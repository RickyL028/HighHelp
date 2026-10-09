import type { Child } from 'hono/jsx'
import { withDrawingVersion } from '../routes/pastPapers/drawingDoc'

// Handwritten answers. Each <drawing-field> holds one saved drawing; public/drawing-editor.js (loaded through
// Layout's `drawing` prop) mounts the js-draw editor inside it, autosaves to `saveUrl`, and handles the
// Type/Draw switch and full-screen mode. The server only decides which state the field opens in.
export type DrawingFieldProps = {
    svgUrl: string
    saveUrl: string
    // answer_drawings.updated_at, or null when nothing has been drawn
    version: string | null
    // Shown in the full-screen editor's top bar
    title: string
    // Selector for the question content the full-screen editor can fold down while drawing
    questionSource?: string
}

// 'live': the editor opens as soon as Draw is chosen (a page with one question).
// 'tap': the drawing shows as a picture until tapped, and only one is live at a time (a page of many
// questions, where live editors would swallow the touches needed to scroll).
export type DrawingActivation = 'live' | 'tap'

const PenIcon = ({ size = 14 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
)

const KeyboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4" /></svg>
)

const ExpandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
)

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
)

const ChevronIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="transition-transform group-aria-expanded:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
)

const fieldData = ({ svgUrl, saveUrl, version, title, questionSource }: DrawingFieldProps, activation: DrawingActivation) => ({
    'data-svg-url': svgUrl,
    'data-save-url': saveUrl,
    'data-version': version ?? undefined,
    'data-title': title,
    'data-question-source': questionSource,
    'data-activation': activation
})

// Kept in step with PREVIEW_CLASS in public/drawing-editor.js, which creates this image after a first save.
const PREVIEW_CLASS = 'absolute inset-0 w-full h-full object-cover object-top bg-white pointer-events-none'

// The box's height follows its state (set here, then by the script): a live editor gets room to write,
// a saved drawing shows its top as a picture, and an empty 'tap' box is just a prompt.
const HOST_CLASS = [
    'group relative overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900',
    '[background-image:radial-gradient(#d4d4d8_1px,transparent_1px)] dark:[background-image:radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:18px_18px]',
    'data-[state=live]:h-[60vh] data-[state=live]:min-h-[22rem] data-[state=live]:max-h-[48rem] data-[state=preview]:h-[22rem] data-[state=empty]:h-44'
].join(' ')

// Kept in step with STATUS_TONES in public/drawing-editor.js: a dot that says how the save is going.
const StatusLine = () => (
    <span data-drawing-status data-tone="idle" class="group inline-flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-neutral-400" aria-live="polite">
        <span class="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-600 group-data-[tone=ok]:bg-green-500 group-data-[tone=busy]:bg-amber-400 group-data-[tone=dirty]:bg-amber-400 group-data-[tone=error]:bg-red-500 group-data-[tone=idle]:hidden"></span>
        <span data-drawing-status-text class="truncate"></span>
    </span>
)

// The editor's box (js-draw pans and zooms inside it), with the save status and actions underneath.
// Until an editor is mounted the box shows the saved drawing as a picture, and in 'tap' mode a prompt.
const DrawPanel = ({ drawing, activation, visible }: { drawing: DrawingFieldProps; activation: DrawingActivation; visible: boolean }) => {
    const state = activation === 'live' ? 'live' : drawing.version ? 'preview' : 'empty'
    return (
        <div data-drawing-draw-panel class={visible ? '' : 'hidden'}>
            <div data-drawing-host data-state={state} class={HOST_CLASS}>
                {drawing.version && (
                    <img data-drawing-preview src={withDrawingVersion(drawing.svgUrl, drawing.version)} alt="Your handwritten answer" loading="lazy" class={PREVIEW_CLASS} />
                )}
                {activation === 'tap' && (
                    <>
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent hidden group-data-[state=preview]:block"></div>
                        <button
                            type="button"
                            data-drawing-activate
                            class="absolute inset-0 w-full h-full flex flex-col items-center justify-center group-data-[state=preview]:justify-end group-data-[state=preview]:pb-4"
                        >
                            <span class="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-white/90 dark:bg-neutral-900/90 group-data-[state=preview]:hidden">
                                <span class="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <PenIcon size={18} />
                                </span>
                                <span class="text-sm font-semibold text-gray-700 dark:text-neutral-200">Tap to write</span>
                                <span class="text-xs text-gray-400 dark:text-neutral-500">Apple Pencil, finger or mouse</span>
                            </span>
                            <span class="hidden group-data-[state=preview]:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white shadow-md ring-1 ring-black/5 text-sm font-semibold text-blue-600">
                                <PenIcon />
                                Tap to keep writing
                            </span>
                        </button>
                    </>
                )}
            </div>
            <div class="flex items-center justify-between gap-3 mt-1.5 min-h-[1.75rem]">
                <StatusLine />
                <span class="shrink-0 flex items-center gap-1">
                    <button
                        type="button"
                        data-drawing-fullscreen
                        class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
                    >
                        <ExpandIcon />
                        Full screen
                    </button>
                    {activation === 'tap' && (
                        <button
                            type="button"
                            data-drawing-deactivate
                            class="hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                        >
                            <CheckIcon />
                            Done
                        </button>
                    )}
                </span>
            </div>
        </div>
    )
}

