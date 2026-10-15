import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processKiraChat } from '../src/server/geminiService';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS support
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

    const {
      message,
      history = [],
      memories = [],
      userName = 'Mestra',
    } = body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem vazia ou inválida.' });
    }

    const result = await processKiraChat({
      message,
      history,
      memories,
      userName,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);
    const errMsg = error?.message || String(error);

    let userFriendlyError = 'Falha ao processar resposta do Orbe.';
    if (errMsg.includes('GEMINI_API_KEY')) {
      userFriendlyError = 'A variável de ambiente GEMINI_API_KEY não está configurada na Vercel.';
    } else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      userFriendlyError = 'Limite de cota da API Gemini atingido. Tente novamente em instantes.';
    } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('403')) {
      userFriendlyError = 'Chave GEMINI_API_KEY inválida. Verifique sua chave no Google AI Studio.';
    }

    return res.status(500).json({
      error: userFriendlyError,
      details: errMsg,
    });
  }
}
