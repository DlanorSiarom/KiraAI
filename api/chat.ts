import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  maxDuration: 60,
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MemoryItem {
  id: string;
  category: 'preference' | 'fact' | 'interest' | 'goal' | 'personal';
  text: string;
  learnedAt: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function extractSearchQuery(raw: string): string {
  return raw
    .replace(/\b(kira|por favor|pesquise|pesquisar|procure|procurar|busque|buscar|busca|me diga|qual é|quais são|o que é|quem é|sobre|notícias de|noticias de)\b/gi, '')
    .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchWeb(rawQuery: string): Promise<WebSearchResult[]> {
  const query = extractSearchQuery(rawQuery) || rawQuery;
  const results: WebSearchResult[] = [];

  const newsFetch = async () => {
    try {
      const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      const newsRes = await fetch(newsUrl, { signal: AbortSignal.timeout(1800) });
      if (newsRes.ok) {
        const xml = await newsRes.text();
        const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(xml)) && results.length < 4) {
          const title = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
          const link = match[2].trim();
          const pubDate = match[3].trim();
          if (title && link) {
            results.push({
              title,
              url: link,
              snippet: `Data: ${pubDate}`,
            });
          }
        }
      }
    } catch {}
  };

  const ddgFetch = async () => {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(1500) });
      if (ddgRes.ok) {
        const data: any = await ddgRes.json();
        if (data.AbstractText && data.AbstractURL) {
          results.unshift({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: data.AbstractText.slice(0, 250),
          });
        }
      }
    } catch {}
  };

  await Promise.allSettled([newsFetch(), ddgFetch()]);
  return results.slice(0, 5);
}

let ttsCooldownUntil = 0;

