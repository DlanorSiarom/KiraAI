import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 60,
};

function getAiClient(): GoogleGenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

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

  const ai = getAiClient();
  if (!ai) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada na Vercel.',
      details: 'Acesse o painel da Vercel > Settings > Environment Variables e adicione a variável GEMINI_API_KEY.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
      }
    }

    const { audioBase64, mimeType = 'audio/webm' } = body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum áudio fornecido para transcrição.' });
    }

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastErr: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: 'Transcreva com precisão o que o usuário falou neste áudio em português. Retorne APENAS a transcrição textual pura das palavras faladas, sem explicações, sem aspas e sem saudações adicionais. Se não houver fala audível, retorne uma string vazia.',
                },
              ],
            },
          ],
        });

        const text = response.text?.trim() || '';
        return res.status(200).json({ success: true, text });
      } catch (err: any) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('Falha ao transcrever áudio.');
  } catch (error: any) {
    console.error('Erro na rota /api/transcribe:', error);
    const errMsg = error?.message || String(error);

    return res.status(500).json({
      error: 'Falha ao transcrever áudio com Gemini.',
      details: errMsg,
    });
  }
}
