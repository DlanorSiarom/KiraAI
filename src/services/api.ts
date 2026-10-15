import { MemoryItem } from '../types';

interface SendMessageParams {
  message: string;
  history: { role: 'user' | 'model'; content: string }[];
  memories: MemoryItem[];
  userName: string;
}

interface ChatApiResponse {
  success: boolean;
  conversationalLead: string;
  mainContent: string;
  cards: {
    title: string;
    subtitle: string;
    description: string;
    imageKeyword: string;
  }[];
  newMemories: {
    category: string;
    text: string;
  }[];
  detectedUserName?: string | null;
  suggestedFollowUps?: string[];
  sources?: {
    title: string;
    url: string;
    snippet?: string;
  }[];
  audioData?: string | null;
  error?: string;
}

export interface ApiHealthStatus {
  status: 'ok' | 'missing_key' | 'error';
  hasApiKey: boolean;
  message: string;
}

// Check if the backend AI route is reachable and API key is present
export async function checkApiHealth(): Promise<ApiHealthStatus> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return {
        status: 'error',
        hasApiKey: false,
        message: `Servidor retornou status ${res.status}.`,
      };
    }
    const data = await res.json();
    return {
      status: data.status || 'ok',
      hasApiKey: Boolean(data.hasApiKey),
      message: data.message || '',
    };
  } catch (err: any) {
    return {
      status: 'error',
      hasApiKey: false,
      message: 'Não foi possível conectar com o endpoint de saúde da API.',
    };
  }
}

export async function sendChatMessage(params: SendMessageParams): Promise<ChatApiResponse> {
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  } catch (netErr: any) {
    throw new Error(
      `Falha de rede ao conectar com /api/chat. Verifique sua conexão com a internet. (${netErr?.message || 'Erro de rede'})`
    );
  }

  const contentType = response.headers.get('content-type') || '';

  // If response is HTML (happens if Vercel rewrites /api/chat to index.html or returns a default 404/504 HTML page)
  if (contentType.includes('text/html')) {
    const htmlText = await response.text().catch(() => '');
    if (response.status === 404) {
      throw new Error(
        'Endpoint /api/chat não encontrado (404). As funções Serverless da Vercel precisam ser implantadas no mesmo projeto.'
      );
    }
    if (response.status === 504 || htmlText.includes('504')) {
      throw new Error(
        'Tempo limite de execução atingido na Vercel (Gateway Timeout 504). Tente uma pergunta mais concisa.'
      );
    }
    throw new Error(
      'A rota /api/chat retornou HTML em vez de JSON. Certifique-se de fazer um novo deploy na Vercel para aplicar a correção do vercel.json.'
    );
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      const rawText = await response.text().catch(() => '');
      errorData = { details: rawText };
    }

    const detailMsg = errorData.details || errorData.error || '';

    if (detailMsg.includes('GEMINI_API_KEY')) {
      throw new Error(
        'A variável GEMINI_API_KEY não foi configurada na Vercel. Adicione GEMINI_API_KEY nas variáveis de ambiente do seu projeto na Vercel (Settings > Environment Variables) e faça um novo deploy.'
      );
    }

    if (detailMsg.includes('429') || detailMsg.includes('quota') || detailMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Limite de cota de requisições da API Gemini atingido. Aguarde alguns instantes antes de tentar novamente.'
      );
    }

    if (detailMsg.includes('API_KEY_INVALID') || detailMsg.includes('403') || detailMsg.includes('401')) {
      throw new Error(
        'A chave da API Gemini é inválida ou expirou. Verifique sua chave em ai.google.dev.'
      );
    }

    throw new Error(detailMsg || errorData.error || `Erro HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch (jsonErr: any) {
    throw new Error('Falha ao decodificar resposta JSON da Kira: ' + jsonErr.message);
  }
}
