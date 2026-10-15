import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processKiraChat } from '../src/server/geminiService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      message,
      history = [],
      memories = [],
      userName = 'Mestra',
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida.' });
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
    return res.status(500).json({
      error: 'Falha ao processar resposta do Orbe.',
      details: error?.message || String(error),
    });
  }
}
