export interface MemoryItem {
  id: string;
  category: 'preference' | 'fact' | 'interest' | 'goal' | 'personal';
  text: string;
  timestamp: number;
}

export interface CuratedCard {
  title: string;
  subtitle: string;
  description: string;
  imageKeyword: string;
  imageUrl?: string;
}

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatExchange {
  id: string;
  userMessage: string;
  conversationalLead: string;
  mainContent: string;
  cards: CuratedCard[];
  timestamp: number;
  newMemories?: { category: string; text: string }[];
  suggestedFollowUps?: string[];
  sources?: WebSource[];
  audioData?: string | null;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
