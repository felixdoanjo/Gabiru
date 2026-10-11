import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SettingsType, Message, SavedModel } from '../../App';
import { Zap, Bot, RefreshCw, Send, Loader2, Brain, User, Users, FileCode, Film, Scissors, Music, Type, Sparkles, Captions, Trash2, Mic, MicOff, Paperclip, Folder, X, Settings, Image as ImageIcon, Camera } from 'lucide-react';
import './Chat.css';
// Importa as imagens do ratinho (Vite processa e garante caminhos corretos no build)
import mouseOpenImg from '/mouse-open.png?url';
import mouseBlinkImg from '/mouse-blink.png?url';
import mouseLupaImg from '/mouse_lupa.png?url';
import mouseLupa2Img from '/mouse_lupa2.png?url';
import mouseMicImg from '/mouse_mic.png?url';
import mouseMic2Img from '/mouse_mic2.png?url';

interface ChatProps {
  messages: Message[];
  chatMessages?: Record<string, Message[]>; // Mensagens dos chats individuais
  chatMessagesVersion?: number; // Versão para forçar re-render
  onSendMessage: (message: string, fromTerminalAgent?: string, activeChatId?: string, file?: File | boolean) => void;
  isStreaming: boolean;
  onCancelStream?: () => void;
  settings: SettingsType;
  onRefreshModels: () => void;
  activeMainView?: string;
  onClearMessages?: () => void;
  streamingTokens?: number;
  streamingMode?: string;
  lastStreamingTokens?: number;
  tokenBars?: Array<{ id: number; tokens: number; growing: boolean }>;
  gamingMode?: boolean;
  onGamingToggle?: () => void;
  onGamingMini?: () => void;
  currentActivity?: { app: string; title: string } | null;
  reminderNotification?: { title: string; time: string } | null;
  onDismissReminder?: () => void;
  incomingReminderCall?: { title: string; time: string; notes?: string; id: string } | null;
  onAnswerReminderCall?: () => void;
  onDeclineReminderCall?: () => void;
  bossModelId?: string;
  activeProject?: { id: string; name: string; description: string; blockType: string; workFolder?: string; saveId?: string } | null;
  onSetActiveProject?: (project: { id: string; name: string; description: string; blockType: string; workFolder?: string; saveId?: string } | null) => void;
  onSetActiveMainView?: (view: 'home' | 'code' | 'video' | 'photo' | 'web' | 'paint') => void;
  onLoadProjectById?: (projectId: string, projectType: string, workFolder?: string) => void;
  searchEngine?: 'google' | 'duckduckgo' | 'brave' | 'bing';
  noFilter?: boolean;
  onSendGroupMessage?: (message: string, group: SavedModel[], groupChatId?: string) => void;
  streamingModels?: Record<string, { isStreaming: boolean; modelName: string }>;
  isModelStreaming?: (modelId: string) => boolean;
  getStreamingModelName?: (modelId: string) => string;
  onActiveChatChange?: (chatId: string | null) => void;
  onUpdateSettings?: (settings: SettingsType) => void;
  // Supervised Mode
  pendingChanges?: Array<{id: string; type: string; filePath: string; content?: string; oldContent?: string; reason?: string}>;
  onAcceptChange?: (changeId: string) => void;
  onRejectChange?: (changeId: string) => void;
}

function getProviderLabel(settings: SettingsType): string {
  switch (settings.apiProvider) {
    case 'ollama': return `Ollama · ${settings.ollamaModel || '(sem modelo)'}`;
    case 'gemini': return `Gemini · ${settings.geminiModel || 'gemini-2.0-flash'}`;
    case 'openrouter': return `OpenRouter · ${settings.openrouterModel || 'llama-3-70b'}`;
    case 'anthropic': return `Claude · ${settings.anthropicModel || 'claude-sonnet'}`;
    case 'openai': return `OpenAI · ${settings.openaiModel || 'gpt-4o'}`;
    case 'custom': return `${settings.customName || 'Custom'} · ${settings.customModel || '(sem modelo)'}`;
    default: return 'IA';
  }
}

