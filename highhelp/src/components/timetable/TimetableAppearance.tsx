import { html, raw } from 'hono/html'
import { THEME_PREVIEWS } from '../../themes'

// The Appearance block of the Config tab. Everything is stored in localStorage and applied by
// window.__ttAppearance (src/themes.ts); nothing here needs the Save button.
// The script is a String.raw constant so regexes and quotes survive hono's `html` helper untouched.

const LABEL = 'text-xs font-semibold text-gray-700 dark:text-neutral-300';
const HINT = 'text-[11px] text-gray-400 dark:text-neutral-500';
const SEG_WRAP = 'inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5 gap-0.5';
const SEG_BTN = 'ap-seg px-3 py-1 rounded-md text-xs font-semibold transition-colors';
const FIELD = 'text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 transition';
const SMALL_BTN = 'px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors';

const SCRIPT = String.raw`
(function () {
    var AP = window.__ttAppearance;
    var section = document.getElementById('appearance-section');
    if (!AP || !section) return;

    var PREVIEWS = __PREVIEWS__;
    var ACCENTS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
    var BG_COLORS = ['#0f172a', '#1c1917', '#14251b', '#2a1533', '#fef3c7', '#e0f2fe', '#ecfdf5', '#fce7f3'];
    var SEG_ON = ['bg-red-500', 'text-white'];
    var SEG_OFF = ['text-gray-500', 'dark:text-neutral-400', 'hover:text-gray-700', 'dark:hover:text-neutral-200'];
    var TILE_ON = ['border-red-500'];
    var TILE_OFF = ['border-gray-200', 'dark:border-neutral-700'];
    var $ = function (id) { return document.getElementById(id); };

    function state() {
        var a = AP.read();
        if (!a.bg || typeof a.bg !== 'object') a.bg = {};
        return a;
    }
    // redraw: also re-render the timetable views (only theme and mode change what they draw).
    function commit(a, redraw) {
        if (a) localStorage.setItem('timetableAppearance', JSON.stringify(a));
        AP.apply();
        if (redraw) window.dispatchEvent(new CustomEvent('timetableThemeChanged'));
        else paint();
    }
    function mode() { return document.documentElement.classList.contains('dark') ? 'dark' : 'light'; }
    function theme() {
        var t = localStorage.getItem('timetableTheme');
        return AP.themes.indexOf(t) >= 0 ? t : 'system';
    }
    function swap(el, on, onClasses, offClasses) {
        (on ? offClasses : onClasses).forEach(function (c) { el.classList.remove(c); });
        (on ? onClasses : offClasses).forEach(function (c) { el.classList.add(c); });
    }
    function status(text, isError) {
        var el = $('ap-bg-status');
        el.textContent = text || '';
        el.classList.toggle('hidden', !text);
        el.classList.toggle('text-red-500', !!isError);
    }

    function tileHtml(p, m) {
        var c = p[m];
        var bar = function (top, strip) {
            return '<div style="position:absolute;left:10px;right:10px;top:' + top + 'px;height:10px;border-radius:3px;border:1px solid ' + c.line + ';'
                + (p.filled ? 'background:' + strip : 'background:' + c.card + ';border-left:3px solid ' + strip) + '"></div>';
        };
        return '<button type="button" data-theme="' + p.id + '" class="ap-tile text-left rounded-xl border-2 p-1.5 transition-colors">'
            + '<div style="position:relative;height:64px;border-radius:8px;overflow:hidden;background:' + c.bg + ';border:1px solid ' + c.line + '">'
            + '<div style="position:absolute;left:10px;right:10px;top:9px;height:14px;border-radius:4px;background:' + c.card + ';border:1px solid ' + c.line + '">'
            + '<div style="position:absolute;right:5px;top:4px;width:22px;height:4px;border-radius:2px;background:' + c.accent + '"></div>'
            + '<div style="position:absolute;left:5px;top:4px;width:30px;height:4px;border-radius:2px;background:' + c.text + ';opacity:.75"></div></div>'
            + bar(30, '#4F86C6') + bar(45, '#E0A23B')
            + '</div><div class="mt-1.5 px-0.5 text-xs font-semibold text-gray-800 dark:text-neutral-200">' + p.label + '</div></button>';
    }

    function swatch(color, group, label) {
        return '<button type="button" data-' + group + '="' + color + '" title="' + (label || color) + '" aria-label="' + (label || color) + '" '
            + 'class="ap-swatch w-6 h-6 rounded-full border border-gray-200 dark:border-neutral-700 flex-shrink-0" style="background:' + color + '"></button>';
    }
    function markSwatches(group, value) {
        section.querySelectorAll('[data-' + group + ']').forEach(function (b) {
            var on = (b.getAttribute('data-' + group) || '').toLowerCase() === (value || '').toLowerCase();
            b.style.boxShadow = on ? '0 0 0 2px var(--t-pop, #fff), 0 0 0 4px currentColor' : '';
        });
    }

    function paint() {
        var a = state(), m = mode(), t = theme();
        section.querySelectorAll('#ap-mode [data-mode]').forEach(function (b) { swap(b, b.getAttribute('data-mode') === m, SEG_ON, SEG_OFF); });

        $('ap-themes').innerHTML = PREVIEWS.map(function (p) { return tileHtml(p, m); }).join('');
        section.querySelectorAll('.ap-tile').forEach(function (b) { swap(b, b.getAttribute('data-theme') === t, TILE_ON, TILE_OFF); });

        markSwatches('accent', a.accent || 'auto');
        $('ap-accent-custom').value = AP.rgb(a.accent) ? a.accent : '#ef4444';

        var type = a.bg.type === 'color' || a.bg.type === 'image' ? a.bg.type : 'none';
        section.querySelectorAll('#ap-bg-type [data-bg]').forEach(function (b) { swap(b, b.getAttribute('data-bg') === type, SEG_ON, SEG_OFF); });
        $('ap-bg-color').classList.toggle('hidden', type !== 'color');
        $('ap-bg-image').classList.toggle('hidden', type !== 'image');
        $('ap-bg-scope-row').classList.toggle('hidden', type === 'none');
        $('ap-bg-scope').value = a.bg.scope === 'site' ? 'site' : 'timetable';

        var col = AP.rgb(a.bg.color);
        markSwatches('bgcolor', a.bg.color || '');
        if (col) $('ap-bg-color-custom').value = a.bg.color;
        var hint = $('ap-bg-hint');
        var b = col && type === 'color' ? AP.brightness(col) : null;
        var want = b === null ? null : (b < 110 && m === 'light' ? 'dark' : (b > 170 && m === 'dark' ? 'light' : null));
        hint.classList.toggle('hidden', !want);
        if (want) {
            hint.querySelector('span').textContent = 'This colour is ' + (want === 'dark' ? 'dark' : 'light') + ', so text may be hard to read. ';
            hint.querySelector('button').textContent = 'Switch to ' + want + ' mode';
            hint.querySelector('button').setAttribute('data-mode-fix', want);
        }

        var img = AP.image();
        var thumb = $('ap-bg-thumb');
        thumb.style.backgroundImage = img ? 'url("' + img + '")' : '';
        thumb.textContent = img ? '' : 'No image';
        $('ap-bg-remove').classList.toggle('hidden', !img);
        $('ap-bg-sliders').classList.toggle('hidden', !img);
        var dim = isFinite(Number(a.bg.dim)) && a.bg.dim !== undefined ? Number(a.bg.dim) : 55;
        var blur = isFinite(Number(a.bg.blur)) && a.bg.blur !== undefined ? Number(a.bg.blur) : 0;
        $('ap-bg-dim').value = dim; $('ap-bg-dim-val').textContent = dim + '%';
        $('ap-bg-blur').value = blur; $('ap-bg-blur-val').textContent = blur + 'px';

        var ca = isFinite(Number(a.cardOpacity)) && a.cardOpacity ? Number(a.cardOpacity) : 100;
        $('ap-cards').value = ca; $('ap-cards-val').textContent = ca + '%';
        $('ap-font').value = a.font || '';
    }

    // A clearly dark or light colour also flips the mode, so text stays readable on it.
    function pickBgColor(value) {
        var a = state(), c = AP.rgb(value);
        if (!c) return;
        a.bg.color = value;
        var b = AP.brightness(c), want = b < 110 ? 'dark' : (b > 170 ? 'light' : null);
        if (want && want !== mode()) {
            localStorage.setItem('theme', want);
            commit(a, true);
        } else {
            commit(a);
        }
    }

    function useImage(value) {
        try { localStorage.setItem('timetableBgImage', value); }
        catch (e) { status('That image is too large to save on this device. Try a smaller one.', true); return; }
        var a = state();
        a.bg.type = 'image';
        status('');
        commit(a);
    }

    // Uploaded images are shrunk to a JPEG that fits comfortably in localStorage.
    function loadImageFile(file) {
        if (!file || !/^image\//.test(file.type)) { status('Choose an image file.', true); return; }
        status('Preparing image...');
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(url);
            var max = 1920, quality = 0.82, data = '';
            for (var i = 0; i < 6; i++) {
                var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                data = canvas.toDataURL('image/jpeg', quality);
                if (data.length < 900000) break;
                max = Math.round(max * 0.8);
                quality -= 0.06;
            }
            useImage(data);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            status('That image could not be read. Try a JPEG or PNG.', true);
        };
        img.src = url;
    }

    $('ap-accents').innerHTML = '<button type="button" data-accent="auto" title="Theme default" aria-label="Theme default" '
        + 'class="ap-swatch w-6 h-6 rounded-full border border-gray-300 dark:border-neutral-600 flex-shrink-0 text-[9px] font-bold text-gray-500 dark:text-neutral-400">A</button>'
        + ACCENTS.map(function (c) { return swatch(c, 'accent'); }).join('');
    $('ap-bg-swatches').innerHTML = BG_COLORS.map(function (c) { return swatch(c, 'bgcolor'); }).join('');

    section.addEventListener('click', function (e) {
        var el = e.target.closest('button');
        if (!el || !section.contains(el)) return;
        var a = state();
        if (el.hasAttribute('data-mode') || el.hasAttribute('data-mode-fix')) {
            localStorage.setItem('theme', el.getAttribute('data-mode') || el.getAttribute('data-mode-fix'));
            commit(null, true);
        } else if (el.hasAttribute('data-theme')) {
            var t = el.getAttribute('data-theme');
            if (t === 'system') localStorage.removeItem('timetableTheme');
            else localStorage.setItem('timetableTheme', t);
            commit(null, true);
        } else if (el.hasAttribute('data-accent')) {
            var acc = el.getAttribute('data-accent');
            if (acc === 'auto') delete a.accent; else a.accent = acc;
            commit(a);
        } else if (el.hasAttribute('data-bg')) {
            a.bg.type = el.getAttribute('data-bg');
            if (a.bg.type === 'color' && !AP.rgb(a.bg.color)) a.bg.color = mode() === 'dark' ? '#0f172a' : '#e0f2fe';
            commit(a);
        } else if (el.hasAttribute('data-bgcolor')) {
            pickBgColor(el.getAttribute('data-bgcolor'));
        } else if (el.id === 'ap-bg-pick') {
            $('ap-bg-file').click();
        } else if (el.id === 'ap-bg-url-use') {
            var v = $('ap-bg-url').value.trim();
            if (!/^https:\/\/[^\s"\\]+$/i.test(v)) { status('Paste a full image link starting with https://', true); return; }
            useImage(v);
        } else if (el.id === 'ap-bg-remove') {
            localStorage.removeItem('timetableBgImage');
            $('ap-bg-url').value = '';
            a.bg.type = 'none';
            status('');
            commit(a);
        } else if (el.id === 'ap-reset') {
            localStorage.removeItem('timetableAppearance');
            localStorage.removeItem('timetableBgImage');
            $('ap-bg-url').value = '';
            status('');
            commit(null);
        }
    });

    $('ap-bg-file').addEventListener('change', function (e) {
        loadImageFile(e.target.files && e.target.files[0]);
        e.target.value = '';
    });
    $('ap-accent-custom').addEventListener('input', function (e) { var a = state(); a.accent = e.target.value; commit(a); });
    $('ap-bg-color-custom').addEventListener('input', function (e) { pickBgColor(e.target.value); });
    $('ap-bg-dim').addEventListener('input', function (e) { var a = state(); a.bg.dim = Number(e.target.value); commit(a); });
    $('ap-bg-blur').addEventListener('input', function (e) { var a = state(); a.bg.blur = Number(e.target.value); commit(a); });
    $('ap-bg-scope').addEventListener('change', function (e) { var a = state(); a.bg.scope = e.target.value; commit(a); });
    $('ap-cards').addEventListener('input', function (e) {
        var a = state(), v = Number(e.target.value);
        if (v >= 100) delete a.cardOpacity; else a.cardOpacity = v;
        commit(a);
    });
    $('ap-font').addEventListener('change', function (e) {
        var a = state();
        if (e.target.value) a.font = e.target.value; else delete a.font;
        commit(a);
    });

    // Mode or theme changed here or from the nav toggle: redraw the tiles in the new palette.
    window.addEventListener('timetableThemeChanged', paint);
    paint();
})();
`.replace('__PREVIEWS__', JSON.stringify(THEME_PREVIEWS));

