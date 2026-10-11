import { useEffect, useState, useRef } from 'react';
import { Code, Film, Image, Globe, CheckCircle, AlertCircle, Music, Play, TerminalSquare, Zap, Maximize2, PictureInPicture2, X } from 'lucide-react';
import HomeWallpaper from '../HomeWallpaper/HomeWallpaper';
import HomePlanner from '../HomePlanner/HomePlanner';

interface ActivityEvent {
  text: string;
  type: 'info' | 'success' | 'error' | 'working' | 'thinking' | 'media';
  time: string;
}

interface HomeActivityProps {
  terminalOutput: string[];
  activeMainView: string;
  isStreaming: boolean;
  onNavigate: (view: 'code' | 'video' | 'photo' | 'web' | 'paint') => void;
  onExecuteCommand: (command: string) => void;
  onClearTerminal: () => void;
  terminalAgent: 'code' | 'video' | 'photo' | 'web' | 'paint' | null;
  onSetTerminalAgent: (agent: 'code' | 'video' | 'photo' | 'web' | 'paint' | null) => void;
  onSendAgentMessage: (agent: string, message: string) => void;
  terminalMode: 'normal' | 'fullscreen' | 'floating';
  onSetTerminalMode: (mode: 'normal' | 'fullscreen' | 'floating') => void;
  photoEditorRef?: any;
  videoEditorRef?: any;
  paintRef?: any;
  userName?: string; // Nome do perfil do usuário
}

function now(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function classifyLine(line: string): { mode: string | null; text: string; type: ActivityEvent['type'] } {
  const l = line.trim();
  let mode: string | null = null;
  let text = l;

  // Prioridade 1: Prefixos explícitos (mais específico primeiro)
  if (l.startsWith('[CODE]') || l.startsWith('[CODE IA]') || l.startsWith('[Code]')) {
    mode = 'code';
    text = l.replace(/^\[CODE\]\s*|\[CODE IA\]\s*|\[Code\]\s*/, '');
  } else if (l.startsWith('[VIDEO]') || l.startsWith('[VIDEO IA]') || l.startsWith('[Video]') || l.startsWith('[Web→Video]')) {
    mode = 'video';
    text = l.replace(/^\[VIDEO\]\s*|\[VIDEO IA\]\s*|\[Video\]\s*|\[Web→Video\]\s*/, '');
  } else if (
    l.startsWith('[PHOTO]') || l.startsWith('[PHOTO IA]') || l.startsWith('[Photo]') || 
    l.startsWith('[Design]') || l.startsWith('[Web→Photo]') || 
    l.startsWith('[Removedor') || l.startsWith('[Melhorar') || 
    l.startsWith('[Visao]') || l.startsWith('[IA]') || 
    l.startsWith('[Borracha') || l.startsWith('[Recorte')
  ) {
    mode = 'photo';
    text = l.replace(/^\[PHOTO\]\s*|\[PHOTO IA\]\s*|\[Photo\]\s*|\[Design\]\s*|\[Web→Photo\]\s*|\[Removedor[^\]]*\]\s*|\[Melhorar[^\]]*\]\s*|\[Visao\]\s*|\[IA\]\s*|\[Borracha[^\]]*\]\s*|\[Recorte[^\]]*\]\s*/, '');
  } else if (l.startsWith('[WEB]') || l.startsWith('[WEB IA]') || l.startsWith('[Web]') || l.startsWith('[Web→')) {
    mode = 'web';
    text = l.replace(/^\[WEB\]\s*|\[WEB IA\]\s*|\[Web\]\s*|\[Web→[^\]]+\]\s*/, '');
  } 
  // Prioridade 2: Padrões específicos de cada modo (apenas se não foi detectado acima)
  else if (
    l.startsWith('$') || l.startsWith('Criando:') || l.startsWith('Arquivo') ||
    l.startsWith('Patch') || l.startsWith('Memória') || l.startsWith('Comando') ||
    l.includes('bill_project') || l.includes('.py ') || l.includes('python ')
  ) {
    mode = 'code';
  }

  let type: ActivityEvent['type'] = 'info';
  const lLow = l.toLowerCase();
  if (l.includes('✅') || lLow.includes('sucesso') || lLow.includes('salvo') || lLow.includes('adicionad') || lLow.includes('concluí') || lLow.includes('resposta pronta')) type = 'success';
  else if (l.includes('❌') || lLow.includes('erro') || lLow.includes('falha') || lLow.includes('falhou') || lLow.includes('bloqueado')) type = 'error';
  else if (lLow.includes('pensando') || lLow.includes('processando')) type = 'thinking';
  else if (lLow.includes('...') || lLow.includes('iniciando') || lLow.includes('buscando') || lLow.includes('baixando') || lLow.includes('gerando') || lLow.includes('executando') || lLow.includes('aplicando') || lLow.includes('carregando') || lLow.includes('pesquisando')) type = 'working';

  return { mode, text, type };
}

