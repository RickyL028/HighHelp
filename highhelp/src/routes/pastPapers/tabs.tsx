import { html } from 'hono/html'
export const PastPaperTabs = ({ subject, activeTab }: { subject: string, activeTab: string }) => {
    const tabs = [
        { id: 'browse', label: 'Browse Papers', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` },
        { id: 'practice', label: 'Practice Questions', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=practice` },
        { id: 'exam', label: 'Mock Exam', href: `/past-papers/mock-exams?subject=${encodeURIComponent(subject)}` },
        { id: 'review', label: 'Review', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=review` },
    ];

    return (
        <div class="border-b border-gray-200 dark:border-neutral-700 mb-8">
            <nav class="-mb-px flex space-x-8">
                {tabs.map(t => (
                    <a href={t.href}
                        class={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                        ${activeTab === t.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'}`}>
                        {t.label}
                    </a>
                ))}
            </nav>
        </div>
    );
}