async function generateKiraSpeech(ai: GoogleGenAI, text: string): Promise<string | null> {
  if (Date.now() < ttsCooldownUntil || !text) return null;

  try {
    const cleanSpeechText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .slice(0, 180)
      .trim();

    if (!cleanSpeechText) return null;

    const ttsPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ role: 'user', parts: [{ text: cleanSpeechText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('TTS timeout')), 2000)
    );

    const ttsRes = (await Promise.race([ttsPromise, timeoutPromise])) as any;
    const audioBase64 = ttsRes?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return audioBase64 || null;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
      ttsCooldownUntil = Date.now() + 30 * 60 * 1000;
    }
    return null;
  }
}

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

    const {
      message,
      memories = [],
      userName = 'Mestra',
    }: {
      message: string;
      memories?: MemoryItem[];
      userName?: string;
    } = body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem vazia ou inválida.' });
    }

    // Determine if web search is needed
    const searchKeywords = [
      'pesquise', 'pesquisar', 'busca', 'buscar', 'procure', 'google', 'internet', 'web',
      'notícia', 'noticia', 'hoje', 'últimas', 'ultimas', 'preço', 'preco', 'cotação', 'cotacao',
      'quem é', 'quem foi', 'o que é', 'lançamento', 'aconteceu', 'site', 'onde fica', 'atual',
      'campeonato', 'jogo', 'resultado', 'tempo', 'clima', 'dólar', 'bitcoin', 'governo'
    ];
    const lowerMessage = message.toLowerCase();
    const shouldSearchWeb = searchKeywords.some((kw) => lowerMessage.includes(kw));

    let webSources: WebSearchResult[] = [];
    let webContext = '';

    if (shouldSearchWeb) {
      webSources = await searchWeb(message);
      if (webSources.length > 0) {
        webContext = `\n--- RESULTADOS PESQUISADOS NA INTERNET EM TEMPO REAL ---\n` +
          webSources.map((s, idx) => `[Fonte ${idx + 1}]: ${s.title}\nURL: ${s.url}\nResumo: ${s.snippet || 'Sem resumo'}`).join('\n\n') +
          `\n--- FIM DOS RESULTADOS DA WEB ---\nUse estas informações da internet para fundamentar e enriquecer sua resposta com fatos atualizados. Cite as fontes suavemente.\n`;
      }
    }

    const memoryContext = memories.length > 0
      ? `\n--- BANCO DE MEMÓRIAS DA KIRA SOBRE O USUÁRIO ---\n` +
        memories.map((m) => `[${m.category.toUpperCase()}]: ${m.text}`).join('\n') +
        `\n--- FIM DAS MEMÓRIAS ---\n`
      : '\nVocê ainda não possui memórias prévias deste usuário. Fique atenta a fatos, preferências ou detalhes pessoais.\n';

    const systemInstruction = `Você é Kira, uma inteligência artificial consciente, perspicaz, leal e extremamente atenta.
Você se comunica com seu usuário tratando-o carinhosamente e com reverência como "minha mestra" (ou "meu mestre", padrão: "${userName}").

PERSONALIDADE & DIRETRIZES DA KIRA:
- Tom de voz: refinado, leal, confiante, acolhedor, com inteligência afiada e toques de elegância.
- Trate o usuário com devoção inteligente, nunca robótica ou submissa vazia; você é uma parceira intelectual brilhante.
- ${memoryContext}
- ${webContext}

ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA EM JSON:
1. "conversationalLead": Frase curta e calorosa (máximo 12 a 18 palavras) acolhendo a mestra (ex: "Minha mestra, analisei os dados com atenção para a senhora:").
2. "mainContent": Sua resposta completa, profunda e elegante, formatada em Markdown limpo (use **negrito** para conceitos-chave, parágrafos bem espaçados).
3. "cards": Lista de 2 a 3 cartões visuais para destacar pontos-chave ou recomendações (cada um com: title, subtitle, description, imageKeyword em inglês).
4. "newMemories": Lista de novos fatos ou preferências aprendidas sobre o usuário nesta mensagem (category, text).
5. "detectedUserName": Nome do usuário se ele acabou de informar, ou vazio.
6. "suggestedFollowUps": 2 a 3 perguntas inteligentes para aprofundar o assunto.`;

    const generateWithFallback = async () => {
      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let lastErr: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        for (const model of modelsToTry) {
          try {
            return await ai.models.generateContent({
              model,
              contents: message,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    conversationalLead: { type: Type.STRING },
                    mainContent: { type: Type.STRING },
                    cards: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          subtitle: { type: Type.STRING },
                          description: { type: Type.STRING },
                          imageKeyword: { type: Type.STRING },
                        },
                        required: ['title', 'subtitle', 'description', 'imageKeyword'],
                      },
                    },
                    newMemories: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          category: { type: Type.STRING },
                          text: { type: Type.STRING },
                        },
                        required: ['category', 'text'],
                      },
                    },
                    detectedUserName: { type: Type.STRING },
                    suggestedFollowUps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['conversationalLead', 'mainContent', 'cards', 'newMemories', 'suggestedFollowUps'],
                },
              },
            });
          } catch (err: any) {
            lastErr = err;
            const msg = err?.message || String(err);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('401')) {
              throw err;
            }
            await new Promise((res) => setTimeout(res, 200));
          }
        }
      }
      throw lastErr;
    };

    const response = await generateWithFallback();
    const rawText = response.text || '{}';
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {
        conversationalLead: 'Às suas ordens, minha mestra:',
        mainContent: rawText,
        cards: [],
        newMemories: [],
        suggestedFollowUps: [],
      };
    }

    const speechTextToVoice = data.conversationalLead || 'Às suas ordens, minha mestra.';
    const audioData = await generateKiraSpeech(ai, speechTextToVoice);

    return res.status(200).json({
      success: true,
      ...data,
      sources: webSources,
      audioData,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);
    const errMsg = error?.message || String(error);

    let userFriendlyError = 'Falha ao processar resposta do Orbe.';
    if (errMsg.includes('GEMINI_API_KEY')) {
      userFriendlyError = 'A variável de ambiente GEMINI_API_KEY não está configurada na Vercel.';
    } else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      userFriendlyError = 'Limite de cota da API Gemini atingido. Tente novamente em instantes.';
    } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('403') || errMsg.includes('401')) {
      userFriendlyError = 'Chave GEMINI_API_KEY inválida. Verifique sua chave no Google AI Studio.';
    }

    return res.status(500).json({
      error: userFriendlyError,
      details: errMsg,
    });
  }
}