export const TimetableAppearance = html`
        <div class="py-5" id="appearance-section">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Appearance</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Pick a theme, then make it yours. Changes apply straight away and stay on this device.</p>
                </div>
                <button id="ap-reset" type="button" class="flex-shrink-0 ${SMALL_BTN}">Reset customisation</button>
            </div>

            <div class="flex items-center justify-between gap-3 mb-3">
                <span class="${LABEL}">Mode</span>
                <div id="ap-mode" class="${SEG_WRAP}">
                    <button type="button" data-mode="light" class="${SEG_BTN}">Light</button>
                    <button type="button" data-mode="dark" class="${SEG_BTN}">Dark</button>
                </div>
            </div>

            <div id="ap-themes" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5"></div>

            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div>
                        <div class="${LABEL}">Accent colour</div>
                        <div class="${HINT}">Buttons, the active tab and highlights. A keeps the theme's own.</div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap sm:justify-end text-red-500">
                        <div id="ap-accents" class="flex items-center gap-1.5 flex-wrap sm:justify-end"></div>
                        <input id="ap-accent-custom" type="color" title="Custom accent" aria-label="Custom accent colour" class="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                    </div>
                </div>

                <div>
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        <div>
                            <div class="${LABEL}">Background</div>
                            <div class="${HINT}">Use the theme's, a colour of your own, or a picture.</div>
                        </div>
                        <div id="ap-bg-type" class="self-start sm:self-auto ${SEG_WRAP}">
                            <button type="button" data-bg="none" class="${SEG_BTN}">Theme</button>
                            <button type="button" data-bg="color" class="${SEG_BTN}">Colour</button>
                            <button type="button" data-bg="image" class="${SEG_BTN}">Image</button>
                        </div>
                    </div>

                    <div id="ap-bg-color" class="hidden mt-3">
                        <div class="flex items-center gap-1.5 flex-wrap text-red-500">
                            <div id="ap-bg-swatches" class="flex items-center gap-1.5 flex-wrap"></div>
                            <input id="ap-bg-color-custom" type="color" title="Custom background" aria-label="Custom background colour" class="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                        </div>
                        <p id="ap-bg-hint" class="hidden ${HINT} mt-2"><span></span><button type="button" class="underline font-semibold text-red-500"></button></p>
                    </div>

                    <div id="ap-bg-image" class="hidden mt-3 space-y-3">
                        <div class="flex items-center gap-3">
                            <div id="ap-bg-thumb" class="w-24 h-14 flex-shrink-0 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 bg-cover bg-center flex items-center justify-center ${HINT}"></div>
                            <div class="flex flex-wrap gap-2">
                                <button id="ap-bg-pick" type="button" class="${SMALL_BTN}">Choose image</button>
                                <button id="ap-bg-remove" type="button" class="hidden ${SMALL_BTN}">Remove</button>
                                <input id="ap-bg-file" type="file" accept="image/*" class="hidden" />
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <input id="ap-bg-url" type="url" inputmode="url" placeholder="or paste an image link (https://...)" class="flex-1 min-w-0 ${FIELD}" />
                            <button id="ap-bg-url-use" type="button" class="flex-shrink-0 ${SMALL_BTN}">Use link</button>
                        </div>
                        <p id="ap-bg-status" class="hidden ${HINT}"></p>
                        <div id="ap-bg-sliders" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            <label class="block">
                                <span class="flex justify-between ${LABEL}"><span>Dim</span><span id="ap-bg-dim-val" class="font-normal"></span></span>
                                <input id="ap-bg-dim" type="range" min="0" max="90" step="5" class="w-full accent-red-500" />
                            </label>
                            <label class="block">
                                <span class="flex justify-between ${LABEL}"><span>Blur</span><span id="ap-bg-blur-val" class="font-normal"></span></span>
                                <input id="ap-bg-blur" type="range" min="0" max="24" step="2" class="w-full accent-red-500" />
                            </label>
                        </div>
                    </div>

                    <div id="ap-bg-scope-row" class="hidden mt-3 flex items-center justify-between gap-3">
                        <span class="${LABEL}">Show it on</span>
                        <select id="ap-bg-scope" class="${FIELD}">
                            <option value="timetable">Timetable only</option>
                            <option value="site">Every page</option>
                        </select>
                    </div>
                </div>

                <label class="block">
                    <span class="flex justify-between ${LABEL}"><span>Card opacity</span><span id="ap-cards-val" class="font-normal"></span></span>
                    <span class="block ${HINT} mb-1">Lower it to let your background show through the class cards.</span>
                    <input id="ap-cards" type="range" min="20" max="100" step="5" class="w-full accent-red-500" />
                </label>

                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="${LABEL}">Font</div>
                        <div class="${HINT}">Overrides the theme's typeface.</div>
                    </div>
                    <select id="ap-font" class="${FIELD}">
                        <option value="">Theme default</option>
                        <option value="sans">Sans (Inter)</option>
                        <option value="rounded">Rounded</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Monospace</option>
                    </select>
                </div>
            </div>
        </div>
`

export const TimetableAppearanceScript = html`<script>${raw(SCRIPT)}</script>`
