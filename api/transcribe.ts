import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeAudio } from '../src/server/geminiService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum áudio fornecido para transcrição.' });
    }

    const text = await transcribeAudio(audioBase64, mimeType);
    return res.status(200).json({ success: true, text });
  } catch (error: any) {
    console.error('Erro na rota /api/transcribe:', error);
    return res.status(500).json({
      error: 'Falha ao transcrever áudio com Gemini.',
      details: error?.message || String(error),
    });
  }
}
