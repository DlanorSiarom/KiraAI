import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeAudio } from './_geminiService';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
      }
    }

    const { audioBase64, mimeType = 'audio/webm' } = body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum áudio fornecido para transcrição.' });
    }

    const text = await transcribeAudio(audioBase64, mimeType);
    return res.status(200).json({ success: true, text });
  } catch (error: any) {
    console.error('Erro na rota /api/transcribe:', error);
    const errMsg = error?.message || String(error);

    let userFriendlyError = 'Falha ao transcrever áudio com Gemini.';
    if (errMsg.includes('GEMINI_API_KEY')) {
      userFriendlyError = 'A variável de ambiente GEMINI_API_KEY não está configurada na Vercel.';
    }

    return res.status(500).json({
      error: userFriendlyError,
      details: errMsg,
    });
  }
}
