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

const PenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
)

const fieldData = ({ svgUrl, saveUrl, version, title, questionSource }: DrawingFieldProps, activation: DrawingActivation) => ({
    'data-svg-url': svgUrl,
    'data-save-url': saveUrl,
    'data-version': version ?? undefined,
    'data-title': title,
    'data-question-source': questionSource,
    'data-activation': activation
})

// Grid paper under everything, so a blank page looks like the editor's before it has loaded.
const GRID_PAPER =
    'background-image: linear-gradient(#ececec 1px, transparent 1px), linear-gradient(90deg, #ececec 1px, transparent 1px); background-size: 24px 24px;'

// Kept in step with PREVIEW_CLASS in public/drawing-editor.js, which creates this image after a first save.
const PREVIEW_CLASS = 'absolute inset-0 w-full h-full object-cover object-top bg-white pointer-events-none'

// The editor's box (js-draw pans and zooms inside it). Until an editor is mounted it shows the saved
// drawing as a picture, and in 'tap' mode a button to start writing.
const DrawPanel = ({ drawing, activation, visible }: { drawing: DrawingFieldProps; activation: DrawingActivation; visible: boolean }) => (
    <div data-drawing-draw-panel class={visible ? '' : 'hidden'}>
        <div
            data-drawing-host
            class="relative h-[60vh] min-h-[22rem] max-h-[48rem] rounded-sm border border-gray-300 dark:border-neutral-600 overflow-hidden bg-white"
            style={GRID_PAPER}
        >
            {drawing.version && (
                <img data-drawing-preview src={withDrawingVersion(drawing.svgUrl, drawing.version)} alt="Your handwritten answer" loading="lazy" class={PREVIEW_CLASS} />
            )}
            {activation === 'tap' && (
                <button type="button" data-drawing-activate class="absolute inset-0 w-full h-full flex items-end justify-center pb-5">
                    <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-md border border-gray-200 bg-white text-sm font-bold text-blue-700">
                        <PenIcon />
                        Tap to write
                    </span>
                </button>
            )}
        </div>
        <div class="flex items-center justify-between gap-3 mt-1">
            <span data-drawing-status class="text-xs text-gray-500 dark:text-neutral-400" aria-live="polite"></span>
            <span class="shrink-0 flex items-center gap-4">
                {activation === 'tap' && (
                    <button type="button" data-drawing-deactivate class="hidden text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline">
                        Done writing
                    </button>
                )}
                <button type="button" data-drawing-fullscreen class="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline">
                    Full screen
                </button>
            </span>
        </div>
    </div>
)

const modeTabClass =
    'px-3 py-1 transition-colors data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=false]:text-gray-600 dark:data-[active=false]:text-neutral-300 data-[active=false]:hover:bg-gray-100 dark:data-[active=false]:hover:bg-neutral-700'

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
        <drawing-field data-variant="answer" data-mode={mode} {...fieldData(drawing, activation)}>
            <div role="tablist" aria-label="Answer format" class="inline-flex mb-2 rounded-sm border border-gray-300 dark:border-neutral-600 overflow-hidden text-xs font-bold">
                <button type="button" role="tab" data-drawing-mode="type" data-active={startsOnDraw ? 'false' : 'true'} aria-selected={startsOnDraw ? 'false' : 'true'} class={modeTabClass}>
                    Type
                </button>
                <button type="button" role="tab" data-drawing-mode="draw" data-active={startsOnDraw ? 'true' : 'false'} aria-selected={startsOnDraw ? 'true' : 'false'} class={`${modeTabClass} inline-flex items-center gap-1.5 border-l border-gray-300 dark:border-neutral-600`}>
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
    <drawing-field data-variant="working" data-mode={drawing.version ? 'draw' : 'closed'} {...fieldData(drawing, activation)}>
        <button
            type="button"
            data-drawing-mode="draw"
            data-active={drawing.version ? 'true' : 'false'}
            aria-expanded={drawing.version ? 'true' : 'false'}
            class="inline-flex items-center gap-1.5 mb-2 text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline"
        >
            <PenIcon />
            Working
        </button>
        <DrawPanel drawing={drawing} activation={activation} visible={!!drawing.version} />
    </drawing-field>
)

// A drawing shown for reference only, e.g. the first attempt while re-doing a question in review mode,
// or a mock exam answer on the marking page.
export const DrawingPreview = ({ svgUrl, version, caption }: { svgUrl: string; version?: string | null; caption: string }) =>
    version ? (
        <figure>
            <figcaption class="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 mb-1">{caption}</figcaption>
            <img
                src={withDrawingVersion(svgUrl, version)}
                alt={caption}
                loading="lazy"
                class="w-full max-h-[28rem] object-contain bg-white rounded-sm border border-gray-200 dark:border-neutral-700"
            />
        </figure>
    ) : null
