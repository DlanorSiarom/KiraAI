import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, ChevronDown, Sparkles, Compass, ArrowRight, Bookmark, Globe, ExternalLink, FastForward } from 'lucide-react';
import { ChatExchange } from '../types';
import { getCuratedImageUrl } from '../services/imageService';

interface ResultSheetProps {
  exchange: ChatExchange | null;
  isOpen: boolean;
  onClose: () => void;
  onFollowUpClick: (text: string) => void;
  isSpeaking: boolean;
  onToggleSpeech: () => void;
}

export const ResultSheet: React.FC<ResultSheetProps> = ({
  exchange,
  isOpen,
  onClose,
  onFollowUpClick,
  isSpeaking,
  onToggleSpeech,
}) => {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const fullText = exchange?.mainContent || '';
  const [displayedCount, setDisplayedCount] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Real-time typewriter effect: gives the sensation of live thought synthesis
  useEffect(() => {
    if (!isOpen || !fullText) {
      setDisplayedCount(0);
      setIsTyping(false);
      return;
    }

    // Only type if recently generated (< 45s ago), otherwise display completely
    const isRecent = exchange ? Date.now() - exchange.timestamp < 45000 : false;
    if (!isRecent) {
      setDisplayedCount(fullText.length);
      setIsTyping(false);
      return;
    }

    setDisplayedCount(0);
    setIsTyping(true);

    // Dynamic pacing: streams 2 to 5 characters every 18ms
    const step = Math.max(2, Math.ceil(fullText.length / 150));
    const intervalMs = 18;

    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= fullText.length) {
        setDisplayedCount(fullText.length);
        setIsTyping(false);
        clearInterval(timer);
      } else {
        setDisplayedCount(current);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [exchange?.id, isOpen]);

  const handleSkipTyping = () => {
    if (!exchange) return;
    setDisplayedCount(fullText.length);
    setIsTyping(false);
  };

  if (!exchange) return null;

  const typedSlice = fullText.slice(0, displayedCount);

  // Formatter for markdown paragraphs & bold syntax during live streaming
  const renderLiveText = (text: string) => {
    const paragraphs = text.split('\n');

    return (
      <div className="space-y-3">
        {paragraphs.map((p, pIdx) => {
          if (!p.trim()) {
            return <div key={pIdx} className="h-2" />;
          }

          const parts = p.split(/(\*\*[^*]+\*\*)/g);
          const isLastParagraph = pIdx === paragraphs.length - 1;

          return (
            <p key={pIdx} className="text-slate-200 text-sm sm:text-base leading-relaxed font-light">
              {parts.map((part, partIdx) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                  return (
                    <strong key={partIdx} className="font-semibold text-white drop-shadow-sm">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={partIdx}>{part}</span>;
              })}
              {isLastParagraph && isTyping && (
                <span
                  className="inline-block w-1.5 h-4 ml-1.5 bg-cyan-400 rounded-xs animate-pulse align-middle shadow-[0_0_10px_rgba(34,211,238,0.95)]"
                  title="Kira gerando pensamento..."
                />
              )}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop dim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          />

          {/* Frosted Glass Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 max-w-2xl mx-auto z-40 bg-[#0a0f1d]/90 backdrop-blur-2xl border-t border-blue-500/20 rounded-t-[36px] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Grabber bar / Minimize handle */}
            <div
              onClick={onClose}
              className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer group"
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
            </div>

            {/* Header section with question pill and action buttons */}
            <div className="px-6 pb-3 pt-1 flex items-center justify-between border-b border-white/5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-blue-200">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate max-w-[240px] sm:max-w-xs">{exchange.userMessage}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Live typing status indicator & skip button */}
                {isTyping && (
                  <button
                    onClick={handleSkipTyping}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-[11px] font-medium text-cyan-300 transition-all cursor-pointer animate-pulse"
                    title="Exibir resposta completa imediatamente"
                  >
                    <FastForward className="w-3 h-3 text-cyan-400" />
                    <span>Pular escrita</span>
                  </button>
                )}

                {/* Voice speech toggle */}
                <button
                  onClick={onToggleSpeech}
                  className={`p-2 rounded-full transition-all cursor-pointer ${
                    isSpeaking
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                      : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
                  }`}
                  title={isSpeaking ? 'Pausar áudio' : 'Ouvir resposta'}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Close sheet */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Minimizar para o orbe"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable body content */}
            <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/10">
              {/* New memory notice badge */}
              {exchange.newMemories && exchange.newMemories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-blue-300">Nova memória memorizada pelo Orbe</p>
                    <p className="text-blue-200/80 mt-0.5">
                      "{exchange.newMemories[0].text}"
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Main formatted response with real-time live typing effect */}
              <div className="prose prose-invert max-w-none">
                {renderLiveText(typedSlice)}
              </div>

              {/* Web Sources Grounding Badges */}
              {exchange.sources && exchange.sources.length > 0 && (!isTyping || displayedCount >= fullText.length * 0.7) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2 pt-2 pb-1"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Fontes Pesquisadas na Internet</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exchange.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-xs text-cyan-200 hover:text-white transition-all group shadow-sm"
                        title={s.snippet || s.title}
                      >
                        <ExternalLink className="w-3 h-3 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                        <span className="truncate max-w-[220px]">{s.title}</span>
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Curated visual cards (matching the video's Rome highlights) */}
              {exchange.cards && exchange.cards.length > 0 && (!isTyping || displayedCount >= fullText.length * 0.8) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 pt-2"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Destaques & Recomendações</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {exchange.cards.map((card, idx) => {
                      const img = card.imageUrl || getCuratedImageUrl(card.imageKeyword, card.title);
                      const isExpanded = selectedCardIndex === idx;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedCardIndex(isExpanded ? null : idx)}
                          className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-blue-400/40 transition-all cursor-pointer shadow-lg hover:shadow-blue-500/10 flex flex-col justify-end min-h-[140px]"
                        >
                          {/* Image background with gradient overlay */}
                          <div className="absolute inset-0">
                            <img
                              src={img}
                              alt={card.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                          </div>

                          {/* Card Text Content */}
                          <div className="relative p-4 z-10">
                            <h4 className="font-semibold text-white text-base tracking-tight leading-snug drop-shadow-md">
                              {card.title}
                            </h4>
                            <p className="text-xs text-blue-300 font-medium mt-0.5 drop-shadow">
                              {card.subtitle}
                            </p>
                            <p className="text-xs text-slate-300/90 mt-1.5 line-clamp-2 leading-relaxed">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Follow-up suggestions */}
              {exchange.suggestedFollowUps && exchange.suggestedFollowUps.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Perguntas sugeridas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {exchange.suggestedFollowUps.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => onFollowUpClick(question)}
                        className="text-xs px-3.5 py-2 rounded-full bg-white/10 hover:bg-blue-600/30 border border-white/10 hover:border-blue-400/40 text-blue-100 transition-all flex items-center gap-1.5 group text-left"
                      >
                        <span>{question}</span>
                        <ArrowRight className="w-3 h-3 text-white/50 group-hover:translate-x-0.5 group-hover:text-blue-300 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
