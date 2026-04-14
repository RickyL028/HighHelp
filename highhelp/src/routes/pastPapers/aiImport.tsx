import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, logAction } from '../../utils'
import { canUploadPastPaper } from '../../permissions'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()


const AI_CONFIG = {
    model: 'gemini-2.5-flash',

    apiKeyBinding: 'GEMINI_API_KEY' as const,
};


function buildPrompt(subject: string, existingTopics: string[]): string {
    const topicsList = existingTopics.length > 0
        ? `The following topics already exist for this subject in the database:\n${existingTopics.map(t => `- ${t}`).join('\n')}\n\nYou MUST choose from the topics above when categorising. If none fit, you may suggest a new topic name, but prefer existing ones.`
        : `No topics exist yet for this subject. Create appropriate topic names based on the HSC syllabus for "${subject}".`;

    return `You are a specialist in analysing NSW HSC exam papers. You will be given a PDF of a past paper for the subject "${subject}".

Your task is to extract EVERY question from the paper and return them in a structured JSON format.

## Section Classification Rules (STRICTLY follow these):
- **Section I**: Always Multiple Choice (MCQ). Each question is worth 1 mark. The correct answer is one of A, B, C, D.
  - question_type: "multiple_choice"
  - marks: 1
  - mc_answer: the correct letter (in the solution)
- **Section II**: Short Answer questions. Marks vary per question.
  - question_type: "short_answer"
- **Section III and beyond**: Extended Response questions (e.g. business reports, essays). Marks vary.
  - question_type: "extended_response"
- If there is no MCQ section at all, start numbering sections from Section II.

## Question Number Conventions:
- Section I MCQs are numbered simply: 1, 2, 3, ...
- Section II+ questions use segment labels. For example:
  - If a question is "Question 21" with parts (a), (b), (c), the segment_label might be derived from the grouping.
  - Common patterns: segment "A" contains questions A1, A2...; or no segment with questions numbered 21, 22...
  - Use whatever grouping the paper naturally uses.

## Topic Categorisation:
${topicsList}

For each question, assign one or more topic names in the "topics" array. This helps users filter questions by topic.

## Text Formatting Rules:
- For mathematical expressions, use LaTeX notation wrapped in double dollar signs: $$expression$$
  - Example: $$\\frac{d}{dx}(x^2) = 2x$$
  - Example: $$\\int_0^1 x^2 \\, dx$$
  - Example: The value of $$x$$ when $$x^2 + 3x - 4 = 0$$
- Use $$...$$ for both inline and display math.
- For plain text questions (e.g. Business Studies, English), do NOT use LaTeX.
- Use \n for line breaks within question text.

## For each question, extract:
1. **section_label**: Roman numeral (I, II, III, IV, etc.)
2. **segment_label**: Letter grouping if present (A, B, C, etc.), or null if questions are just numbered
3. **question_number**: The question identifier within its segment (e.g. "A1", "B3", "21", "22a", "22b")
4. **question_full_label**: Full label like "II A1", "III B2", "I 5"
5. **question_type**: "multiple_choice", "short_answer", or "extended_response"
6. **marks**: Integer mark value
7. **question_text**: The full question text. For MCQs include options (A) through (D).
8. **mc_answer**: For MCQs only — the correct answer letter (A/B/C/D) if determinable from an answer key, else null
9. **topics**: Array of topic name strings this question covers (1-3 topics per question)
10. **stimulus_coordinates**: If the question has an associated image/graph/diagram/table that is embedded in the PDF (not text), provide bounding box as:
   {"page": <1-indexed page number>, "x": <left % 0-100>, "y": <top % 0-100>, "w": <width % 0-100>, "h": <height % 0-100>}
   If no image stimulus, set to null.

## Sub-questions:
- If a question has parts like (a), (b), (c) that each have their own mark allocation, treat each part as a separate question.
- The question_number should reflect the part, e.g. "21a", "21b".
- The parent question text (if any) should be included as a prefix in each sub-question's question_text, or captured in stimulus_text.

## Output Format:
Return ONLY a valid JSON object with this structure:
{
  "questions": [
    {
      "section_label": "I",
      "segment_label": null,
      "question_number": "1",
      "question_full_label": "I 1",
      "question_type": "multiple_choice",
      "marks": 1,
      "question_text": "What is the primary function of management?\\n(A) To maximise profits\\n(B) To coordinate resources\\n(C) To reduce costs\\n(D) To increase market share",
      "mc_answer": null,
      "topics": ["Marketing"],
      "stimulus_coordinates": null
    }
  ]
}

Be thorough. Do not skip any questions.`;
}