// Helper para extrair conteúdo de texto de uma mensagem (pode ser string ou array com visão)
function getMessageTextContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((c: any) => c.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

export default function Chat({ messages, chatMessages: chatMessagesProp, chatMessagesVersion, onSendMessage, isStreaming, onCancelStream, settings, onRefreshModels, activeMainView, onClearMessages, streamingTokens = 0, streamingMode = '', lastStreamingTokens = 0, tokenBars: tokenBarsProp, gamingMode, onGamingToggle, onGamingMini, currentActivity, reminderNotification, onDismissReminder, incomingReminderCall, onAnswerReminderCall, onDeclineReminderCall, bossModelId, activeProject, onSetActiveProject, onSetActiveMainView, onLoadProjectById, searchEngine = 'google', noFilter = false, onSendGroupMessage, streamingModels = {}, isModelStreaming, getStreamingModelName, onActiveChatChange, pendingChanges = [], onAcceptChange, onRejectChange }: ChatProps) {
  const [input, setInput] = useState('');
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<{ start: number, end: number } | null>(null);
  
  // Sistema de anexos
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modo Grupo
  const [groupMode, setGroupMode] = useState(false);
  const [groupModels, setGroupModels] = useState<SavedModel[]>([]);
  // Menu de gerenciamento de equipe
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  // Criação de novo grupo
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const [newGroupStep, setNewGroupStep] = useState<'select' | 'details'>('select');
  const [tempGroupModels, setTempGroupModels] = useState<SavedModel[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  // Chat style WhatsApp/Telegram
  const [activeChat, setActiveChat] = useState<string | null>(null); // ID do contato/grupo ativo
  
  // Notifica o App quando activeChat muda
  useEffect(() => {
    if (onActiveChatChange) {
      onActiveChatChange(activeChat);
    }
  }, [activeChat, onActiveChatChange]);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedGroups, setSavedGroups] = useState<Array<{ id: string; name: string; avatar?: string; models: SavedModel[] }>>([]);
  // Mensagens por chat - usa o prop se fornecido, senão usa state local
  const [chatMessagesLocal, setChatMessagesLocal] = useState<Record<string, Message[]>>({});
  const chatMessages = chatMessagesProp || chatMessagesLocal;
  
  // CRITICAL: Força re-render quando chatMessagesProp muda internamente
  const [, forceRender] = useState(0);
  const lastChatMessagesRef = useRef<string>('');
  useEffect(() => {
    if (activeChat && chatMessagesProp) {
      const current = JSON.stringify(chatMessagesProp[activeChat] || []);
      if (current !== lastChatMessagesRef.current) {
        lastChatMessagesRef.current = current;
        forceRender(prev => prev + 1);
      }
    }
  }, [chatMessagesProp, activeChat]);
  const setChatMessages = setChatMessagesLocal;
  
  // Força re-render quando chatMessagesProp mudar
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (chatMessagesProp) {
      forceUpdate(prev => prev + 1);
    }
  }, [chatMessagesProp]);
  
  // Escuta eventos de atualização de chat em tempo real
  useEffect(() => {
    const handleChatUpdate = (e: CustomEvent) => {
      const { chatId, messages } = e.detail;
      if (chatId === activeChat) {
        console.log('[Chat] Recebeu evento bill-chat-updated:', chatId, messages.length, 'mensagens');
        setChatMessagesLocal(prev => ({ ...prev, [chatId]: messages }));
        forceUpdate(prev => prev + 1);
      }
    };
    
    window.addEventListener('bill-chat-updated', handleChatUpdate as EventListener);
    return () => window.removeEventListener('bill-chat-updated', handleChatUpdate as EventListener);
  }, [activeChat]);
  
  // LOG: Mostra chatMessagesVersion na montagem e mudanças
  useEffect(() => {
    // Logs removidos
  }, [chatMessagesVersion, activeChat, chatMessagesProp]);
  
  // Sistema de mensagens não lidas
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastSeenMessageIndex, setLastSeenMessageIndex] = useState<Record<string, number>>(() => {
    // Inicializa carregando do localStorage
    const saved = localStorage.getItem('bill-last-seen-messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {};
  });
  
  // Trigger para forçar reordenação quando houver nova mensagem
  const [listUpdateTrigger, setListUpdateTrigger] = useState(0);
  
  // Context menu (botão direito)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'group' | 'contact'; id: string } | null>(null);
  
  // Debug: loga mudanças no streamingModels (MOVIDO PARA DEPOIS de activeChat)
  useEffect(() => {
    // Log removido para reduzir poluição
    if (activeChat && streamingModels[activeChat]) {
      console.log('[Chat] Modelo atual está streaming:', streamingModels[activeChat].modelName);
    }
  }, [streamingModels, activeChat]);
  
  // Notifica o App.tsx quando activeChat muda (para listeners globais como speech)
  useEffect(() => {
    if (onActiveChatChange) {
      onActiveChatChange(activeChat);
      console.log('[Chat] activeChat mudou para:', activeChat || 'nenhum');
    }
  }, [activeChat, onActiveChatChange]);
  
  // Context menu para mensagens
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number; y: number; messageIndex: number } | null>(null);
  // Menu de adicionar (botão +)
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showProviderSubmenu, setShowProviderSubmenu] = useState(false);
  const [addingProvider, setAddingProvider] = useState<'ollama' | 'gemini' | 'openrouter' | 'anthropic' | 'openai' | 'custom' | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactModel, setNewContactModel] = useState('');
  const [newContactApiKey, setNewContactApiKey] = useState('');
  const [newContactBaseUrl, setNewContactBaseUrl] = useState('');
  const [newContactAvatar, setNewContactAvatar] = useState('');
  const [newContactColor, setNewContactColor] = useState('#3b82f6');
  const [newContactVoice, setNewContactVoice] = useState('');
  // Edição
  const [editingItem, setEditingItem] = useState<{ type: 'group' | 'contact'; id: string; name: string; avatar: string; voice?: string; color?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editVoice, setEditVoice] = useState('');
  const [editColor, setEditColor] = useState('');
  
  // Chamada de voz
  const [inCall, setInCall] = useState(false);
  const inCallRef = useRef(false); // Ref para evitar closure issues
  const callChatIdRef = useRef<string | null>(null); // Armazena o ID do chat em ligação
  const [callMinimized, setCallMinimized] = useState(false); // Se a interface de chamada está minimizada
  const [callDuration, setCallDuration] = useState(0);
  const [callVolume, setCallVolume] = useState(100);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [isCallProcessing, setIsCallProcessing] = useState(false);
  const callMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const callAudioChunksRef = useRef<Blob[]>([]);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  const stopMonitoringRef = useRef<(() => void) | null>(null);
  const isReminderCallRef = useRef<boolean>(false); // Flag para identificar chamada de lembrete
  const ringtoneRef = useRef<HTMLAudioElement | null>(null); // Ref para o som de toque

  // Toca música de toque quando chamada recebida aparece
  useEffect(() => {
    if (incomingReminderCall) {
      console.log('[Ringtone] Iniciando toque de chamada...');
      
      // Cria áudio com som de toque (usando Web Audio API para gerar som)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      let isPlaying = true;
      
      const playRingtone = () => {
        if (!isPlaying) return;
        
        // Cria um toque de telefone realista (dois toques curtos)
        const now = audioContext.currentTime;
        
        // Primeiro bip
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.frequency.value = 480; // Hz
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc1.start(now);
        osc1.stop(now + 0.4);
        
        // Segundo bip
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 620; // Hz
        gain2.gain.setValueAtTime(0.3, now + 0.5);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
        osc2.start(now + 0.5);
        osc2.stop(now + 0.9);
        
        // Repete a cada 3 segundos
        setTimeout(() => {
          if (isPlaying) playRingtone();
        }, 3000);
      };
      
      playRingtone();
      
      // Cleanup: para o som quando componente desmonta ou chamada é aceita/recusada
      return () => {
        console.log('[Ringtone] Parando toque de chamada');
        isPlaying = false;
        audioContext.close();
      };
    }
  }, [incomingReminderCall]);

  // Detecta quando chamada inicia (para chamadas de lembrete) e força interface aparecer
  useEffect(() => {
    console.log('[Call] useEffect inCall disparado - inCall:', inCall, 'isReminderCall:', isReminderCallRef.current);
    if (inCall && isReminderCallRef.current) {
      console.log('[Call] ✓ Chamada de lembrete ativa detectada! Forçando interface...');
      setCallMinimized(false);
      isReminderCallRef.current = false; // Limpa a flag
      console.log('[Call] Interface forçada a aparecer');
    }
  }, [inCall]);

  // Detecta se há chamada pendente - roda em TODA renderização
  useEffect(() => {
    const pendingCall = (window as any).pendingReminderCall;
    if (pendingCall) {
      console.log('[Call] 🔔 PENDENTE! Chamada de lembrete detectada:', pendingCall);
      console.log('[Call] activeChat atual:', activeChat);
      console.log('[Call] inCall:', inCall);
      
      // Se não está em chamada, processa
      if (!inCall) {
        // Se ainda não mudou para o chat da IA chefe, muda agora
        if (activeChat !== pendingCall.bossModelId) {
          console.log('[Call] Mudando para chat da IA Chefe:', pendingCall.bossModelId);
          setActiveChat(pendingCall.bossModelId);
        }
      }
    }
  }); // SEM DEPENDÊNCIAS - roda toda vez

  // Detecta e inicia chamada de lembrete automaticamente
  useEffect(() => {
    const pendingCall = (window as any).pendingReminderCall;
    
    if (pendingCall && !inCall && activeChat === pendingCall.bossModelId) {
      console.log('[Call] ✓✓✓ TUDO PRONTO! Chat mudou para IA Chefe E chamada pendente detectada!');
      console.log('[Call] Boss Model ID:', pendingCall.bossModelId);
      console.log('[Call] Active Chat:', activeChat);
      console.log('[Call] Mensagem:', pendingCall.reminderMessage);
      
      // Copia os dados ANTES de limpar a flag
      const callData = {
        bossModelId: pendingCall.bossModelId,
        reminderMessage: pendingCall.reminderMessage
      };
      console.log('[Call] Dados copiados:', callData);
      
      // Agora sim limpa a flag
      delete (window as any).pendingReminderCall;
      console.log('[Call] Flag limpa');
      
      // Agora que o activeChat está correto, inicia a chamada
      setTimeout(async () => {
        console.log('[Call] ⏰ Iniciando chamada...');
        console.log('[Call] activeChat:', activeChat);
        console.log('[Call] inCall ANTES de iniciar:', inCall);
        
        // Marca que é uma chamada de lembrete
        isReminderCallRef.current = true;
        console.log('[Call] ✓ Marcado como chamada de lembrete - isReminderCallRef.current:', isReminderCallRef.current);
        
        const success = await startCall();
        console.log('[Call] 📞 startCall() retornou:', success);
        console.log('[Call] inCall DEPOIS de startCall:', inCall);
        console.log('[Call] inCallRef.current:', inCallRef.current);
        
        if (success) {
          console.log('[Call] ✓ Chamada iniciada com sucesso!');
          
          // O useEffect que observa inCall vai cuidar de mostrar a interface
          
          // Para lembretes, envia a mensagem IMEDIATAMENTE (não espera 5 segundos)
          // A IA vai falar o recado assim que a chamada abrir
          setTimeout(() => {
            console.log('[Call] ⏰ Enviando mensagem de lembrete imediatamente...');
            console.log('[Call] inCallRef.current:', inCallRef.current);
            if (inCallRef.current) {
              console.log('[Call] ✓ Chamada ativa! Enviando mensagem de lembrete');
              console.log('[Call] Mensagem:', callData.reminderMessage);
              
              // Envia como se fosse uma mensagem do usuário, a IA vai processar e falar
              onSendMessage(callData.reminderMessage, undefined, activeChat);
            } else {
              console.log('[Call] ✗ AVISO: Chamada não está ativa após timeout');
            }
          }, 500); // 500ms - envia rápido para IA falar logo
        } else {
          console.log('[Call] ✗ ERRO: startCall retornou false');
        }
      }, 300);
    } else if (pendingCall && !inCall && activeChat !== pendingCall.bossModelId) {
      console.log('[Call] ⏳ Chamada pendente detectada, mas activeChat ainda não é o correto');
      console.log('[Call] Aguardando: activeChat =', activeChat, ', deveria ser =', pendingCall.bossModelId);
      console.log('[Call] Mudando para o chat correto...');
      setActiveChat(pendingCall.bossModelId);
    }
  }, [activeChat, inCall]); // Agora depende de activeChat e inCall

  useEffect(() => {
    try {
      const models = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
      setSavedModels(models);
      
      // Carrega grupos salvos
      const groups = JSON.parse(localStorage.getItem('bill-saved-groups') || '[]');
      
      // CORREÇÃO: Atualiza avatares dos modelos dentro dos grupos para usar o avatar correto dos contatos
      const correctedGroups = groups.map((group: any) => ({
        ...group,
        models: group.models.map((groupModel: any) => {
          const originalModel = models.find((m: any) => m.id === groupModel.id);
          if (originalModel) {
            // Usa o avatar do modelo original, não o que está salvo no grupo
            return {
              ...groupModel,
              avatar: originalModel.avatar
            };
          }
          return groupModel;
        })
      }));
      
      setSavedGroups(correctedGroups);
      // Salva a correção
      localStorage.setItem('bill-saved-groups', JSON.stringify(correctedGroups));
    } catch {}
    
    // Listen for storage changes if models are updated in another tab/component
    const handleStorage = () => {
      try {
        const models = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
        setSavedModels(models);
        
        const groups = JSON.parse(localStorage.getItem('bill-saved-groups') || '[]');
        
        // CORREÇÃO: Atualiza avatares dos modelos dentro dos grupos
        const correctedGroups = groups.map((group: any) => ({
          ...group,
          models: group.models.map((groupModel: any) => {
            const originalModel = models.find((m: any) => m.id === groupModel.id);
            if (originalModel) {
              return {
                ...groupModel,
                avatar: originalModel.avatar
              };
            }
            return groupModel;
          })
        }));
        
        setSavedGroups(correctedGroups);
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    
    // Fecha context menu ao clicar fora
    const handleClickOutside = () => {
      setContextMenu(null);
      setShowAddMenu(false);
      setMessageContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isVideoMode = activeMainView === 'video';
  const isPhotoMode = activeMainView === 'photo';
  const isPaintMode = activeMainView === 'paint';
  const isWebMode = activeMainView === 'web';

  // Debug: rastreia mudanças no activeProject
  useEffect(() => {
    console.log('[Chat] activeProject mudou:', activeProject);
  }, [activeProject]);
  
  // Atualiza lista quando mensagens mudam ou streaming termina
  // DISABLED: Causava loop infinito de re-renders bloqueando handleSendMessage
  // useEffect(() => {
  //   if (!isStreaming) {
  //     setListUpdateTrigger(prev => prev + 1);
  //   }
  // }, [isStreaming, Array.isArray(messages) ? messages.length : 0]);
  
  // Monitora mudanças no localStorage para reordenar lista
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Se algum chat teve mensagens atualizadas, reordena
      if (e.key && e.key.startsWith('bill-chat-')) {
        setListUpdateTrigger(prev => prev + 1);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Também monitora quando o próprio app salva (storage event não funciona na mesma tab)
    const interval = setInterval(() => {
      setListUpdateTrigger(prev => prev + 1);
    }, 2000); // Atualiza a cada 2 segundos
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Garante que o textarea fique focável após fechar modal
  useEffect(() => {
    if (!showProjectsModal) {
      // Força o textarea a ser focável novamente
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.disabled = false;
          textareaRef.current.style.pointerEvents = 'auto';
          textareaRef.current.focus();
          console.log('[Chat] Textarea reativado após fechar modal');
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showProjectsModal]);

  // ── Token bars — gerenciado no App.tsx para persistir entre trocas de aba ─
  interface TokenBar { id: number; tokens: number; growing: boolean; }
  const [tokenBarsLocal, setTokenBarsLocal] = useState<TokenBar[]>([]);
  // Usa o prop se disponível (vem do App.tsx), senão usa estado local
  const tokenBars = tokenBarsProp ?? tokenBarsLocal;
  const setTokenBars = tokenBarsProp ? (_: any) => {} : setTokenBarsLocal;
  const lastMsgCountRef = useRef(0);
  const lastStreamingRef = useRef(false);

  // Rastreia tempo de resposta por mensagem (índice → segundos)
  const [responseTimes, setResponseTimes] = useState<Record<number, number>>({});
  const streamStartRef = useRef<number>(0);
  const streamMsgIndexRef = useRef<number>(-1);

  // Estima tokens: ~4 chars = 1 token
  const estimateTokens = (text: string) => Math.max(1, Math.round(text.length / 4));

  useEffect(() => {
    // Proteção: garante que messages é um array
    if (!Array.isArray(messages)) return;
    
    const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.content);
    const count = assistantMsgs.length;

    // Se tokenBars vem do App.tsx (prop), só rastreia tempo de resposta
    if (tokenBarsProp !== undefined) {
      if (!isStreaming && lastStreamingRef.current) {
        const elapsed = Math.round((Date.now() - streamStartRef.current) / 1000);
        const lastAssistantIdx = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop() ?? -1;
        if (lastAssistantIdx >= 0 && elapsed > 0) {
          setResponseTimes(prev => ({ ...prev, [lastAssistantIdx]: elapsed }));
        }
      } else if (isStreaming && !lastStreamingRef.current) {
        streamStartRef.current = Date.now();
      }
      lastStreamingRef.current = isStreaming;
      lastMsgCountRef.current = count;
      return;
    }

    // Fallback: gerencia tokenBars localmente (sem prop)
    if (isStreaming && !lastStreamingRef.current) {
      streamStartRef.current = Date.now();
      const assistantIdx = Array.isArray(messages) ? messages.findIndex((m, i) => i === messages.length - 1 && m.role === 'assistant') : -1;
      streamMsgIndexRef.current = assistantIdx;
      setTokenBars(prev => {
        const bars = [...prev, { id: Date.now(), tokens: 0, growing: true }];
        return bars.slice(-5);
      });
    } else if (!isStreaming && lastStreamingRef.current) {
      const elapsed = Math.round((Date.now() - streamStartRef.current) / 1000);
      const lastAssistantIdx = Array.isArray(messages) ? messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop() ?? -1 : -1;
      if (lastAssistantIdx >= 0 && elapsed > 0) {
        setResponseTimes(prev => ({ ...prev, [lastAssistantIdx]: elapsed }));
      }
      const last = assistantMsgs[assistantMsgs.length - 1];
      const tokens = last ? estimateTokens(last.content) : (lastStreamingTokens > 0 ? lastStreamingTokens : streamingTokens);
      setTokenBars(prev => {
        const updated = [...prev];
        let lastIdx = -1;
        for (let i = updated.length - 1; i >= 0; i--) { if (updated[i].growing) { lastIdx = i; break; } }
        if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], tokens, growing: false };
        return updated;
      });
    } else if (isStreaming) {
      const isActiveTab = !streamingMode || streamingMode === activeMainView;
      const last = assistantMsgs[assistantMsgs.length - 1];
      const tokens = isActiveTab ? (last ? estimateTokens(last.content) : streamingTokens) : streamingTokens;
      setTokenBars(prev => {
        const updated = [...prev];
        let lastIdx = -1;
        for (let i = updated.length - 1; i >= 0; i--) { if (updated[i].growing) { lastIdx = i; break; } }
        if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], tokens };
        return updated;
      });
    }
    lastStreamingRef.current = isStreaming;
    lastMsgCountRef.current = count;
  }, [isStreaming, messages, streamingTokens, lastStreamingTokens, tokenBarsProp]);

  const formatTokens = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${n}`;

  // ── Microfone: push-to-talk com MediaRecorder + Whisper ───────────────────
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    if (isListening || isTranscribing) return;
    try {
      // Usa o microfone selecionado nas configurações, se disponível
      const audioConstraints = settings.selectedMicId 
        ? { deviceId: { exact: settings.selectedMicId } }
        : true;
      
      console.log('[Mic] Iniciando gravação com microfone:', settings.selectedMicId || 'padrão');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(100); // coleta chunks a cada 100ms
      mediaRecorderRef.current = recorder;
      setIsListening(true);
    } catch (err) {
      console.error('[Mic] Erro ao acessar microfone:', err);
    }
  }, [isListening, isTranscribing, settings.selectedMicId]);

  const stopListening = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    console.log('[Mic] Parando gravação...');
    
    // Espera um pouco para garantir que o último chunk seja capturado
    await new Promise(r => setTimeout(r, 300));
    
    recorder.stop();
    recorder.stream.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
    setIsListening(false);
    setIsTranscribing(true);

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];

    console.log('[Mic] Blob criado - tamanho:', blob.size, 'bytes, tipo:', blob.type);

    // Se o blob está vazio, não faz nada
    if (blob.size === 0) {
      console.log('[Mic] Nenhum áudio gravado');
      setIsTranscribing(false);
      return;
    }

    // Converte blob para base64 e salva via IPC
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    console.log('[Mic] Base64 gerado - tamanho:', base64.length, 'caracteres');

    try {
      console.log('[Mic] Salvando áudio...');
      const saveResult = await (window as any).electronAPI.saveAudioBlob(base64, 'webm');
      if (!saveResult.success) throw new Error(saveResult.error);
      console.log('[Mic] Áudio salvo em:', saveResult.path);

      console.log('[Mic] Transcrevendo...');
      const transcribeResult = await (window as any).electronAPI.transcribeAudio(saveResult.path);
      console.log('[Mic] Resultado da transcrição:', JSON.stringify(transcribeResult, null, 2));
      setIsTranscribing(false);

      if (transcribeResult.success && transcribeResult.segments?.length > 0) {
        const text = transcribeResult.segments.map((s: any) => s.text).join(' ').trim();
        console.log('[Mic] Transcrição final:', text);
        console.log('[Mic] Enviando para chat:', activeChat || '(nenhum - chat principal)');
        if (text && !isStreaming) {
          onSendMessage(text, undefined, activeChat || undefined);
          setInput('');
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
      } else {
        console.log('[Mic] Whisper não detectou fala no áudio - verifique:');
        console.log('  1. Volume do microfone está adequado?');
        console.log('  2. Duração da gravação foi suficiente? (mínimo ~1 segundo)');
        console.log('  3. Microfone correto selecionado nas configurações?');
        console.log('  4. Ambiente com muito ruído pode confundir o VAD');
      }
    } catch (err) {
      console.error('[Mic] Erro na transcrição:', err);
      setIsTranscribing(false);
    }
  }, [isStreaming, onSendMessage, activeChat]); // ADICIONADO activeChat nas dependências!

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // ── Hotkey global para microfone ───────────────────────────────────────────
  useEffect(() => {
    const hotkey = settings.micHotkey;
    if (!hotkey) return;

    // Mouse buttons (Mouse3, Mouse4, Mouse5)
    const isMouseHotkey = hotkey.startsWith('Mouse');
    const mouseBtn = isMouseHotkey ? parseInt(hotkey.replace('Mouse', '')) : -1;

    const matchesKeyEvent = (e: KeyboardEvent): boolean => {
      let combo = '';
      if (e.ctrlKey) combo += 'Ctrl+';
      if (e.altKey) combo += 'Alt+';
      if (e.shiftKey) combo += 'Shift+';
      combo += e.code;
      return combo === hotkey;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isMouseHotkey && matchesKeyEvent(e)) {
        e.preventDefault();
        startListening();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isMouseHotkey && matchesKeyEvent(e)) {
        e.preventDefault();
        stopListening();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (isMouseHotkey && e.button === mouseBtn) {
        e.preventDefault();
        startListening();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (isMouseHotkey && e.button === mouseBtn) {
        e.preventDefault();
        stopListening();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', onMouseUp, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };
  }, [settings.micHotkey, startListening, stopListening]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;
    
    const msg = input.trim();
    const file = attachedFile;
    
    setInput('');
    setAttachedFile(null);
    setAttachedFilePreview(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    // Se modo grupo ativo e sem @mention explícito, envia para o grupo
    const hasAtMention = /\B@\S+/.test(msg);
    if (groupMode && groupModels.length > 0 && !hasAtMention) {
      if (activeChat && onSendGroupMessage) {
        console.log('[Chat] Enviando mensagem para grupo:', activeChat);
        onSendGroupMessage(msg, groupModels, activeChat, file);
      }
    } else {
      if (activeChat) {
        console.log('[Chat] Enviando mensagem para chat:', activeChat);
        onSendMessage(msg, undefined, activeChat, file);
      } else {
        onSendMessage(msg, undefined, undefined, file);
      }
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAttachedFile(file);
    
    // Se for imagem, cria preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachedFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedFilePreview(null);
    }
    
    // Reset input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeAttachment = () => {
    setAttachedFile(null);
    setAttachedFilePreview(null);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';

    // Autocomplete detection
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      const match = val.lastIndexOf(lastWord, cursor);
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setMentionIndex({ start: match, end: match + lastWord.length });
    } else {
      setMentionQuery(null);
      setMentionIndex(null);
    }
  };

  const handleMentionSelect = (modelName: string) => {
    if (!mentionIndex) return;
    const before = input.slice(0, mentionIndex.start);
    const after = input.slice(mentionIndex.end);
    const newText = before + '@' + modelName + ' ' + after;
    setInput(newText);
    setMentionQuery(null);
    setMentionIndex(null);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const filteredModels = mentionQuery !== null 
    ? (() => {
        // Se está em modo grupo, filtra apenas os membros do grupo
        const modelsToFilter = groupMode && groupModels.length > 0 
          ? groupModels 
          : savedModels;
        
        return modelsToFilter.filter(m => 
          m.name.toLowerCase().includes(mentionQuery) || 
          m.model.toLowerCase().includes(mentionQuery)
        );
      })()
    : [];

  const codeSuggestedPrompts = [
    'Crie um projeto React do zero',
    'Crie um script Python',
    'Crie uma landing page HTML/CSS',
    'Instale dependências do projeto',
    'Explique e melhore este código',
    'Crie uma API com Express.js',
  ];

  const videoSuggestedPrompts = [
    'Corte do segundo 10 ao 30 do vídeo',
    'Adicione legenda automática com Whisper',
    'Converta para formato vertical (9:16)',
    'Adicione fade in e fade out',
    'Extraia o áudio do vídeo em MP3',
    'Deixe em slow motion (50% velocidade)',
    'Gere uma thumbnail para YouTube',
    'Normalize o volume do áudio',
    'Adicione texto com título no vídeo',
    'Exporte em máxima qualidade para YouTube',
  ];

  const suggestedPrompts = isVideoMode ? videoSuggestedPrompts : codeSuggestedPrompts;

  const videoPromptIcons = [
    <Scissors size={12} />, <Captions size={12} />, <Film size={12} />,
    <Sparkles size={12} />, <Music size={12} />, <Film size={12} />,
    <Sparkles size={12} />, <Music size={12} />, <Type size={12} />, <Film size={12} />,
  ];

  const renderMessageContent = (content: string, msg?: Message) => {
    // Remove web-action blocks from display — user should never see these
    const filtered = content
      .replace(/```web-action:[^\n]*\n[\s\S]*?```/g, '')
      .replace(/```web-action:[^\n]*/g, '') // partial block during streaming
      .trim();

    // If nothing left after filtering (pure action response), show nothing
    const displayContent = filtered || '';
    // Renderiza markdown inline: **bold**, *italic*, ~~strike~~, `code`
    const renderInline = (text: string, baseKey: number): React.ReactNode => {
      const parts: React.ReactNode[] = [];
      // Regex que captura **bold**, *italic*, ~~strike~~, `code`
      const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`)/g;
      let last = 0;
      let m: RegExpExecArray | null;
      let i = 0;
      while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) parts.push(<span key={`${baseKey}-t${i++}`}>{text.slice(last, m.index)}</span>);
        if (m[2] !== undefined)      parts.push(<strong key={`${baseKey}-b${i++}`}>{m[2]}</strong>);
        else if (m[3] !== undefined) parts.push(<em key={`${baseKey}-i${i++}`}>{m[3]}</em>);
        else if (m[4] !== undefined) parts.push(<del key={`${baseKey}-s${i++}`}>{m[4]}</del>);
        else if (m[5] !== undefined) parts.push(<code key={`${baseKey}-c${i++}`} style={{background:'rgba(255,255,255,0.1)',borderRadius:'3px',padding:'1px 4px',fontSize:'12px',fontFamily:'monospace'}}>{m[5]}</code>);
        last = m.index + m[0].length;
      }
      if (last < text.length) parts.push(<span key={`${baseKey}-t${i++}`}>{text.slice(last)}</span>);
      
      // Custom Mention parsing for user messages
      const finalParts = parts.map((part: any) => {
        if (msg && msg.role === 'user' && msg.modelName && msg.modelColor && part && part.props && typeof part.props.children === 'string' && part.type === 'span') {
          const str = part.props.children;
          const mentionText = `@${msg.modelName.replace(/\s+/g, '').toLowerCase()}`;
          const lowerStr = str.toLowerCase();
          const mentionIndex = lowerStr.indexOf(mentionText);
          if (mentionIndex !== -1) {
            const before = str.substring(0, mentionIndex);
            const exactMention = str.substring(mentionIndex, mentionIndex + mentionText.length);
            const after = str.substring(mentionIndex + mentionText.length);
            return (
              <span key={part.key}>
                {before}
                <strong style={{ color: msg.modelColor }}>{exactMention}</strong>
                {after}
              </span>
            );
          }
        }
        return part;
      });

      const combined = finalParts.length === 1 && typeof finalParts[0] === 'object' ? finalParts[0] : <>{finalParts}</>;
      return combined;
    };

    const lines = displayContent.split('\n');
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeLines: string[] = [];
    const result: JSX.Element[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.slice(3).trim();
          codeLines = [];
        } else {
          inCodeBlock = false;
          const isFileBlock = codeBlockLang.startsWith('file:');
          const isPatch = codeBlockLang.startsWith('file-patch:');
          const isCommand = codeBlockLang === 'command';
          const isMemory = codeBlockLang === 'save-memory';
          const isSpecial = isFileBlock || isCommand || isPatch || isMemory;
          
          const label = isFileBlock ? codeBlockLang.slice(5) : 
                        isPatch ? `Patch: ${codeBlockLang.slice(11)}` :
                        isCommand ? 'Terminal' : 
                        isMemory ? 'Memória' : codeBlockLang;

          result.push(<CodeBlock key={key++} label={label} code={codeLines.join('\n')} isSpecial={isSpecial} />);
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
      } else {
        if (line.trim() === '') {
          result.push(<br key={key++} />);
        } else if (/^#{1,3}\s/.test(line)) {
          // Títulos # ## ###
          const level = line.match(/^(#+)/)?.[1].length || 1;
          const text = line.replace(/^#+\s/, '');
          const fontSize = level === 1 ? '15px' : level === 2 ? '14px' : '13px';
          result.push(<p key={key++} style={{ fontWeight: 700, fontSize, margin: '6px 0 2px', color: 'var(--text-primary)' }}>{renderInline(text, key)}</p>);
        } else if (/^[-*]\s/.test(line)) {
          // Lista
          const text = line.replace(/^[-*]\s/, '');
          result.push(<p key={key++} style={{ margin: '2px 0', paddingLeft: '12px' }}>{'• '}{renderInline(text, key)}</p>);
        } else {
          result.push(<p key={key++}>{renderInline(line, key)}</p>);
        }
      }
    }

    // Se terminar dentro de um bloco de código (streaming), renderiza o que temos até agora
    if (inCodeBlock && codeLines.length > 0) {
      const isFileBlock = codeBlockLang.startsWith('file:');
      const isPatch = codeBlockLang.startsWith('file-patch:');
      const isCommand = codeBlockLang === 'command';
      const isMemory = codeBlockLang === 'save-memory';
      const isSpecial = isFileBlock || isCommand || isPatch || isMemory;
      
      const label = isFileBlock ? codeBlockLang.slice(5) : 
                    isPatch ? `Patch: ${codeBlockLang.slice(11)}` :
                    isCommand ? 'Terminal' : 
                    isMemory ? 'Memória' : codeBlockLang;

      // Durante o streaming, talvez não queiramos colapsar para o usuário ver o progresso?
      // Mas o usuário pediu para vir minimizado. Vamos manter a regra de colapsado.
      result.push(<CodeBlock key={key++} label={label} code={codeLines.join('\n')} isSpecial={isSpecial} />);
    }

    return result;
  };

  // Função que retorna o timestamp da última mensagem de um chat
  const getLastMessageTimestamp = (chatId: string): number => {
    try {
      const stored = localStorage.getItem(`bill-chat-${chatId}`);
      if (!stored) return -1; // Sem mensagens = vai pro final
      const messages = JSON.parse(stored) as Message[];
      if (messages.length === 0) return -1; // Sem mensagens = vai pro final
      const lastMsg = messages[messages.length - 1];
      return (lastMsg as any).timestamp || -1;
    } catch {
      return -1;
    }
  };

  const filteredContacts = React.useMemo(() => {
    const filtered = savedModels.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Ordena por última mensagem (mais recente primeiro)
    const sorted = filtered.sort((a, b) => {
      const timeA = getLastMessageTimestamp(a.id);
      const timeB = getLastMessageTimestamp(b.id);
      return timeB - timeA;
    });
    // console.log('[Chat] Contatos ordenados:', sorted.map(c => ({ name: c.name, time: getLastMessageTimestamp(c.id) })));
    return sorted;
  }, [savedModels, searchQuery, listUpdateTrigger]);
  
  const filteredGroups = React.useMemo(() => {
    const filtered = savedGroups.filter(g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Ordena por última mensagem (mais recente primeiro)
    const sorted = filtered.sort((a, b) => {
      const timeA = getLastMessageTimestamp(a.id);
      const timeB = getLastMessageTimestamp(b.id);
      return timeB - timeA;
    });
    // console.log('[Chat] Grupos ordenados:', sorted.map(g => ({ name: g.name, time: getLastMessageTimestamp(g.id) })));
    return sorted;
  }, [savedGroups, searchQuery, listUpdateTrigger]);
  
  // Lista unificada de contatos E grupos, ordenados por timestamp
  const allChats = React.useMemo(() => {
    const contacts = filteredContacts.map(c => ({ ...c, type: 'contact' as const }));
    const groups = filteredGroups.map(g => ({ ...g, type: 'group' as const }));
    const combined = [...contacts, ...groups];
    
    return combined.sort((a, b) => {
      const timeA = getLastMessageTimestamp(a.id);
      const timeB = getLastMessageTimestamp(b.id);
      return timeB - timeA;
    });
  }, [filteredContacts, filteredGroups]);

  // Funções de edição e exclusão
  const handleDeleteGroup = (groupId: string) => {
    const updatedGroups = savedGroups.filter(g => g.id !== groupId);
    setSavedGroups(updatedGroups);
    localStorage.setItem('bill-saved-groups', JSON.stringify(updatedGroups));
    setContextMenu(null);
  };

  const handleDeleteContact = (contactId: string) => {
    const updatedModels = savedModels.filter(m => m.id !== contactId);
    setSavedModels(updatedModels);
    localStorage.setItem('bill-saved-models', JSON.stringify(updatedModels));
    setContextMenu(null);
  };

  const handleEditGroup = (groupId: string) => {
    const group = savedGroups.find(g => g.id === groupId);
    if (group) {
      setEditingItem({ type: 'group', id: groupId, name: group.name, avatar: group.avatar || '' });
      setEditName(group.name);
      setEditAvatar(group.avatar || '');
      setContextMenu(null);
    }
  };

  const handleEditContact = (contactId: string) => {
    const contact = savedModels.find(m => m.id === contactId);
    if (contact) {
      setEditingItem({ type: 'contact', id: contactId, name: contact.name, avatar: contact.avatar || '', voice: contact.voice, color: contact.color });
      setEditName(contact.name);
      setEditAvatar(contact.avatar || '');
      setEditVoice(contact.voice || '');
      setEditColor(contact.color || '#3b82f6');
      setEditVoice(contact.voice || '');
      setContextMenu(null);
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (editingItem.type === 'group') {
      const updatedGroups = savedGroups.map(g => 
        g.id === editingItem.id ? { ...g, name: editName, avatar: editAvatar } : g
      );
      setSavedGroups(updatedGroups);
      localStorage.setItem('bill-saved-groups', JSON.stringify(updatedGroups));
    } else {
      const updatedModels = savedModels.map(m => 
        m.id === editingItem.id ? { ...m, name: editName, avatar: editAvatar, voice: editVoice || undefined, color: editColor || '#3b82f6' } : m
      );
      setSavedModels(updatedModels);
      localStorage.setItem('bill-saved-models', JSON.stringify(updatedModels));
      
      // ATUALIZA OS GRUPOS que contêm este contato SOMENTE com nome e voz (NÃO o avatar)
      const updatedGroups = savedGroups.map(group => ({
        ...group,
        models: group.models.map(model => 
          model.id === editingItem.id 
            ? { ...model, name: editName, voice: editVoice || undefined, color: editColor || '#3b82f6' }
            : model
        )
      }));
      setSavedGroups(updatedGroups);
      localStorage.setItem('bill-saved-groups', JSON.stringify(updatedGroups));
      console.log('[Chat] Atualizou nome/voz/cor nos grupos que contêm:', editName);
    }

    setEditingItem(null);
    setEditName('');
    setEditAvatar('');
    setEditVoice('');
    setEditColor('');
  };
  
  // Funções de chamada
  const startCall = async () => {
    if (!activeChat) {
      console.log('[Call] ERRO: Não há activeChat definido');
      return false;
    }
    
    console.log('[Call] Iniciando chamada...');
    console.log('[Call] activeChat:', activeChat);
    console.log('[Call] groupMode:', groupMode);
    console.log('[Call] groupModels:', groupModels.map(m => m.name).join(', '));
    
    setInCall(true);
    inCallRef.current = true; // Atualiza ref junto com state
    callChatIdRef.current = activeChat; // Salva o ID do chat em ligação
    setCallDuration(0);
    
    // Adiciona mensagem de início de chamada no histórico
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const callMessage: Message = {
      role: 'system',
      content: `Ligação iniciada às ${timeStr}`,
      timestamp: now.toISOString(),
      isCallMarker: true, // Flag especial para identificar
      callStartTime: now.toISOString()
    };
    
    // Salva no localStorage
    const saved = localStorage.getItem(`bill-chat-${activeChat}`);
    const currentMessages = saved ? JSON.parse(saved) : [];
    const updatedMessages = [...currentMessages, callMessage];
    localStorage.setItem(`bill-chat-${activeChat}`, JSON.stringify(updatedMessages));
    console.log('[Call] Salvou mensagem de início no localStorage para:', activeChat, 'Total mensagens:', updatedMessages.length);
    
    // Atualiza estado local para mostrar imediatamente
    setChatMessages(prev => ({
      ...prev,
      [activeChat]: updatedMessages
    }));
    
    console.log('[Call] Mensagem de início adicionada ao chat');
    
    // Atualiza o volume global da chamada
    if ((window as any).callVolumeRef) {
      (window as any).callVolumeRef.current = callVolume;
    }
    
    callIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Inicia o microfone automaticamente
    try {
      const audioConstraints = settings.selectedMicId 
        ? { deviceId: { exact: settings.selectedMicId } }
        : true;
      
      console.log('[Call] Solicitando acesso ao microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      console.log('[Call] Microfone autorizado, stream obtido');
      callStreamRef.current = stream;
      
      // Configura análise de áudio para detectar silêncio
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 2048;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      console.log('[Call] Analisador de áudio configurado');
      
      // Inicia gravação contínua
      startCallRecording(stream);
      
    } catch (err) {
      console.warn('[Call] Microfone não disponível - chamada continuará sem áudio do usuário:', err);
      // Não encerra a chamada - permite continuar sem microfone (apenas receber)
    }
    
    console.log('[Call] Chamada iniciada com sucesso!');
    return true;
  };
  
  const startCallRecording = (stream: MediaStream) => {
    console.log('[Call] Iniciando gravação...');
    
    // Para monitoramento anterior se existir
    if (stopMonitoringRef.current) {
      console.log('[Call] Parando monitoramento anterior...');
      stopMonitoringRef.current();
      stopMonitoringRef.current = null;
    }
    
    // Limpa timeout de silêncio anterior
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    console.log('[Call] MimeType:', mimeType);
    const recorder = new MediaRecorder(stream, { mimeType });
    callAudioChunksRef.current = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        console.log('[Call] Chunk de áudio recebido:', e.data.size, 'bytes');
        callAudioChunksRef.current.push(e.data);
      }
    };
    
    recorder.onstop = async () => {
      console.log('[Call] Gravação parada, chunks:', callAudioChunksRef.current.length);
      const blob = new Blob(callAudioChunksRef.current, { type: 'audio/webm' });
      console.log('[Call] Blob criado:', blob.size, 'bytes');
      const totalSize = blob.size;
      const stillInCall = inCallRef.current;
      callAudioChunksRef.current = [];
      
      console.log('[Call] inCallRef.current:', stillInCall, 'blobSize:', totalSize);
      
      // Processa se tiver mais de 1KB e estiver em chamada (usa ref para evitar closure)
      if (totalSize > 1000 && stillInCall) {
        console.log('[Call] Processando áudio...');
        await processCallAudio(blob);
      } else {
        console.log('[Call] Blob muito pequeno ou não está em chamada, ignorando. Size:', totalSize, 'inCall:', stillInCall);
      }
      
      // Reinicia gravação se ainda estiver em chamada (usa ref)
      if (stillInCall && callStreamRef.current) {
        console.log('[Call] Reiniciando gravação...');
        setTimeout(() => {
          if (inCallRef.current) {
            startCallRecording(callStreamRef.current!);
          }
        }, 100);
      }
    };
    
    // Coleta chunks a cada 100ms para ter áudio mais completo
    recorder.start(100);
    callMediaRecorderRef.current = recorder;
    setIsCallRecording(true);
    console.log('[Call] MediaRecorder iniciado, estado:', recorder.state);
    
    // Monitora silêncio e guarda a função de parar
    stopMonitoringRef.current = monitorSilence();
  };
  
  const monitorSilence = () => {
    if (!analyserRef.current) {
      console.log('[Call] Analyser não disponível, não pode monitorar');
      return;
    }
    
    console.log('[Call] Iniciando monitoramento de silêncio...');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastLogTime = Date.now();
    let isMonitoring = true; // Flag local para controlar o loop
    let recordingStartTime = Date.now(); // Marca quando começou a gravar
    let speechDetected = false; // Flag para saber se detectou fala
    
    const checkVolume = () => {
      // Verifica se ainda deve monitorar (usa refs ao invés de state)
      if (!isMonitoring || !analyserRef.current || !callStreamRef.current) {
        console.log('[Call] Parando monitoramento');
        return;
      }
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      
      // Log do volume a cada 2 segundos para debug
      const now = Date.now();
      if (now - lastLogTime > 2000) {
        console.log('[Call] Volume atual:', average.toFixed(2));
        lastLogTime = now;
      }
      
      // Se detectou som (acima do limiar aumentado para 20)
      if (average > 20) {
        speechDetected = true; // Marca que detectou fala
        // Cancela timeout de silêncio anterior
        if (silenceTimeoutRef.current) {
          console.log('[Call] Fala detectada, cancelando timeout de silêncio');
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      } else {
        // Detectou silêncio
        const recordingDuration = now - recordingStartTime;
        
        // Só processa se:
        // 1. Detectou fala em algum momento (speechDetected = true)
        // 2. Gravou pelo menos 1 segundo
        // 3. Não está já processando
        if (!silenceTimeoutRef.current && !isCallProcessing && speechDetected && recordingDuration > 1000) {
          // Aguarda 2.5 segundos de silêncio antes de processar
          console.log('[Call] Silêncio após fala detectado, aguardando 2.5s...');
          silenceTimeoutRef.current = setTimeout(() => {
            if (callMediaRecorderRef.current && callMediaRecorderRef.current.state === 'recording') {
              console.log('[Call] Silêncio confirmado após fala, processando áudio...');
              callMediaRecorderRef.current.stop();
            }
            silenceTimeoutRef.current = null;
          }, 2500);
        }
      }
      
      requestAnimationFrame(checkVolume);
    };
    
    checkVolume();
    
    // Retorna função para parar o monitoramento
    return () => {
      isMonitoring = false;
    };
  };
  
  const processCallAudio = async (blob: Blob) => {
    setIsCallProcessing(true);
    
    console.log('[Call] Blob criado - tamanho:', blob.size, 'bytes, tipo:', blob.type);
    
    // Se o blob está vazio, não faz nada
    if (blob.size === 0) {
      console.log('[Call] Nenhum áudio gravado');
      setIsCallProcessing(false);
      return;
    }
    
    try {
      // Converte para base64 de forma segura (sem estouro de stack)
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Converte em chunks para evitar "Maximum call stack size exceeded"
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      
      console.log('[Call] Base64 gerado - tamanho:', base64.length, 'caracteres');
      console.log('[Call] Salvando áudio...');
      const saveResult = await (window as any).electronAPI.saveAudioBlob(base64, 'webm');
      if (!saveResult.success) throw new Error(saveResult.error);
      console.log('[Call] Áudio salvo em:', saveResult.path);
      
      console.log('[Call] Transcrevendo...');
      const transcribeResult = await (window as any).electronAPI.transcribeAudio(saveResult.path);
      console.log('[Call] Resultado da transcrição:', JSON.stringify(transcribeResult, null, 2));
      
      if (transcribeResult.success && transcribeResult.segments?.length > 0) {
        const text = transcribeResult.segments.map((s: any) => s.text).join(' ').trim();
        console.log('[Call] Transcrição final:', text);
        console.log('[Call] Enviando para chat:', activeChat || '(nenhum - chat principal)');
        console.log('[Call] isStreaming:', isStreaming);
        console.log('[Call] Chamando onSendMessage com:', {
          text,
          fromTerminalAgent: undefined,
          activeChatId: activeChat || undefined
        });
        
        if (text && text.length > 2 && !isStreaming) {
          // Envia para a IA apenas se não estiver streamando
          // Durante chamada, as mensagens não devem ser salvas no histórico
          // por isso passamos uma flag especial
          console.log('[Call] Enviando mensagem de chamada (não será salva no histórico)');
          (window as any).skipHistorySave = true; // Flag global temporária
          
          // Verifica se está em modo grupo
          if (groupMode && groupModels.length > 0 && onSendGroupMessage && activeChat) {
            console.log('[Call] Enviando para grupo:', groupModels.map(m => m.name).join(', '));
            const result = onSendGroupMessage(text, groupModels, activeChat);
            console.log('[Call] onSendGroupMessage retornou:', result);
          } else {
            // Envia para chat individual
            const result = onSendMessage(text, undefined, activeChat || undefined);
            console.log('[Call] onSendMessage retornou:', result);
          }
          
          (window as any).skipHistorySave = false;
        } else if (isStreaming) {
          console.log('[Call] Ignorando - IA ainda está respondendo (isStreaming=true)');
        } else {
          console.log('[Call] Texto muito curto, ignorando:', text);
        }
      } else {
        console.log('[Call] Whisper não detectou fala no áudio - verifique:');
        console.log('  1. Volume do microfone está adequado?');
        console.log('  2. Duração da gravação foi suficiente? (mínimo ~1 segundo)');
        console.log('  3. Microfone correto selecionado nas configurações?');
        console.log('  4. Ambiente com muito ruído pode confundir o VAD');
      }
    } catch (err) {
      console.error('[Call] Erro ao processar áudio:', err);
    } finally {
      setIsCallProcessing(false);
    }
  };
  
  const endCall = () => {
    if (!activeChat) {
      console.log('[Call] ERRO: Não há activeChat ao finalizar chamada');
      return;
    }
    
    const currentDuration = callDuration; // Captura antes de zerar
    
    console.log('[Call] Finalizando chamada...');
    console.log('[Call] activeChat:', activeChat);
    console.log('[Call] Duração:', currentDuration, 'segundos');
    
    setInCall(false);
    inCallRef.current = false; // Atualiza ref junto com state
    callChatIdRef.current = null; // Limpa o ID do chat
    setCallMinimized(false); // Reseta minimização
    setCallDuration(0);
    setIsCallRecording(false);
    setIsCallProcessing(false);
    
    // Atualiza a mensagem de chamada no histórico
    const saved = localStorage.getItem(`bill-chat-${activeChat}`);
    console.log('[Call] localStorage para', activeChat, ':', saved ? 'encontrado' : 'não encontrado');
    
    if (saved) {
      const messages = JSON.parse(saved);
      console.log('[Call] Total de mensagens no chat:', messages.length);
      
      // Encontra a última mensagem de início de chamada
      const callMarkerIndex = messages.findIndex((m: any) => m.isCallMarker && m.callStartTime && !m.callEndTime);
      console.log('[Call] Índice do marcador de chamada:', callMarkerIndex);
      
      if (callMarkerIndex !== -1) {
        const callMessage = messages[callMarkerIndex];
        const startTime = new Date(callMessage.callStartTime);
        const endTime = new Date();
        
        const startTimeStr = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Formata duração
        const minutes = Math.floor(currentDuration / 60);
        const seconds = currentDuration % 60;
        const durationStr = minutes > 0 
          ? `${minutes}min ${seconds}s` 
          : `${seconds}s`;
        
        // Atualiza a mensagem
        messages[callMarkerIndex] = {
          ...callMessage,
          content: `Ligação: ${startTimeStr} - ${endTimeStr} (${durationStr})`,
          callEndTime: endTime.toISOString()
        };
        
        // Remove todas as mensagens que vieram DEPOIS do marcador de chamada
        // (essas são as conversas da chamada que não devem ficar no histórico)
        const cleanedMessages = messages.slice(0, callMarkerIndex + 1);
        console.log('[Call] Removendo', messages.length - cleanedMessages.length, 'mensagens da chamada do histórico');
        
        localStorage.setItem(`bill-chat-${activeChat}`, JSON.stringify(cleanedMessages));
        console.log('[Call] Atualizou mensagem de chamada no localStorage');
        
        // Limpa o buffer do App.tsx também
        if ((window as any).clearChatBuffer) {
          console.log('[Call] Limpando buffer do App.tsx');
          (window as any).clearChatBuffer(activeChat, cleanedMessages);
        }
        
        // Atualiza estado local para mostrar imediatamente
        setChatMessages(prev => ({
          ...prev,
          [activeChat]: cleanedMessages
        }));
        
        console.log('[Call] Chamada finalizada e registrada no histórico');
      } else {
        console.log('[Call] AVISO: Não encontrou marcador de chamada para atualizar');
      }
    } else {
      console.log('[Call] ERRO: Não encontrou histórico no localStorage');
    }
    
    // Remove o volume da chamada
    if ((window as any).callVolumeRef) {
      (window as any).callVolumeRef.current = null;
    }
    
    // Para monitoramento
    if (stopMonitoringRef.current) {
      stopMonitoringRef.current();
      stopMonitoringRef.current = null;
    }
    
    // Limpa intervalo de tempo
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
      callIntervalRef.current = null;
    }
    
    // Para gravação
    if (callMediaRecorderRef.current && callMediaRecorderRef.current.state !== 'inactive') {
      callMediaRecorderRef.current.stop();
    }
    callMediaRecorderRef.current = null;
    
    // Limpa timeout de silêncio
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Para stream de áudio
    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach(track => track.stop());
      callStreamRef.current = null;
    }
    
    // Limpa contexto de áudio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };
  
  // Limpa o intervalo quando o componente desmonta
  useEffect(() => {
    return () => {
      if (callIntervalRef.current) {
        clearInterval(callIntervalRef.current);
      }
    };
  }, []);
  
  // Formata o tempo da chamada (00:00)
  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Deletar mensagem
  const handleDeleteMessage = (messageIndex: number) => {
    if (activeChat) {
      console.log('[Chat] Deletando mensagem índice:', messageIndex, 'do chat:', activeChat);
      
      setChatMessages(prev => {
        const updated = {
          ...prev,
          [activeChat]: prev[activeChat].filter((_, i) => i !== messageIndex)
        };
        
        // Atualiza localStorage
        try {
          localStorage.setItem(`bill-chat-${activeChat}`, JSON.stringify(updated[activeChat]));
          console.log('[Chat] Mensagem deletada do localStorage');
        } catch (e) {
          console.error('[Chat] Erro ao deletar mensagem do localStorage:', e);
        }
        
        return updated;
      });
      
      // IMPORTANTE: Também remove do buffer em memória (App.tsx)
      // Dispara evento customizado para o App.tsx limpar o chatBuffersRef
      window.dispatchEvent(new CustomEvent('bill-delete-message', {
        detail: { chatId: activeChat, messageIndex }
      }));
      console.log('[Chat] Evento bill-delete-message disparado');
    }
    setMessageContextMenu(null);
  };

  // Se tem chat ativo, mostra apenas o chat. Senão, mostra a lista de contatos
  const showingChatView = activeChat !== null;

  // Mensagens do chat ativo (se não tiver chat ativo, usa as mensagens principais do prop)
  // REMOVIDO useMemo - usa diretamente pra sempre pegar valor atualizado
  const currentMessages = activeChat ? (chatMessages[activeChat] || []) : messages;
  
  // Log para debug
  useEffect(() => {
    console.log('[Chat/currentMessages] activeChat:', activeChat, '| mensagens:', currentMessages.length);
    if (activeChat) {
      console.log('[Chat/currentMessages] chatMessages[', activeChat, ']:', chatMessages[activeChat]?.length || 0);
    }
  }, [activeChat, currentMessages, chatMessages]);

  // Rola para baixo quando troca de chat ou carrega mensagens
  useEffect(() => {
    // Pequeno delay para garantir que as mensagens foram renderizadas
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeChat, currentMessages.length]);

  // Carrega mensagens do localStorage quando monta ou activeChat muda
  const onClearMessagesRef = useRef(onClearMessages);
  useEffect(() => {
    onClearMessagesRef.current = onClearMessages;
  }, [onClearMessages]);

  useEffect(() => {
    if (activeChat) {
      const saved = localStorage.getItem(`bill-chat-${activeChat}`);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          
          // CORREÇÃO: Remove avatares undefined das mensagens salvas
          const isGroup = savedGroups.some(g => g.id === activeChat);
          if (isGroup) {
            const group = savedGroups.find(g => g.id === activeChat);
            parsed = parsed.map((msg: Message) => {
              if (msg.role === 'assistant' && msg.modelAvatar === undefined) {
                // Remove avatar undefined para forçar fallback
                const { modelAvatar, ...rest } = msg;
                return rest;
              }
              return msg;
            });
            // Salva as mensagens corrigidas
            localStorage.setItem(`bill-chat-${activeChat}`, JSON.stringify(parsed));
          }
          
          setChatMessages(prev => ({
            ...prev,
            [activeChat]: parsed
          }));
          console.log('[Chat] Carregou histórico do localStorage:', activeChat, parsed.length, 'mensagens');
          
          // Reseta o ref de mensagens anteriores quando muda de chat
          prevMessagesLengthRef.current = -1;
          
          // Verifica se houve shift de mensagens (mensagens antigas removidas)
          const shiftKey = 'bill-chat-shift-' + activeChat;
          const shift = localStorage.getItem(shiftKey);
          if (shift) {
            const shiftCount = parseInt(shift);
            setLastSeenMessageIndex(prev => {
              const currentIndex = prev[activeChat] ?? -1;
              const newIndex = Math.max(-1, currentIndex - shiftCount);
              console.log('[Chat] Ajustando lastSeenMessageIndex devido a shift:', activeChat, 'era:', currentIndex, 'agora:', newIndex, 'shift:', shiftCount);
              return {
                ...prev,
                [activeChat]: newIndex
              };
            });
            // Remove o marcador de shift
            localStorage.removeItem(shiftKey);
          }
          
          // NÃO marca como lido automaticamente ao abrir
          // Só marca como lido quando você realmente vê as mensagens (ao fechar o chat)
        } catch {}
      } else {
        // Se não tem histórico salvo, inicializa vazio
        setChatMessages(prev => ({
          ...prev,
          [activeChat]: []
        }));
        console.log('[Chat] Chat novo sem histórico:', activeChat);
      }
      
      // NÃO limpa mais o array global - cada chat mantém seu próprio buffer
      // Isso permite múltiplos chats responderem simultaneamente
    }
    
    // Cleanup: marca como lido ao SAIR do chat
    return () => {
      if (activeChat) {
        const saved = localStorage.getItem(`bill-chat-${activeChat}`);
        if (saved) {
          try {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
              setLastSeenMessageIndex(prev => ({
                ...prev,
                [activeChat]: messages.length - 1
              }));
              
              // Salva hash da última mensagem
              const lastMsg = messages[messages.length - 1];
              const textContent = getMessageTextContent(lastMsg.content);
              const hash = `${lastMsg.role}_${textContent.substring(0, 50)}`;
              lastMessageIdRef.current[activeChat] = hash;
              
              try {
                localStorage.setItem('bill-last-message-ids', JSON.stringify(lastMessageIdRef.current));
              } catch {}
            }
          } catch {}
        }
      }
    };
  }, [activeChat]);

  // Sincroniza quando as mensagens do App.tsx mudam (incluindo quando são limpas)
  const prevMessagesLengthRef = useRef<number>(-1);
  useEffect(() => {
    if (activeChat) {
      // Detecta limpeza: se tinha mensagens antes e agora está vazio
      const hadMessages = prevMessagesLengthRef.current > 0;
      const nowEmpty = messages.length === 0;
      const localHasMessages = (chatMessages[activeChat]?.length ?? 0) > 0;
      
      if (hadMessages && nowEmpty && localHasMessages) {
        console.log('[Chat] Detectou limpeza de mensagens, limpando estado local:', activeChat);
        setChatMessages(prev => ({
          ...prev,
          [activeChat]: []
        }));
      }
      
      // Atualiza o ref para a próxima checagem
      prevMessagesLengthRef.current = messages.length;
    }
  }, [messages.length, activeChat]); // Removido chatMessages das dependências

  // Sincroniza mensagens do prop global com o chat ativo (apenas durante streaming)
  const lastSyncedLengthRef = useRef(0);
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    // Proteção: garante que messages é um array
    if (!Array.isArray(messages)) return;
    
    // Só sincroniza se:
    // 1. Tem chat ativo
    // 2. Tem mensagens no prop (não está vazio)
    // 3. Está em streaming (para ver updates em tempo real)
    // 4. O tamanho das mensagens mudou (evita loops)
    if (activeChat && messages.length > 0 && isStreaming && messages.length !== lastSyncedLengthRef.current) {
      console.log('[Chat] Sincronizando', messages.length, 'mensagens do App.tsx para chat', activeChat, '(streaming)');
      lastSyncedLengthRef.current = messages.length;
      
      // Durante streaming, força update imediato para mostrar progresso
      setChatMessages(prev => {
        const updated = {
          ...prev,
          [activeChat]: [...messages].slice(-20)
        };
        return updated;
      });
      
      console.log('[Chat] Atualizou estado local (sem salvar no localStorage ainda)');
    }
    
    // Reset quando para de fazer streaming
    if (!isStreaming && lastSyncedLengthRef.current > 0) {
      lastSyncedLengthRef.current = 0;
    }
  }, [messages, activeChat, isStreaming]);

  // Recarrega do localStorage quando streaming termina
  useEffect(() => {
    // Detecta transição de streaming -> não streaming
    if (isStreaming) {
      wasStreamingRef.current = true;
      return;
    }
    
    // Se estava fazendo streaming e agora parou
    if (wasStreamingRef.current && !isStreaming && activeChat) {
      wasStreamingRef.current = false;
      
      // Verifica se esse chat específico parou de fazer streaming
      if (isModelStreaming && !isModelStreaming(activeChat)) {
        // Aguarda para garantir que o App.tsx salvou
        const timer = setTimeout(() => {
          const saved = localStorage.getItem(`bill-chat-${activeChat}`);
          if (saved) {
            try {
              const parsedFromStorage = JSON.parse(saved);
              
              // Mescla com mensagens em memória para preservar campos image (base64)
              setChatMessages(prev => {
                const currentInMemory = prev[activeChat] || [];
                
                // Mescla: se mensagem existe em memória com image, mantém o image
                const merged = parsedFromStorage.map((msgFromStorage: Message, idx: number) => {
                  const msgInMemory = currentInMemory[idx];
                  
                  // Se mensagem em memória tem image, preserva
                  if (msgInMemory?.image) {
                    return { ...msgFromStorage, image: msgInMemory.image };
                  }
                  
                  return msgFromStorage;
                });
                
                console.log('[Chat] Recarregou e mesclou com imagens em memória:', activeChat, merged.length, 'mensagens');
                
                return {
                  ...prev,
                  [activeChat]: merged
                };
              });
              
              // NÃO marca como lido automaticamente
              // Só marca quando você SAIR do chat
            } catch (e) {
              console.error('[Chat] Erro ao recarregar:', e);
            }
          }
        }, 200);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isStreaming, activeChat, isModelStreaming]);
  
  // Atualiza contadores de não lidas para chats que não estão ativos
  const lastMessageIdRef = useRef<Record<string, string>>({});
  const initializedRef = useRef(false);
  
  useEffect(() => {
    if (!initializedRef.current) {
      const savedIds = localStorage.getItem('bill-last-message-ids');
      if (savedIds) {
        try {
          lastMessageIdRef.current = JSON.parse(savedIds);
        } catch {}
      }
      initializedRef.current = true;
    }
    
    const updateUnreadCounts = () => {
      const newUnreadCounts: Record<string, number> = {};
      
      savedModels.forEach(model => {
        if (model.id === activeChat) {
          newUnreadCounts[model.id] = 0;
          const saved = localStorage.getItem(`bill-chat-${model.id}`);
          if (saved) {
            try {
              const messages = JSON.parse(saved);
              if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                // Usa hash simples: role + primeiros 50 chars do conteúdo
                const textContent = getMessageTextContent(lastMsg.content);
                const hash = `${lastMsg.role}_${textContent.substring(0, 50)}`;
                lastMessageIdRef.current[model.id] = hash;
                try {
                  localStorage.setItem('bill-last-message-ids', JSON.stringify(lastMessageIdRef.current));
                } catch {}
              }
            } catch {}
          }
          return;
        }
        
        const saved = localStorage.getItem(`bill-chat-${model.id}`);
        if (saved) {
          try {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              const textContent = getMessageTextContent(lastMsg.content);
              const currentHash = `${lastMsg.role}_${textContent.substring(0, 50)}`;
              const savedHash = lastMessageIdRef.current[model.id];
              
              if (savedHash && currentHash !== savedHash) {
                newUnreadCounts[model.id] = 1;
              }
            }
          } catch {}
        }
      });
      
      savedGroups.forEach(group => {
        if (group.id === activeChat) {
          newUnreadCounts[group.id] = 0;
          const saved = localStorage.getItem(`bill-chat-${group.id}`);
          if (saved) {
            try {
              const messages = JSON.parse(saved);
              if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                const textContent = getMessageTextContent(lastMsg.content);
                const hash = `${lastMsg.role}_${textContent.substring(0, 50)}`;
                lastMessageIdRef.current[group.id] = hash;
                try {
                  localStorage.setItem('bill-last-message-ids', JSON.stringify(lastMessageIdRef.current));
                } catch {}
              }
            } catch {}
          }
          return;
        }
        
        const saved = localStorage.getItem(`bill-chat-${group.id}`);
        if (saved) {
          try {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              const textContent = getMessageTextContent(lastMsg.content);
              const currentHash = `${lastMsg.role}_${textContent.substring(0, 50)}`;
              const savedHash = lastMessageIdRef.current[group.id];
              
              if (savedHash && currentHash !== savedHash) {
                newUnreadCounts[group.id] = 1;
              }
            }
          } catch {}
        }
      });
      
      setUnreadCounts(newUnreadCounts);
    };
    
    updateUnreadCounts();
    const interval = setInterval(updateUnreadCounts, 500);
    return () => clearInterval(interval);
  }, [savedModels, savedGroups, activeChat]);

  // Salva lastSeenMessageIndex no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('bill-last-seen-messages', JSON.stringify(lastSeenMessageIndex));
  }, [lastSeenMessageIndex]);

  useEffect(() => {
    // Log removido
  }, [messages, activeChat, currentMessages]);

  return (
    <div className="chat-container">
      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Token bars — substitui o título "Bill Code" */}
        <div className="token-bars-container">
          {tokenBars.length === 0 ? (
            <span className="token-bars-empty">tokens</span>
          ) : (
            tokenBars.map((bar) => {
              // Altura máxima 32px, mínima 6px
              const maxTokens = Math.max(...tokenBars.map(b => b.tokens), 1);
              const heightPct = Math.max(0.15, bar.tokens / maxTokens);
              const height = Math.round(6 + heightPct * 26);
              return (
                <div key={bar.id} className="token-bar-wrap" title={`${bar.tokens} tokens`}>
                  <div
                    className={`token-bar ${bar.growing ? 'token-bar--growing' : 'token-bar--done'}`}
                    style={{ height: `${height}px` }}
                  />
                  <span className="token-bar-label">
                    {formatTokens(bar.tokens)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onClearMessages && Array.isArray(messages) && messages.length > 0 && (
            <button 
              className="clear-chat-btn" 
              onClick={onClearMessages} 
              title="Limpar histórico do chat"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <Trash2 size={12} />
            </button>
          )}
          <div className="chat-provider-badge" title="Altere o provider nas configurações" style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Bot size={12} style={{marginRight: 4}} />
              {getProviderLabel(settings)}
              {settings.apiProvider === 'ollama' && (
                <button className="refresh-models-btn" onClick={onRefreshModels} title="Atualizar modelos Ollama">
                  <RefreshCw size={10} />
                </button>
              )}
            </div>
            {currentActivity && (
              <div style={{ 
                fontSize: 9, 
                color: '#10b981', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 3,
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '1px 5px',
                borderRadius: 3
              }}>
                <span style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: '50%', 
                  background: '#10b981',
                  display: 'inline-block'
                }} />
                {currentActivity.app === 'chrome' || currentActivity.app === 'firefox' || currentActivity.app === 'msedge' ? 
                  `Navegando: ${currentActivity.title.slice(0, 25)}${currentActivity.title.length > 25 ? '...' : ''}` :
                  `Jogando: ${currentActivity.app}`
                }
              </div>
            )}
          </div>
          {/* Botões gaming mode — dentro do header existente */}
          {onGamingMini && gamingMode && (
            <button
              onClick={onGamingMini}
              title="Minimizar para ícone"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: 4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {onGamingToggle && (
            <button
              onClick={onGamingToggle}
              title={gamingMode ? 'Sair do modo gaming' : 'Modo gaming — overlay sobre o jogo'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: gamingMode ? '#c084fc' : 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = gamingMode ? '#c084fc' : 'var(--text-secondary)'; }}
            >
              {gamingMode
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              }
            </button>
          )}
        </div>
      </div>

      {/* Header do chat ativo - ABAIXO dos tokens */}
      {showingChatView && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-tertiary)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {/* Foto do perfil */}
          {(() => {
            const contact = savedModels.find(m => m.id === activeChat);
            const group = savedGroups.find(g => g.id === activeChat);
            const avatar = contact?.avatar || group?.avatar;
            const name = contact?.name || group?.name || 'Chat';
            
            return (
              <>
                {/* Avatar à esquerda */}
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: avatar ? 'transparent' : 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '2px solid var(--border-color)'
                }}>
                  {avatar ? (
                    <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    group ? <Users size={16} color="var(--text-secondary)" /> : <User size={16} color="var(--text-secondary)" />
                  )}
                </div>
                
                {/* Nome */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {name}
                  </div>
                </div>
                
                {/* Ícone de telefone */}
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  title="Ligar"
                  onClick={startCall}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </button>
                
                {/* Botão Voltar em retângulo */}
                <button
                  onClick={() => {
                    setActiveChat(null);
                    setGroupMode(false);
                    setGroupModels([]);
                  }}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '5px 10px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  Voltar
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Barra de notificação de chamada minimizada */}
      {inCall && callMinimized && callChatIdRef.current && (() => {
        const contact = savedModels.find(m => m.id === callChatIdRef.current);
        const group = savedGroups.find(g => g.id === callChatIdRef.current);
        const displayName = contact?.name || group?.name || 'Contato';
        
        return (
          <div
            onClick={() => {
              console.log('[Call] Clique na barra - voltando para interface de chamada');
              console.log('[Call] callChatIdRef.current:', callChatIdRef.current);
              console.log('[Call] É grupo?', !!group);
              
              try {
                // Primeiro restaura a interface
                setCallMinimized(false);
                
                // Se não está no chat da chamada, volta para ele
                if (activeChat !== callChatIdRef.current) {
                  console.log('[Call] Mudando activeChat de', activeChat, 'para', callChatIdRef.current);
                  
                  // Se é grupo, ativa modo grupo ANTES de mudar o activeChat
                  if (group && Array.isArray(group.members) && group.members.length > 0) {
                    console.log('[Call] Ativando modo grupo com', group.members.length, 'membros');
                    setGroupMode(true);
                    setGroupModels(group.members);
                  } else if (group) {
                    console.warn('[Call] Grupo encontrado mas sem membros válidos:', group);
                  }
                  
                  setActiveChat(callChatIdRef.current);
                } else {
                  console.log('[Call] Já está no chat correto, apenas restaurando interface');
                }
              } catch (error) {
                console.error('[Call] Erro ao voltar para chamada:', error);
              }
            }}
            style={{
              background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(124, 92, 252, 0.25))',
              borderBottom: '1px solid rgba(124, 92, 252, 0.3)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(124, 92, 252, 0.3))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(124, 92, 252, 0.25))';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--accent)" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Em chamada com {displayName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {formatCallTime(callDuration)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Clique para voltar
            </span>
          </div>
        );
      })()}

      <div className="chat-messages" ref={messagesContainerRef}>
        {/* Banner de Projeto Ativo */}
        {activeProject && showingChatView && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(102, 126, 234, 0.1))',
            border: '1px solid rgba(124, 92, 252, 0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            marginBottom: '8px',
            flexShrink: 0
          }}>
            <Folder size={12} color="#c084fc" />
            <div style={{ flex: 1, color: '#c084fc', fontWeight: 500 }}>
              {activeProject.name}
            </div>
            <span style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Em Andamento
            </span>
            <button
              onClick={() => onSetActiveProject?.(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: '#c084fc',
                display: 'flex',
                opacity: 0.6,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {currentMessages.length === 0 && showingChatView && (
          <div className="chat-welcome">
            {isVideoMode ? (
              <>
                <div className="welcome-icon">
                  <Film size={40} strokeWidth={1.5} />
                </div>
                <h3 style={{color: 'var(--text-primary)'}}>Bill Video está pronto!</h3>
                <p style={{color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', marginBottom: '16px'}}>
                  Editor profissional com FFmpeg. Corte, efeitos, legendas automáticas,
                  geração de imagens, narração e exportação avançada.
                </p>
                <div className="suggested-prompts" style={{gridTemplateColumns: '1fr'}}>
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={prompt}
                      className="prompt-btn video-prompt-btn"
                      onClick={() => !isStreaming && onSendMessage(prompt)}
                      disabled={isStreaming}
                      style={{display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left'}}
                    >
                      <span style={{opacity: 0.7, flexShrink: 0}}>{videoPromptIcons[i]}</span>
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : isPhotoMode ? (
              <>
                <div className="welcome-icon">
                  <Sparkles size={40} strokeWidth={1.5} />
                </div>
                <h3 style={{color: 'var(--text-primary)'}}>Bill Photo está pronto!</h3>
                <p style={{color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', marginBottom: '16px'}}>
                  Editor visual inteligente. Adicione imagens, textos, formas, efeitos e deixe a IA montar o layout por você.
                </p>
                <div className="suggested-prompts">
                  {['Busca uma foto de pôr do sol e adiciona ao canvas', 'Crie um post para Instagram com texto e fundo roxo', 'Adicione um título grande no topo do canvas', 'Gere uma imagem de um dragão voando'].map((prompt) => (
                    <button key={prompt} className="prompt-btn" onClick={() => !isStreaming && onSendMessage(prompt)} disabled={isStreaming}>{prompt}</button>
                  ))}
                </div>
              </>
            ) : isPaintMode ? (
              <>
                <div className="welcome-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l4-4 4 4"/><path d="M7 13V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>
                <h3 style={{color: 'var(--text-primary)'}}>Bill Paint está pronto!</h3>
                <p style={{color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', marginBottom: '16px'}}>
                  Especialista em artes digitais. Posso buscar referências, gerar imagens base, converter em traçado e dar feedback sobre seu desenho.
                </p>
                <div className="suggested-prompts">
                  {['Busca referência de mão segurando espada', 'Gera uma referência de rosto feminino anime', 'Quais cores usar para um personagem sombrio?', 'Como desenhar proporções de corpo corretas?'].map((prompt) => (
                    <button key={prompt} className="prompt-btn" onClick={() => !isStreaming && onSendMessage(prompt)} disabled={isStreaming}>{prompt}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="welcome-icon"><Bot size={40} strokeWidth={1.5} /></div>
                <h3>Bill Code está pronto!</h3>
                <p>Fale o que quer criar e a IA vai programar, criar arquivos e executar comandos automaticamente.</p>
                <div className="suggested-prompts">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="prompt-btn"
                      onClick={() => !isStreaming && onSendMessage(prompt)}
                      disabled={isStreaming}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!showingChatView ? (
          // Lista de contatos/grupos - usa classe "messages" para manter o mesmo efeito de fundo
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Barra de pesquisa com engrenagem */}
            <div style={{ padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '24px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Botão criar novo grupo */}
            <div
              onClick={() => {
                setCreatingGroup(true);
                setNewGroupStep('select');
                setTempGroupModels([]);
                setNewGroupName('');
                setNewGroupImage('');
              }}
              style={{
                display: 'none'
              }}
            >
            </div>

            {/* Lista unificada de grupos e contatos ordenados por última mensagem */}
            {allChats.map((chat) => {
              if (chat.type === 'group') {
                const group = chat;
              // Pega as mensagens do grupo do localStorage
              let messages: Message[] = [];
              const saved = localStorage.getItem(`bill-chat-${group.id}`);
              if (saved) {
                try {
                  messages = JSON.parse(saved);
                } catch {
                  messages = [];
                }
              }
              
              const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
              
              // Verifica se tem mensagens não lidas
              const unreadCount = unreadCounts[group.id] || 0;
              const hasUnread = unreadCount > 0;
              
              // Para grupos, mostra "ModelName: mensagem" ou "Você: mensagem"
              let lastMessagePreview = 'Sem mensagens';
              if (lastMessage && lastMessage.content) {
                const textContent = getMessageTextContent(lastMessage.content);
                if (textContent.trim()) {
                  if (lastMessage.role === 'user') {
                    const userDisplayName = settings.userName || 'Você';
                    lastMessagePreview = userDisplayName + ': ' + textContent.substring(0, 40);
                  } else {
                    // Encontra qual modelo respondeu baseado no modelId ou color
                    const respondingModel = group.models.find(m => 
                      m.id === lastMessage.modelId || 
                      m.color === lastMessage.color ||
                      m.name === lastMessage.sender
                    );
                    
                    if (respondingModel) {
                      lastMessagePreview = `${respondingModel.name}: ${textContent.substring(0, 35)}`;
                    } else {
                      // Se não identificou o modelo, mostra só a mensagem
                      lastMessagePreview = textContent.substring(0, 40);
                    }
                  }
                } else if (lastMessage.image) {
                  // Se tem imagem mas sem texto
                  const userDisplayName = settings.userName || 'Você';
                  lastMessagePreview = lastMessage.role === 'user' ? userDisplayName + ': 📷 Imagem' : '📷 Imagem';
                }
              }
              
              return (
              <div
                key={group.id}
                onClick={() => {
                  setActiveChat(group.id);
                  setGroupMode(true);
                  setGroupModels(group.models);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', id: group.id });
                }}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  background: hasUnread ? 'rgba(124, 92, 252, 0.05)' : '',
                  borderLeft: hasUnread ? '3px solid rgba(124, 92, 252, 0.8)' : '3px solid transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = hasUnread ? 'rgba(124, 92, 252, 0.08)' : 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = hasUnread ? 'rgba(124, 92, 252, 0.05)' : ''}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {group.avatar ? (
                    <img
                      src={group.avatar}
                      alt={group.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-color)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users size={20} color="#fff" />
                    </div>
                  )}
                  {hasUnread && (
                    <div style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'rgba(124, 92, 252, 0.95)',
                      border: '2px solid var(--bg-secondary)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: hasUnread ? 700 : 600, color: hasUnread ? '#fff' : 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.name}
                  </div>
                  <div style={{ fontSize: '12px', color: hasUnread ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : 400 }}>
                    {lastMessagePreview}
                  </div>
                </div>
              </div>
              );
              } else {
                // É um contato
                const model = chat;
                const unreadCount = unreadCounts[model.id] || 0;
                const hasUnread = unreadCount > 0;
              
              // SEMPRE pega do localStorage para garantir dados atualizados
              let messages: Message[] = [];
              const saved = localStorage.getItem(`bill-chat-${model.id}`);
              if (saved) {
                try {
                  messages = JSON.parse(saved);
                } catch {
                  messages = [];
                }
              }
              
              const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
              let lastMessagePreview = 'Sem mensagens';
              if (lastMessage && lastMessage.content) {
                const textContent = getMessageTextContent(lastMessage.content);
                if (textContent.trim()) {
                  const userDisplayName = settings.userName || 'Você';
                  lastMessagePreview = (lastMessage.role === 'user' ? userDisplayName + ': ' : '') + textContent.substring(0, 40);
                } else if (lastMessage.image) {
                  const userDisplayName = settings.userName || 'Você';
                  lastMessagePreview = lastMessage.role === 'user' ? userDisplayName + ': 📷 Imagem' : '📷 Imagem';
                }
              }
              
              return (
              <div
                key={model.id}
                onClick={() => {
                  setActiveChat(model.id);
                  setGroupMode(false);
                  setGroupModels([]);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'contact', id: model.id });
                }}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  background: hasUnread ? 'rgba(124, 92, 252, 0.05)' : '',
                  borderLeft: hasUnread ? '3px solid rgba(124, 92, 252, 0.8)' : '3px solid transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = hasUnread ? 'rgba(124, 92, 252, 0.08)' : 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = hasUnread ? 'rgba(124, 92, 252, 0.05)' : ''}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {model.avatar ? (
                    <img
                      src={model.avatar}
                      alt={model.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-color)'
                      }}
                    />
                  ) : (
                    <MouseAvatar size={40} />
                  )}
                  {hasUnread && (
                    <div style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'rgba(124, 92, 252, 0.95)',
                      border: '2px solid var(--bg-secondary)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: hasUnread ? 700 : 600, color: hasUnread ? '#fff' : 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {model.name}
                  </div>
                  <div style={{ fontSize: '12px', color: hasUnread ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : 400 }}>
                    {lastMessagePreview}
                  </div>
                </div>
              </div>
              );
              }
            })}
            
            {/* Botão fixo no canto inferior direito */}
            {!creatingGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMenu(!showAddMenu);
                }}
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  background: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  zIndex: 100
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                }}
                title="Opções"
              >
                <Users size={22} color="#fff" />
              </button>
            )}

            {/* Menu pop-up apenas com Criar Grupo */}
            {showAddMenu && !creatingGroup && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '70px',
                  right: '16px',
                  background: '#1a1a24',
                  border: '1px solid rgba(124, 92, 252, 0.3)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  minWidth: '180px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  zIndex: 101
                }}
              >
                <button
                  onClick={() => {
                    setCreatingGroup(true);
                    setTempGroupModels([]);
                    setNewGroupName('');
                    setNewGroupImage('');
                    setGroupSearchQuery('');
                    setNewGroupStep('select');
                    setShowAddMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#1a1a24',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a24'}
                >
                  <Users size={16} />
                  Criar Grupo
                </button>
              </div>
            )}
          </div>
        ) : (
          // Área de mensagens normal
          <>

        {currentMessages.filter((msg: any) => !msg.isSystem).map((msg, index) => {
          const isLast = index === currentMessages.length - 1;
          const hasThoughts = msg.thoughts && msg.thoughts.trim();

          // Mensagem de marcador de chamada (estilo especial)
          if ((msg as any).isCallMarker) {
            return (
              <div 
                key={index} 
                className="message system"
                style={{
                  justifyContent: 'center',
                  opacity: 0.8,
                  margin: '12px 0'
                }}
              >
                <div 
                  className="message-content"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  <span>{msg.content}</span>
                </div>
              </div>
            );
          }

          if (msg.role === 'system') return null;

          return (
            <div 
              key={index} 
              className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMessageContextMenu({ x: e.clientX, y: e.clientY, messageIndex: index });
              }}
            >
              <div className="message-avatar">
                {msg.role === 'user' 
                  ? (settings.userAvatar ? (
                      <img 
                        src={settings.userAvatar} 
                        alt="avatar" 
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${settings.userColor || '#3498db'}` }} 
                      />
                    ) : <User size={18} />)
                  : (() => {
                      // Tenta usar avatar da mensagem primeiro
                      if (msg.modelAvatar && msg.modelAvatar !== 'undefined') {
                        return (
                          <img 
                            src={msg.modelAvatar} 
                            alt="avatar" 
                            style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${msg.modelColor || 'black'}`, objectFit: 'cover' }} 
                          />
                        );
                      }
                      
                      // Se não tem, busca do contato/grupo salvo
                      if (activeChat) {
                        const contact = savedModels.find(m => m.id === activeChat);
                        const group = savedGroups.find(g => g.id === activeChat);
                        
                        let avatar: string | undefined;
                        
                        // Se for grupo, busca o avatar do modelo específico que enviou a mensagem
                        if (group && msg.modelName) {
                          const groupModel = group.models.find((m: any) => m.name === msg.modelName);
                          avatar = groupModel?.avatar;
                        } else if (contact) {
                          // Se for contato individual
                          avatar = contact.avatar;
                        }
                        
                        if (avatar && avatar !== 'undefined') {
                          return (
                            <img 
                              src={avatar} 
                              alt="avatar" 
                              style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${msg.modelColor || 'black'}`, objectFit: 'cover' }} 
                            />
                          );
                        }
                      }
                      
                      // Fallback: rato
                      return (
                        <MouseAvatar 
                          size={36} 
                          thinking={msg.role === 'assistant' && isLast && isStreaming && !msg.content} 
                          speaking={msg.role === 'assistant' && isLast && isStreaming && !!msg.content} 
                        />
                      );
                    })()
                }
              </div>
              
              <div className="message-content">
                {msg.role === 'user' && settings.userName && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: settings.userColor || '#3498db', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    fontWeight: 'bold', 
                    marginBottom: '2px',
                    textAlign: 'right'
                  }}>
                    {settings.userName}
                  </div>
                )}
                {msg.role === 'assistant' && msg.modelName && (
                  <div style={{ fontSize: '11px', color: msg.modelColor || 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '2px' }}>
                    {msg.modelName}
                  </div>
                )}
                {/* Pensamentos */}
                {hasThoughts && (
                  <div className="thoughts-container">
                    <div className="thoughts-header">
                      <span className="thought-icon"><Brain size={12} /></span>
                      <span className="thought-label">Pensando...</span>
                    </div>
                    <div className="thoughts-content">{msg.thoughts}</div>
                  </div>
                )}

                {/* Conteúdo principal */}
                {msg.content ? (() => {
                  // Detecta placeholder de pesquisa
                  if (msg.content === '__RESEARCHING__') {
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        background: 'rgba(155, 89, 182, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(155, 89, 182, 0.3)'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '3px solid rgba(155, 89, 182, 0.3)',
                          borderTop: '3px solid #9b59b6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <span style={{ color: '#9b59b6', fontWeight: '500' }}>Pesquisando na web...</span>
                        <style>{`
                          @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                          }
                        `}</style>
                      </div>
                    );
                  }
                  
                  // Detecta placeholder de geração (após pesquisa)
                  if (msg.content === '__GENERATING__') {
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        background: 'rgba(52, 152, 219, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(52, 152, 219, 0.3)'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '3px solid rgba(52, 152, 219, 0.3)',
                          borderTop: '3px solid #3498db',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <span style={{ color: '#3498db', fontWeight: '500' }}>Gerando resposta...</span>
                      </div>
                    );
                  }
                  
                  // Extrai texto do conteúdo (pode ser string ou array com visão)
                  const textContent = getMessageTextContent(msg.content);
                  
                  // Filtra web-action blocks para detectar se há conteúdo visível
                  const visibleContent = textContent
                    .replace(/```web-action:[^\n]*\n[\s\S]*?```/g, '')
                    .replace(/```web-action:[^\n]*/g, '')
                    .trim();

                  // Se tem conteúdo visível, renderiza normalmente
                  if (visibleContent) {
                    return (
                      <div className="message-text">
                        {/* Layout: ícone + nome do arquivo à direita, mais visível */}
                        {(msg.image || msg.imageFile) && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '10px',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#fff'
                          }}>
                            <ImageIcon size={18} />
                            <span>{msg.imageFile || 'imagem.jpg'}</span>
                          </div>
                        )}
                        {renderMessageContent(textContent, msg)}
                        {isLast && activeChat && isModelStreaming && isModelStreaming(activeChat) && (
                          <span className="streaming-wave">
                            <span /><span /><span />
                          </span>
                        )}
                        {msg.role === 'assistant' && !isStreaming && responseTimes[index] !== undefined && (
                          <div className="response-time">
                            <button className="copy-msg-btn" title="Copiar mensagem"
                              onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                            <span>{responseTimes[index]}s</span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Só tem web-action (sem texto visível) — mostra indicador de pesquisa
                  if (isLast && activeChat && isModelStreaming && isModelStreaming(activeChat) && msg.role === 'assistant') {
                    return (
                      <div className="message-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'lucide-spin 1s linear infinite', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Pesquisando...
                      </div>
                    );
                  }

                  // Conteúdo puro de ação já processado — não renderiza nada
                  return null;
                })() : (
                  // Mensagem sem conteúdo de texto
                  msg.image ? (
                    // Se tem imagem mas sem texto
                    <div className="message-text">
                      <img 
                        src={msg.image} 
                        alt={msg.imageFile || 'Imagem anexada'} 
                        style={{
                          maxWidth: '300px',
                          borderRadius: '8px',
                          display: 'block',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }} 
                      />
                    </div>
                  ) :
                  // Mensagem do assistente sem conteúdo
                  msg.role === 'assistant' && isLast && isStreaming ? (
                    <div className="thinking-indicator">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <div className="message-text" style={{ opacity: 0.5, fontStyle: 'italic' }}>
                      (sem resposta)
                    </div>
                  ) : null
                )}
              </div>
            </div>
          );
        })}

        {/* Notificação de Lembrete */}
        {reminderNotification && (
          <div className="message assistant">
            <div className="message-avatar">
              <MouseAvatar size={36} />
            </div>
            <div className="message-content">
              <div style={{
                background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.08), rgba(124, 92, 252, 0.12))',
                border: '1px solid rgba(124, 92, 252, 0.2)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'relative',
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(124, 92, 252, 0.25))',
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(124, 92, 252, 0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(124, 92, 252, 0.9)', marginBottom: '4px' }}>
                    Lembrete • {reminderNotification.time}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {reminderNotification.title}
                  </div>
                </div>
                {onDismissReminder && (
                  <button
                    onClick={onDismissReminder}
                    style={{
                      background: 'rgba(124, 92, 252, 0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px',
                      cursor: 'pointer',
                      color: 'rgba(124, 92, 252, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)';
                      e.currentTarget.style.color = 'rgba(124, 92, 252, 1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)';
                      e.currentTarget.style.color = 'rgba(124, 92, 252, 0.7)';
                    }}
                    title="Dispensar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Barra "trabalhando..." quando streaming */}
      {isStreaming && (
        <div className="working-bar" style={{ flexShrink: 0 }}>
          <span className="working-dots">
            <span />
            {(() => {
              // Coleta nomes das IAs que estão trabalhando
              const workingModels: string[] = [];
              
              console.log('[WorkingBar] Verificando modelos trabalhando...');
              console.log('[WorkingBar] activeChat:', activeChat);
              console.log('[WorkingBar] savedModels:', savedModels.map(m => ({ id: m.id, name: m.name })));
              
              // Se tem chat ativo e função para verificar streaming
              if (activeChat && isModelStreaming && getStreamingModelName) {
                console.log('[WorkingBar] Verificando se activeChat está fazendo streaming...');
                if (isModelStreaming(activeChat)) {
                  const modelName = getStreamingModelName(activeChat);
                  console.log('[WorkingBar] modelName do getStreamingModelName:', modelName);
                  
                  // Busca o nome do contato correspondente
                  const contact = savedModels.find(m => m.id === activeChat);
                  console.log('[WorkingBar] contact encontrado:', contact);
                  
                  const contactName = contact?.name || modelName || 'IA';
                  console.log('[WorkingBar] Nome final:', contactName);
                  workingModels.push(contactName);
                }
              }
              
              // Se tem streamingModels, coleta todos que estão trabalhando
              if (streamingModels && Object.keys(streamingModels).length > 0) {
                console.log('[WorkingBar] streamingModels:', streamingModels);
                Object.entries(streamingModels).forEach(([chatId, info]) => {
                  console.log('[WorkingBar] Verificando chatId:', chatId, 'info:', info);
                  if (info.isStreaming && info.modelName) {
                    // Busca o nome do contato
                    const contact = savedModels.find(m => m.id === chatId);
                    console.log('[WorkingBar] contact para', chatId, ':', contact);
                    const contactName = contact?.name || info.modelName;
                    console.log('[WorkingBar] contactName:', contactName);
                    if (!workingModels.includes(contactName)) {
                      workingModels.push(contactName);
                    }
                  }
                });
              }
              
              console.log('[WorkingBar] workingModels final:', workingModels);
              
              // Se não encontrou nenhum modelo, mostra genérico
              if (workingModels.length === 0) {
                console.log('[WorkingBar] Nenhum modelo identificado, mostrando genérico');
                return 'Trabalhando...';
              }
              
              // Formata os nomes
              if (workingModels.length === 1) {
                return `${workingModels[0]} trabalhando...`;
              } else if (workingModels.length === 2) {
                return `${workingModels[0]} e ${workingModels[1]} trabalhando...`;
              } else {
                return `${workingModels.slice(0, -1).join(', ')} e ${workingModels[workingModels.length - 1]} trabalhando...`;
              }
            })()}
          </span>
          {onCancelStream && (
            <button className="working-cancel" onClick={onCancelStream}>
              cancelar
            </button>
          )}
        </div>
      )}

      {/* Preview do arquivo anexado - ACIMA do form */}
      {attachedFile && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0
        }}>
          {attachedFilePreview ? (
            <img 
              src={attachedFilePreview} 
              alt="Preview" 
              style={{
                width: '60px',
                height: '60px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '2px solid var(--border-color)'
              }}
            />
          ) : (
            <div style={{
              width: '60px',
              height: '60px',
              background: 'var(--bg-input)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--border-color)'
            }}>
              <Paperclip size={28} color="var(--text-secondary)" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '4px'
            }}>
              {attachedFile.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {attachedFile.type || 'Arquivo'} • {(attachedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            onClick={removeAttachment}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            }}
            title="Remover anexo"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Botões de Aprovação - FIXOS NO RODAPÉ */}
      {pendingChanges && pendingChanges.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-light)',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <button
            type="button"
            onClick={() => pendingChanges.forEach(c => onAcceptChange && onAcceptChange(c.id))}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              opacity: 0.9
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
          >
            ✓ Aceitar {pendingChanges.length > 1 ? `(${pendingChanges.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => pendingChanges.forEach(c => onRejectChange && onRejectChange(c.id))}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
          >
            ✕ Rejeitar {pendingChanges.length > 1 ? `(${pendingChanges.length})` : ''}
          </button>
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="chat-input-wrapper" style={{ position: 'relative' }}>
          {/* Modal de seleção de Grupo */}
        {/* Menu lateral de Gerenciamento de Equipe */}
        {showTeamMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '80px',
              right: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              width: '350px',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              zIndex: 10000
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Gerenciamento de Equipe
              </h3>
              <button
                onClick={() => setShowTeamMenu(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* IA Chefe */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                IA Chefe (Gerenciamento Automático)
              </label>
              <select
                value={settings.bossModelId || ''}
                onChange={(e) => {
                  const newBossId = e.target.value || undefined;
                  const newSettings = { ...settings, bossModelId: newBossId };
                  if (onUpdateSettings) {
                    onUpdateSettings(newSettings);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">Nenhuma (desabilitado)</option>
                {savedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </option>
                ))}
              </select>
              <small style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px', lineHeight: '1.4' }}>
                A IA Chefe recebe lembretes, alertas e tarefas automáticas. Aparece com uma coroa branca na lista de contatos e é usada na aba Home.
              </small>
            </div>

            {/* Membros da Equipe */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', display: 'block' }}>
                Membros da Equipe ({savedModels.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {savedModels.map((model) => {
                  const isBoss = settings.bossModelId === model.id;
                  return (
                    <div
                      key={model.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px',
                        background: isBoss ? 'rgba(255, 215, 0, 0.1)' : 'var(--bg-tertiary)',
                        border: `1px solid ${isBoss ? 'rgba(255, 215, 0, 0.3)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Avatar */}
                      {model.avatar ? (
                        <img
                          src={model.avatar}
                          alt=""
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: `2px solid ${model.color || 'var(--accent)'}`
                          }}
                        />
                      ) : (
                        <MouseAvatar size={36} />
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {model.name}
                          </span>
                          {isBoss && (
                            <span style={{ fontSize: '14px' }} title="IA Chefe">👑</span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {model.provider} · {model.model}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {mentionQuery !== null && filteredModels.length > 0 && (
          <div className="mention-popover" style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 100,
            minWidth: '200px'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '4px 8px', fontWeight: 'bold' }}>
              Selecionar Modelo de IA
            </div>
            {filteredModels.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleMentionSelect(m.name.replace(/\s+/g, ''))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  background: 'var(--bg-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: m.color || 'var(--accent)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{m.name}</span>
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>{m.model || m.provider}</span>
                </div>
              </button>
            ))}
          </div>
        )}
          {/* Só mostra textarea e botões quando tiver um chat ativo */}
          {activeChat && (
            <>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                placeholder={
                  isListening ? '🎤 Gravando... solte para enviar' 
                  : isTranscribing ? '⏳ Transcrevendo...' 
                  : attachedFile 
                    ? 'Adicione uma mensagem (opcional)... (Enter para enviar)'
                    : 'Digite sua mensagem... (Enter para enviar, Shift+Enter nova linha)'
                }
                disabled={false}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && filteredModels.length > 0 && (e.key === 'Tab' || e.key === ' ')) {
                    e.preventDefault();
                    handleMentionSelect(filteredModels[0].name.replace(/\s+/g, ''));
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={2}
                style={{ maxHeight: '120px', overflowY: 'auto', resize: 'none' }}
              />
              {/* Coluna de botões à direita */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Linha 1: Anexar, Projetos e Grupo */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="mic-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    title="Anexar arquivo"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button 
                    type="button" 
                    className="mic-btn"
                    onClick={() => {
                      console.log('[Chat] Abrindo modal de projetos, activeMainView:', activeMainView);
                      setShowProjectsModal(true);
                    }}
                    disabled={isStreaming}
                    title="Abrir projetos"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Folder size={16} />
                  </button>
                  <button
                    type="button"
                    className="mic-btn"
                    onClick={() => setShowTeamMenu(v => !v)}
                    disabled={isStreaming}
                    title="Gerenciamento de Equipe"
                    style={{ position: 'relative' }}
                  >
                    <Users size={16} />
                  </button>
                </div>
                {/* Linha 2: Screenshot, Mic e Send */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className="mic-btn"
                    onClick={async () => {
                      try {
                        console.log('[Screenshot] Iniciando captura...');
                        const result = await (window as any).electronAPI.captureScreenArea?.();
                        console.log('[Screenshot] Resultado:', result);
                        if (result?.success && result?.base64) {
                          console.log('[Screenshot] Abrindo editor...');
                          // Dispara evento customizado com o base64
                          window.dispatchEvent(new CustomEvent('open-screenshot-editor', { 
                            detail: { base64: result.base64 }
                          }));
                        } else {
                          console.error('[Screenshot] Falhou:', result?.error);
                        }
                      } catch (err) {
                        console.error('[Screenshot] Erro:', err);
                      }
                    }}
                    disabled={isStreaming}
                    title="Capturar área da tela"
                    style={{ position: 'relative' }}
                  >
                    <Camera size={16} />
                  </button>
                  <button
                    type="button"
                    className={`mic-btn ${isListening ? 'mic-btn--active' : ''} ${isTranscribing ? 'mic-btn--transcribing' : ''}`}
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onMouseLeave={isListening ? stopListening : undefined}
                    onTouchStart={(e) => { e.preventDefault(); startListening(); }}
                    onTouchEnd={stopListening}
                    disabled={isStreaming || isTranscribing}
                    title={isTranscribing ? 'Transcrevendo...' : isListening ? 'Solte para enviar' : 'Segure para falar'}
                  >
                    {isTranscribing ? <Loader2 size={16} className="lucide-spin" /> : isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button type="submit" className="send-btn" disabled={!input.trim() || isStreaming}>
                    {isStreaming ? <Loader2 size={16} className="lucide-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </form>

      {/* Modal de Projetos - renderiza condicionalmente */}
      {showProjectsModal ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowProjectsModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a24, #12121c)',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '70vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#c084fc' }}>
                Projetos {activeMainView ? `- ${activeMainView.charAt(0).toUpperCase() + activeMainView.slice(1)}` : ''}
              </h2>
              <button
                onClick={() => setShowProjectsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#888',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <ProjectsList 
              activeMainView={activeMainView} 
              onSelectProject={(project) => {
                console.log('[Chat] Definindo projeto ativo:', project);
                // Fecha o modal IMEDIATAMENTE
                setShowProjectsModal(false);
                // Aguarda um frame para garantir que o modal sumiu
                requestAnimationFrame(() => {
                  onSetActiveProject?.(project);
                  console.log('[Chat] Modal fechado, projeto deve estar ativo');
                  // Carrega o projeto no editor correspondente
                  if (onLoadProjectById) {
                    console.log('[Chat] Carregando projeto no editor:', project.blockType, 'workFolder:', project.workFolder);
                    onLoadProjectById(project.id, project.blockType, project.workFolder);
                  }
                });
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1a1a24',
            border: '1px solid rgba(124, 92, 252, 0.3)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            minWidth: '150px',
            overflow: 'hidden'
          }}
        >
          <button
            onClick={() => {
              if (contextMenu.type === 'group') {
                handleEditGroup(contextMenu.id);
              } else {
                handleEditContact(contextMenu.id);
              }
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#1a1a24',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a24'}
          >
            <Settings size={14} />
            Editar
          </button>
          <button
            onClick={() => {
              if (contextMenu.type === 'group') {
                handleDeleteGroup(contextMenu.id);
              } else {
                handleDeleteContact(contextMenu.id);
              }
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#1a1a24',
              border: 'none',
              color: '#ef4444',
              fontSize: '13px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a24'}
          >
            <Trash2 size={14} />
            Excluir
          </button>
        </div>
      )}

      {/* Modal de Edição */}
      {editingItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', marginTop: 0 }}>
              Editar {editingItem.type === 'group' ? 'Grupo' : 'Contato'}
            </h3>

            {/* Preview da imagem */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              {editAvatar ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={editAvatar} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
                  <button
                    onClick={() => setEditAvatar('')}
                    style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '2px dashed var(--border-color)' }}>
                  {editingItem.type === 'group' ? <Users size={36} color="var(--text-secondary)" /> : <User size={36} color="var(--text-secondary)" />}
                </div>
              )}
            </div>

            {/* Nome */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                Nome
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Digite o nome"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Upload de imagem */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                Imagem (opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                id="edit-image-upload"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setEditAvatar(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <button
                onClick={() => document.getElementById('edit-image-upload')?.click()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              >
                <Paperclip size={16} />
                Escolher arquivo
              </button>
            </div>

            {/* Voz TTS - apenas para contatos */}
            {editingItem.type === 'contact' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                    Voz (TTS)
                  </label>
                  <select
                    value={editVoice}
                    onChange={(e) => setEditVoice(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Usar voz padrão das configurações</option>
                    <optgroup label="Piper (Offline)">
                      <option value="faber">🗣️ Faber (masculina)</option>
                      <option value="cadu">🗣️ Cadu (masculina)</option>
                      <option value="edresson">🗣️ Edresson (masculina)</option>
                      <option value="jeff">🗣️ Jeff (masculina)</option>
                    </optgroup>
                    <optgroup label="Edge-TTS (Microsoft - Online)">
                      <option value="pt-BR-AntonioNeural">🗣️ Antonio (masculina)</option>
                      <option value="pt-BR-FranciscaNeural">👩 Francisca (feminina)</option>
                      <option value="pt-BR-ThalitaMultilingualNeural">👩 Thalita (feminina multilíngue)</option>
                    </optgroup>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                    Cor (nome e contorno)
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={editColor || '#3b82f6'}
                      onChange={(e) => setEditColor(e.target.value)}
                      style={{
                        width: '60px',
                        height: '40px',
                        padding: '2px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={editColor || '#3b82f6'}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#3b82f6"
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Botões */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setEditingItem(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: editName.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: editName.trim() ? 'pointer' : 'not-allowed',
                  opacity: editName.trim() ? 1 : 0.5
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu lateral de configuração do novo contato */}
      {addingProvider && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            width: '350px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 10000
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {addingProvider === 'ollama' ? 'Ollama' : addingProvider === 'gemini' ? 'Gemini' : addingProvider === 'openrouter' ? 'OpenRouter' : addingProvider === 'anthropic' ? 'Claude' : addingProvider === 'openai' ? 'OpenAI' : 'Custom'}
            </h3>
            <button
              onClick={() => setAddingProvider(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Avatar */}
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            {newContactAvatar ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={newContactAvatar} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
                <button
                  onClick={() => setNewContactAvatar('')}
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: newContactColor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '32px' }}>
                {newContactName.substring(0, 2) || 'IA'}
              </div>
            )}
          </div>

          {/* Nome */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
              Nome
            </label>
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Ex: Claude Sonnet"
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* Upload Avatar */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="file"
              accept="image/*"
              id="new-contact-avatar"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setNewContactAvatar(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
            />
            <button
              onClick={() => document.getElementById('new-contact-avatar')?.click()}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center'
              }}
            >
              <Paperclip size={14} />
              {newContactAvatar ? 'Trocar Imagem' : 'Adicionar Imagem'}
            </button>
          </div>

          {/* Cor */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
              Cor
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="color"
                value={newContactColor}
                onChange={(e) => setNewContactColor(e.target.value)}
                style={{
                  width: '50px',
                  height: '36px',
                  padding: '2px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={newContactColor}
                onChange={(e) => setNewContactColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Voz TTS */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
              Voz (TTS)
            </label>
            <select
              value={newContactVoice}
              onChange={(e) => setNewContactVoice(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Usar voz padrão das configurações</option>
              <optgroup label="Piper (Offline)">
                <option value="faber">Faber (masculina)</option>
                <option value="cadu">Cadu (masculina)</option>
                <option value="edresson">Edresson (masculina)</option>
                <option value="jeff">Jeff (masculina)</option>
              </optgroup>
              <optgroup label="Edge-TTS (Microsoft - Online)">
                <option value="pt-BR-AntonioNeural">Antonio (masculina)</option>
                <option value="pt-BR-FranciscaNeural">Francisca (feminina)</option>
                <option value="pt-BR-ThalitaMultilingualNeural">Thalita (feminina multilíngue)</option>
              </optgroup>
            </select>
          </div>

          {/* Modelo */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
              Modelo
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={newContactModel}
                onChange={(e) => setNewContactModel(e.target.value)}
                placeholder={addingProvider === 'ollama' ? 'llama3.2' : addingProvider === 'gemini' ? 'gemini-2.0-flash-exp' : 'Modelo ID'}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={async () => {
                  try {
                    let url = '';
                    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    
                    if (addingProvider === 'ollama') {
                      url = (newContactBaseUrl || 'http://localhost:11434') + '/api/tags';
                    } else if (addingProvider === 'openai') {
                      url = (newContactBaseUrl || 'https://api.openai.com/v1') + '/models';
                      if (newContactApiKey) headers['Authorization'] = `Bearer ${newContactApiKey}`;
                    } else if (addingProvider === 'openrouter') {
                      url = (newContactBaseUrl || 'https://openrouter.ai/api/v1') + '/models';
                      if (newContactApiKey) headers['Authorization'] = `Bearer ${newContactApiKey}`;
                    } else if (addingProvider === 'anthropic') {
                      alert('Claude não tem API de listagem de modelos. Use: claude-opus-4, claude-sonnet-4-20250514, claude-haiku-3-5');
                      return;
                    } else if (addingProvider === 'gemini') {
                      alert('Gemini não tem API de listagem pública. Use: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-2.5-pro-preview');
                      return;
                    } else if (addingProvider === 'custom') {
                      url = newContactBaseUrl + '/models';
                      if (newContactApiKey) headers['Authorization'] = `Bearer ${newContactApiKey}`;
                    }

                    const res = await fetch(url, { headers });
                    const data = await res.json();
                    
                    let models: string[] = [];
                    if (addingProvider === 'ollama') {
                      models = data.models?.map((m: any) => m.name) || [];
                    } else {
                      models = data.data?.map((m: any) => m.id) || [];
                    }
                    
                    if (models.length > 0) {
                      const selected = prompt('Modelos disponíveis:\n\n' + models.join('\n') + '\n\nDigite o nome do modelo:');
                      if (selected) setNewContactModel(selected.trim());
                    } else {
                      alert('Nenhum modelo encontrado');
                    }
                  } catch (err) {
                    alert('Erro ao buscar modelos: ' + (err as Error).message);
                  }
                }}
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Auto-detectar modelos disponíveis"
              >
                Detectar
              </button>
            </div>
          </div>

          {/* API Key */}
          {addingProvider !== 'ollama' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                API Key
              </label>
              <input
                type="password"
                value={newContactApiKey}
                onChange={(e) => setNewContactApiKey(e.target.value)}
                placeholder="Cole sua API key"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* Base URL */}
          {(addingProvider === 'ollama' || addingProvider === 'custom' || addingProvider === 'openai' || addingProvider === 'openrouter') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                {addingProvider === 'ollama' ? 'URL Ollama' : 'Base URL'}
              </label>
              <input
                type="text"
                value={newContactBaseUrl}
                onChange={(e) => setNewContactBaseUrl(e.target.value)}
                placeholder={addingProvider === 'ollama' ? 'http://localhost:11434' : 'https://...'}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => setAddingProvider(null)}
              style={{
                flex: 1,
                padding: '9px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const newContact: SavedModel = {
                  id: Date.now().toString(),
                  name: newContactName.trim() || 'IA',
                  provider: addingProvider,
                  model: newContactModel,
                  apiKey: newContactApiKey,
                  baseUrl: newContactBaseUrl,
                  avatar: newContactAvatar,
                  color: newContactColor,
                  voice: newContactVoice || undefined
                };
                const models = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
                models.push(newContact);
                localStorage.setItem('bill-saved-models', JSON.stringify(models));
                setSavedModels(models);
                setAddingProvider(null);
                setNewContactName('');
                setNewContactModel('');
                setNewContactApiKey('');
                setNewContactBaseUrl('');
                setNewContactAvatar('');
                setNewContactColor('#3b82f6');
                setNewContactVoice('');
              }}
              disabled={!newContactName.trim() || !newContactModel.trim()}
              style={{
                flex: 1,
                padding: '9px',
                background: (newContactName.trim() && newContactModel.trim()) ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: (newContactName.trim() && newContactModel.trim()) ? 'pointer' : 'not-allowed',
                opacity: (newContactName.trim() && newContactModel.trim()) ? 1 : 0.5
              }}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Menu de contexto de mensagens */}
      {messageContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: messageContextMenu.y,
            left: messageContextMenu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10001,
            minWidth: '150px',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => {
              const msg = currentMessages[messageContextMenu.messageIndex];
              if (msg) {
                navigator.clipboard.writeText(msg.content).catch(() => {});
              }
              setMessageContextMenu(null);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copiar
          </div>
          <div style={{ height: '1px', background: 'var(--border-color)' }} />
          <div
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#ff4444',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => handleDeleteMessage(messageContextMenu.messageIndex)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Excluir
          </div>
        </div>
      )}

      {/* Modal de Criação de Grupo */}
      {creatingGroup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => {
            setCreatingGroup(false);
            setNewGroupStep('select');
            setTempGroupModels([]);
            setNewGroupName('');
            setNewGroupImage('');
            setGroupSearchQuery('');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {newGroupStep === 'select' ? 'Selecionar Modelos' : 'Detalhes do Grupo'}
              </h3>
              <button
                onClick={() => {
                  setCreatingGroup(false);
                  setNewGroupStep('select');
                  setTempGroupModels([]);
                  setNewGroupName('');
                  setNewGroupImage('');
                  setGroupSearchQuery('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {newGroupStep === 'select' ? (
              <>
                {/* Etapa 1: Selecionar modelos */}
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="text"
                    placeholder="Buscar modelos..."
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Modelos selecionados */}
                {tempGroupModels.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                      Selecionados ({tempGroupModels.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {tempGroupModels.map((model) => (
                        <div
                          key={model.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            background: 'var(--bg-input)',
                            borderRadius: '6px'
                          }}
                        >
                          {model.avatar ? (
                            <img src={model.avatar} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <MouseAvatar size={24} />
                          )}
                          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {model.name}
                          </div>
                          <button
                            onClick={() => setTempGroupModels(prev => prev.filter(m => m.id !== model.id))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de modelos disponíveis */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {savedModels
                    .filter(m => 
                      !tempGroupModels.find(tm => tm.id === m.id) &&
                      m.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
                    )
                    .map((model) => (
                      <div
                        key={model.id}
                        onClick={() => setTempGroupModels(prev => [...prev, model])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        {model.avatar ? (
                          <img src={model.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <MouseAvatar size={32} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>
                            {model.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {model.provider} · {model.model}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Botão próximo */}
                <button
                  onClick={() => setNewGroupStep('details')}
                  disabled={tempGroupModels.length === 0}
                  style={{
                    width: '100%',
                    marginTop: '20px',
                    padding: '12px',
                    background: tempGroupModels.length > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: tempGroupModels.length > 0 ? 'pointer' : 'not-allowed',
                    opacity: tempGroupModels.length > 0 ? 1 : 0.5
                  }}
                >
                  Próximo ({tempGroupModels.length} selecionados)
                </button>
              </>
            ) : (
              <>
                {/* Etapa 2: Detalhes do grupo */}
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  {newGroupImage ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={newGroupImage} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
                      <button
                        onClick={() => setNewGroupImage('')}
                        style={{
                          position: 'absolute',
                          top: '0',
                          right: '0',
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: '50%',
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#fff'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '2px dashed var(--border-color)' }}>
                      <Users size={36} color="var(--text-secondary)" />
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                    Nome do Grupo
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Digite o nome do grupo"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                    Imagem do Grupo (opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    id="group-image-upload"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewGroupImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('group-image-upload')?.click()}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  >
                    <ImageIcon size={16} />
                    Escolher imagem
                  </button>
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setNewGroupStep('select')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => {
                      if (!newGroupName.trim()) return;
                      
                      const newGroup = {
                        id: Date.now().toString(),
                        name: newGroupName,
                        avatar: newGroupImage,
                        models: tempGroupModels
                      };
                      
                      const updatedGroups = [...savedGroups, newGroup];
                      setSavedGroups(updatedGroups);
                      localStorage.setItem('bill-saved-groups', JSON.stringify(updatedGroups));
                      
                      setCreatingGroup(false);
                      setNewGroupStep('select');
                      setTempGroupModels([]);
                      setNewGroupName('');
                      setNewGroupImage('');
                      setGroupSearchQuery('');
                    }}
                    disabled={!newGroupName.trim()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: newGroupName.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: newGroupName.trim() ? 'pointer' : 'not-allowed',
                      opacity: newGroupName.trim() ? 1 : 0.5
                    }}
                  >
                    Criar Grupo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Overlay de Chamada */}
      {inCall && callChatIdRef.current && !callMinimized && (() => {
        // Pega informações do contato/grupo ativo
        const contact = savedModels.find(m => m.id === callChatIdRef.current);
        const group = savedGroups.find(g => g.id === callChatIdRef.current);
        const displayName = contact?.name || group?.name || 'Contato';
        const displayAvatar = contact?.avatar || group?.avatar || '👤';
        const isImageAvatar = displayAvatar && (displayAvatar.startsWith('http://') || displayAvatar.startsWith('https://') || displayAvatar.startsWith('data:'));
        
        return (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(20,20,25,0.98) 0%, rgba(30,30,40,0.98) 100%)',
            backdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            padding: '40px'
          }}>
            {/* Botão Voltar no canto superior direito */}
            <button
              onClick={() => setCallMinimized(true)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              Voltar
            </button>
            <div style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: isImageAvatar ? 'transparent' : 'linear-gradient(135deg, var(--accent) 0%, #9b59b6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '80px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden'
            }}>
              {isImageAvatar ? (
                <img 
                  src={displayAvatar} 
                  alt={displayName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                displayAvatar
              )}
            </div>
            
            {/* Nome do contato */}
            <h2 style={{
              color: 'var(--text-primary)',
              fontSize: '28px',
              fontWeight: 600,
              margin: 0
            }}>
              {displayName}
            </h2>
            
            {/* Contador de tempo */}
            <div style={{
              fontSize: '48px',
              fontWeight: 300,
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              letterSpacing: '4px'
            }}>
              {formatCallTime(callDuration)}
            </div>
            
            {/* Indicador de status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              minHeight: '24px'
            }}>
              {isCallProcessing ? (
                <>
                  <div className="streaming-wave">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>Processando...</span>
                </>
              ) : isCallRecording ? (
                <>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#e74c3c',
                    animation: 'pulse 1s ease-in-out infinite'
                  }}></div>
                  <span>Ouvindo...</span>
                </>
              ) : (
                <span>Iniciando...</span>
              )}
            </div>
            
            {/* Controle de volume */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              width: '300px'
            }}>
              <label style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Volume da Voz: {callVolume}%
              </label>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={callVolume}
                onChange={(e) => {
                  const newVolume = parseInt(e.target.value);
                  setCallVolume(newVolume);
                  // Atualiza o volume global em tempo real
                  if ((window as any).callVolumeRef) {
                    (window as any).callVolumeRef.current = newVolume;
                  }
                }}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${callVolume * 100 / 150}%, rgba(255,255,255,0.1) ${callVolume * 100 / 150}%, rgba(255,255,255,0.1) 100%)`,
                  cursor: 'pointer',
                  accentColor: 'var(--accent)'
                }}
              />
            </div>
            
            {/* Botão desligar */}
            <button
              onClick={endCall}
              style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: '#e74c3c',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                boxShadow: '0 10px 30px rgba(231,76,60,0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(231,76,60,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(231,76,60,0.4)';
              }}
              title="Desligar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                <line x1="18" y1="6" x2="6" y2="18" strokeWidth="3"/>
              </svg>
            </button>
          </div>
        );
      })()}
      
      {/* Overlay de Chamada Recebida (Lembrete) */}
      {incomingReminderCall && bossModelId && (() => {
        const bossModel = savedModels.find(m => m.id === bossModelId);
        if (!bossModel) return null;
        
        const displayName = bossModel.name;
        const displayAvatar = bossModel.avatar || '👤';
        const isImageAvatar = displayAvatar && (displayAvatar.startsWith('http://') || displayAvatar.startsWith('https://') || displayAvatar.startsWith('data:'));
        
        return (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(20,20,25,0.98) 0%, rgba(30,30,40,0.98) 100%)',
            backdropFilter: 'blur(10px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '30px',
            padding: '40px',
            animation: 'fadeIn 0.3s ease-in'
          }}>
            {/* Animação de pulso no avatar */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Anéis pulsantes */}
              <div style={{
                position: 'absolute',
                width: '220px',
                height: '220px',
                borderRadius: '50%',
                border: '3px solid rgba(124, 92, 252, 0.5)',
                animation: 'ringPulse 2s ease-in-out infinite'
              }} />
              <div style={{
                position: 'absolute',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                border: '3px solid rgba(124, 92, 252, 0.3)',
                animation: 'ringPulse 2s ease-in-out infinite 0.5s'
              }} />
              
              {/* Avatar */}
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: isImageAvatar ? 'transparent' : 'linear-gradient(135deg, #7c5cfc 0%, #667eea 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px',
                boxShadow: '0 20px 60px rgba(124, 92, 252, 0.4)',
                overflow: 'hidden',
                border: '4px solid rgba(124, 92, 252, 0.6)'
              }}>
                {isImageAvatar ? (
                  <img 
                    src={displayAvatar} 
                    alt={displayName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  displayAvatar
                )}
              </div>
            </div>
            
            {/* Nome e status */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{
                color: 'var(--text-primary)',
                fontSize: '28px',
                fontWeight: 600,
                margin: 0
              }}>
                {displayName}
              </h2>
              <div style={{
                fontSize: '16px',
                color: '#c084fc',
                fontWeight: 500
              }}>
                Chamada de Lembrete
              </div>
            </div>
            
            {/* Botões de aceitar e negar */}
            <div style={{
              display: 'flex',
              gap: '30px',
              alignItems: 'center'
            }}>
              {/* Botão Recusar */}
              <button
                onClick={onDeclineReminderCall}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: '#e74c3c',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  boxShadow: '0 10px 30px rgba(231,76,60,0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(231,76,60,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(231,76,60,0.4)';
                }}
                title="Recusar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  <line x1="18" y1="6" x2="6" y2="18" strokeWidth="3"/>
                </svg>
              </button>
              
              {/* Botão Aceitar */}
              <button
                onClick={onAnswerReminderCall}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: '#7c5cfc',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  boxShadow: '0 10px 30px rgba(124, 92, 252, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(124, 92, 252, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 92, 252, 0.4)';
                }}
                title="Atender"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Componente para listar projetos
function ProjectsList({ activeMainView, onSelectProject }: { activeMainView?: string; onSelectProject: (project: any) => void }) {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const loadPlans = () => {
      try {
        const saved = localStorage.getItem('bill-plans');
        const loadedPlans = saved ? JSON.parse(saved) : [];
        console.log('[ProjectsList] Planos carregados:', loadedPlans.length);
        setPlans(loadedPlans);
      } catch {
        setPlans([]);
      }
    };

    loadPlans();
    
    // Escuta eventos de atualização
    window.addEventListener('plans-updated', loadPlans);
    return () => window.removeEventListener('plans-updated', loadPlans);
  }, []);

  // Filtra blocos do tipo da aba atual
  const relevantBlocks = plans.flatMap(plan => 
    plan.blocks
      .filter((b: any) => {
        const match = b.type === activeMainView && b.type !== 'start' && b.type !== 'end';
        console.log('[ProjectsList] Bloco:', b.type, 'aba:', activeMainView, 'match:', match);
        return match;
      })
      .map((b: any) => ({ ...b, planName: plan.name, planId: plan.id }))
  );

  console.log('[ProjectsList] Blocos relevantes encontrados:', relevantBlocks.length);

  if (relevantBlocks.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
        <Folder size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
        <div style={{ fontSize: '14px' }}>Nenhum projeto encontrado para esta aba</div>
        <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
          Aba atual: {activeMainView || 'nenhuma'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {relevantBlocks.map((block: any) => (
        <div
          key={`${block.planId}-${block.id}`}
          onClick={() => {
            console.log('[ProjectsList] Projeto selecionado:', block);
            onSelectProject({ 
              id: block.id, 
              name: block.label, 
              description: block.description, 
              blockType: block.type,
              deadline: block.deadline,
              deadlineTime: block.deadlineTime,
              workFolder: block.workFolder,
              saveId: block.saveId
            });
          }}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          {/* Botão de concluir */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Atualiza o bloco para concluído
              const saved = localStorage.getItem('bill-plans');
              if (saved) {
                const plans = JSON.parse(saved);
                const updatedPlans = plans.map((p: any) => ({
                  ...p,
                  blocks: p.blocks.map((b: any) => 
                    b.id === block.id 
                      ? { ...b, status: 'completed', completedAt: new Date().toISOString() }
                      : b
                  )
                }));
                localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
                window.dispatchEvent(new CustomEvent('plans-updated'));
              }
            }}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: block.status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(124, 92, 252, 0.2)',
              border: `1px solid ${block.status === 'completed' ? '#22c55e' : '#7c5cfc'}`,
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: block.status === 'completed' ? '#22c55e' : '#c084fc',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = block.status === 'completed' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(124, 92, 252, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = block.status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(124, 92, 252, 0.2)';
            }}
          >
            {block.status === 'completed' ? '✓ Concluído' : 'Concluir'}
          </button>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '4px', paddingRight: '100px' }}>
            {block.label}
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
            Plano: {block.planName}
          </div>
          {block.description && (
            <div style={{ fontSize: '12px', color: '#aaa' }}>
              {block.description}
            </div>
          )}
          {block.deadline && (
            <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '8px' }}>
              Prazo: {new Date(block.deadline).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Componente interno para blocos de código com colapso
function CodeBlock({ label, code, isSpecial }: { label: string; code: string; isSpecial: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  return (
    <div className={`code-block ${isSpecial ? 'special-block' : ''}`}>
      <div className="code-block-header" onClick={() => setIsCollapsed(!isCollapsed)} style={{cursor: 'pointer', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {isSpecial ? <Zap size={12} style={{marginRight: 6, color: 'var(--accent-light)'}} /> : <FileCode size={12} style={{marginRight: 6}} />}
          <span style={{fontWeight: 600, fontSize: '11px'}}>{label || 'Código'}</span>
        </div>
        <span style={{fontSize: '9px', opacity: 0.6, textTransform: 'uppercase'}}>{isCollapsed ? 'Exibir' : 'Recolher'}</span>
      </div>
      {!isCollapsed && (
        <pre><code>{code}</code></pre>
      )}
    </div>
  );
}

// ── MouseAvatar: ratinho animado que pisca os olhos ──────────────────────────
export function MouseAvatar({ size = 36, thinking = false, speaking = false, noBorder = false }: { size?: number; thinking?: boolean; speaking?: boolean; noBorder?: boolean }) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(true);

  // Piscar olhos normal
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    };
    const schedule = () => {
      const delay = 2500 + Math.random() * 2500;
      return setTimeout(() => { blink(); schedule(); }, delay);
    };
    const t = setTimeout(() => { blink(); schedule(); }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Boca abrindo e fechando quando speaking
  useEffect(() => {
    if (!speaking) { setMouthOpen(true); return; }
    // Alterna rápido: ~150ms aberta, ~100ms fechada
    let open = true;
    const tick = () => {
      open = !open;
      setMouthOpen(open);
    };
    const interval = setInterval(tick, open ? 150 : 100);
    return () => clearInterval(interval);
  }, [speaking]);

  const imgOpen = thinking ? mouseLupaImg : speaking ? mouseMicImg : mouseOpenImg;
  const imgBlink = thinking ? mouseLupa2Img : speaking ? mouseMic2Img : mouseBlinkImg;

  // Quando speaking: alterna mic/mic2 rapidamente pela boca
  // Quando blinking normal: alterna open/blink pelos olhos
  const currentImg = speaking
    ? (mouthOpen ? imgOpen : imgBlink)
    : (isBlinking ? imgBlink : imgOpen);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      position: 'relative',
      padding: (speaking && !noBorder) ? '2px' : '0',
      background: (speaking && !noBorder)
        ? 'conic-gradient(#7c5cfc, #b08fff, #c084fc, #9d4edd, #7c5cfc)'
        : 'transparent',
      animation: (speaking && !noBorder) ? 'avatar-glow-spin 1s linear infinite' : 'none',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        border: noBorder ? 'none' : '2px solid #000',
        position: 'relative',
        background: noBorder ? 'transparent' : 'white',
      }}>
        <img
          src={currentImg}
          alt="avatar"
          style={{
            width: '180%',
            height: '180%',
            objectFit: 'cover',
            position: 'absolute',
            top: '-45%',
            left: '-40%',
            transition: 'none',
            clipPath: noBorder ? 'circle(35% at 50% 50%)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
