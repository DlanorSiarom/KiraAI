import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Trash2, ArrowUpRight, Clock } from 'lucide-react';
import { ChatExchange } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatExchange[];
  onSelectExchange: (exchange: ChatExchange) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectExchange,
  onClearHistory,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-sm bg-[#090d16] border-l border-white/10 p-6 z-10 flex flex-col h-full shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-base">Conversas Anteriores</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
              {history.length === 0 ? (
                <div className="text-center py-16 text-white/30 text-xs">
                  Nenhuma conversa registrada ainda.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectExchange(item);
                      onClose();
                    }}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-400/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-white/30 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    <p className="font-medium text-xs text-white mt-1.5 truncate">
                      {item.userMessage}
                    </p>
                    <p className="text-[11px] text-white/50 mt-1 line-clamp-2 leading-relaxed">
                      {item.conversationalLead}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={onClearHistory}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-rose-300 text-xs font-medium flex items-center justify-center gap-2 border border-white/5 hover:border-rose-500/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar histórico
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
