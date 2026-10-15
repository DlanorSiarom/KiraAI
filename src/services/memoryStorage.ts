import { MemoryItem } from '../types';

const MEMORIES_STORAGE_KEY = 'orb_ai_memories_v1';
const USER_NAME_STORAGE_KEY = 'orb_ai_user_name_v1';

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem-1',
    category: 'interest',
    text: 'Tem interesse em viagens culturais, arquitetura histórica e gastronomia autêntica.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'mem-2',
    category: 'preference',
    text: 'Prefere respostas refinadas, diretas ao ponto, com recomendações práticas.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: 'mem-3',
    category: 'fact',
    text: 'Curte explorar cidades a pé e descobrir cantos fora do circuito turístico comum.',
    timestamp: Date.now() - 1000 * 60 * 60 * 12,
  },
];

export function getStoredMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(INITIAL_MEMORIES));
      return INITIAL_MEMORIES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Falha ao carregar memórias:', e);
    return INITIAL_MEMORIES;
  }
}

export function saveStoredMemories(memories: MemoryItem[]): void {
  try {
    localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(memories));
  } catch (e) {
    console.error('Falha ao salvar memórias:', e);
  }
}

export function addMemories(newItems: { category: string; text: string }[]): MemoryItem[] {
  const current = getStoredMemories();
  const added: MemoryItem[] = [];

  for (const item of newItems) {
    // Avoid exact duplicate text
    const exists = current.some(
      (m) => m.text.toLowerCase().trim() === item.text.toLowerCase().trim()
    );
    if (!exists && item.text.trim().length > 3) {
      const validCategory: MemoryItem['category'] =
        item.category === 'preference' ||
        item.category === 'fact' ||
        item.category === 'interest' ||
        item.category === 'goal' ||
        item.category === 'personal'
          ? item.category
          : 'fact';

      const newMem: MemoryItem = {
        id: 'mem-' + Math.random().toString(36).substring(2, 9),
        category: validCategory,
        text: item.text.trim(),
        timestamp: Date.now(),
      };
      added.push(newMem);
    }
  }

  if (added.length > 0) {
    const updated = [...added, ...current];
    saveStoredMemories(updated);
    return updated;
  }

  return current;
}

export function deleteMemory(id: string): MemoryItem[] {
  const current = getStoredMemories();
  const updated = current.filter((m) => m.id !== id);
  saveStoredMemories(updated);
  return updated;
}

export function clearAllMemories(): void {
  saveStoredMemories([]);
}

export function getStoredUserName(): string {
  try {
    return localStorage.getItem(USER_NAME_STORAGE_KEY) || 'Robin';
  } catch {
    return 'Robin';
  }
}

export function setStoredUserName(name: string): void {
  try {
    localStorage.setItem(USER_NAME_STORAGE_KEY, name);
  } catch (e) {
    console.error('Falha ao salvar nome de usuário:', e);
  }
}
