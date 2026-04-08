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
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}`} class="text-sm text-gray-500 dark:text-neutral-400 hover:underline">← Back to {subject}</a>
                    <h1 class="text-2xl font-bold mt-2 dark:text-white">Add New Past Paper</h1>
                </div>

                <form action="/past-papers/create" method="post" class="bg-white dark:bg-neutral-800 p-6 rounded-xl border border-gray-300 dark:border-neutral-700 shadow-sm space-y-6">
                    <input type="hidden" name="subject" value={subject} />

                    <div>
                        <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">School Name</label>
                        <input type="text" name="school_name" list="nsw-schools" required placeholder="Select or type school..." class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" />
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
                        <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Paper Type</label>
                        <select name="paper_type" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="Trial Paper" selected>Trial Paper</option>
                            <option value="HSC Examination">HSC Examination</option>
                            <option value="Assessment Task">Assessment Task</option>
                            <option value="Yearly">Yearly</option>
                            <option value="Half Yearly">Half Yearly</option>

                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Year</label>
                            <select name="academic_year" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                {years.map(y => <option value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Reference Link (Optional)</label>
                            <input type="url" name="reference_link" placeholder="https://..." class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        </div>
                    </div>

                    <div class="border-t border-gray-100 dark:border-neutral-700 pt-6">
                        <h3 class="text-lg font-bold mb-4 dark:text-white">Structure</h3>
                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-4">Define the structure to auto-generate placeholder questions.</p>

                        <div id="segments-container" class="space-y-4">

                            <div class="grid grid-cols-12 gap-4 items-end bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-lg border dark:border-neutral-700">
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Section</label>
                                    <input type="text" name="segments[0][section]" value="I" placeholder="I, II, III" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Segment (Optional)</label>
                                    <input type="text" name="segments[0][label]" value="A" placeholder="A, B, C" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase"># Questions</label>
                                    <input type="number" name="segments[0][count]" value="10" min="1" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>

                        <button type="button" id="add-segment-btn" class="mt-4 text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline transition-colors">+ Add Another Segment</button>
                    </div>
                    <div class="pt-4">
                        <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Create Paper & Placeholders</button>
                    </div>
                </form>

                {/* AI Import Section */}
                <div class="mt-8 border-t-2 border-dashed border-gray-200 dark:border-neutral-700 pt-8">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold dark:text-white">Or: AI Import from PDF</h3>
                            <p class="text-sm text-gray-500 dark:text-neutral-400">Upload a past paper PDF and let AI extract questions automatically.</p>
                        </div>
                    </div>

                    <form action="/past-papers/create-with-ai" method="post" enctype="multipart/form-data" id="ai-import-form" class="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-xl border border-purple-200 dark:border-purple-800/40 space-y-4">
                        <input type="hidden" name="subject" value={subject} />

                        <p class="text-xs text-gray-500 dark:text-neutral-400 mb-2">
                            Fill in the paper details above first (school name, year, etc.), then upload your PDF here. The AI will categorise all questions using HSC conventions (Section I = MCQ, Section II = Short Answer, Section III+ = Extended Response).
                        </p>

                        {/* Duplicate hidden fields for paper metadata */}
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">School Name</label>
                                <input type="text" name="school_name" list="nsw-schools-ai" required placeholder="Select or type school..." class="w-full mt-1 rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm" />
                                <datalist id="nsw-schools-ai">
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
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Year</label>
                                <select name="academic_year" class="w-full mt-1 rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm">
                                    {years.map(y => <option value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Paper Type</label>
                                <select name="paper_type" class="w-full mt-1 rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm">
                                    <option value="Trial Paper" selected>Trial Paper</option>
                                    <option value="HSC Examination">HSC Examination</option>
                                    <option value="Assessment Task">Assessment Task</option>
                                    <option value="Yearly">Yearly</option>
                                    <option value="Half Yearly">Half Yearly</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Reference Link (Optional)</label>
                                <input type="url" name="reference_link" placeholder="https://..." class="w-full mt-1 rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm" />
                            </div>
                        </div>

                        <div class="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-6 text-center hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition cursor-pointer relative" id="pdf-drop-zone">
                            <input type="file" name="pdf_file" accept=".pdf,application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required id="pdf-file-input" />
                            <div class="text-gray-500 dark:text-neutral-400" id="pdf-drop-label">
                                <span class="block text-3xl mb-2">📄</span>
                                <span class="font-bold text-sm">Click or drag to upload PDF</span>
                                <span class="block text-xs mt-1 text-gray-400 dark:text-neutral-500">Supports HSC-format past papers</span>
                            </div>
                        </div>

                        <button type="submit" id="ai-submit-btn" class="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            <span id="ai-submit-text">Create Paper with AI</span>
                        </button>
                    </form>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    let segmentCount = 1;
                    document.getElementById('add-segment-btn').addEventListener('click', () => {
                        const div = document.createElement('div');
                        div.className = 'grid grid-cols-12 gap-4 items-end bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-lg border dark:border-neutral-700';
                        div.innerHTML = \`
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Section</label>
                                <input type="text" name="segments[\${segmentCount}][section]" placeholder="I, II" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Segment</label>
                                <input type="text" name="segments[\${segmentCount}][label]" placeholder="A, B" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase"># Questions</label>
                                <input type="number" name="segments[\${segmentCount}][count]" value="5" min="1" class="w-full mt-1 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:ring-blue-500" />
                            </div>
                        \`;
                        document.getElementById('segments-container').appendChild(div);
                        segmentCount++;
                    });

                    // PDF upload feedback
                    const pdfInput = document.getElementById('pdf-file-input');
                    const pdfLabel = document.getElementById('pdf-drop-label');
                    if (pdfInput) {
                        pdfInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                pdfLabel.innerHTML = '<span class="block text-3xl mb-2">✅</span><span class="font-bold text-sm text-green-700 dark:text-green-400">' + file.name + '</span><span class="block text-xs mt-1 text-gray-400 dark:text-neutral-500">' + (file.size / 1024 / 1024).toFixed(2) + ' MB</span>';
                            }
                        });
                    }

                    // AI form loading state
                    const aiForm = document.getElementById('ai-import-form');
                    if (aiForm) {
                        aiForm.addEventListener('submit', () => {
                            const btn = document.getElementById('ai-submit-btn');
                            const text = document.getElementById('ai-submit-text');
                            btn.disabled = true;
                            btn.classList.add('opacity-60', 'cursor-not-allowed');
                            text.textContent = 'Processing with AI… This may take 30-60 seconds';
                        });
                    }
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