const modeTabClass = [
    'inline-flex items-center gap-1.5 px-3 py-1 rounded transition-colors',
    'data-[active=true]:bg-white data-[active=true]:text-gray-900 data-[active=true]:shadow-sm dark:data-[active=true]:bg-neutral-700 dark:data-[active=true]:text-white',
    'data-[active=false]:text-gray-500 dark:data-[active=false]:text-neutral-400 data-[active=false]:hover:text-gray-800 dark:data-[active=false]:hover:text-neutral-200'
].join(' ')

// The answer box with a Type | Draw switch: a drawing takes the textarea's place rather than sitting
// beside it. The textarea (children) stays in the form either way, so a typed answer is never lost.
export const AnswerInput = ({
    drawing,
    hasText,
    activation = 'live',
    children
}: {
    drawing: DrawingFieldProps
    hasText: boolean
    activation?: DrawingActivation
    children: Child
}) => {
    // Open on whatever was last used to answer this question. With nothing yet, the client applies the
    // device's last choice ('auto'), so an iPad that draws keeps opening on Draw.
    const mode = drawing.version ? 'draw' : hasText ? 'type' : 'auto'
    const startsOnDraw = mode === 'draw'
    return (
        <drawing-field class="block" data-variant="answer" data-mode={mode} {...fieldData(drawing, activation)}>
            <div role="tablist" aria-label="Answer format" class="inline-flex items-center gap-0.5 p-0.5 mb-2 rounded-md bg-gray-100 dark:bg-neutral-800 text-xs font-semibold">
                <button type="button" role="tab" data-drawing-mode="type" data-active={startsOnDraw ? 'false' : 'true'} aria-selected={startsOnDraw ? 'false' : 'true'} class={modeTabClass}>
                    <KeyboardIcon />
                    Type
                </button>
                <button type="button" role="tab" data-drawing-mode="draw" data-active={startsOnDraw ? 'true' : 'false'} aria-selected={startsOnDraw ? 'true' : 'false'} class={modeTabClass}>
                    <PenIcon />
                    Draw
                </button>
            </div>
            <div data-drawing-type-panel class={startsOnDraw ? 'hidden' : ''}>
                {children}
            </div>
            <DrawPanel drawing={drawing} activation={activation} visible={startsOnDraw} />
        </drawing-field>
    )
}

// Scratch working under a multiple-choice question: closed until asked for, open if there is already some.
export const WorkingPad = ({ drawing, activation = 'live' }: { drawing: DrawingFieldProps; activation?: DrawingActivation }) => (
    <drawing-field class="block" data-variant="working" data-mode={drawing.version ? 'draw' : 'closed'} {...fieldData(drawing, activation)}>
        <button
            type="button"
            data-drawing-mode="draw"
            data-active={drawing.version ? 'true' : 'false'}
            aria-expanded={drawing.version ? 'true' : 'false'}
            class="group inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:text-gray-900 hover:border-gray-300 dark:hover:text-white transition-colors"
        >
            <PenIcon />
            Working
            <ChevronIcon />
        </button>
        <DrawPanel drawing={drawing} activation={activation} visible={!!drawing.version} />
    </drawing-field>
)

// A drawing shown for reference only, e.g. the first attempt while re-doing a question in review mode,
// or a mock exam answer on the marking page. Sized to the drawing itself, so a tall page isn't letterboxed.
export const DrawingPreview = ({ svgUrl, version, caption }: { svgUrl: string; version?: string | null; caption: string }) =>
    version ? (
        <figure>
            <figcaption class="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 mb-1.5">{caption}</figcaption>
            <img
                src={withDrawingVersion(svgUrl, version)}
                alt={caption}
                loading="lazy"
                class="block w-auto h-auto max-w-full max-h-[36rem] bg-white rounded-md border border-gray-200 dark:border-neutral-700"
            />
        </figure>
    ) : null
