import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, X, Trash2, Plus, Sparkles, User, Tag, Check, RefreshCw } from 'lucide-react';
import { MemoryItem } from '../types';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryItem[];
  onAddMemory: (category: MemoryItem['category'], text: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearAll: () => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearAll,
  userName,
  onUpdateUserName,
}) => {
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('preference');
  const [editingName, setEditingName] = useState(userName);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [nameSavedNotice, setNameSavedNotice] = useState(false);

  const handleSaveName = () => {
    if (editingName.trim()) {
      onUpdateUserName(editingName.trim());
      setNameSavedNotice(true);
      setTimeout(() => setNameSavedNotice(false), 2000);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newText.trim()) {
      onAddMemory(newCategory, newText.trim());
      setNewText('');
    }
  };

  const filteredMemories = memories.filter((m) => {
    if (activeFilter === 'all') return true;
    return m.category === activeFilter;
  });

  const getCategoryBadge = (cat: MemoryItem['category']) => {
    switch (cat) {
      case 'preference':
        return { label: 'Preferência', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'interest':
        return { label: 'Interesse', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
      case 'fact':
        return { label: 'Fato', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'goal':
        return { label: 'Objetivo', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'personal':
        return { label: 'Pessoal', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      default:
        return { label: 'Memória', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-lg bg-[#0d1424]/95 border border-blue-500/30 rounded-3xl p-6 shadow-2xl shadow-blue-500/10 z-10 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Memória Adaptativa do Orbe</h3>
                  <p className="text-xs text-blue-300/80">
                    O que a IA aprendeu nas suas conversas
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Config */}
            <div className="py-4 border-b border-white/10">
              <label className="text-xs font-medium text-white/70 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  Como o Orbe deve chamar você:
                </span>
                {nameSavedNotice && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Salvo!
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Todas ({memories.length})
              </button>
              <button
                onClick={() => setActiveFilter('preference')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  activeFilter === 'preference'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Preferências
              </button>
              <button
                onClick={() => setActiveFilter('interest')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  activeFilter === 'interest'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Interesses
              </button>
              <button
                onClick={() => setActiveFilter('fact')}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  activeFilter === 'fact'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Fatos
              </button>
            </div>

            {/* Memories List */}
            <div className="flex-1 overflow-y-auto py-2 space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 min-h-[160px] max-h-[260px]">
              {filteredMemories.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">
                  Nenhuma memória nesta categoria ainda. O Orbe aprende conforme vocês conversam!
                </div>
              ) : (
                filteredMemories.map((mem) => {
                  const badge = getCategoryBadge(mem.category);
                  return (
                    <div
                      key={mem.id}
                      className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-400/30 transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-white/30">
                            {new Date(mem.timestamp).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-light">
                          {mem.text}
                        </p>
                      </div>

                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Esquecer este fato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add memory manually */}
            <form onSubmit={handleCreate} className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryItem['category'])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-blue-400"
                >
                  <option value="preference" className="bg-slate-900 text-white">Preferência</option>
                  <option value="interest" className="bg-slate-900 text-white">Interesse</option>
                  <option value="fact" className="bg-slate-900 text-white">Fato pessoal</option>
                  <option value="goal" className="bg-slate-900 text-white">Objetivo</option>
                </select>

                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Ensinar fato novo ao Orbe..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                />

                <button
                  type="submit"
                  disabled={!newText.trim()}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Salvar
                </button>
              </div>

              {/* Bottom footer bar with clear all */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-white/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  Memória sincronizada localmente
                </span>
                {memories.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-[11px] text-rose-400/80 hover:text-rose-300 transition-colors"
                  >
                    Limpar todas as memórias
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
