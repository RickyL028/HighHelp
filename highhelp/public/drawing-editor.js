/* Handwritten answers for past-paper questions, built on js-draw
 * (MIT, https://github.com/personalizedrefrigerator/js-draw).
 *
 * Each <drawing-field> (src/components/DrawingField.tsx) holds one saved drawing. In Draw mode it mounts a
 * js-draw editor in place of the typed answer; "Full screen" hands the same drawing to an editor covering
 * the page. Drawings autosave as SVG to the field's save URL, and every successful save fires a bubbling
 * `drawing-saved` event from the field. js-draw is only downloaded the first time a drawing opens.
 * window.HighHelpDrawing.flushAll() lets a page wait for pending saves before it swaps content out. */
(function () {
  'use strict';
  if (window.HighHelpDrawing) return;

  const JS_DRAW_SRC = 'https://cdn.jsdelivr.net/npm/js-draw@1.33.0/dist/bundle.js';
  const JS_DRAW_INTEGRITY = 'sha384-A79kcpuOgu83tqJXkIZB+ISAy41ql8kgv5t0OE4HyfaHw5BL9NhZyurfdmjlfsLM';
  // Mirrors DRAWING_MAX_BYTES in src/routes/pastPapers/drawingDoc.ts.
  const MAX_BYTES = 5000000;
  // Save shortly after the pen lifts, but never let more than MAX_WAIT of continuous writing go unsaved.
  const SAVE_DELAY_MS = 2000;
  const SAVE_MAX_WAIT_MS = 15000;
  const RETRY_DELAYS_MS = [3000, 8000, 20000, 60000];
  // New pages share one width so a drawing looks the same on every device; the editor zooms to fit it.
  // Roughly A4 in proportion, and it grows as the student writes past an edge.
  const PAGE_WIDTH = 1000;
  const PAGE_HEIGHT = 1400;
  const PAGE_MARGIN = 60;
  // Writing off the bottom is the common case, so that edge gets a good run of fresh paper, not a sliver.
  const PAGE_EXTEND = 400;
  // Once a pen has been used on this device, a finger pans instead of drawing (palm rejection).
  const PEN_SEEN_KEY = 'drawingPenSeen';
  // Type or Draw, whichever the student last picked on this device.
  const MODE_KEY = 'answerInputMode';

  // js-draw follows the OS colour scheme by default; the site has its own theme switch, so pin the
  // editor's colours to html.dark instead. The page itself stays white paper in both themes.
  const THEME_CSS =
    'html:not(.dark) .imageEditorContainer.imageEditorContainer{--background-color-1:#fff;--background-color-2:#f5f5f5;--background-color-3:#e5e5e5;' +
    '--foreground-color-1:#111827;--foreground-color-2:#1f2937;--foreground-color-3:#111827;--selection-background-color:#bfdbfe;' +
    '--selection-foreground-color:#1e3a8a;--primary-action-foreground-color:#2563eb;--shadow-color:rgba(0,0,0,.3)}' +
    'html.dark .imageEditorContainer.imageEditorContainer{--background-color-1:#171717;--background-color-2:#262626;--background-color-3:#404040;' +
    '--foreground-color-1:#f5f5f5;--foreground-color-2:#e5e5e5;--foreground-color-3:#d4d4d4;--selection-background-color:#1e3a8a;' +
    '--selection-foreground-color:#fff;--primary-action-foreground-color:#60a5fa;--shadow-color:rgba(0,0,0,.6)}';

  let jsDrawLoading = null;
  let themeStyle = null;
  // Every editor currently open, in place or full screen.
  const sessions = new Set();

  function readSetting(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeSetting(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* private mode: the choice just isn't remembered */
    }
  }

  function loadJsDraw() {
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.textContent = THEME_CSS;
      document.head.appendChild(themeStyle);
    }
    if (window.jsdraw) return Promise.resolve(window.jsdraw);
    if (jsDrawLoading) return jsDrawLoading;
    jsDrawLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JS_DRAW_SRC;
      script.integrity = JS_DRAW_INTEGRITY;
      script.crossOrigin = 'anonymous';
      script.onload = () => (window.jsdraw ? resolve(window.jsdraw) : reject(new Error('js-draw did not initialise')));
      script.onerror = () => {
        jsDrawLoading = null;
        script.remove();
        reject(new Error('js-draw failed to load'));
      };
      document.head.appendChild(script);
    });
    return jsDrawLoading;
  }

  /* ---- One editor bound to one saved drawing ---- */

  // Everything the student drew, as an SVG string, or null for an empty page (which deletes the drawing).
  // XMLSerializer rather than outerHTML: the HTML serializer writes &nbsp;, which is not valid XML and
  // would stop the saved file rendering as an image.
  async function serialize(editor) {
    if (editor.image.getAllComponents().length === 0) return null;
    const svg = await editor.toSVGAsync();
    return new XMLSerializer().serializeToString(svg);
  }

  async function send(s, svg) {
    const res = await fetch(s.saveUrl, {
      method: svg === null ? 'DELETE' : 'PUT',
      headers: svg === null ? undefined : { 'Content-Type': 'image/svg+xml' },
      body: svg === null ? undefined : svg,
      credentials: 'same-origin',
      // Browsers cap keepalive bodies at 64 KB; below that, a save started as the tab closes still lands.
      keepalive: svg === null || svg.length < 60000,
    });
    if (!res.ok) {
      const error = new Error('save failed');
      error.status = res.status;
      throw error;
    }
    return res.json();
  }

  function scheduleSave(s, delay) {
    clearTimeout(s.timer);
    if (!s.closed) s.timer = setTimeout(() => flush(s), delay);
  }

  function markDirty(s) {
    if (s.closed) return;
    s.dirty = true;
    if (!s.dirtySince) s.dirtySince = Date.now();
    if (!s.saving) s.setStatus('Unsaved changes');
    scheduleSave(s, Math.max(0, Math.min(SAVE_DELAY_MS, s.dirtySince + SAVE_MAX_WAIT_MS - Date.now())));
  }

  // One request. Resolves true when the server has what was serialised, false when it did not.
  function saveOnce(s) {
    s.dirty = false;
    s.dirtySince = 0;
    s.setStatus('Saving…');
    s.saving = (async () => {
      try {
        const svg = await serialize(s.editor);
        if (svg !== null && new Blob([svg]).size > MAX_BYTES) {
          const error = new Error('too large');
          error.status = 413;
          throw error;
        }
        const result = await send(s, svg);
        s.failures = 0;
        s.blocked = false;
        s.setStatus(s.dirty ? 'Unsaved changes' : 'Saved');
        s.onSaved(result);
        return true;
      } catch (error) {
        s.dirty = true;
        s.failures += 1;
        const status = error && error.status;
        if (status === 413) {
          s.blocked = true;
          s.setStatus('Not saved: this drawing is too large. Remove a pasted image and it will save.');
        } else if (status === 401) {
          s.blocked = true;
          s.setStatus('Not saved: you have been signed out. Sign in again in another tab, then draw to retry.');
        } else {
          s.setStatus('Not saved: retrying…');
          scheduleSave(s, RETRY_DELAYS_MS[Math.min(s.failures - 1, RETRY_DELAYS_MS.length - 1)]);
        }
        return false;
      } finally {
        s.saving = null;
      }
    })();
    return s.saving;
  }

  // Saves until nothing is pending. Resolves true once the server holds the latest drawing.
  async function flush(s) {
    clearTimeout(s.timer);
    if (s.saving) await s.saving;
    if (!s.dirty) return s.failures === 0;
    const ok = await saveOnce(s);
    return ok ? flush(s) : false;
  }

  // The page only ever grows, and only when ink crosses an edge: that edge moves out past the ink, so
  // nothing drawn is cut from the saved image, while writing close to an edge leaves the page alone.
  function growPageToFit(s) {
    const { editor } = s;
    const components = editor.image.getAllComponents();
    if (components.length === 0) return;
    const content = components.reduce((box, component) => box.union(component.getBBox()), components[0].getBBox());
    const page = editor.getImportExportRect();
    if (page.containsRect(content)) return;
    let wanted = page.union(content.grownBy(PAGE_MARGIN));
    if (wanted.y + wanted.h > page.y + page.h) {
      wanted = new window.jsdraw.Rect2(wanted.x, wanted.y, wanted.w, wanted.h + PAGE_EXTEND);
    }
    editor.dispatchNoAnnounce(editor.image.setImportExportRect(wanted), false);
  }

  // Shows the full width of the page, starting from its top edge. False if the editor has no size yet.
  // Sets the transform directly: js-draw's zoomTo leaves the zoom alone whenever the target already fills
  // between a third and four fifths of the view, which left the page at half the editor's width.
  function fitPageWidth(editor) {
    const { Mat33, Vec2 } = window.jsdraw;
    const page = editor.getImportExportRect();
    const screen = editor.viewport.getScreenRectSize();
    if (!screen.x || !screen.y) return false;
    // A slim margin keeps the page edge visible, so it reads as a sheet of paper.
    const margin = Math.min(24, screen.x * 0.03);
    const scale = (screen.x - 2 * margin) / page.w;
    editor.viewport.resetTransform(Mat33.translation(Vec2.of(margin - page.x * scale, margin - page.y * scale)).rightMul(Mat33.scaling2D(scale)));
    editor.queueRerender();
    return true;
  }

  function enableFingerPanning(editor) {
    const { PanZoomTool, PanZoomMode } = window.jsdraw;
    editor.toolController.getMatchingTools(PanZoomTool).forEach((tool) => {
      // Only the touch tool: the toolbar's hand tool and the keyboard tool have their own jobs.
      if (tool.getMode() & PanZoomMode.TwoFingerTouchGestures) tool.setModeEnabled(PanZoomMode.OneFingerTouchGestures, true);
    });
  }

  function createEditor(host, jsdraw) {
    const editor = new jsdraw.Editor(host, { wheelEventsEnabled: 'only-if-focused' });
    editor.getRootElement().style.height = '100%';
    // js-draw's default pens are purple and clay; answers read better in black and blue.
    const pens = editor.toolController.getMatchingTools(jsdraw.PenTool);
    if (pens[0]) pens[0].setColor(jsdraw.Color4.fromHex('#111827'));
    if (pens[1]) pens[1].setColor(jsdraw.Color4.fromHex('#1d4ed8'));
    if (readSetting(PEN_SEEN_KEY) === '1') enableFingerPanning(editor);
    editor.addToolbar();
    return editor;
  }

  function startNewPage(editor, jsdraw) {
    editor.dispatchNoAnnounce(editor.image.setImportExportRect(new jsdraw.Rect2(0, 0, PAGE_WIDTH, PAGE_HEIGHT)), false);
    editor.dispatchNoAnnounce(
      editor.setBackgroundStyle({ color: jsdraw.Color4.white, type: jsdraw.BackgroundComponentBackgroundType.Grid, autoresize: false }),
      false,
    );
  }

  // Mounts an editor inside `host` with the saved drawing loaded. Resolves to the session, or null if the
  // tools or the drawing could not be loaded (`setStatus` has said why).
  async function openSession({ host, svgUrl, saveUrl, setStatus, onSaved }) {
    setStatus('Loading…');
    let jsdraw;
    try {
      jsdraw = await loadJsDraw();
    } catch (e) {
      setStatus("Couldn't load the drawing tools. Check your connection and try again.");
      return null;
    }
    const s = {
      host,
      svgUrl,
      saveUrl,
      setStatus,
      onSaved,
      editor: createEditor(host, jsdraw),
      fitted: false,
      dirty: false,
      dirtySince: 0,
      saving: null,
      timer: null,
      failures: 0,
      blocked: false,
      closed: false,
      onPointerDown: null,
    };
    // Read-only until the saved drawing is in, so nothing drawn early can be lost or overwrite it.
    s.editor.setReadOnly(true);
    let existed = false;
    try {
      const res = await fetch(svgUrl, { cache: 'no-cache', credentials: 'same-origin' });
      // 204: nothing drawn yet.
      if (res.status === 204) {
        startNewPage(s.editor, jsdraw);
      } else if (!res.ok) {
        throw new Error('load failed: ' + res.status);
      } else {
        await s.editor.loadFromSVG(await res.text(), true);
        existed = true;
      }
    } catch (e) {
      // An editor opened now would save a blank page over the stored drawing, so don't open one at all.
      s.editor.remove();
      setStatus("Couldn't open your saved drawing. Try again in a moment.");
      return null;
    }
    requestAnimationFrame(() => {
      s.fitted = fitPageWidth(s.editor);
    });
    s.editor.setReadOnly(false);
    setStatus(existed ? 'Saved' : 'Draw your answer. It saves automatically.');

    // Fired only for changes that enter the undo history (ink, erasing, moving, text, images), never for
    // panning, zooming or the page resizes above, so looking around does not trigger a save.
    const { EditorEventType } = jsdraw;
    const onChange = () => {
      growPageToFit(s);
      markDirty(s);
    };
    s.editor.notifier.on(EditorEventType.CommandDone, onChange);
    s.editor.notifier.on(EditorEventType.CommandUndone, onChange);
    s.onPointerDown = (event) => {
      if (event.pointerType !== 'pen' || readSetting(PEN_SEEN_KEY) === '1') return;
      writeSetting(PEN_SEEN_KEY, '1');
      enableFingerPanning(s.editor);
    };
    host.addEventListener('pointerdown', s.onPointerDown, true);
    sessions.add(s);
    return s;
  }

  function destroySession(s) {
    s.closed = true;
    clearTimeout(s.timer);
    sessions.delete(s);
    s.host.removeEventListener('pointerdown', s.onPointerDown, true);
    s.editor.remove();
  }

  // Ends a session, saving anything still pending on the way out. Resolves false if that save failed.
  async function closeSession(s) {
    if (s.closed) return true;
    const ok = await flush(s);
    destroySession(s);
    return ok;
  }

  window.addEventListener('beforeunload', (event) => {
    let pending = false;
    sessions.forEach((s) => {
      if (s.dirty || s.saving) {
        pending = true;
        flush(s);
      }
    });
    if (pending) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sessions.forEach((s) => flush(s));
  });

  // An editor in the page sits inside the answer form. js-draw's buttons are all type="button", but Enter
  // in one of its text inputs would still submit the form through its first submit button (which can be
  // "Revert"). Cancelling the key's default stops that without hiding the key from js-draw.
  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;
      if (event.key === 'Enter' && target instanceof HTMLInputElement && target.closest('[data-drawing-host]')) event.preventDefault();
    },
    true,
  );

  /* ---- Full screen ---- */

  function buildOverlay(title) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex flex-col bg-white dark:bg-neutral-950';
    overlay.style.overscrollBehavior = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-neutral-800">' +
      '<button type="button" data-drawing-done class="shrink-0 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">Done</button>' +
      '<div class="min-w-0 flex-1">' +
      '<div data-drawing-title class="text-sm font-bold text-gray-900 dark:text-neutral-100 truncate"></div>' +
      '<div data-drawing-status class="text-xs text-gray-500 dark:text-neutral-400 truncate" aria-live="polite"></div>' +
      '</div>' +
      '<button type="button" data-drawing-question-toggle aria-expanded="false" class="shrink-0 hidden text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline">Show question</button>' +
      '</div>' +
      '<div data-drawing-question class="shrink-0 hidden max-h-[40vh] overflow-y-auto p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900"></div>' +
      '<div data-drawing-surface class="relative flex-1 min-h-0"></div>';
    overlay.setAttribute('aria-label', title);
    overlay.querySelector('[data-drawing-title]').textContent = title;
    return overlay;
  }

  // Copies the question (and stimulus) the page is showing into the fold-down panel, minus anything
  // interactive: a cloned radio would otherwise look like it changes the real answer.
  function fillQuestionPanel(panel, selector) {
    if (!selector) return false;
    const sources = document.querySelectorAll(selector);
    sources.forEach((source) => {
      const copy = source.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copy.querySelectorAll('input, textarea, select, button, drawing-field').forEach((el) => el.remove());
      panel.appendChild(copy);
    });
    return sources.length > 0;
  }

  // A dialog over the whole page with its own editor for the drawing. Resolves once it has closed.
  function openFullScreen({ svgUrl, saveUrl, title, questionSource, onSaved }) {
    return new Promise((resolve) => {
      const overlay = buildOverlay(title);
      const statusEl = overlay.querySelector('[data-drawing-status]');
      const previousOverflow = document.documentElement.style.overflow;
      let session = null;
      let state = 'open';

      const close = async (fromHistory) => {
        if (state !== 'open') return;
        state = 'closing';
        if (session) {
          statusEl.textContent = 'Saving…';
          const ok = await flush(session);
          if (!ok && !window.confirm('Your latest changes have not been saved. Close the drawing anyway?')) {
            state = 'open';
            // The Back press already popped our history entry; put it back so Back still closes the editor.
            if (fromHistory) history.pushState({ highhelpDrawing: true }, '');
            return;
          }
          destroySession(session);
        }
        state = 'closed';
        window.removeEventListener('popstate', onPopState);
        overlay.remove();
        document.documentElement.style.overflow = previousOverflow;
        if (!fromHistory) history.back();
        resolve();
      };
      const onPopState = () => close(true);

      const panel = overlay.querySelector('[data-drawing-question]');
      const toggle = overlay.querySelector('[data-drawing-question-toggle]');
      if (fillQuestionPanel(panel, questionSource)) {
        toggle.classList.remove('hidden');
        toggle.addEventListener('click', () => {
          const show = panel.classList.contains('hidden');
          panel.classList.toggle('hidden', !show);
          toggle.textContent = show ? 'Hide question' : 'Show question';
          toggle.setAttribute('aria-expanded', String(show));
          // The drawing area just changed size; js-draw re-measures on resize.
          window.dispatchEvent(new Event('resize'));
        });
      }
      overlay.querySelector('[data-drawing-done]').addEventListener('click', () => close(false));

      document.body.appendChild(overlay);
      document.documentElement.style.overflow = 'hidden';
      // Back (or an iPad edge swipe) closes full screen instead of leaving the question.
      history.pushState({ highhelpDrawing: true }, '');
      window.addEventListener('popstate', onPopState);
      overlay.querySelector('[data-drawing-done]').focus();

      openSession({
        host: overlay.querySelector('[data-drawing-surface]'),
        svgUrl,
        saveUrl,
        setStatus: (text) => {
          statusEl.textContent = text;
        },
        onSaved,
      }).then((s) => {
        if (!s) return;
        // Closed while it was still loading.
        if (state === 'closed') closeSession(s);
        else session = s;
      });
    });
  }

  /* ---- <drawing-field>: Type | Draw in the page ---- */

  // Kept in step with PREVIEW_CLASS in src/components/DrawingField.tsx.
  const PREVIEW_CLASS = 'absolute inset-0 w-full h-full object-cover object-top bg-white pointer-events-none';

  // On a page of many questions ('tap' fields) only one editor is live at a time; this is it.
  let activeTapField = null;

  // A live 'tap' editor that scrolls well out of view goes back to being a picture, so a long page never
  // holds on to an editor (and its canvases) that nobody is looking at.
  const farAway = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.target === activeTapField) entry.target.deactivate();
      });
    },
    { rootMargin: '50% 0px' },
  );

  class DrawingField extends HTMLElement {
    // Nothing happens before connectedCallback: pages parse fragments into detached elements (attempt.tsx's
    // swap()), and only a field that is actually on the page should load anything.
    connectedCallback() {
      if (!this.handleClick) this.handleClick = this.onClick.bind(this);
      this.addEventListener('click', this.handleClick);
      this.tap = this.dataset.activation === 'tap';
      this.version = this.dataset.version || null;
      if (this.tap) farAway.observe(this);
      let mode = this.dataset.mode || 'type';
      if (mode === 'auto') mode = readSetting(MODE_KEY) === 'draw' ? 'draw' : 'type';
      this.setMode(mode, false);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.handleClick);
      if (this.tap) farAway.unobserve(this);
      if (activeTapField === this) activeTapField = null;
      const s = this.session;
      this.session = null;
      if (s) closeSession(s);
    }

    part(name) {
      return this.querySelector('[data-drawing-' + name + ']');
    }

    status(text) {
      const el = this.part('status');
      if (el) el.textContent = text;
    }

    // While an editor is mounted it fills the box. Otherwise the box shows the saved drawing as a picture
    // and, for 'tap' fields, the button to start writing.
    showEditor(live) {
      let preview = this.part('preview');
      if (!live && this.version) {
        if (!preview) {
          preview = document.createElement('img');
          preview.setAttribute('data-drawing-preview', '');
          preview.alt = 'Your handwritten answer';
          preview.className = PREVIEW_CLASS;
          this.part('host').prepend(preview);
        }
        const url = this.dataset.svgUrl;
        const src = url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(this.version);
        if (preview.getAttribute('src') !== src) preview.src = src;
      }
      if (preview) preview.classList.toggle('hidden', live || !this.version);
      const activate = this.part('activate');
      if (activate) activate.classList.toggle('hidden', live);
      const deactivate = this.part('deactivate');
      if (deactivate) deactivate.classList.toggle('hidden', !live);
    }

    setMode(mode, remember) {
      this.mode = mode;
      const drawing = mode === 'draw';
      const typePanel = this.part('type-panel');
      const drawPanel = this.part('draw-panel');
      if (typePanel) typePanel.classList.toggle('hidden', drawing);
      if (drawPanel) drawPanel.classList.toggle('hidden', !drawing);
      this.querySelectorAll('[data-drawing-mode]').forEach((button) => {
        const active = button.getAttribute('data-drawing-mode') === mode;
        button.setAttribute('data-active', String(active));
        button.setAttribute(button.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-expanded', String(active));
      });
      if (remember && this.dataset.variant === 'answer') writeSetting(MODE_KEY, mode);

      if (!drawing) {
        // A live field keeps its editor so switching back is instant; a 'tap' field gives it up.
        if (this.tap) this.deactivate();
        else if (this.session) flush(this.session);
      } else if (this.session) {
        // The editor was hidden; let it re-measure, and fit the page if it never could.
        const s = this.session;
        window.dispatchEvent(new Event('resize'));
        if (!s.fitted) {
          requestAnimationFrame(() => {
            if (!s.closed) s.fitted = fitPageWidth(s.editor);
          });
        }
      } else if (this.tap) {
        this.showEditor(false);
      } else {
        this.mount();
      }
    }

    onClick(event) {
      const target = event.target;
      if (!target || !target.closest) return;
      const modeButton = target.closest('[data-drawing-mode]');
      if (modeButton && this.contains(modeButton)) {
        event.preventDefault();
        // The working pad has a single button that both opens and closes it.
        const picked = modeButton.getAttribute('data-drawing-mode');
        this.setMode(this.dataset.variant === 'working' && this.mode === 'draw' ? 'closed' : picked, true);
        if (this.mode === 'type') {
          const textarea = this.querySelector('textarea');
          if (textarea) textarea.focus();
        }
        return;
      }
      if (target.closest('[data-drawing-activate]')) {
        event.preventDefault();
        this.activate();
      } else if (target.closest('[data-drawing-deactivate]')) {
        event.preventDefault();
        this.deactivate();
      } else if (target.closest('[data-drawing-fullscreen]')) {
        event.preventDefault();
        this.fullScreen();
      }
    }

    // Resolves true once an editor is live in the box.
    async mount() {
      if (this.session || this.mounting || this.inFullScreen) return false;
      this.mounting = true;
      const ticket = (this.ticket = (this.ticket || 0) + 1);
      this.showEditor(false);
      const s = await openSession({
        host: this.part('host'),
        svgUrl: this.dataset.svgUrl,
        saveUrl: this.dataset.saveUrl,
        setStatus: (text) => this.status(text),
        onSaved: (result) => this.saved(result),
      });
      this.mounting = false;
      if (!s) return false;
      // Removed from the page, or put away, while it was still loading.
      if (!this.isConnected || ticket !== this.ticket) {
        closeSession(s);
        return false;
      }
      this.session = s;
      this.showEditor(true);
      return true;
    }

    // 'tap' fields: make this the one live editor on the page, putting the previous one away first.
    async activate() {
      if (this.session || this.mounting) return;
      if (activeTapField && activeTapField !== this) await activeTapField.deactivate();
      activeTapField = this;
      if (!(await this.mount()) && activeTapField === this) activeTapField = null;
    }

    // Saves and closes the editor, leaving the drawing as a picture the page can scroll over.
    async deactivate() {
      if (activeTapField === this) activeTapField = null;
      this.ticket = (this.ticket || 0) + 1;
      const s = this.session;
      this.session = null;
      if (s) await closeSession(s);
      if (this.isConnected) this.showEditor(false);
    }

    saved(result) {
      this.version = result.updated_at || null;
      if (this.version) this.dataset.version = this.version;
      else delete this.dataset.version;
      this.dispatchEvent(new CustomEvent('drawing-saved', { bubbles: true, detail: { svgUrl: this.dataset.svgUrl, version: this.version } }));
    }

    // One editor per drawing at a time: the in-page editor saves and steps aside, then (for a live field)
    // is rebuilt from the saved copy once full screen closes.
    async fullScreen() {
      if (this.inFullScreen || this.mounting) return;
      if (this.session) {
        this.status('Saving…');
        const ok = await flush(this.session);
        if (!ok && !window.confirm('Your latest changes have not been saved. Open full screen anyway?')) return;
        destroySession(this.session);
        this.session = null;
      }
      if (activeTapField === this) activeTapField = null;
      this.inFullScreen = true;
      this.showEditor(false);
      this.status('Open in full screen');
      await openFullScreen({
        svgUrl: this.dataset.svgUrl,
        saveUrl: this.dataset.saveUrl,
        title: this.dataset.title || 'Your answer',
        questionSource: this.dataset.questionSource,
        onSaved: (result) => this.saved(result),
      });
      this.inFullScreen = false;
      this.status('');
      if (!this.isConnected) return;
      this.showEditor(false);
      if (this.mode === 'draw' && !this.tap) this.mount();
    }
  }

  if (!customElements.get('drawing-field')) customElements.define('drawing-field', DrawingField);

  window.HighHelpDrawing = {
    // Resolves true once every open drawing is saved, false if one could not be.
    flushAll: () => Promise.all(Array.from(sessions, (s) => flush(s))).then((results) => results.every(Boolean)),
  };
})();
