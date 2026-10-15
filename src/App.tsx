import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  Brain,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Info,
  Waves,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Orb } from './components/Orb';
import { ResultSheet } from './components/ResultSheet';
import { MemoryModal } from './components/MemoryModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ChatExchange, MemoryItem, OrbState } from './types';
import {
  getStoredMemories,
  saveStoredMemories,
  addMemories,
  deleteMemory,
  clearAllMemories,
  getStoredUserName,
  setStoredUserName,
} from './services/memoryStorage';
import { sendChatMessage } from './services/api';
import { audioRecorder, transcribeAudioDirectly } from './services/audioRecorder';
// @ts-ignore
import AeroShards from '../components/AeroShards.jsx';
// @ts-ignore
import PromptBar from '../components/PromptBar.jsx';

const SAMPLE_PROMPTS = [
  'Quem é você e qual sua missão, Kira?',
  'Pesquise as últimas notícias de tecnologia hoje',
  'Qual a cotação atual do bitcoin e do dólar?',
  'O que você já aprendeu sobre mim?',
];

export default function App() {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [inputMessage, setInputMessage] = useState('');
  const [userName, setUserName] = useState<string>('Mestra');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [history, setHistory] = useState<ChatExchange[]>([]);
  const [currentExchange, setCurrentExchange] = useState<ChatExchange | null>(null);

  // AeroShards state
  const [shardFlow, setShardFlow] = useState<'stream' | 'vortex' | 'ribbon'>('stream');
  const [shardsEnabled, setShardsEnabled] = useState(true);

  // UI state
  const [isResultSheetOpen, setIsResultSheetOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [learnedNotification, setLearnedNotification] = useState<string | null>(null);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio / Speech
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeechPlayingRef = useRef<boolean>(false);
  const keepAliveIntervalRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcriptRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize and keep Web Speech voices cache ready
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    synthRef.current = window.speechSynthesis;

    const cacheVoices = () => {
      window.speechSynthesis.getVoices();
    };

    cacheVoices();
    window.speechSynthesis.onvoiceschanged = cacheVoices;
  }, []);

  // Helper to pick STRICTLY a female voice for Kira - never male or robotic!
  const getFemaleVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const isMale = (name: string) => {
      const n = name.toLowerCase();
      return (
        (n.includes('male') && !n.includes('female')) ||
        n.includes('david') ||
        n.includes('daniel') ||
        n.includes('george') ||
        n.includes('mark') ||
        n.includes('richard') ||
        n.includes('felipe') ||
        n.includes('ricardo') ||
        n.includes('antonio') ||
        n.includes('espeak') ||
        n.includes('guy') ||
        n.includes('junior')
      );
    };

    // 1. Prioritize verified Portuguese female voices
    const ptVoices = voices.filter((v) => v.lang.startsWith('pt') && !isMale(v.name));
    const femalePt = ptVoices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        n.includes('female') ||
        n.includes('maria') ||
        n.includes('luciana') ||
        n.includes('fernanda') ||
        n.includes('letícia') ||
        n.includes('leticia') ||
        n.includes('francisca') ||
        n.includes('camila') ||
        n.includes('helena') ||
        n.includes('vitória') ||
        n.includes('vitoria') ||
        n.includes('google português')
      );
    });
    if (femalePt) return femalePt;
    if (ptVoices.length > 0) return ptVoices[0];

    // 2. Any verified female voice in any language
    const anyFemale = voices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        !isMale(n) &&
        (n.includes('female') ||
          n.includes('samantha') ||
          n.includes('victoria') ||
          n.includes('zira') ||
          n.includes('karen') ||
          n.includes('helena'))
      );
    });
    if (anyFemale) return anyFemale;

    // 3. Fallback only to non-male voice
    const nonMale = voices.find((v) => !isMale(v.name));
    return nonMale || null;
  };

  const stopAllAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    isSpeechPlayingRef.current = false;
    speechQueueRef.current = [];
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setOrbState('idle');
  };

  // Speaks text aloud in natural sentence chunks using Kira's female voice
  const speakSentences = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    // Clean markdown characters and links
    const cleanText = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      setIsSpeaking(false);
      setOrbState('idle');
      return;
    }

    // Split into sentences (preserving natural stops)
    const sentences = cleanText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    speechQueueRef.current = sentences;
    isSpeechPlayingRef.current = true;
    setIsSpeaking(true);
    setOrbState('speaking');

    // Keep alive to prevent browser 15s pause timeout
    if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 2500);

    const playNext = () => {
      if (!isSpeechPlayingRef.current || speechQueueRef.current.length === 0) {
        setIsSpeaking(false);
        setOrbState('idle');
        isSpeechPlayingRef.current = false;
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
        return;
      }

      const sentence = speechQueueRef.current.shift()!;
      const utterance = new SpeechSynthesisUtterance(sentence);
      const femaleVoice = getFemaleVoice();
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      utterance.pitch = 1.25; // Gentle, sweet feminine pitch
      utterance.rate = 1.02;  // Conversational tempo
      utterance.volume = 1.0;

      utterance.onend = () => {
        playNext();
      };

      utterance.onerror = (e) => {
        console.warn('Speech chunk notification:', e);
        playNext();
      };

      utteranceRef.current = utterance;
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    };

    synth.cancel();
    playNext();
  };

  // Play Kira's SINGLE, UNIQUE female voice - NEVER two voices!
  const speakText = (leadText: string, mainText: string, audioBase64?: string | null) => {
    // 1. Immediately cancel any prior sound to eliminate overlap
    stopAllAudio();

    // 2. If Kira's original neural voice is available, play ONLY Kira's neural voice!
    if (audioBase64) {
      try {
        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        audio.volume = 1.0;
        currentAudioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          setOrbState('speaking');
        };

        // When Kira's original voice finishes, conclude gracefully - NEVER start a robotic voice!
        audio.onended = () => {
          setIsSpeaking(false);
          setOrbState('idle');
          currentAudioRef.current = null;
        };

        audio.onerror = () => {
          currentAudioRef.current = null;
          speakSentences(`${leadText}. ${mainText}`);
        };

        audio.play().catch(() => {
          currentAudioRef.current = null;
          speakSentences(`${leadText}. ${mainText}`);
        });
        return;
      } catch (err) {
        currentAudioRef.current = null;
      }
    }

    // 3. Fallback to browser female voice ONLY when neural audio is absent
    speakSentences(`${leadText}. ${mainText}`);
  };

  // Toggle voice playback manually
  const handleToggleSpeech = () => {
    if (!currentExchange) return;

    if (isSpeaking) {
      stopAllAudio();
    } else {
      speakText(currentExchange.conversationalLead, currentExchange.mainContent, currentExchange.audioData);
    }
  };

  // Stop all mic capture (Web Speech and MediaRecorder)
  const stopVoiceCapture = async (): Promise<string> => {
    let finalQuery = transcriptRef.current.trim();

    // 1. Stop Web Speech recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // 2. Stop universal MediaRecorder
    if (audioRecorder.getIsRecording()) {
      try {
        const recording = await audioRecorder.stop();
        // If Web Speech didn't capture text or gave empty transcript, transcribe via Gemini
        if (!finalQuery && recording && recording.audioBase64) {
          setIsTranscribing(true);
          setOrbState('thinking');
          try {
            const transcribed = await transcribeAudioDirectly(recording.audioBase64, recording.mimeType);
            if (transcribed && transcribed.trim()) {
              finalQuery = transcribed.trim();
              setInputMessage(finalQuery);
            }
          } catch (err: any) {
            console.warn('Erro na transcrição de áudio Gemini:', err);
          } finally {
            setIsTranscribing(false);
          }
        }
      } catch (e) {
        console.warn('Erro ao finalizar gravação de áudio:', e);
      }
    }

    setIsListening(false);
    setAudioLevel(0);
    return finalQuery;
  };

  // Start universal voice input: MediaRecorder + concurrent WebSpeech for live streaming
  const startVoiceInput = async () => {
    stopAllAudio();
    setIsResultSheetOpen(false);
    transcriptRef.current = '';
    setInputMessage('');

    // Start universal microphone recording with live volume feedback on the Orb
    try {
      await audioRecorder.start((level) => {
        setAudioLevel(level);
      });
      setIsListening(true);
      setOrbState('listening');
    } catch (err: any) {
      console.warn('Microfone não pôde ser iniciado via MediaRecorder:', err);
      setMicErrorMessage('Acesso ao microfone necessário. Autorize o microfone no navegador para falar com a Kira.');
      setTimeout(() => setMicErrorMessage(null), 6000);
      setIsListening(false);
      setOrbState('idle');
      return;
    }

    // Attempt starting Web Speech API concurrently for instant live typing on supported browsers
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            transcriptRef.current = currentTranscript;
            setInputMessage(currentTranscript);
          }
        };

        recognition.onerror = (e: any) => {
          // Non-critical; MediaRecorder continues recording in background!
          console.log('WebSpeech evento (MediaRecorder ativo em segundo plano):', e?.error);
        };

        recognition.onend = () => {
          // If speech naturally paused and we got transcript, submit
          if (transcriptRef.current.trim() && isListening) {
            stopVoiceInputAndSend();
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        // Silently continue with MediaRecorder
      }
    }
  };

  const stopVoiceInputAndSend = async () => {
    const query = await stopVoiceCapture();
    if (query) {
      handleSendMessage(query);
    } else {
      setOrbState('idle');
    }
  };

  // Toggle voice input on/off
  const toggleSpeechRecognition = async () => {
    if (isListening) {
      await stopVoiceInputAndSend();
    } else {
      await startVoiceInput();
    }
  };

  // Handler when user clicks directly on the Orb
  const handleOrbClick = async () => {
    // If Kira is speaking, stop speech immediately
    if (isSpeaking) {
      stopAllAudio();
      return;
    }

    // If already listening, conclude recording and send!
    if (isListening) {
      await stopVoiceInputAndSend();
      return;
    }

    // If idle, start listening immediately!
    await startVoiceInput();
  };

  // Submit query to Orb with memory learning
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    // Reset voice synthesis if running
    if (synthRef.current && isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    setInputMessage('');
    setOrbState('thinking');

    try {
      // Build history context for API
      const historyContext = history.slice(-4).flatMap((item) => [
        { role: 'user' as const, content: item.userMessage },
        { role: 'model' as const, content: `${item.conversationalLead}\n${item.mainContent}` },
      ]);

      const data = await sendChatMessage({
        message: query,
        history: historyContext,
        memories,
        userName,
      });

      // Check if user changed name
      if (data.detectedUserName && data.detectedUserName.trim()) {
        const newName = data.detectedUserName.trim();
        setUserName(newName);
        setStoredUserName(newName);
      }

      // Automatically learn and persist any new memories extracted
      let updatedMemories = memories;
      if (data.newMemories && data.newMemories.length > 0) {
        updatedMemories = addMemories(data.newMemories);
        setMemories(updatedMemories);

        // Show brief discreet memory feedback
        setLearnedNotification(data.newMemories[0].text);
        setTimeout(() => setLearnedNotification(null), 5000);
      }

      const newExchange: ChatExchange = {
        id: 'exchange-' + Date.now(),
        userMessage: query,
        conversationalLead: data.conversationalLead || 'Às suas ordens, mestra',
        mainContent: data.mainContent,
        cards: data.cards || [],
        timestamp: Date.now(),
        newMemories: data.newMemories,
        suggestedFollowUps: data.suggestedFollowUps,
        sources: data.sources || [],
        audioData: data.audioData || null,
      };

      setCurrentExchange(newExchange);
      setHistory((prev) => [newExchange, ...prev]);
      setOrbState('idle');

      // Slide up the frosted glass result sheet (as shown in the video)
      setIsResultSheetOpen(true);

      // Automatically speak out loud with real voice on EVERY response!
      speakText(newExchange.conversationalLead, newExchange.mainContent, data.audioData);
    } catch (err: any) {
      console.error('Falha ao enviar mensagem:', err);
      setOrbState('idle');
      const fallbackExchange: ChatExchange = {
        id: 'fallback-' + Date.now(),
        userMessage: query,
        conversationalLead: 'Compreendi seu pedido',
        mainContent: `Desculpe, ocorreu uma instabilidade momentânea na conexão. Por favor tente novamente. (${err.message || 'Erro de rede'})`,
        cards: [],
        timestamp: Date.now(),
      };
      setCurrentExchange(fallbackExchange);
      setIsResultSheetOpen(true);
      speakText(fallbackExchange.conversationalLead, fallbackExchange.mainContent, null);
    }
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    setStoredUserName(newName);
  };

  const handleAddMemory = (category: MemoryItem['category'], text: string) => {
    const updated = addMemories([{ category, text }]);
    setMemories(updated);
  };

  const handleDeleteMemory = (id: string) => {
    const updated = deleteMemory(id);
    setMemories(updated);
  };

  const handleClearAllMemories = () => {
    clearAllMemories();
    setMemories([]);
  };

  const handlePromptBarSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === '/memorias' || trimmed.startsWith('/memorias')) {
      setIsMemoryModalOpen(true);
      return;
    }
    if (trimmed === '/historico' || trimmed.startsWith('/historico')) {
      setIsHistoryDrawerOpen(true);
      return;
    }
    if (trimmed === '/falar' || trimmed.startsWith('/falar')) {
      toggleSpeechRecognition();
      return;
    }
    if (trimmed === '/silenciar' || trimmed === '/parar' || trimmed.startsWith('/silenciar')) {
      if (synthRef.current) synthRef.current.cancel();
      setIsSpeaking(false);
      setOrbState('idle');
      return;
    }
    if (trimmed === '/cristais' || trimmed.startsWith('/cristais')) {
      const flows: ('stream' | 'vortex' | 'ribbon')[] = ['stream', 'vortex', 'ribbon'];
      const nextIndex = (flows.indexOf(shardFlow) + 1) % flows.length;
      setShardFlow(flows[nextIndex]);
      return;
    }
    if (trimmed === '/apresentar' || trimmed.startsWith('/apresentar')) {
      handleSendMessage('Quem é você e qual a sua missão ao meu lado, Kira?');
      return;
    }

    handleSendMessage(trimmed);
  };

  const promptSources: any = [
    {
      key: 'memorias',
      name: 'Memórias da Kira',
      description: `${memories.length} memórias salvas`,
      icon: <Brain className="w-3.5 h-3.5 text-purple-400" />,
      attach: false,
    },
    {
      key: 'conversas',
      name: 'Histórico de Conversas',
      description: `${history.length} diálogos registrados`,
      icon: <MessageSquare className="w-3.5 h-3.5 text-purple-400" />,
      attach: false,
    },
    {
      key: 'cristais',
      name: 'AeroShards',
      description: `Fluxo ativo: ${shardFlow}`,
      icon: <Waves className="w-3.5 h-3.5 text-purple-400" />,
      attach: false,
    },
    {
      key: 'voz',
      name: 'Voz da Kira',
      description: isSpeaking ? 'Falando agora (clique para parar)' : 'Voz feminina ativa',
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
      attach: false,
    },
  ];

  const promptCommands = [
    { key: 'memorias', name: '/memorias', description: 'Abrir cofre de memórias da Kira' },
    { key: 'historico', name: '/historico', description: 'Rever conversas anteriores' },
    { key: 'falar', name: '/falar', description: 'Ativar reconhecimento de voz' },
    { key: 'silenciar', name: '/silenciar', description: 'Interromper fala da Kira' },
    { key: 'cristais', name: '/cristais', description: `Alternar fluxo do AeroShards (${shardFlow})` },
    { key: 'apresentar', name: '/apresentar', description: 'Pedir apresentação formal de Kira' },
  ];

  const promptModels = [
    { key: 'kira-flash', name: 'Kira Ultra (Flash)', tag: 'Ultra Rápido' },
    { key: 'kira-pro', name: 'Kira Profunda', tag: 'Pensamento' },
  ];

  return (
    <div className="relative w-screen h-screen bg-[#070913] text-white flex flex-col items-center justify-between overflow-hidden select-none font-sans">
      {/* AeroShards Ambient 3D procedural crystals */}
      {shardsEnabled && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-45 transition-opacity duration-1000">
          <AeroShards
            backgroundColor="#070913"
            shardColor="#8b5cf6"
            accentColor="#38bdf8"
            placement="full"
            flow={shardFlow}
            material="pearl"
            detail="balanced"
            scale={1.1}
            spread={0.88}
            depth={1.15}
            speed={0.75}
            glow={1.2}
            bloom={0.8}
            interaction="attract"
            className="w-full h-full"
            onError={(err: any) => console.warn('AeroShards notice:', err)}
          />
        </div>
      )}

      {/* Background ambient radial blue/purple lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.18),transparent_65%)] pointer-events-none z-1" />

      {/* Top Navigation Bar */}
      <header className="relative z-20 w-full max-w-3xl px-6 py-4 flex items-center justify-between">
        {/* Left: History & AeroShards flow selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/70 hover:text-white transition-all shadow-sm cursor-pointer"
            title="Ver conversas passadas"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Conversas</span>
            {history.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-600/60 text-[10px] text-white flex items-center justify-center">
                {history.length}
              </span>
            )}
          </button>

          {/* AeroShards Flow switcher badge */}
          <button
            onClick={() => {
              const flows: ('stream' | 'vortex' | 'ribbon')[] = ['stream', 'vortex', 'ribbon'];
              const nextIndex = (flows.indexOf(shardFlow) + 1) % flows.length;
              setShardFlow(flows[nextIndex]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 hover:border-purple-400 text-xs font-medium text-purple-200 transition-all shadow-sm cursor-pointer"
            title="Alternar estilo dos cristais AeroShards (Stream, Vortex, Ribbon)"
          >
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span className="capitalize hidden md:inline">Cristais: {shardFlow}</span>
          </button>
        </div>

        {/* Center: Brand / Kira indicator */}
        <div className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-semibold text-white/50">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] animate-pulse" />
          <span className="text-purple-200 font-medium">KIRA AI</span>
        </div>

        {/* Right: Adaptive Memory Bank + AeroShards toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShardsEnabled((v) => !v)}
            className={`p-1.5 rounded-full border text-xs transition-all cursor-pointer ${
              shardsEnabled
                ? 'bg-purple-500/20 border-purple-400/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
            title={shardsEnabled ? 'Ocultar AeroShards' : 'Ativar AeroShards'}
          >
            {shardsEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsMemoryModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/40 text-xs font-medium text-white/80 hover:text-purple-200 transition-all shadow-sm group cursor-pointer"
            title="Abrir memórias aprendidas"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Memória</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-semibold">
              {memories.length}
            </span>
          </button>
        </div>
      </header>

      {/* Subtle notification when AI learns a new memory */}
      <AnimatePresence>
        {learnedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-18 z-30 px-4 py-2 rounded-full bg-blue-950/80 backdrop-blur-md border border-blue-400/40 text-xs text-blue-200 shadow-xl flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>Memória aprendida: <strong>{learnedNotification}</strong></span>
          </motion.div>
        )}

        {micErrorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-18 z-40 px-4 py-2.5 rounded-full bg-red-950/90 backdrop-blur-md border border-red-500/50 text-xs text-red-200 shadow-xl flex items-center gap-2 max-w-md text-center"
          >
            <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>{micErrorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Center Area: Fluid Luminous Orb + Adaptive Greeting Text */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 w-full max-w-xl">
        {/* The 3D Fluid Glowing Orb */}
        <Orb
          state={orbState}
          audioLevel={audioLevel}
          onClick={() => {
            // Stop speech if Kira is talking
            stopAllAudio();

            // If already listening, stop and submit
            if (isListening) {
              toggleSpeechRecognition();
              return;
            }

            // Close sheet to let the user see the active listening orb
            setIsResultSheetOpen(false);

            // Immediately start listening to the user's voice
            toggleSpeechRecognition();
          }}
        />

        {/* Center Dynamic Typography (reproducing the video exactly) */}
        <div className="text-center mt-3 sm:mt-5 transition-all duration-500">
          <motion.p
            key={
              isListening
                ? 'listening'
                : orbState === 'thinking'
                ? 'searching'
                : currentExchange?.conversationalLead || 'hello'
            }
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm sm:text-base text-slate-400 font-normal tracking-wide"
          >
            {isListening
              ? 'Ouvindo sua voz com atenção...'
              : orbState === 'thinking'
              ? 'Conectando memórias...'
              : currentExchange
              ? currentExchange.conversationalLead
              : `Às suas ordens, ${userName}`}
          </motion.p>

          <motion.h1
            key={isListening ? 'listening_title' : currentExchange ? 'result' : 'prompt'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1"
          >
            {isListening
              ? inputMessage || 'Pode falar, mestra...'
              : orbState === 'thinking'
              ? 'A Kira está refletindo...'
              : currentExchange
              ? 'Here is what I found'
              : 'Como a Kira pode servi-la hoje?'}
          </motion.h1>

          {/* Quick access button if sheet is minimized */}
          {currentExchange && !isResultSheetOpen && orbState !== 'thinking' && !isListening && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setIsResultSheetOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-blue-200 transition-all cursor-pointer"
            >
              <span>Ver resposta da Kira</span>
              <ArrowRight className="w-3 h-3 text-blue-400" />
            </motion.button>
          )}
        </div>
      </main>

      {/* Bottom Area: PromptBar + Quick Chips */}
      <footer className="relative z-20 w-full max-w-2xl px-4 pb-6 sm:pb-8 flex flex-col items-center gap-3">
        {/* Quick Suggestion Chips (when no conversation or to explore topics) */}
        {!currentExchange && orbState === 'idle' && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none text-[11px] text-white/60">
            {SAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Listening Mode Banner */}
        {isListening ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl flex items-center justify-between bg-red-950/60 border border-red-500/40 backdrop-blur-2xl rounded-2xl px-5 py-3 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
          >
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm text-red-200 truncate font-light">
                {inputMessage || 'Ouvindo sua voz... fale com a Kira'}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-2">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow"
              >
                <span>Concluir</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="w-full flex justify-center">
            <PromptBar
              placeholder="Fale com a Kira... (digite @ para atalhos, / para comandos)"
              busy={orbState === 'thinking'}
              width={620}
              radius={24}
              background="rgba(16, 18, 32, 0.88)"
              menuBackground="rgba(23, 26, 45, 0.98)"
              color="#f8fafc"
              sparkColor="#c084fc"
              sparkBoost={1.4}
              models={promptModels}
              defaultModel="kira-flash"
              efforts={['Rápido', 'Equilibrado', 'Profundo', 'Supremo']}
              defaultEffort="Equilibrado"
              sources={promptSources}
              commands={promptCommands}
              onSend={handlePromptBarSend}
              onStop={() => {
                if (synthRef.current) synthRef.current.cancel();
                setIsSpeaking(false);
                setOrbState('idle');
              }}
              onDictate={toggleSpeechRecognition}
              onAttach={() => {}}
              onEffortChange={(effort: string) => console.log('Kira effort:', effort)}
              className="shadow-[0_16px_50px_rgba(0,0,0,0.7)] border border-white/15 backdrop-blur-2xl"
            />
          </div>
        )}
      </footer>

      {/* Result Card / Drawer Sheet (slides up from bottom as in video) */}
      <ResultSheet
        exchange={currentExchange}
        isOpen={isResultSheetOpen}
        onClose={() => setIsResultSheetOpen(false)}
        onFollowUpClick={(prompt) => {
          setIsResultSheetOpen(false);
          setInputMessage(prompt);
          handleSendMessage(prompt);
        }}
        isSpeaking={isSpeaking}
        onToggleSpeech={handleToggleSpeech}
      />

      {/* Memory Bank Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        onClearAll={handleClearAllMemories}
        userName={userName}
        onUpdateUserName={handleUpdateUserName}
      />

      {/* Conversations History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        history={history}
        onSelectExchange={(exchange) => {
          setCurrentExchange(exchange);
          setIsResultSheetOpen(true);
        }}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