interface AIQuestion {
    section_label: string;
    segment_label: string | null;
    question_number: string;
    question_full_label: string;
    question_type: 'multiple_choice' | 'short_answer' | 'extended_response';
    marks: number;
    question_text: string;
    mc_answer: string | null;
    topics: string[];
    stimulus_coordinates: {
        page: number;
        x: number;
        y: number;
        w: number;
        h: number;
    } | null;
}

interface GeminiResponse {
    questions: AIQuestion[];
}

async function callGemini(apiKey: string, pdfBase64: string, subject: string, existingTopics: string[]): Promise<GeminiResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: 'application/pdf',
                            data: pdfBase64,
                        },
                    },
                    {
                        text: buildPrompt(subject, existingTopics),
                    },
                ],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Import] Gemini API error: ${response.status} - ${errorText}`);

        try {
            const errJson = JSON.parse(errorText);
            throw new Error(`Gemini API error 403: ${errJson.error.message}`);
        } catch {
            throw new Error(`Gemini API error 403: ${errorText}`);
        }
    }

    const data = await response.json() as any;


    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
        console.error('[AI Import] No text in Gemini response:', JSON.stringify(data));
        throw new Error('No response from Gemini');
    }


    const parsed = JSON.parse(textContent) as GeminiResponse;
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response format from Gemini');
    }

    return parsed;
}

async function insertQuestionsFromAI(
    db: D1Database,
    bucket: R2Bucket,
    paperId: number,
    subject: string,
    questions: AIQuestion[],
    uploaderId: number
): Promise<number> {

    const existingQs = await db.prepare('SELECT id FROM exam_questions WHERE paper_id = ?').bind(paperId).all<{ id: number }>();
    if (existingQs.results.length > 0) {
        const ids = existingQs.results.map(q => q.id);

        for (const id of ids) {
            await db.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(id).run();
        }
    }
    await db.prepare('DELETE FROM exam_questions WHERE paper_id = ?').bind(paperId).run();


    const topicRows = await db.prepare('SELECT id, name FROM topics WHERE subject = ?').bind(subject).all<{ id: number, name: string }>();
    const topicCache = new Map<string, number>();
    for (const t of topicRows.results) {
        topicCache.set(t.name.toLowerCase().trim(), t.id);
    }

    const stmt = db.prepare(`
        INSERT INTO exam_questions 
        (paper_id, section_label, segment_label, question_number, question_full_label, 
         question_type, marks, question_text, mc_answer, stimulus_image_key, 
         uploader_id, ordering_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];


        let stimulusKey: string | null = null;
        if (q.stimulus_coordinates) {
            stimulusKey = `pdf_crop:${JSON.stringify(q.stimulus_coordinates)}`;
        }

        const insertResult = await db.prepare(`
            INSERT INTO exam_questions 
            (paper_id, section_label, segment_label, question_number, question_full_label, 
             question_type, marks, question_text, mc_answer, stimulus_image_key, 
             uploader_id, ordering_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `).bind(
            paperId,
            q.section_label,
            q.segment_label || null,
            q.question_number,
            q.question_full_label || `${q.section_label} ${q.question_number}`,
            q.question_type,
            q.marks || null,
            q.question_text || null,
            q.mc_answer || null,
            stimulusKey,
            uploaderId,
            i + 1 // ordering_index
        ).first<{ id: number }>();

        if (insertResult && q.topics && q.topics.length > 0) {
            for (const topicName of q.topics) {
                const key = topicName.toLowerCase().trim();
                let topicId = topicCache.get(key);


                if (!topicId) {
                    const newTopic = await db.prepare(
                        'INSERT INTO topics (subject, name) VALUES (?, ?) ON CONFLICT(subject, name) DO UPDATE SET name = name RETURNING id'
                    ).bind(subject, topicName.trim()).first<{ id: number }>();
                    if (newTopic) {
                        topicId = newTopic.id;
                        topicCache.set(key, topicId);
                    }
                }


                if (topicId) {
                    await db.prepare(
                        'INSERT OR IGNORE INTO question_topics (question_id, topic_id) VALUES (?, ?)'
                    ).bind(insertResult.id, topicId).run();
                }
            }
        }

        insertedCount++;
    }

    return insertedCount;
}


