import { logAction } from '../../utils'
import { Bindings } from '../../types'
import { callGemini, insertQuestionsFromAI } from "./aiImport"

export interface AIImportJob {
  paperId: number;
  subject: string;
  userId: number;
  mode: 'import' | 'create';
  schoolName?: string;
  year?: number;
}

// Safely converts an ArrayBuffer to Base64 in Cloudflare Workers 
// without hitting V8 call stack limits or typed array apply quirks.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // Convert to a regular array for apply to guarantee safety
    const arr = new Array(chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      arr[j] = chunk[j];
    }
    binary += String.fromCharCode.apply(null, arr);
  }
  return btoa(binary);
}

export async function processAIImportJob(job: AIImportJob, env: Bindings) {
  const { paperId, subject, userId, mode } = job;

  await env.DB.prepare("UPDATE papers SET ai_status = 'processing' WHERE id = ?")
    .bind(paperId).run();

  try {
    const obj = await env.BUCKET.get(`papers/${paperId}.pdf`);
    if (!obj) throw new Error('PDF not found in R2');

    const arrayBuffer = await obj.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer); // Use the safe converter

    const topicRows = await env.DB.prepare('SELECT name FROM topics WHERE subject = ?')
      .bind(subject).all<{ name: string }>();
    const existingTopics = topicRows.results.map(t => t.name);

    const result = await callGemini(env.GEMINI_API_KEY, base64, subject, existingTopics);

    const count = await insertQuestionsFromAI(env.DB, env.BUCKET, paperId, subject, result.questions, userId);

    await env.DB.prepare("UPDATE papers SET ai_status = 'done' WHERE id = ?")
      .bind(paperId).run();

    await logAction(env.DB, 2, 'AI_IMPORT',
      `AI imported ${count} questions into paper ${paperId}`, paperId, 'papers');

  } catch (err: any) {
    throw err;
  }
}