import { html } from 'hono/html'
export const PastPaperTabs = ({ subject, activeTab }: { subject: string, activeTab: string }) => {
    const tabs = [
        { id: 'browse', label: 'Browse Papers', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` },
        { id: 'practice', label: 'Practice Questions', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=practice` },
        { id: 'exam', label: 'Mock Exam', href: `/past-papers/mock-exams?subject=${encodeURIComponent(subject)}` },
        { id: 'review', label: 'Review', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=review` },
        { id: 'stats', label: 'Statistics', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=stats` },
    ];

    return (
        <div class="border-b border-gray-200 dark:border-neutral-700 mb-8">
            {/* Five tabs are wider than a phone, so the bar scrolls sideways rather than the page. */}
            <nav class="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto scrollbar-hide">
                {tabs.map(t => (
                    <a href={t.href} aria-current={activeTab === t.id ? 'page' : undefined}
                        class={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                        ${activeTab === t.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'}`}>
                        {t.label}
                    </a>
                ))}
            </nav>
            {/* ...and scrolls the current tab into view, which on a phone can start past the edge. Styles
                come from the Tailwind CDN, so the bar is measured once the document has been styled. */}
            <script dangerouslySetInnerHTML={{ __html: `
                (function () {
                    var nav = document.currentScript.previousElementSibling;
                    function reveal() {
                        var current = nav.querySelector('[aria-current="page"]');
                        if (!current) return;
                        var bar = nav.getBoundingClientRect();
                        var tab = current.getBoundingClientRect();
                        if (tab.right > bar.right || tab.left < bar.left) nav.scrollLeft += tab.left - bar.left - 16;
                    }
                    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(reveal); });
                    else requestAnimationFrame(reveal);
                })();
            ` }} />
        </div>
    );
}