app.post('/past-papers/paper/:id/ai-import', async (c) => {
    const user = await getUser(c);
    const paperId = c.req.param('id');

    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);
    if (paper.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

    const apiKey = c.env[AI_CONFIG.apiKeyBinding];
    if (!apiKey) {
        return c.text('AI service not configured. Please set GEMINI_API_KEY.', 500);
    }

    const body = await c.req.parseBody();
    const file = body['pdf_file'];
    if (!(file instanceof File)) return c.text('Invalid file uploaded', 400);
    if (!file.name.toLowerCase().endsWith('.pdf')) return c.text('Please upload a PDF file', 400);

    try {

        const arrayBuffer = await file.arrayBuffer();


        await c.env.BUCKET.put(`papers/${paperId}.pdf`, arrayBuffer, {
            httpMetadata: { contentType: 'application/pdf' },
        });

        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        const base64 = btoa(binary);

        const topicRows = await c.env.DB.prepare('SELECT name FROM topics WHERE subject = ?').bind(paper.subject).all<{ name: string }>();
        const existingTopics = topicRows.results.map(t => t.name);

        const result = await callGemini(apiKey, base64, paper.subject, existingTopics);

        if (result.questions.length === 0) {
            return c.text('AI could not extract any questions from the PDF. Please check the PDF quality.', 400);
        }


        const count = await insertQuestionsFromAI(c.env.DB, c.env.BUCKET, parseInt(paperId), paper.subject, result.questions, 2);

        await logAction(c.env.DB, user.id, 'AI_IMPORT', `AI imported ${count} questions from PDF into paper ${paperId}`, parseInt(paperId), 'papers');

        return c.redirect(`/past-papers/paper/${paperId}`);
    } catch (error: any) {
        console.error('[AI Import] Error:', error);
        return c.text(`AI import failed: ${error.message}`, 500);
    }
});


app.post('/past-papers/create-with-ai', async (c) => {
    const user = await getUser(c);
    const body = await c.req.parseBody();
    const subject = body['subject'] as string;

    if (!user || !canUploadPastPaper(user, subject)) return c.redirect('/past-papers');

    const apiKey = c.env[AI_CONFIG.apiKeyBinding];
    if (!apiKey) {
        return c.text('AI service not configured. Please set GEMINI_API_KEY.', 500);
    }

    const school = body['school_name'] as string;
    const year = parseInt(body['academic_year'] as string);
    const link = body['reference_link'] as string;
    const type = body['paper_type'] as string || 'Trial Paper';

    const file = body['pdf_file'];
    if (!(file instanceof File)) return c.text('Please upload a PDF file', 400);
    if (!file.name.toLowerCase().endsWith('.pdf')) return c.text('Please upload a PDF file', 400);

    try {

        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        const base64 = btoa(binary);


        const paperRes = await c.env.DB.prepare(
            'INSERT INTO papers (subject, school_name, academic_year, reference_link, paper_type) VALUES (?, ?, ?, ?, ?) RETURNING id'
        ).bind(subject, school, year, link, type).first<{ id: number }>();

        if (!paperRes) {
            return c.text('Failed to create paper', 500);
        }

        const paperId = paperRes.id;


        await c.env.BUCKET.put(`papers/${paperId}.pdf`, arrayBuffer, {
            httpMetadata: { contentType: 'application/pdf' },
        });


        const topicRows = await c.env.DB.prepare('SELECT name FROM topics WHERE subject = ?').bind(subject).all<{ name: string }>();
        const existingTopics = topicRows.results.map(t => t.name);

        const result = await callGemini(apiKey, base64, subject, existingTopics);

        if (result.questions.length === 0) {

            await logAction(c.env.DB, user.id, 'CREATE_PAPER', `Created paper ${school} ${year} (AI: no questions found)`, paperId, 'papers');
            return c.redirect(`/past-papers/paper/${paperId}`);
        }


        const count = await insertQuestionsFromAI(c.env.DB, c.env.BUCKET, paperId, subject, result.questions, 2);

        await logAction(c.env.DB, user.id, 'CREATE_PAPER_AI', `Created paper ${school} ${year} with ${count} AI-extracted questions`, paperId, 'papers');

        return c.redirect(`/past-papers/paper/${paperId}`);
    } catch (error: any) {
        console.error('[AI Import] Error:', error);
        return c.text(`AI import failed: ${error.message}. The paper may have been created — check the paper list.`, 500);
    }
});


export default app
