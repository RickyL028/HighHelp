import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, logAction } from '../../utils'
import { canUploadPastPaper } from '../../permissions'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()


app.get('/past-papers/create', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')
    if (!subject || !user || !canUploadPastPaper(user, subject)) return c.redirect('/past-papers')

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

    return c.html(
        <Layout title={`Add Paper - ${subject}`} user={user}>
            <div class="max-w-2xl mx-auto">
                <div class="mb-6">
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}`} class="text-sm text-gray-500 hover:underline">← Back to {subject}</a>
                    <h1 class="text-2xl font-bold mt-2">Add New Past Paper</h1>
                </div>

                <form action="/past-papers/create" method="post" class="bg-white p-6 rounded border border-gray-300 shadow-none space-y-6">
                    <input type="hidden" name="subject" value={subject} />

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">School Name</label>
                        <input type="text" name="school_name" list="nsw-schools" required placeholder="Select or type school..." class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        <datalist id="nsw-schools">
                            <option value="Sydney Boys High School" />
                            <option value="Sydney Girls High School" />
                            <option value="North Sydney Boys High School" />
                            <option value="North Sydney Girls High School" />
                            <option value="Sydney Grammar School" />
                            <option value="James Ruse Agricultural High School" />
                            <option value="Baulkham Hills High School" />
                            <option value="Hornsby Girls High School" />
                        </datalist>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Paper Type</label>
                        <select name="paper_type" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="Trial Paper" selected>Trial Paper</option>
                            <option value="HSC Examination">HSC Examination</option>
                            <option value="Assessment Task">Assessment Task</option>
                            <option value="Yearly">Yearly</option>
                            <option value="Half Yearly">Half Yearly</option>

                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Year</label>
                            <select name="academic_year" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                {years.map(y => <option value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Reference Link (Optional)</label>
                            <input type="url" name="reference_link" placeholder="https://..." class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        </div>
                    </div>

                    <div class="border-t border-gray-100 pt-6">
                        <h3 class="text-lg font-bold mb-4">Structure</h3>
                        <p class="text-sm text-gray-500 mb-4">Define the structure to auto-generate placeholder questions.</p>

                        <div id="segments-container" class="space-y-4">
                        
                            <div class="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg">
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase">Section</label>
                                    <input type="text" name="segments[0][section]" value="I" placeholder="I, II, III" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase">Segment (Optional)</label>
                                    <input type="text" name="segments[0][label]" value="A" placeholder="A, B, C" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase"># Questions</label>
                                    <input type="number" name="segments[0][count]" value="10" min="1" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                            </div>
                        </div>

                        <button type="button" id="add-segment-btn" class="mt-4 text-sm text-blue-600 font-bold hover:underline">+ Add Another Segment</button>
                    </div>

                    <div class="pt-4">
                        <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Create Paper & Placeholders</button>
                    </div>
                </form>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    let segmentCount = 1;
                    document.getElementById('add-segment-btn').addEventListener('click', () => {
                        const div = document.createElement('div');
                        div.className = 'grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg';
                        div.innerHTML = \`
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase">Section</label>
                                <input type="text" name="segments[\${segmentCount}][section]" placeholder="I, II" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase">Segment</label>
                                <input type="text" name="segments[\${segmentCount}][label]" placeholder="A, B" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase"># Questions</label>
                                <input type="number" name="segments[\${segmentCount}][count]" value="5" min="1" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                        \`;
                        document.getElementById('segments-container').appendChild(div);
                        segmentCount++;
                    });
                `}} />
            </div>
        </Layout>
    )
})


app.post('/past-papers/create', async (c) => {
    const user = await getUser(c)
    const body = await c.req.parseBody()
    const subject = body['subject'] as string

    if (!user || !canUploadPastPaper(user, subject)) return c.redirect('/past-papers')

    const school = body['school_name'] as string;
    const year = parseInt(body['academic_year'] as string);
    const link = body['reference_link'] as string;
    const type = body['paper_type'] as string || 'Trial Paper';

    // Insert Paper
    const paperRes = await c.env.DB.prepare('INSERT INTO papers (subject, school_name, academic_year, reference_link, paper_type) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .bind(subject, school, year, link, type)
        .first<{ id: number }>();

    if (!paperRes) {
        return c.text('Failed to create paper', 500);
    }

    const paperId = paperRes.id;

    
    const statements = [];
    let globalOrderIndex = 1;

    for (let i = 0; i < 20; i++) {
        const section = body[`segments[${i}][section]`] as string;
        const label = body[`segments[${i}][label]`] as string;
        const count = parseInt((body[`segments[${i}][count]`] as string) || '0');

        if (section && count > 0) {
            // Create questions
            for (let q = 1; q <= count; q++) {
                const qNum = label ? `${label}${q}` : `${q}`;
                const fullLabel = label ? `${section} ${label}${q}` : `${section} ${q}`;

                statements.push(
                    c.env.DB.prepare(`
                        INSERT INTO exam_questions 
                        (paper_id, section_label, segment_label, question_number, question_full_label, uploader_id, ordering_index)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(paperId, section, label || null, qNum, fullLabel, user.id, globalOrderIndex)
                );
                globalOrderIndex++;
            }
        }
    }

    if (statements.length > 0) {
        await c.env.DB.batch(statements);
    }

    await logAction(c.env.DB, user.id, 'CREATE_PAPER', `Created paper ${school} ${year}`, paperId as number, 'papers');

    return c.redirect(`/past-papers/paper/${paperId}`);
});

export default app
