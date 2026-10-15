import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { processKiraChat, transcribeAudio } from './api/_geminiService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

// Chat endpoint (shared logic with Vercel api/chat.ts)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      history = [],
      memories = [],
      userName = 'Mestra',
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Mensagem inválida.' });
      return;
    }

    const result = await processKiraChat({
      message,
      history,
      memories,
      userName,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Erro na API /api/chat:', error);
    res.status(500).json({
      error: 'Falha ao processar resposta do Orbe.',
      details: error?.message || String(error),
    });
  }
});

// Audio transcribe endpoint (shared logic with Vercel api/transcribe.ts)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Nenhum áudio fornecido para transcrição.' });
      return;
    }

    const text = await transcribeAudio(audioBase64, mimeType);
    res.json({ success: true, text });
  } catch (error: any) {
    console.error('Erro na rota /api/transcribe:', error);
    res.status(500).json({
      error: 'Falha ao transcrever áudio com Gemini.',
      details: error?.message || String(error),
    });
  }
});

// Health check endpoint (shared logic with Vercel api/health.ts)
app.get('/api/health', (_req: Request, res: Response) => {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;

  res.json({
    status: apiKey ? 'ok' : 'missing_key',
    hasApiKey: Boolean(apiKey),
    timestamp: Date.now(),
    message: apiKey
      ? 'API da Kira conectada e chave Gemini detectada.'
      : 'GEMINI_API_KEY não encontrada nas variáveis de ambiente.',
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
