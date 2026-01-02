import { getSortedSubjects } from '../utils'

// Redesigned Subject Selector (Compact Pills)
export const SubjectSelector = (props: { baseUrl: string, type: 'standard' | 'essay' }) => {
    const { popular, others } = getSortedSubjects(props.type);

    const Pill = ({ subject }: { subject: string }) => (
        <a
            href={`${props.baseUrl}?subject=${encodeURIComponent(subject)}`}
            class="inline-block bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm mb-2 mr-2"
        >
            {subject}
        </a>
    );

    return (
        <div class="space-y-4">
            {/* Priority Subjects */}
            <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Popular Subjects</h3>
                <div class="flex flex-wrap">
                    {popular.map(s => <Pill subject={s} />)}
                </div>
            </div>

            <hr class="border-gray-100" />

            {/* All Other Subjects */}
            <div>
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">All Subjects</h3>
                <div class="flex flex-wrap">
                    {others.map(s => <Pill subject={s} />)}
                </div>
            </div>
        </div>
    )
}
