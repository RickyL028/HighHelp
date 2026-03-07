import { getSortedSubjects } from '../utils'

// usage: subject select filters for pages
export const SubjectSelector = (props: { baseUrl: string, type: 'standard' | 'essay' }) => {
    const { popular, others } = getSortedSubjects(props.type);

    const Pill = ({ subject }: { subject: string }) => (
        <a
            href={`${props.baseUrl}?subject=${encodeURIComponent(subject)}`}
            class="inline-block bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 px-3 py-1 rounded text-xs font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:border-blue-600 transition mb-2 mr-2"
        >
            {subject}
        </a>
    );

    return (
        <div class="space-y-4">
            {/* Priority Subjects */}
            <div>
                <h3 class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-2">Popular Subjects</h3>
                <div class="flex flex-wrap">
                    {popular.map(s => <Pill subject={s} />)}
                </div>
            </div>

            <hr class="border-gray-100 dark:border-neutral-800" />

            {/* All Other Subjects */}
            <div>
                <h3 class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-2">All Subjects</h3>
                <div class="flex flex-wrap">
                    {others.map(s => <Pill subject={s} />)}
                </div>
            </div>
        </div>
    )
}
