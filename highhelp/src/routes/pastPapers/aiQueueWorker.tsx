
import { logAction } from '../../utils'
import { Bindings } from '../../types'

import {callGemini, insertQuestionsFromAI} from "./aiImport"


export interface AIImportJob {
  paperId: number;
  subject: string;
  userId: number;
  mode: 'import' | 'create'; // so we know which log action to use
  schoolName?: string;
  year?: number;
}

export async function processAIImportJob(job: AIImportJob, env: Bindings) {
  const { paperId, subject, userId, mode } = job;

  
  await env.DB.prepare("UPDATE papers SET ai_status = 'processing' WHERE id = ?")
    .bind(paperId).run();

  try {
  
    const obj = await env.BUCKET.get(`papers/${paperId}.pdf`);
    if (!obj) throw new Error('PDF not found in R2');

    const arrayBuffer = await obj.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const topicRows = await env.DB.prepare('SELECT name FROM topics WHERE subject = ?')
      .bind(subject).all<{ name: string }>();
    const existingTopics = topicRows.results.map(t => t.name);

    const result = await callGemini(env.GEMINI_API_KEY, base64, subject, existingTopics);

    const count = await insertQuestionsFromAI(env.DB, env.BUCKET, paperId, subject, result.questions, userId);

    
    await env.DB.prepare("UPDATE papers SET ai_status = 'done' WHERE id = ?")
      .bind(paperId).run();

    await logAction(env.DB, userId, 'AI_IMPORT',
      `AI imported ${count} questions into paper ${paperId}`, paperId, 'papers');

  } catch (err: any) {
    await env.DB.prepare("UPDATE papers SET ai_status = 'error', ai_error = ? WHERE id = ?")
      .bind(err.message, paperId).run();
    throw err; 
  }
}