import { ChatExchange, MemoryItem } from '../types';

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

export async function sendChatMessage(params: SendMessageParams): Promise<ChatApiResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}