function detectWebMedia(terminalOutput: string[]): { isPlaying: boolean; label: string } {
  const recent = terminalOutput.slice(-20).join(' ').toLowerCase();
  const isYoutube = recent.includes('youtube') || recent.includes('youtu.be');
  const isMusic = recent.includes('spotify') || recent.includes('music') || recent.includes('músic') || recent.includes('soundcloud') || recent.includes('deezer');
  const isVideo = recent.includes('vídeo') || recent.includes('video') || recent.includes('assistindo') || recent.includes('playing');
  if (isMusic) return { isPlaying: true, label: 'Tocando música' };
  if (isYoutube) return { isPlaying: true, label: 'YouTube ativo' };
  if (isVideo) return { isPlaying: true, label: 'Reproduzindo vídeo' };
  return { isPlaying: false, label: '' };
}

function ThinkingDots({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: color,
          display: 'inline-block',
          animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

export const AGENT_META: Record<string, { label: string; color: string; accent: string; icon: React.ReactNode }> = {
  code:  { label: 'Code',  color: '#007acc', accent: 'rgba(0,122,204,0.15)',  icon: <Code size={14} /> },
  video: { label: 'Video', color: '#ff6b6b', accent: 'rgba(255,107,107,0.15)', icon: <Film size={14} /> },
  photo: { label: 'Design', color: '#7c5cfc', accent: 'rgba(124,92,252,0.15)', icon: <Image size={14} /> },
  web:   { label: 'Web',   color: '#22c55e', accent: 'rgba(34,197,94,0.15)',  icon: <Globe size={14} /> },
};

// ── Context Menu Item ─────────────────────────────────────────────────────────
function CtxItem({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', background: hov ? (danger ? '#ef444422' : 'var(--bg-tertiary)') : 'transparent',
        border: 'none', color: danger ? (hov ? '#ef4444' : '#f87171') : 'var(--text-primary)',
        padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
        fontSize: '12px', fontWeight: 500, textAlign: 'left', transition: 'all 0.1s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Terminal Card ─────────────────────────────────────────────────────────────
export interface TerminalCardProps {
  output: string[];
  onExecuteCommand: (cmd: string) => void;
  onClear: () => void;
  terminalAgent: 'code' | 'video' | 'photo' | 'web' | null;
  onSetAgent: (agent: 'code' | 'video' | 'photo' | 'web' | null) => void;
  onSendAgentMessage: (agent: string, message: string) => void;
  isStreaming: boolean;
  terminalMode?: 'normal' | 'fullscreen' | 'floating';
  onSetTerminalMode?: (mode: 'normal' | 'fullscreen' | 'floating') => void;
  /** When true, the card fills available vertical space (used in fullscreen) */
  fillHeight?: boolean;
  userName?: string; // Nome do perfil do usuário
}

export function TerminalCard({
  output, onExecuteCommand, onClear,
  terminalAgent, onSetAgent, onSendAgentMessage,
  isStreaming,
  terminalMode = 'normal',
  onSetTerminalMode,
  fillHeight = false,
  userName,
}: TerminalCardProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const termColor = '#f59e0b';
  const agentMeta = terminalAgent ? AGENT_META[terminalAgent] : null;
  const activeColor = agentMeta ? agentMeta.color : termColor;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);
  useEffect(() => { inputRef.current?.focus(); }, [terminalAgent]);

  // Fecha o menu de contexto ao clicar em qualquer lugar
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;
    if (cmd === 'clear' || cmd === 'cls') { onClear(); setCommand(''); return; }
    const openMatch = cmd.match(/^open\s+(code|video|photo|web)$/i);
    if (openMatch) {
      onSetAgent(openMatch[1].toLowerCase() as 'code' | 'video' | 'photo' | 'web');
      setCommand(''); setHistory(prev => [cmd, ...prev]); return;
    }
    if (/^exit(\s+(code|video|photo|web))?$/i.test(cmd)) {
      onSetAgent(null); setCommand(''); setHistory(prev => [cmd, ...prev]); return;
    }
    setHistory(prev => [cmd, ...prev]);
    setHistIdx(-1);
    if (terminalAgent) { onSendAgentMessage(terminalAgent, cmd); }
    else { onExecuteCommand(cmd); }
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next); setCommand(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next); setCommand(next === -1 ? '' : (history[next] ?? ''));
    }
  };

  const colorLine = (line: string) => {
    if (line.match(/^\[(CODE|VIDEO|PHOTO|WEB)\] você:/)) return '#93c5fd';
    if (line.match(/^\[(CODE|VIDEO|PHOTO|WEB) IA\]/))    return '#86efac';
    if (line.match(/^\[(CODE|VIDEO|PHOTO|WEB)\] (Pensando|Conectado|Desconectado)/)) return '#fde68a';
    if (line.startsWith('$') || line.match(/^[A-Z]:\\.*>/)) return termColor;
    if (line.includes('✅') || line.toLowerCase().includes('sucesso') || line.toLowerCase().includes('done')) return '#4ade80';
    if (line.includes('❌') || line.toLowerCase().startsWith('erro') || line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) return '#f87171';
    if (line.startsWith('⚠') || line.toLowerCase().includes('aviso') || line.toLowerCase().includes('warn')) return '#fbbf24';
    if (line.startsWith('>')) return '#a78bfa';
    return '#d4d4d8';
  };

  const renderPrompt = () => {
    if (agentMeta) return (
      <>
        <span style={{ color: agentMeta.color, fontWeight: 700, userSelect: 'none', flexShrink: 0 }}>{agentMeta.label.toLowerCase()}@{userName || 'bill'}</span>
        <span style={{ color: '#d4d4d8', userSelect: 'none', flexShrink: 0 }}>:</span>
        <span style={{ color: '#60a5fa', userSelect: 'none', flexShrink: 0 }}>~</span>
        <span style={{ color: agentMeta.color, userSelect: 'none', flexShrink: 0, marginRight: '4px' }}>$</span>
      </>
    );
    return (
      <>
        <span style={{ color: '#22c55e', fontWeight: 700, userSelect: 'none', flexShrink: 0 }}>user@{userName || 'bill'}</span>
        <span style={{ color: '#d4d4d8', userSelect: 'none', flexShrink: 0 }}>:</span>
        <span style={{ color: '#60a5fa', userSelect: 'none', flexShrink: 0 }}>~</span>
        <span style={{ color: '#d4d4d8', userSelect: 'none', flexShrink: 0, marginRight: '4px' }}>$</span>
      </>
    );
  };

  return (
    <>
      <div
        style={{
          background: '#0d0d0d',
          border: `1px solid ${agentMeta ? agentMeta.color + '88' : 'var(--border-color)'}`,
          borderRadius: '12px',
          padding: '14px 14px 12px',
          cursor: 'text',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: fillHeight ? 'unset' : '170px',
          flex: fillHeight ? 1 : 'unset',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = activeColor + '99';
          if (!fillHeight) e.currentTarget.style.transform = 'translateY(-2px)';
          (e.currentTarget.style as any).boxShadow = `0 4px 20px ${activeColor}22`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = agentMeta ? agentMeta.color + '88' : 'var(--border-color)';
          e.currentTarget.style.transform = 'translateY(0)';
          (e.currentTarget.style as any).boxShadow = 'none';
        }}
        onClick={() => inputRef.current?.focus()}
        onContextMenu={e => {
          if (!onSetTerminalMode) return;
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: activeColor }}><TerminalSquare size={14} /></div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Terminal
            </span>
            {agentMeta && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: agentMeta.color + '18', borderRadius: '20px',
                padding: '2px 8px', border: `1px solid ${agentMeta.color}44`,
              }}>
                {isStreaming ? <ThinkingDots color={agentMeta.color} /> : <Zap size={9} color={agentMeta.color} />}
                <span style={{ fontSize: '9px', color: agentMeta.color, fontWeight: 700 }}>
                  {isStreaming ? 'processando...' : `conectado → ${agentMeta.label}`}
                </span>
              </div>
            )}
            {/* Badge de modo */}
            {terminalMode === 'fullscreen' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f59e0b18', borderRadius: '20px', padding: '2px 7px', border: '1px solid #f59e0b33' }}>
                <Maximize2 size={8} color={termColor} />
                <span style={{ fontSize: '9px', color: termColor, fontWeight: 700 }}>tela cheia</span>
              </div>
            )}
            {terminalMode === 'floating' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#a78bfa18', borderRadius: '20px', padding: '2px 7px', border: '1px solid #a78bfa33' }}>
                <PictureInPicture2 size={8} color="#a78bfa" />
                <span style={{ fontSize: '9px', color: '#a78bfa', fontWeight: 700 }}>flutuante</span>
              </div>
            )}
          </div>
          {/* Fechar (fullscreen/floating) via header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {terminalMode !== 'normal' && onSetTerminalMode && (
              <button
                onClick={e => { e.stopPropagation(); onSetTerminalMode('normal'); }}
                title="Voltar ao normal"
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '4px', transition: 'color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; }}
              >
                <X size={13} />
              </button>
            )}
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: activeColor, boxShadow: `0 0 8px ${activeColor}`,
              animation: isStreaming && agentMeta ? 'pulse 1s ease-in-out infinite' : 'none',
            }} />
          </div>
        </div>

        {/* Área de conteúdo */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          fontSize: '11px',
          lineHeight: '1.75',
          background: 'transparent',
          padding: '4px 2px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: fillHeight ? '200px' : '120px',
          maxHeight: fillHeight ? 'none' : '260px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {output.length === 0 && !agentMeta && (
            <span style={{ color: '#4b5563', fontStyle: 'italic', fontSize: '10px' }}>
              Terminal pronto — clique com botão direito para opções
            </span>
          )}
          {output.length === 0 && agentMeta && (
            <span style={{ color: agentMeta.color + '88', fontStyle: 'italic', fontSize: '10px' }}>
              Conectado ao agente {agentMeta.label} · Digite sua mensagem e pressione Enter
            </span>
          )}
          {output.map((line, i) => (
            <div key={i} style={{ color: colorLine(line), whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%' }}>
              {line}
            </div>
          ))}
          <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            {renderPrompt()}
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#f3f4f6', fontFamily: 'inherit', fontSize: 'inherit', caretColor: activeColor,
              }}
            />
          </form>
          <div ref={bottomRef} />
        </div>

        {/* Bottom glow */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${activeColor}, transparent)`,
          opacity: agentMeta ? (isStreaming ? 1 : 0.5) : 0.25,
          animation: isStreaming && agentMeta ? 'glowSlide 1.2s ease-in-out infinite' : 'none',
        }} />

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>

      {/* ── Context Menu ── */}
      {ctxMenu && onSetTerminalMode && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setCtxMenu(null)}
            onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }}
          />
          <div
            style={{
              position: 'fixed',
              left: Math.min(ctxMenu.x, window.innerWidth - 190),
              top: Math.min(ctxMenu.y, window.innerHeight - 160),
              zIndex: 9999,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '5px',
              minWidth: '180px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '4px 10px 6px', borderBottom: '1px solid var(--border-light)', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Terminal
              </span>
            </div>
            {terminalMode !== 'fullscreen' && (
              <CtxItem
                icon={<Maximize2 size={13} />}
                label="Tela cheia"
                onClick={() => { onSetTerminalMode('fullscreen'); setCtxMenu(null); }}
              />
            )}
            {terminalMode !== 'floating' && (
              <CtxItem
                icon={<PictureInPicture2 size={13} />}
                label="Flutuante"
                onClick={() => { onSetTerminalMode('floating'); setCtxMenu(null); }}
              />
            )}
            {terminalMode !== 'normal' && (
              <>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
                <CtxItem
                  icon={<X size={13} />}
                  label="Fechar"
                  danger
                  onClick={() => { onSetTerminalMode('normal'); setCtxMenu(null); }}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function HomeActivity({
  terminalOutput, activeMainView, isStreaming, onNavigate,
  onExecuteCommand, onClearTerminal,
  terminalAgent, onSetTerminalAgent, onSendAgentMessage,
  terminalMode, onSetTerminalMode,
  photoEditorRef, videoEditorRef, paintRef,
  userName,
}: HomeActivityProps) {
  const [cards, setCards] = useState<Record<string, ActivityEvent[]>>({ code: [], video: [], photo: [], web: [] });
  const [activeHomeTab, setActiveHomeTab] = useState<'wallpaper' | 'placeholder' | 'terminal'>('wallpaper');
  const prevLenRef = useRef(0);

  const handleOpenProject = async (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => {
    console.log('Abrindo projeto:', appType, projectId);
    
    // Navega para a aba
    onNavigate(appType);
    
    // Aguarda um pouco para a aba renderizar
    setTimeout(async () => {
      try {
        if (appType === 'photo' && photoEditorRef?.current) {
          await photoEditorRef.current.loadProjectById(projectId);
        } else if (appType === 'video' && videoEditorRef?.current) {
          await videoEditorRef.current.loadProjectById?.(projectId);
        } else if (appType === 'paint' && paintRef?.current) {
          await paintRef.current.loadProjectById?.(projectId);
        }
        // TODO: code
      } catch (e) {
        console.error('Erro ao carregar projeto:', e);
      }
    }, 500);
  };

  useEffect(() => {
    if (terminalOutput.length === prevLenRef.current) return;
    const newLines = terminalOutput.slice(prevLenRef.current);
    prevLenRef.current = terminalOutput.length;
    const updates: Record<string, ActivityEvent[]> = { code: [], video: [], photo: [], web: [] };
    newLines.forEach(line => {
      const { mode, text, type } = classifyLine(line);
      if (mode && text.length > 2) updates[mode].push({ text: text.slice(0, 80), type, time: now() });
    });
    setCards(prev => {
      const next = { ...prev };
      Object.keys(updates).forEach(mode => {
        if (updates[mode].length > 0) next[mode] = [...prev[mode], ...updates[mode]].slice(-8);
      });
      return next;
    });
  }, [terminalOutput]);

  const webMedia = detectWebMedia(terminalOutput);

  const modes: Array<{ id: 'code' | 'video' | 'photo' | 'web'; label: string; icon: React.ReactNode; color: string; accent: string }> = [
    { id: 'code',  label: 'Code',  icon: <Code size={16} />,  color: '#007acc', accent: 'rgba(0,122,204,0.12)' },
    { id: 'video', label: 'Video', icon: <Film size={16} />,  color: '#ff6b6b', accent: 'rgba(255,107,107,0.12)' },
    { id: 'photo', label: 'Design', icon: <Image size={16} />, color: '#7c5cfc', accent: 'rgba(124,92,252,0.12)' },
    { id: 'web',   label: 'Web',   icon: <Globe size={16} />, color: '#22c55e', accent: 'rgba(34,197,94,0.12)' },
  ];

  const terminalCardProps: TerminalCardProps = {
    output: terminalOutput,
    onExecuteCommand,
    onClear: onClearTerminal,
    terminalAgent,
    onSetAgent: onSetTerminalAgent,
    onSendAgentMessage,
    isStreaming,
    terminalMode,
    onSetTerminalMode,
    userName,
  };

  // ── Fullscreen: só o terminal, ocupa tudo ──────────────────────────────────
  if (terminalMode === 'fullscreen') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: '20px', flex: 1, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <TerminalCard {...terminalCardProps} fillHeight />
        <style>{`
          @keyframes dotBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.1); opacity: 1; } }
          @keyframes glowSlide { 0% { opacity: 0.2; transform: scaleX(0.2); } 50% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0.2; transform: scaleX(0.2); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', flex: 1, overflowY: 'auto' }}>
      {/* ── 3 Tabs no topo ── */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
        <button
          onClick={() => setActiveHomeTab('wallpaper')}
          style={{
            width: '60px',
            height: '6px',
            background: activeHomeTab === 'wallpaper' ? '#667eea' : 'var(--border-color)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            if (activeHomeTab !== 'wallpaper') e.currentTarget.style.background = 'var(--text-dim)';
          }}
          onMouseLeave={e => {
            if (activeHomeTab !== 'wallpaper') e.currentTarget.style.background = 'var(--border-color)';
          }}
        />
        <button
          onClick={() => setActiveHomeTab('placeholder')}
          style={{
            width: '60px',
            height: '6px',
            background: activeHomeTab === 'placeholder' ? '#667eea' : 'var(--border-color)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            if (activeHomeTab !== 'placeholder') e.currentTarget.style.background = 'var(--text-dim)';
          }}
          onMouseLeave={e => {
            if (activeHomeTab !== 'placeholder') e.currentTarget.style.background = 'var(--border-color)';
          }}
        />
        <button
          onClick={() => setActiveHomeTab('terminal')}
          style={{
            width: '60px',
            height: '6px',
            background: activeHomeTab === 'terminal' ? '#667eea' : 'var(--border-color)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            if (activeHomeTab !== 'terminal') e.currentTarget.style.background = 'var(--text-dim)';
          }}
          onMouseLeave={e => {
            if (activeHomeTab !== 'terminal') e.currentTarget.style.background = 'var(--border-color)';
          }}
        />
      </div>

      {/* Conteúdo baseado na tab ativa */}
      {activeHomeTab === 'wallpaper' && (
        <div style={{ flex: 1, display: 'flex' }}>
          <HomeWallpaper onOpenProject={handleOpenProject} />
        </div>
      )}

      {activeHomeTab === 'placeholder' && (
        <div style={{ flex: 1, display: 'flex' }}>
          <HomePlanner />
        </div>
      )}

      {activeHomeTab === 'terminal' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
          {/* ── Grid 2x2 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: '0 0 auto' }}>
            {modes.map(mode => {
          const events = cards[mode.id];
          const isThisActive = activeMainView === mode.id;
          const isThisStreaming = isStreaming && isThisActive;
          const hasMedia = mode.id === 'web' && webMedia.isPlaying;
          const isConnected = terminalAgent === mode.id;

          return (
            <div
              key={mode.id}
              onClick={() => onNavigate(mode.id)}
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${isConnected ? mode.color + 'cc' : isThisActive ? mode.color + '55' : 'var(--border-color)'}`,
                borderRadius: '12px', padding: '16px', cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                display: 'flex', flexDirection: 'column', gap: '10px',
                minHeight: '170px', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = mode.color + '99';
                e.currentTarget.style.transform = 'translateY(-2px)';
                (e.currentTarget.style as any).boxShadow = `0 4px 20px ${mode.color}22`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = isConnected ? mode.color + 'cc' : isThisActive ? mode.color + '55' : 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
                (e.currentTarget.style as any).boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: mode.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {mode.label}
                  </span>
                  {isConnected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: mode.color + '22', borderRadius: '20px', padding: '1px 6px', border: `1px solid ${mode.color}44` }}>
                      <TerminalSquare size={8} color={mode.color} />
                      <span style={{ fontSize: '8px', color: mode.color, fontWeight: 700 }}>terminal</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {hasMedia && !isThisStreaming && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `${mode.color}22`, borderRadius: '20px', padding: '2px 7px', border: `1px solid ${mode.color}44` }}>
                      {webMedia.label.includes('música') || webMedia.label.includes('music') ? <Music size={9} color={mode.color} /> : <Play size={9} color={mode.color} />}
                      <span style={{ fontSize: '9px', color: mode.color, fontWeight: 600 }}>{webMedia.label}</span>
                    </div>
                  )}
                  {isThisStreaming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: `${mode.color}22`, borderRadius: '20px', padding: '2px 8px', border: `1px solid ${mode.color}44` }}>
                      <ThinkingDots color={mode.color} />
                      <span style={{ fontSize: '9px', color: mode.color, fontWeight: 600 }}>pensando</span>
                    </div>
                  ) : isThisActive ? (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: mode.color, boxShadow: `0 0 8px ${mode.color}` }} />
                  ) : events.length > 0 ? (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#444' }} />
                  ) : null}
                </div>
              </div>

              {isThisStreaming && events.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: `${mode.color}11`, borderRadius: '8px' }}>
                  <ThinkingDots color={mode.color} />
                  <span style={{ fontSize: '11px', color: mode.color, fontWeight: 500 }}>IA processando sua mensagem...</span>
                </div>
              )}

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {events.length === 0 && !isThisStreaming ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '4px' }}>Nenhuma atividade ainda</div>
                ) : (
                  events.slice(-4).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>
                        {ev.type === 'success'  ? <CheckCircle size={10} color="#22c55e" /> :
                         ev.type === 'error'    ? <AlertCircle size={10} color="#ef4444" /> :
                         ev.type === 'thinking' ? <ThinkingDots color={mode.color} /> :
                         ev.type === 'working'  ? (
                           <span style={{ display: 'inline-block', width: 10, height: 10 }}>
                             <svg viewBox="0 0 10 10" width="10" height="10">
                               <circle cx="5" cy="5" r="4" fill="none" stroke={mode.color} strokeWidth="1.5"
                                 strokeDasharray="12 4" style={{ animation: 'spinIcon 1s linear infinite', transformOrigin: 'center' }} />
                             </svg>
                           </span>
                         ) : <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-dim)', marginTop: '3px' }} />}
                      </div>
                      <span style={{ fontSize: '10px', color: ev.type === 'error' ? '#ef4444' : ev.type === 'success' ? '#22c55e' : 'var(--text-secondary)', lineHeight: 1.45, flex: 1 }}>
                        {ev.text}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-dim)', flexShrink: 0, marginTop: '1px' }}>{ev.time}</span>
                    </div>
                  ))
                )}
              </div>

              {isThisActive && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
                  background: `linear-gradient(90deg, transparent, ${mode.color}, transparent)`,
                  animation: isThisStreaming ? 'glowSlide 1.2s ease-in-out infinite' : 'none',
                  opacity: isThisStreaming ? 1 : 0.5,
                }} />
              )}
            </div>
          );
        })}
      </div>

          {/* ── 5º card: Terminal (só quando não flutuante) ── */}
          {terminalMode !== 'floating' && <TerminalCard {...terminalCardProps} />}
        </div>
      )}

      <style>{`
        @keyframes dotBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.1); opacity: 1; } }
        @keyframes spinIcon { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glowSlide { 0% { opacity: 0.2; transform: scaleX(0.2); } 50% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0.2; transform: scaleX(0.2); } }
      `}</style>
    </div>
  );
}
