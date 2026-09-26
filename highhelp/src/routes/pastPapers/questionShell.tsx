import type { Child } from 'hono/jsx'

type Slot = Child | undefined

// Narrow right-hand column holding the mark value, split from the question
// body by a single vertical rule.
export const MarksRail = ({ marks, caption = 'marks' }: { marks?: number | string | null; caption?: string }) => (
    <div class="w-12 sm:w-14 shrink-0 border-l border-gray-200 dark:border-neutral-800 pl-3 sm:pl-4 text-center">
        <div class="text-base font-bold leading-none text-gray-900 dark:text-neutral-100">{marks ?? '?'}</div>
        <div class="mt-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500">{caption}</div>
    </div>
)

const PdfIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
)

// Single line of provenance above the question body: index label, source
// reference, optional link back to the original paper, plus any badges.
export const QuestionMeta = ({
    label,
    source,
    pdfUrl,
    pdfPage,
    children
}: {
    label?: string
    source?: string
    pdfUrl?: string
    pdfPage?: string | null
    children?: Slot
}) => (
    <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {label && <span class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-neutral-500">{label}</span>}
        {source && <span class="text-sm font-semibold text-gray-600 dark:text-neutral-300">{source}</span>}
        {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 hover:underline transition-colors">
                <PdfIcon />
                Original PDF {pdfPage ? `(p.${pdfPage})` : ''}
            </a>
        )}
        {children}
    </div>
)

// Shared question frame used by batch mode and the mock exam views: open
// layout (no card outline), body on the left, marks in the rail on the right.
export const QuestionShell = ({
    id,
    header,
    marks,
    marksCaption,
    class: className = '',
    children
}: {
    id?: string
    header?: Slot
    marks?: number | string | null
    marksCaption?: string
    class?: string
    children?: Slot
}) => (
    <section id={id} class={`flex items-start gap-4 sm:gap-6 py-7 border-b border-gray-100 dark:border-neutral-800 last:border-b-0 ${className}`}>
        <div class="flex-1 min-w-0">
            {header}
            <div class="space-y-4">{children}</div>
        </div>
        <MarksRail marks={marks} caption={marksCaption} />
    </section>
)
