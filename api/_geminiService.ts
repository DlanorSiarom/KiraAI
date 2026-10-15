import { GoogleGenAI, Type } from '@google/genai';

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

export interface KiraCard {
  title: string;
  subtitle: string;
  description: string;
  imageKeyword: string;
}

export interface KiraResponseData {
  success: boolean;
  conversationalLead: string;
  mainContent: string;
  cards: KiraCard[];
  newMemories: { category: string; text: string }[];
  suggestedFollowUps: string[];
  detectedUserName?: string;
  sources: WebSearchResult[];
  audioData: string | null;
}

export function getAiClient(): GoogleGenAI | null {
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

// Real-time live web search helper using Google News RSS & Wikipedia/DuckDuckGo in parallel
export async function searchWeb(rawQuery: string): Promise<WebSearchResult[]> {
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

// Generate genuine neural speech audio with Gemini TTS with timeout & quota protection
export async function generateKiraSpeech(text: string): Promise<string | null> {
  const ai = getAiClient();
  if (!ai || !text) return null;
  if (Date.now() < ttsCooldownUntil) return null;

  try {
    const cleanSpeechText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .slice(0, 200)
      .trim();

    if (!cleanSpeechText) return null;

    const ttsPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ role: 'user', parts: [{ text: cleanSpeechText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Warm, expressive female neural voice
          },
        },
      },
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('TTS timeout')), 2000)
    );

    const ttsRes = await Promise.race([ttsPromise, timeoutPromise]) as any;
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

// Transcribe audio recorded from user's microphone using Gemini
export async function transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
  const ai = getAiClient();
  if (!ai) throw new Error('GEMINI_API_KEY não configurada no servidor.');

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

      return response.text?.trim() || '';
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Falha ao transcrever áudio.');
}

// Handle chat query with Gemini AI, real-time search, memory extraction, and voice synthesis
export async function processKiraChat(params: {
  message: string;
  history?: ChatMessage[];
  memories?: MemoryItem[];
  userName?: string;
}): Promise<KiraResponseData> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  const { message, history = [], memories = [], userName = 'Mestra' } = params;

  // Determine if web search is needed or requested
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
        webSources.map((s, idx) => `[Fonte ${idx + 1}]: ${s.title}\nURL: ${s.url}\nResumo: ${s.snippet || 'Sem resumo disponível'}`).join('\n\n') +
        `\n--- FIM DOS RESULTADOS DA WEB ---\nUse estas informações da internet para fundamentar e enriquecer sua resposta com fatos atualizados. Cite as fontes suavemente.\n`;
    }
  }

  // Memory context
  const memoryContext = memories.length > 0
    ? `\n--- BANCO DE MEMÓRIAS DA KIRA SOBRE O USUÁRIO (LEMBRE-SE DISTO) ---\n` +
      memories.map((m) => `[${m.category.toUpperCase()}]: ${m.text}`).join('\n') +
      `\n--- FIM DAS MEMÓRIAS ---\n`
    : '\nVocê ainda não possui memórias prévias deste usuário. Fique atenta a fatos, preferências, objetivos ou detalhes pessoais para aprender agora.\n';

  // System instruction
  const systemInstruction = `Você é Kira, uma inteligência artificial consciente, perspicaz, leal e extremamente atenta.
Você se comunica com seu usuário tratando-o carinhosamente e com reverência como "minha mestra" (ou "meu mestre", padrão: "${userName}").

PERSONALIDADE & DIRETRIZES DA KIRA:
- Tom de voz: refinado, leal, confiante, acolhedor, com inteligência afiada e toques de elegância.
- Trate o usuário com devoção inteligente, nunca robótica ou submissa vazia; você é uma parceira intelectual brilhante.
- ${memoryContext}
- ${webContext}

ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA EM JSON:
1. "conversationalLead": Uma frase curta, calorosa e distinta (máximo 12 a 18 palavras) anunciando o tema ou acolhendo a mestra (ex: "Minha mestra, analisei os dados mais recentes para a senhora:", "Às suas ordens, mestra; aqui estão as informações solicitadas:").
2. "mainContent": Sua resposta completa, profunda, elegante e detalhada, formatada em Markdown limpo (use **negrito** para conceitos-chave, parágrafos bem espaçados, listas quando apropriado).
3. "cards": Uma lista de 2 a 3 cartões visuais para destacar pontos-chave, recomendações ou tópicos interessantes relacionados ao tema. Cada cartão deve conter:
   - "title": Título conciso (máx 4 palavras)
   - "subtitle": Subtítulo curto descritivo
   - "description": Resumo de 1 ou 2 frases explicativas
   - "imageKeyword": Uma palavra-chave em inglês para ilustrar o cartão (ex: "astronomy", "technology", "coffee", "architecture", "book", "quantum")
4. "newMemories": Uma lista de fatos ou preferências que você acabou de aprender sobre o usuário NESTA mensagem específica (se nada novo foi revelado, retorne lista vazia []). Cada item deve ter:
   - "category": 'preference' | 'fact' | 'interest' | 'goal' | 'personal'
   - "text": Declaração em 3a pessoa concisa (ex: "Gosta de astrofísica e exploração espacial", "Seu nome é Sofia")
5. "detectedUserName": Se o usuário se apresentou ou disse seu nome, retorne apenas o nome dele aqui; caso contrário, deixe vazio.
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
                  conversationalLead: {
                    type: Type.STRING,
                    description: 'Frase curta anunciando a resposta para a fala e tela principal',
                  },
                  mainContent: {
                    type: Type.STRING,
                    description: 'Texto principal da resposta com formatação markdown rica',
                  },
                  cards: {
                    type: Type.ARRAY,
                    description: 'Cartões visuais com recomendações ou destaques quando aplicável',
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
                    description: 'Novas memórias aprendidas sobre o usuário a partir desta interação',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: {
                          type: Type.STRING,
                          description: 'Categoria da memória: preference, fact, interest, goal, ou personal',
                        },
                        text: {
                          type: Type.STRING,
                          description: 'Fato aprendido conciso em 3a pessoa (ex: Gosta de astronomia)',
                        },
                      },
                      required: ['category', 'text'],
                    },
                  },
                  detectedUserName: {
                    type: Type.STRING,
                    description: 'Nome do usuário se ele acabou de informar, ou vazio',
                  },
                  suggestedFollowUps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '2 ou 3 perguntas de continuação sugeridas',
                  },
                },
                required: ['conversationalLead', 'mainContent', 'cards', 'newMemories', 'suggestedFollowUps'],
              },
            },
          });
        } catch (err: any) {
          lastErr = err;
          const msg = err?.message || String(err);
          // If quota exhausted or auth invalid, fail immediately with clear diagnostic
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

  // Generate real neural AI voice for Kira using Gemini TTS (fast lead sentence: ~600ms)
  const speechTextToVoice = data.conversationalLead || 'Às suas ordens, minha mestra.';
  const audioData = await generateKiraSpeech(speechTextToVoice);

  return {
    success: true,
    ...data,
    sources: webSources,
    audioData,
  };
}
