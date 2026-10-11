import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Files, Search, Settings as SettingsIcon, FolderOpen, Folder, FileCode, ChevronRight, ChevronDown, Palette, X, User, Video } from 'lucide-react';
import { FileItem, SettingsType, SavedModel, ApiProvider } from '../../App';
import { MouseAvatar } from '../Chat/Chat';
import './Sidebar.css';

// Componente para selecionar microfone
function MicrophoneSelector({ settings, onSettingsChange }: { settings: SettingsType; onSettingsChange: (s: SettingsType) => void }) {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMics() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicrophones(mics);
        
        if (!settings.selectedMicId && mics.length > 0) {
          onSettingsChange({ ...settings, selectedMicId: mics[0].deviceId });
        }
      } catch (err) {
        console.error('[Sidebar] Erro ao listar microfones:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMics();
  }, []);

  if (loading) {
    return <small style={{ color: 'var(--text-secondary)' }}>⏳ Carregando microfones...</small>;
  }

  if (microphones.length === 0) {
    return <small style={{ color: '#ef4444' }}>❌ Nenhum microfone detectado</small>;
  }

  return (
    <select
      value={settings.selectedMicId || ''}
      onChange={(e) => onSettingsChange({ ...settings, selectedMicId: e.target.value })}
      style={{ width: '100%', padding: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
    >
      {microphones.map((mic, i) => (
        <option key={mic.deviceId} value={mic.deviceId}>
          {mic.label || `Microfone ${i + 1}`}
        </option>
      ))}
    </select>
  );
}

interface SidebarProps {
  activeTab: 'explorer' | 'search' | 'settings';
  onTabChange: (tab: 'explorer' | 'search' | 'settings') => void;
  files: FileItem[];
  workFolder: string;
  onSelectFolder: () => void;
  onFileClick: (filePath: string) => void;
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
  activeMainView?: string;
  onNeedRestart?: () => void;
  onToggleDesignPreview?: () => void;
  disableViewChange?: boolean; // Desabilita mudança de view (para quando CustomPanel está aberto)
}

const STORAGE_KEY = 'bill-saved-models';

function loadSavedModels(): SavedModel[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function persistSavedModels(models: SavedModel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  window.dispatchEvent(new Event('storage'));
}

function getModelIdFromSettings(settings: SettingsType): string {
  switch (settings.apiProvider) {
    case 'ollama':     return settings.ollamaModel || '';
    case 'gemini':     return settings.geminiModel || 'gemini-2.0-flash';
    case 'openrouter': return settings.openrouterModel || '';
    case 'anthropic':  return settings.anthropicModel || '';
    case 'openai':     return settings.openaiModel || '';
    case 'custom':     return settings.customModel || '';
    default:           return '';
  }
}

function getApiKeyFromSettings(settings: SettingsType): string {
  switch (settings.apiProvider) {
    case 'gemini':     return settings.geminiApiKey || '';
    case 'openrouter': return settings.openrouterApiKey || '';
    case 'anthropic':  return settings.anthropicApiKey || '';
    case 'openai':     return settings.openaiApiKey || '';
    case 'custom':     return settings.customApiKey || '';
    default:           return '';
  }
}

function getBaseUrlFromSettings(settings: SettingsType): string {
  switch (settings.apiProvider) {
    case 'ollama':     return settings.ollamaUrl || '';
    case 'openrouter': return settings.openrouterUrl || '';
    case 'openai':     return settings.openaiUrl || '';
    case 'custom':     return settings.customBaseUrl || '';
    default:           return '';
  }
}

const PROVIDER_ICON: Record<ApiProvider, string> = {
  ollama: 'Ollama', gemini: 'Gemini', openrouter: 'OpenRouter', anthropic: 'Anthropic', openai: 'OpenAI', custom: 'Custom',
};

const PROVIDER_EMOJI: Record<ApiProvider, string> = {
  ollama: '🦙', gemini: '✨', openrouter: '🌐', anthropic: '🧠', openai: '🤖', custom: '🔧',
};

function CustomModelPicker({ model, url, apiKey, onUpdateModel }: { model: string, url: string, apiKey?: string, onUpdateModel: (m: string) => void }) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<string[]>([]);

  const fetchModels = async () => {
    try {
      setFetching(true);
      setError('');
      const result = await window.electronAPI.fetchCustomModels(url, apiKey);
      if (result.error) {
        setError(result.error);
        setModels([]);
      } else {
        setModels(result.models || []);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar modelos');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="setting-group">
      <label>Modelo Detectado</label>
      {fetching ? (
        <div style={{ fontSize: '11px', opacity: 0.8, color: 'var(--accent)' }}>⏳ Buscando modelos...</div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', color: '#ff5252' }}>❌ {error}</div>
          <input value={model} onChange={e => onUpdateModel(e.target.value)} placeholder="Digite o modelo manualmente" />
          <button type="button" onClick={fetchModels} style={{ padding: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            Tentar Novamente
          </button>
        </div>
      ) : models.length > 0 ? (
        <select value={model} onChange={(e) => onUpdateModel(e.target.value)}>
          <option value="" disabled>Selecione um modelo...</option>
          {models.map((cm) => <option key={cm} value={cm}>{cm}</option>)}
        </select>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <input value={model} onChange={e => onUpdateModel(e.target.value)} placeholder="Nenhum modelo detectado. Digite manualmente." />
          <button type="button" onClick={fetchModels} style={{ padding: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            Buscar Modelos da API
          </button>
        </div>
      )}
    </div>
  );
}

const DraggableModal = ({ title, onClose, onSave, children }: { title: string, onClose: () => void, onSave?: () => void, children: React.ReactNode }) => {
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth / 2 - 250), y: Math.max(0, window.innerHeight / 2 - 300) });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, initialX: pos.x, initialY: pos.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      setPos({ 
        x: dragStart.current.initialX + (e.clientX - dragStart.current.x), 
        y: dragStart.current.initialY + (e.clientY - dragStart.current.y) 
      });
    };
    const handleMouseUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  return createPortal(
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: 500, maxHeight: '80vh', 
      background: '#0d0d0d', border: '1px solid #333', 
      borderRadius: '8px', zIndex: 10000, display: 'flex', flexDirection: 'column', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.8)', overflow: 'hidden'
    }}>
      <div 
        onMouseDown={handleMouseDown}
        style={{ 
          padding: '15px 20px', background: '#1a1a1a', borderBottom: '1px solid #333', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none' 
        }}
      >
        <div style={{ flex: 1, height: '16px' }} /> {/* Drag area */}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', color: 'white' }}>
        {children}
        {onSave && (
          <div style={{ borderTop: '1px solid #333', paddingTop: '15px', marginTop: '5px' }}>
            <button 
              className="modal-save-btn"
              onClick={(e) => {
                onSave();
                const btn = e.currentTarget;
                const originalText = btn.innerText;
                btn.innerText = '✅ SALVO!';
                btn.style.background = '#4CAF50';
                setTimeout(() => {
                  btn.innerText = originalText;
                  btn.style.background = '';
                }, 2000);
              }}
            >
              SALVAR ALTERAÇÕES
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default function Sidebar({
  activeTab,
  onTabChange,
  files,
  workFolder,
  onSelectFolder,
  onFileClick,
  settings,
  onSettingsChange,
  activeMainView,
  onNeedRestart,
  onToggleDesignPreview,
  disableViewChange = false
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [activeSettingsTab, setActiveSettingsTab] = useState('Meus Modelos');
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'overview'>('members');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  
  // Estados para interação na visão geral
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  // Provider form state (nome, cor, foto para salvar junto com o modelo)
  const [providerName, setProviderName] = useState<string>('');
  const [providerColor, setProviderColor] = useState<string>('#9b59b6');
  const [providerAvatar, setProviderAvatar] = useState<string>('');
  const [providerVoice, setProviderVoice] = useState<string>('faber'); // Voz padrão
  
  const [savedModels, setSavedModels] = useState<SavedModel[]>(loadSavedModels);

  useEffect(() => { persistSavedModels(savedModels); }, [savedModels]);
  
  // Migração: Se não tem boss definido mas tem modelos salvos, define o primeiro como boss
  useEffect(() => {
    if (!settings.bossModelId && savedModels.length > 0) {
      console.log('[Sidebar] Migracao: Definindo primeiro modelo como IA Chefe');
      onSettingsChange({ ...settings, bossModelId: savedModels[0].id });
    }
  }, []);

  const handleSaveModel = () => {
    const modelId = getModelIdFromSettings(settings);
    if (!modelId && settings.apiProvider !== 'custom') return; // Don't save empty if not custom
    const provider = settings.apiProvider;
    const displayName = providerName.trim() || settings.customName || modelId || provider;
    
    // Create a unique hash string based on URL or API key so multiple APIs of the same provider don't overwrite each other
    const apiKeySuffix = getApiKeyFromSettings(settings)?.slice(-4) || 'nokey';
    const urlSuffix = getBaseUrlFromSettings(settings)?.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'nourl';
    const uniqueId = `${provider}-${modelId || settings.customName || 'custom'}-${urlSuffix}-${apiKeySuffix}`;

    const entry: SavedModel = {
      id: uniqueId,
      name: displayName,
      provider,
      model: modelId,
      apiKey: getApiKeyFromSettings(settings),
      baseUrl: getBaseUrlFromSettings(settings),
      customName: settings.customName,
      color: providerColor,
      avatar: providerAvatar || undefined,
      voice: providerVoice, // Salva a voz selecionada
    };
    
    // Se é o primeiro modelo sendo salvo OU não há boss definido ainda, define como IA Chefe automaticamente
    const isFirstModel = savedModels.length === 0;
    const noBossDefined = !settings.bossModelId;
    
    setSavedModels(prev => {
      const filtered = prev.filter(m => m.id !== entry.id);
      return [entry, ...filtered];
    });
    
    // IMPORTANTE: Atualizar bossModelId DEPOIS de adicionar ao array
    if (isFirstModel || (savedModels.length > 0 && noBossDefined)) {
      console.log('[Sidebar] Definindo primeiro modelo como IA Chefe automaticamente:', uniqueId);
      setTimeout(() => {
        onSettingsChange({ ...settings, bossModelId: uniqueId });
      }, 0);
    }
    
    // Reset form
    setProviderName('');
    setProviderColor('#9b59b6');
    setProviderAvatar('');
    setProviderVoice('faber'); // Reset para voz padrão
  };

  const handleDeleteModel = (id: string) =>
    setSavedModels(prev => prev.filter(m => m.id !== id));

  const handleLoadModel = (m: SavedModel) => {
    const patch: Partial<SettingsType> = {
      apiProvider: m.provider,
      // Salva a identidade do modelo ativo para usar nas mensagens sem @mention
      activeModelColor: m.color,
      activeModelName: m.name,
      activeModelAvatar: m.avatar,
    };
    switch (m.provider) {
      case 'ollama':     patch.ollamaModel = m.model; patch.ollamaUrl = m.baseUrl; break;
      case 'gemini':     patch.geminiModel = m.model; patch.geminiApiKey = m.apiKey; break;
      case 'openrouter': patch.openrouterModel = m.model; patch.openrouterApiKey = m.apiKey; patch.openrouterUrl = m.baseUrl; break;
      case 'anthropic':  patch.anthropicModel = m.model; patch.anthropicApiKey = m.apiKey; break;
      case 'openai':     patch.openaiModel = m.model; patch.openaiApiKey = m.apiKey; patch.openaiUrl = m.baseUrl; break;
      case 'custom':     patch.customModel = m.model; patch.customApiKey = m.apiKey; patch.customBaseUrl = m.baseUrl; patch.customName = m.customName; break;
    }
    onSettingsChange({ ...settings, ...patch });
  };
  const [soul, setSoul] = useState({
    assistantName: '',
    personality: '',
    userName: '',
    vocatives: '',
    beliefs: ''
  });
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [fetchingCustomModels, setFetchingCustomModels] = useState(false);
  const [customError, setCustomError] = useState('');

  const fetchCustomModels = async (url: string, key?: string) => {
    if (!url) return;
    setFetchingCustomModels(true);
    setCustomError('');
    try {
      const result = await window.electronAPI.fetchCustomModels(url, key);
      if (result.success && result.models) {
        setCustomModels(result.models);
        if (result.models.length > 0 && !result.models.includes(settings.customModel || '')) {
          onSettingsChange({ ...settings, customModel: result.models[0] });
        }
      } else {
        throw new Error(result.error || 'Falha ao buscar modelos');
      }
    } catch (err: any) {
      setCustomError(err.message || 'Falha ao buscar modelos');
      setCustomModels([]);
    } finally {
      setFetchingCustomModels(false);
    }
  };

  // Buscar modelos customizados se já tiver URL salva ao carregar ou se mudar a URL
  useEffect(() => {
    if (settings.apiProvider === 'custom' && settings.customBaseUrl) {
      const timer = setTimeout(() => {
        fetchCustomModels(settings.customBaseUrl || '', settings.customApiKey);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [settings.apiProvider, settings.customBaseUrl, settings.customApiKey]);

  // Carregar Alma quando entrar na aba Perfil
  useEffect(() => {
    if (activeTab === 'settings' && activeSettingsTab === 'Perfil') {
      window.electronAPI.readSoul().then((res: any) => {
        if (res.success) setSoul(res.soul);
      });
    }
  }, [activeTab, activeSettingsTab]);

  // Força aba Settings quando não estiver em modo Code e tentar usar Explorer/Search
  useEffect(() => {
    if (activeMainView !== 'code' && (activeTab === 'explorer' || activeTab === 'search')) {
      onTabChange('settings');
    }
  }, [activeMainView, activeTab, onTabChange]);

  const handleSaveSoul = async () => {
    try {
      const res: any = await window.electronAPI.saveSoul(soul);
      if (res.success) {
        if (onNeedRestart) onNeedRestart();
        const btn = document.querySelector('.save-soul-btn') as HTMLButtonElement;
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = '✅ ALMA SINCRONIZADA!';
          btn.style.background = '#4CAF50';
          setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = '';
          }, 2000);
        }
      } else {
        alert('Erro ao sincronizar alma: ' + (res.error || 'Erro desconhecido'));
      }
    } catch (err: any) {
      alert('Falha crítica na sincronização: ' + err.message);
    }
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (items: FileItem[]) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      return (
        <div key={item.path} className="file-item">
          <div
            className={`file-name ${item.isDirectory ? 'folder' : ''}`}
            onClick={() => {
              if (item.isDirectory) {
                toggleFolder(item.path);
              } else {
                onFileClick(item.path);
              }
            }}
          >
            <span className="chevron-icon">
              {item.isDirectory ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{width: 14, display: 'inline-block'}}></span>}
            </span>
            <span className="icon">
              {item.isDirectory ? <Folder size={14} className="text-vscode-folder" /> : <FileCode size={14} className="text-vscode-file" />}
            </span>
            <span className="name">{item.name}</span>
          </div>
          {item.isDirectory && isExpanded && (
            <div className="file-tree-sub" style={{ paddingLeft: 12 }}>
              {/* Here we would recursively render children if we had a nested tree structure, but currently files is flat or just 1 level? Actually listDirectory needs to handle nested. If it's a flat list representing tree, we need to adapt. Assuming standard approach. */}
            </div>
          )}
        </div>
      );
    });
  };

  const updateSavedModel = (id: string, updates: Partial<SavedModel>) => {
    const newModels = savedModels.map(sm => sm.id === id ? { ...sm, ...updates } : sm);
    setSavedModels(newModels);
    persistSavedModels(newModels);
  };

  const renderTabButton = (id: string, label: string, icon: React.ReactNode) => (
    <button
      key={id}
      onClick={() => setActiveSettingsTab(activeSettingsTab === id ? '' : id)}
      className={`settings-tab-btn ${activeSettingsTab === id ? 'active' : ''}`}
    >
      {icon}
      {label.toUpperCase()}
    </button>
  );

  return (
    <div className="sidebar">
      <div className="activity-bar">
        <button
          className={`activity-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
          title="Configurações"
        >
          <SettingsIcon size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`activity-btn ${activeTab === 'recorder' ? 'active' : ''}`}
          onClick={() => onTabChange('recorder')}
          title="Gravador de Tela"
        >
          <Video size={24} strokeWidth={1.5} />
        </button>
        <button
          className="activity-btn"
          onClick={async () => {
            try {
              const result = await (window as any).electronAPI?.captureScreenArea();
              if (result?.success && result?.base64) {
                window.dispatchEvent(new CustomEvent('open-screenshot-editor', { 
                  detail: { base64: result.base64 }
                }));
              }
            } catch (err) {
              console.error('[Screenshot] Erro:', err);
            }
          }}
          title="Capturar Tela"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      </div>

      <div className="side-panel">
        {activeTab === 'settings' && (
          <div className="settings-panel">
            <div className="panel-header">CONFIGURAÇÕES</div>
            
            <div className="settings-content" style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* 1. MEU PERFIL */}
              {renderTabButton('Perfil', 'Meu Perfil', <ChevronRight size={14} />)}
              {activeSettingsTab === 'Perfil' && (
                <DraggableModal onSave={() => { onSettingsChange(settings); setActiveSettingsTab(''); }} title="Meu Perfil" onClose={() => setActiveSettingsTab('')}>
                  <div className="setting-group">
                    <label>Foto de Perfil</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                      {settings.userAvatar ? (
                        <div style={{ position: 'relative' }}>
                          <img src={settings.userAvatar} alt="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${settings.userColor || '#3498db'}` }} />
                          <button
                            onClick={() => onSettingsChange({ ...settings, userAvatar: '' })}
                            style={{ position: 'absolute', top: -4, right: -4, background: '#555', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >✕</button>
                        </div>
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: `2px dashed ${settings.userColor || '#3498db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'var(--text-secondary)' }}>
                          <User size={24} />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => onSettingsChange({ ...settings, userAvatar: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', flex: 1 }}
                      />
                    </div>
                    <small style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Esta foto aparecerá ao lado das suas mensagens no chat.
                    </small>
                  </div>

                  <div className="setting-group" style={{ marginTop: '16px' }}>
                    <label>Seu Nome</label>
                    <input 
                      type="text" 
                      value={settings.userName || ''}
                      onChange={(e) => onSettingsChange({ ...settings, userName: e.target.value })}
                      placeholder="Ex: Mateus Félix"
                    />
                    <small style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Nome que identifica você nas conversas.
                    </small>
                  </div>

                  <div className="setting-group" style={{ marginTop: '16px' }}>
                    <label>Cor do Perfil</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                      {['#9b59b6', '#3498db', '#2ecc71', '#e67e22', '#e74c3c', '#e91e8c', '#00bcd4', '#f1c40f'].map(c => (
                        <button
                          key={c}
                          onClick={() => onSettingsChange({ ...settings, userColor: c })}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: c, border: settings.userColor === c ? '2px solid var(--text-primary)' : '1px solid transparent', cursor: 'pointer', flexShrink: 0 }}
                        />
                      ))}
                      <input
                        type="color"
                        value={settings.userColor || '#3498db'}
                        onChange={(e) => onSettingsChange({ ...settings, userColor: e.target.value })}
                        style={{ width: '24px', height: '24px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', padding: 0, borderRadius: '4px' }}
                      />
                    </div>
                    <small style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Cor do contorno da foto e do seu nome no chat.
                    </small>
                  </div>
                </DraggableModal>
              )}

              {/* 2. PROVEDORES DE IA */}
              {renderTabButton('Modelos', 'Provedores de IA', <FileCode size={14} />)}
              {activeSettingsTab === 'Modelos' && (
                <DraggableModal onSave={() => { handleSaveModel(); onSettingsChange(settings); }} title="Provedores de IA" onClose={() => setActiveSettingsTab('')}>
                  {/* ── Identidade da IA ── */}
                  <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>Identidade da IA</div>

                    {/* Foto */}
                    <div className="setting-group">
                      <label>Foto (Opcional)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                        {providerAvatar ? (
                          <div style={{ position: 'relative' }}>
                            <img src={providerAvatar} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border-light)' }} />
                            <button
                              onClick={() => setProviderAvatar('')}
                              style={{ position: 'absolute', top: -4, right: -4, background: '#555', color: 'white', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-secondary)' }}>foto</div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setProviderAvatar(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{ fontSize: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                        />
                      </div>
                    </div>

                    {/* Nome */}
                    <div className="setting-group">
                      <label>Nome de Exibição</label>
                      <input
                        type="text"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        placeholder="Ex: Meu Gemini, GPT Pessoal, Claude Dev..."
                      />
                    </div>

                    {/* Cor */}
                    <div className="setting-group">
                      <label>Cor</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        {['#9b59b6', '#3498db', '#2ecc71', '#e67e22', '#e74c3c', '#e91e8c', '#00bcd4'].map(c => (
                          <button
                            key={c}
                            onClick={() => setProviderColor(c)}
                            style={{ width: '16px', height: '16px', borderRadius: '3px', background: c, border: providerColor === c ? '2px solid var(--text-primary)' : '1px solid transparent', cursor: 'pointer', flexShrink: 0 }}
                          />
                        ))}
                        <input
                          type="color"
                          value={providerColor}
                          onChange={(e) => setProviderColor(e.target.value)}
                          style={{ width: '20px', height: '20px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', padding: 0, borderRadius: '3px' }}
                        />
                      </div>
                    </div>

                    {/* Voz */}
                    <div className="setting-group">
                      <label>Voz (TTS)</label>
                      <select
                        value={providerVoice}
                        onChange={(e) => setProviderVoice(e.target.value)}
                        style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
                      >
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
                  </div>

                  <div className="setting-group">
                    <label>Provedor de IA</label>
                    <select
                      value={settings.apiProvider}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          apiProvider: e.target.value as any,
                        })
                      }
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="gemini">Google Gemini (Nuvem)</option>
                      <option value="openrouter">OpenRouter (Nuvem)</option>
                      <option value="anthropic">Anthropic Claude (Nuvem)</option>
                      <option value="openai">OpenAI GPT (Nuvem)</option>
                      <option value="custom">Personalizada (Custom API)</option>
                    </select>
                  </div>

                  {settings.apiProvider === 'ollama' && (
                    <div className="setting-group">
                      <label>Modelo Ollama</label>
                      {settings.ollamaModels && settings.ollamaModels.length > 0 ? (
                        <select
                          value={settings.ollamaModel || ''}
                          onChange={(e) => onSettingsChange({ ...settings, ollamaModel: e.target.value })}
                        >
                          <option value="" disabled>Selecione um modelo...</option>
                          {settings.ollamaModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={settings.ollamaModel}
                          onChange={(e) => onSettingsChange({ ...settings, ollamaModel: e.target.value })}
                          placeholder="Nenhum modelo encontrado..."
                        />
                      )}
                    </div>
                  )}

                  {settings.apiProvider === 'gemini' && (
                    <>
                      <div className="setting-group">
                        <label>API Key do Gemini</label>
                        <input
                          type="password"
                          value={settings.geminiApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, geminiApiKey: e.target.value })}
                          placeholder="Sua API Key"
                        />
                      </div>
                      <div className="setting-group">
                        <label>Modelo Gemini</label>
                        <input
                          type="text"
                          value={settings.geminiModel || 'gemini-2.0-flash'}
                          onChange={(e) => onSettingsChange({ ...settings, geminiModel: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {settings.apiProvider === 'openrouter' && (
                    <>
                      <div className="setting-group">
                        <label>API Key do OpenRouter</label>
                        <input
                          type="password"
                          value={settings.openrouterApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, openrouterApiKey: e.target.value })}
                        />
                      </div>
                      <div className="setting-group">
                        <label>Modelo</label>
                        <input
                          type="text"
                          value={settings.openrouterModel || ''}
                          onChange={(e) => onSettingsChange({ ...settings, openrouterModel: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {settings.apiProvider === 'anthropic' && (
                    <>
                      <div className="setting-group">
                        <label>API Key da Anthropic</label>
                        <input
                          type="password"
                          value={settings.anthropicApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, anthropicApiKey: e.target.value })}
                        />
                      </div>
                      <div className="setting-group">
                        <label>Modelo Claude</label>
                        <input
                          type="text"
                          value={settings.anthropicModel || ''}
                          onChange={(e) => onSettingsChange({ ...settings, anthropicModel: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {settings.apiProvider === 'openai' && (
                    <>
                      <div className="setting-group">
                        <label>API Key da OpenAI</label>
                        <input
                          type="password"
                          value={settings.openaiApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, openaiApiKey: e.target.value })}
                        />
                      </div>
                      <div className="setting-group">
                        <label>Modelo GPT</label>
                        <input
                          type="text"
                          value={settings.openaiModel || ''}
                          onChange={(e) => onSettingsChange({ ...settings, openaiModel: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {settings.apiProvider === 'custom' && (
                    <>
                      <div className="setting-group">
                        <label>ID do Provedor (Nome)</label>
                        <input
                          type="text"
                          value={settings.customName || ''}
                          onChange={(e) => onSettingsChange({ ...settings, customName: e.target.value })}
                          placeholder="Ex: lmstudio, vllm, local-api"
                        />
                      </div>
                      <div className="setting-group">
                        <label>URL Base da API</label>
                        <input
                          type="text"
                          value={settings.customBaseUrl || ''}
                          onChange={(e) => onSettingsChange({ ...settings, customBaseUrl: e.target.value })}
                          placeholder="Ex: http://localhost:1234/v1"
                        />
                        <small style={{ fontSize: '9px', opacity: 0.6 }}>
                          Deve terminar em /v1 ou no endpoint base compatível.
                        </small>
                      </div>
                      <div className="setting-group">
                        <label>API Key (Opcional)</label>
                        <input
                          type="password"
                          value={settings.customApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, customApiKey: e.target.value })}
                          placeholder="Sua API Key se houver"
                        />
                      </div>
                      <div className="setting-group">
                        <label>Modelo Detectado</label>
                        {fetchingCustomModels ? (
                          <div style={{ fontSize: '11px', opacity: 0.8, color: 'var(--accent)' }}>
                            ⏳ Buscando modelos...
                          </div>
                        ) : customError ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '10px', color: '#ff5252' }}>
                              ❌ {customError}
                            </div>
                            <input
                              type="text"
                              value={settings.customModel || ''}
                              onChange={(e) => onSettingsChange({ ...settings, customModel: e.target.value })}
                              placeholder="Digite o modelo manualmente"
                            />
                          </div>
                        ) : customModels.length > 0 ? (
                          <select
                            value={settings.customModel || ''}
                            onChange={(e) => onSettingsChange({ ...settings, customModel: e.target.value })}
                          >
                            <option value="" disabled>Selecione um modelo...</option>
                            {customModels.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                              type="text"
                              value={settings.customModel || ''}
                              onChange={(e) => onSettingsChange({ ...settings, customModel: e.target.value })}
                              placeholder="Nenhum modelo detectado. Digite manualmente."
                            />
                            <button
                              type="button"
                              onClick={() => fetchCustomModels(settings.customBaseUrl || '', settings.customApiKey)}
                              style={{
                                padding: '6px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                marginTop: '4px'
                              }}
                            >
                              🔄 Tentar Detectar Modelos
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </DraggableModal>
              )}

              {/* 3. GERENCIAMENTO DE EQUIPE */}
              {renderTabButton('Equipe', 'Gerenciamento de Equipe', <ChevronRight size={14} />)}
              {activeSettingsTab === 'Equipe' && (
                <DraggableModal 
                  onSave={() => { 
                    onSettingsChange(settings); 
                    setActiveSettingsTab(''); 
                    setCanvasZoom(1);
                    setCanvasPan({ x: 0, y: 0 });
                  }} 
                  title="Gerenciamento de Equipe" 
                  onClose={() => {
                    setActiveSettingsTab('');
                    setTeamSubTab('members');
                    setCanvasZoom(1);
                    setCanvasPan({ x: 0, y: 0 });
                  }}
                  style={{ width: '800px', maxWidth: '90vw', height: '650px', maxHeight: '85vh' }}
                >
                  
                  {/* ABA MEMBROS */}
                  {teamSubTab === 'members' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Meu Perfil (Dono) */}
                      <div
                        onClick={() => setSelectedMemberId(selectedMemberId === 'user' ? null : 'user')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          background: selectedMemberId === 'user' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-light)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {settings.userAvatar ? (
                          <img src={settings.userAvatar} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${settings.userColor || '#3498db'}` }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={16} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: settings.userColor || 'var(--text-primary)' }}>
                            {settings.userName || 'Você'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                            Dono
                          </div>
                        </div>
                      </div>

                      {/* Lista de Modelos (Gerente/Funcionários) */}
                      {savedModels.map((model) => {
                        const isManager = settings.bossModelId === model.id;
                        const role = isManager ? 'Gerente' : 'Funcionário';
                        
                        return (
                          <div key={model.id}>
                            <div
                              onClick={() => setSelectedMemberId(selectedMemberId === model.id ? null : model.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px',
                                background: selectedMemberId === model.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                borderRadius: '6px',
                                border: '1px solid var(--border-light)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {model.avatar ? (
                                <img src={model.avatar} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${model.color || '#999'}` }} />
                              ) : (
                                <MouseAvatar size={32} />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: model.color || 'var(--text-primary)' }}>
                                  {model.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                  {role}
                                </div>
                              </div>
                            </div>

                            {/* Menu de opções quando selecionado */}
                            {selectedMemberId === model.id && (
                              <div style={{ marginTop: '8px', marginLeft: '42px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  Selecionar Cargo
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSettingsChange({ ...settings, bossModelId: model.id });
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: isManager ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  Gerente (IA Chefe)
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (settings.bossModelId === model.id) {
                                      onSettingsChange({ ...settings, bossModelId: undefined });
                                    }
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: !isManager ? 'rgba(100,149,237,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  Funcionário
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteModel(model.id);
                                    setSelectedMemberId(null);
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(239,68,68,0.2)',
                                    border: '1px solid rgba(239,68,68,0.5)',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    marginTop: '4px'
                                  }}
                                >
                                  🗑️ Excluir Membro
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                </DraggableModal>
              )}

              {/* 4. TEMAS */}
              {renderTabButton('Temas', 'Temas & Cores', <Folder size={14} />)}
              {activeSettingsTab === 'Temas' && (
                <DraggableModal onSave={() => { handleSaveModel(); onSettingsChange(settings); }} title="Temas & Cores" onClose={() => setActiveSettingsTab('')}>
                  <div className="setting-group">
                    <label>Visual da Interface</label>
                    <select
                      value={settings.theme}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          theme: e.target.value as any,
                        })
                      }
                    >
                      <option value="billeditor">🌙 Dark</option>
                      <option value="facebook">☀️ Light</option>
                    </select>
                  </div>
                </DraggableModal>
              )}

              {/* 5. WEB */}
              {renderTabButton('Web', 'Pesquisa Web', <Search size={14} />)}
              {activeSettingsTab === 'Web' && (
                <DraggableModal onSave={() => { handleSaveModel(); onSettingsChange(settings); }} title="Integração Web" onClose={() => setActiveSettingsTab('')}>
                  <div className="setting-group">
                    <label>Provedor de Pesquisa</label>
                    <select
                      value={settings.searchProvider || 'duckduckgo'}
                      onChange={(e) => onSettingsChange({ ...settings, searchProvider: e.target.value as any })}
                    >
                      <option value="tavily">🔥 Tavily (Recomendado para IAs)</option>
                      <option value="duckduckgo">🦆 DuckDuckGo (Grátis - Sem API)</option>
                      <option value="google">🔍 Google Custom Search (Requer API)</option>
                      <option value="brave">🦁 Brave Search (Requer API)</option>
                    </select>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                      Escolha qual serviço usar para pesquisas web.
                    </small>
                  </div>

                  {/* TAVILY SEARCH */}
                  {settings.searchProvider === 'tavily' && (
                    <>
                      <div className="setting-group" style={{ marginTop: '14px' }}>
                        <label>Tavily API Key</label>
                        <input
                          type="password"
                          value={settings.tavilyApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, tavilyApiKey: e.target.value })}
                          placeholder="tvly-..."
                        />
                        <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                          Crie em: <a href="https://tavily.com" target="_blank" style={{ color: '#8b5cf6' }}>tavily.com</a> (1000 buscas grátis/mês)
                        </small>
                      </div>

                      <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <strong style={{ color: '#8b5cf6' }}>⚡ Por que Tavily?</strong><br/>
                          • Feito especificamente para IAs<br/>
                          • Retorna conteúdo já extraído e limpo<br/>
                          • Mais rápido que outras APIs<br/>
                          • 1000 buscas grátis por mês<br/><br/>
                          <strong style={{ color: '#8b5cf6' }}>📌 Como configurar:</strong><br/>
                          1. Acesse tavily.com e crie uma conta<br/>
                          2. Copie sua API Key<br/>
                          3. Cole aqui e salve
                        </div>
                      </div>
                    </>
                  )}

                  {/* GOOGLE CUSTOM SEARCH */}
                  {settings.searchProvider === 'google' && (
                    <>
                      <div className="setting-group" style={{ marginTop: '14px' }}>
                        <label>Google API Key</label>
                        <input
                          type="password"
                          value={settings.googleApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, googleApiKey: e.target.value })}
                          placeholder="AIzaSy..."
                        />
                        <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                          Crie em: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style={{ color: '#8b5cf6' }}>Google Cloud Console</a>
                        </small>
                      </div>

                      <div className="setting-group" style={{ marginTop: '14px' }}>
                        <label>Search Engine ID (CX)</label>
                        <input
                          type="text"
                          value={settings.googleCx || ''}
                          onChange={(e) => onSettingsChange({ ...settings, googleCx: e.target.value })}
                          placeholder="0123456789abcdef:..."
                        />
                        <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                          Crie em: <a href="https://programmablesearchengine.google.com/" target="_blank" style={{ color: '#8b5cf6' }}>Programmable Search Engine</a>
                        </small>
                      </div>

                      <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <strong style={{ color: '#8b5cf6' }}>📌 Como configurar:</strong><br/>
                          1. Crie um projeto no Google Cloud<br/>
                          2. Ative a API "Custom Search API"<br/>
                          3. Crie credenciais (API Key)<br/>
                          4. Crie um Search Engine no link acima<br/>
                          5. Cole a API Key e o Search Engine ID aqui
                        </div>
                      </div>
                    </>
                  )}

                  {/* BRAVE SEARCH */}
                  {settings.searchProvider === 'brave' && (
                    <>
                      <div className="setting-group" style={{ marginTop: '14px' }}>
                        <label>Brave API Key</label>
                        <input
                          type="password"
                          value={settings.braveApiKey || ''}
                          onChange={(e) => onSettingsChange({ ...settings, braveApiKey: e.target.value })}
                          placeholder="BSA..."
                        />
                        <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                          Crie em: <a href="https://brave.com/search/api/" target="_blank" style={{ color: '#8b5cf6' }}>Brave Search API</a>
                        </small>
                      </div>

                      <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <strong style={{ color: '#8b5cf6' }}>📌 Como configurar:</strong><br/>
                          1. Crie uma conta no Brave Search<br/>
                          2. Solicite acesso à API<br/>
                          3. Cole a API Key aqui
                        </div>
                      </div>
                    </>
                  )}

                  {/* DUCKDUCKGO */}
                  {settings.searchProvider === 'duckduckgo' && (
                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <strong style={{ color: '#22c55e' }}>✅ Pronto para usar!</strong><br/>
                        DuckDuckGo não requer chaves de API. Basta salvar e começar a pesquisar.
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Como funciona:</strong><br/>
                      Quando a IA detecta que precisa de informações atualizadas, ela automaticamente busca na internet usando o provedor selecionado e responde com base nos resultados.
                    </div>
                  </div>
                </DraggableModal>
              )}

              {/* 6. VISÃO */}
              {renderTabButton('Visão', 'Visão da IA', <FileCode size={14} />)}
              {activeSettingsTab === 'Visão' && (
                <DraggableModal onSave={() => { handleSaveModel(); onSettingsChange(settings); }} title="Visão Ocular" onClose={() => setActiveSettingsTab('')}>
                  <div className="setting-group">
                    <label>Modo de Visão</label>
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', lineHeight: 1.5, fontSize: '10px' }}>
                      Quando o editor de fotos precisa analisar o canvas visualmente, qual IA usar?
                    </small>
                    <select
                      value={settings.visionMode || 'moondream-then-api'}
                      onChange={(e) => onSettingsChange({ ...settings, visionMode: e.target.value as any })}
                    >
                      <option value="moondream-then-api">🥇 Moondream → API (recomendado)</option>
                      <option value="api-then-moondream">🥇 API → Moondream (fallback)</option>
                      <option value="moondream">🦙 Só Moondream (local)</option>
                      <option value="api">🌐 Só API (precisa suportar visão)</option>
                      <option value="disabled">🚫 Desativado</option>
                    </select>
                  </div>

                  <div className="setting-group" style={{ marginTop: '14px' }}>
                    <label>Modelo de Visão Local (Ollama)</label>
                    <input
                      type="text"
                      value={settings.moondreamModel || 'moondream'}
                      onChange={(e) => onSettingsChange({ ...settings, moondreamModel: e.target.value })}
                      placeholder="moondream"
                    />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: 1.5 }}>
                      Modelo do Ollama para análise visual local. Padrão: <code>moondream</code>.<br/>
                      Outros: <code>llava</code>, <code>llava:13b</code>, <code>bakllava</code><br/>
                      Instale: <code>ollama pull moondream</code>
                    </small>
                  </div>

                  <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Como funciona:</strong><br/>
                      O editor de fotos captura uma miniatura do canvas e envia para análise antes de cada mensagem. Isso permite que a IA veja posição, sobreposição e tamanho real dos elementos.<br/><br/>
                      <strong>Moondream</strong> = roda localmente, funciona com qualquer API.<br/>
                      <strong>API</strong> = usa a API configurada (precisa suportar visão, ex: GPT-4o, Gemini, Claude).
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,200,0,0.1)', borderRadius: '6px', border: '1px solid rgba(255,200,0,0.3)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      <strong style={{ color: '#ffc107' }}>⚠️ Requisito:</strong><br/>
                      O Moondream <strong>não vem instalado</strong> com o app. Você precisa instalar manualmente:<br/><br/>
                      1. Instale o Ollama: <a href="https://ollama.com" target="_blank" style={{ color: '#4fc3f7' }}>ollama.com</a><br/>
                      2. Abra o terminal e execute: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>ollama pull moondream</code><br/>
                      3. Mantenha o Ollama rodando em segundo plano
                    </div>
                  </div>
                </DraggableModal>
              )}

              {/* 7. ÁUDIO */}
              {renderTabButton('Áudio', 'Som & Voz', <ChevronRight size={14} />)}
              {activeSettingsTab === 'Áudio' && (
                <DraggableModal onSave={() => { handleSaveModel(); onSettingsChange(settings); }} title="Voz & Áudio" onClose={() => setActiveSettingsTab('')}>
                  <AudioSettings settings={settings} onSettingsChange={onSettingsChange} />
                </DraggableModal>
              )}

              {/* 8. CACHE */}
              {renderTabButton('Cache', 'Cache & Armazenamento', <ChevronRight size={14} />)}
              {activeSettingsTab === 'Cache' && (
                <DraggableModal onSave={() => { setActiveSettingsTab(''); }} title="Cache & Armazenamento" onClose={() => setActiveSettingsTab('')}>
                  <CacheManager />
                </DraggableModal>
              )}

            </div>
          </div>
        )}

        {activeTab === 'recorder' && (
          <div className="settings-panel">
            <div className="panel-header">GRAVADOR DE TELA</div>
            <ScreenRecorder />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente do Gravador de Tela ──
function ScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedMicLabel, setSelectedMicLabel] = useState('');
  const [micVolume, setMicVolume] = useState(100);
  const [systemVolume, setSystemVolume] = useState(100);
  const [savePath, setSavePath] = useState('');
  const [fps, setFps] = useState(60);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [outputPath, setOutputPath] = useState('');

  useEffect(() => {
    // Carregar dispositivos de áudio
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(mics);
      if (mics.length > 0 && !selectedMic) {
        setSelectedMic(mics[0].deviceId);
        setSelectedMicLabel(mics[0].label || 'Microfone Padrão');
      }
    });

    // Definir pasta padrão Downloads
    const downloads = `${(window as any).electronAPI ? 'Downloads' : 'Downloads'}`;
    setSavePath(downloads);
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const result = await (window as any).electronAPI?.startScreenRecording({
        micDeviceName: selectedMicLabel,
        micVolume,
        systemVolume,
        savePath: savePath || '',
        fps
      });

      if (result?.success) {
        setIsRecording(true);
        setDuration(0);
        setOutputPath(result.outputPath || '');
        console.log('[Recorder] Gravação iniciada:', result.outputPath);
      } else {
        console.error('[Recorder] Erro ao iniciar:', result?.error);
        alert(`Erro ao iniciar gravação:\n${result?.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('[Recorder] Erro:', err);
      alert('Erro ao iniciar gravação');
    }
  };

  const stopRecording = async () => {
    try {
      const result = await (window as any).electronAPI?.stopScreenRecording();
      
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      
      if (result?.success) {
        console.log('[Recorder] Gravação finalizada em:', outputPath);
      } else {
        console.error('[Recorder] Erro ao parar:', result?.error);
      }
    } catch (err) {
      console.error('[Recorder] Erro:', err);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Status */}
      <div style={{ 
        padding: '12px', 
        background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)', 
        borderRadius: '8px',
        border: `1px solid ${isRecording ? '#ef4444' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {isRecording ? (isPaused ? 'Pausado' : 'Gravando') : 'Parado'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            {formatTime(duration)}
          </div>
        </div>
        {isRecording && (
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}
      </div>

      {/* Configurações */}
      {!isRecording && (
        <>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Microfone
            </label>
            <select
              value={selectedMic}
              onChange={(e) => {
                setSelectedMic(e.target.value);
                const device = audioDevices.find(d => d.deviceId === e.target.value);
                setSelectedMicLabel(device?.label || 'Microfone Padrão');
              }}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
            >
              {audioDevices.map(dev => (
                <option key={dev.deviceId} value={dev.deviceId}>
                  {dev.label || 'Microfone Padrão'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Taxa de Quadros (FPS)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setFps(30)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: fps === 30 ? 'var(--primary)' : 'var(--bg-secondary)',
                  border: `1px solid ${fps === 30 ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  color: fps === 30 ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: fps === 30 ? 600 : 400
                }}
              >
                30 FPS
              </button>
              <button
                onClick={() => setFps(60)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: fps === 60 ? 'var(--primary)' : 'var(--bg-secondary)',
                  border: `1px solid ${fps === 60 ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  color: fps === 60 ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: fps === 60 ? 600 : 400
                }}
              >
                60 FPS
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Volume do Microfone: {micVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={micVolume}
              onChange={(e) => setMicVolume(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Volume do Sistema: {systemVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={systemVolume}
              onChange={(e) => setSystemVolume(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Salvar em
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={savePath}
                readOnly
                placeholder="Downloads"
                style={{ flex: 1, padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                onClick={async () => {
                  const result = await (window as any).electronAPI?.selectFolder();
                  if (result?.success && result.path) {
                    setSavePath(result.path);
                  }
                }}
              />
              <button
                onClick={async () => {
                  const result = await (window as any).electronAPI?.selectFolder();
                  if (result?.success && result.path) {
                    setSavePath(result.path);
                  }
                }}
                style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}
              >
                Escolher...
              </button>
            </div>
            <small style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Deixe vazio para salvar em Downloads
            </small>
          </div>
        </>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              flex: 1,
              padding: '12px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Iniciar Gravação
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              flex: 1,
              padding: '12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Parar Gravação
          </button>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <div style={{ fontSize: '11px', color: '#93c5fd', lineHeight: '1.6' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Informações:</div>
          • Captura a tela inteira em Full HD<br />
          • Inclui cursor do mouse<br />
          • Mixagem automática de áudio<br />
          • Formato MP4 (H.264 + AAC)
        </div>
      </div>
    </div>
  );
}

// ── Componente para gerenciar cache de downloads ──
function CacheManager() {
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmingCategory, setConfirmingCategory] = useState<string | null>(null);

  const checkCache = async () => {
    setLoading(true);
    setMessage('');
    const api = (window as any).electronAPI;
    if (!api) return;
    
    const result = await api.checkDownloadCache();
    setCacheInfo(result);
    setLoading(false);
  };

  const clearCache = async (category?: string) => {
    setLoading(true);
    setMessage('');
    setConfirmingCategory(null);
    const api = (window as any).electronAPI;
    if (!api) return;
    
    const result = await api.clearDownloadCache(category);
    setLoading(false);
    
    if (result.success) {
      setMessage(result.message);
      checkCache();
    } else {
      setMessage(`Erro: ${result.error}`);
    }
  };

  useEffect(() => {
    checkCache();
  }, []);

  if (loading && !cacheInfo) {
    return <div style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>Carregando...</div>;
  }

  if (!cacheInfo || !cacheInfo.success) {
    return <div style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>Erro ao carregar informações do cache</div>;
  }

  const hasFiles = cacheInfo.exists && cacheInfo.totalCount > 0;

  // Se está confirmando alguma categoria, mostra o painel de confirmação
  if (confirmingCategory) {
    const categoryNames: any = {
      'all': 'todo o cache',
      'videos': 'vídeos',
      'audios': 'áudios',
      'images': 'imagens',
      'outros': 'outros arquivos'
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
        <div style={{ 
          padding: '12px', 
          background: 'var(--bg-secondary)', 
          borderRadius: '4px',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
            Confirmar exclusão
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Tem certeza que deseja limpar {categoryNames[confirmingCategory]}?
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setConfirmingCategory(null)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => clearCache(confirmingCategory)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
      
      {/* Resumo Total */}
      <div style={{ 
        padding: '12px', 
        background: 'var(--bg-secondary)', 
        borderRadius: '4px',
        border: '1px solid var(--border-light)'
      }}>
        {hasFiles ? (
          <>
            <div style={{ marginBottom: '6px', color: 'var(--text-primary)', fontWeight: 500 }}>
              Total: {cacheInfo.totalCount} arquivo(s) · {cacheInfo.totalSizeMB} MB
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {cacheInfo.path}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)' }}>Nenhum arquivo em cache</div>
        )}
      </div>

      {/* Categorias */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Vídeos */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          border: '1px solid var(--border-light)'
        }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Vídeos</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {cacheInfo.categories.videos.count} arquivo(s) · {(cacheInfo.categories.videos.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          {cacheInfo.categories.videos.count > 0 && (
            <button
              onClick={() => setConfirmingCategory('videos')}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Áudios */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          border: '1px solid var(--border-light)'
        }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Áudios</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {cacheInfo.categories.audios.count} arquivo(s) · {(cacheInfo.categories.audios.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          {cacheInfo.categories.audios.count > 0 && (
            <button
              onClick={() => setConfirmingCategory('audios')}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Imagens */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          border: '1px solid var(--border-light)'
        }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Imagens</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {cacheInfo.categories.images.count} arquivo(s) · {(cacheInfo.categories.images.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          {cacheInfo.categories.images.count > 0 && (
            <button
              onClick={() => setConfirmingCategory('images')}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Outros */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          border: '1px solid var(--border-light)'
        }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Outros</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {cacheInfo.categories.outros.count} arquivo(s) · {(cacheInfo.categories.outros.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          {cacheInfo.categories.outros.count > 0 && (
            <button
              onClick={() => setConfirmingCategory('outros')}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div style={{ 
          padding: '8px 10px', 
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          borderRadius: '4px',
          fontSize: '11px',
          border: '1px solid var(--border-light)'
        }}>
          {message}
        </div>
      )}

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
        <button
          onClick={checkCache}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        
        {hasFiles && (
          <button
            onClick={() => setConfirmingCategory('all')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            {loading ? 'Limpando...' : 'Limpar Tudo'}
          </button>
        )}
      </div>

      <div style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '11px', 
        lineHeight: '1.4',
        paddingTop: '4px',
        borderTop: '1px solid var(--border-light)'
      }}>
        Arquivos temporários baixados da web, gerados pela IA ou enviados para os editores.
      </div>
    </div>
  );
}

// ── Componente separado para aba Áudio (evita re-render do Sidebar inteiro) ──
function AudioSettings({ settings, onSettingsChange }: {
  settings: SettingsType;
  onSettingsChange: (s: SettingsType) => void;
}) {
  const [isCapturing, setIsCapturing] = useState(false);

  const startCapture = () => setIsCapturing(true);

  const clearHotkey = () => {
    onSettingsChange({ ...settings, micHotkey: '' });
  };

  useEffect(() => {
    if (!isCapturing) return;

    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Ignora teclas modificadoras sozinhas
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      let combo = '';
      if (e.ctrlKey) combo += 'Ctrl+';
      if (e.altKey) combo += 'Alt+';
      if (e.shiftKey) combo += 'Shift+';
      combo += e.code; // ex: KeyF, F9, CapsLock, Space
      onSettingsChange({ ...settings, micHotkey: combo });
      setIsCapturing(false);
    };

    const handleMouse = (e: MouseEvent) => {
      // Botões extras do mouse: 3=Meio, 4=Voltar, 5=Avançar
      if (e.button >= 3) {
        e.preventDefault();
        const names: Record<number, string> = { 3: 'Mouse3', 4: 'Mouse4', 5: 'Mouse5' };
        onSettingsChange({ ...settings, micHotkey: names[e.button] || `Mouse${e.button}` });
        setIsCapturing(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Clique com botão esquerdo cancela (apenas fecha o modo captura)
      if (e.button === 0) setIsCapturing(false);
    };

    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('mousedown', handleMouse, true);
    // Timeout de 5s para cancelar automaticamente
    const timeout = setTimeout(() => setIsCapturing(false), 5000);

    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('mousedown', handleMouse, true);
      clearTimeout(timeout);
    };
  }, [isCapturing, settings, onSettingsChange]);

  const hotkeyLabel = settings.micHotkey
    ? settings.micHotkey.replace('Mouse3', '🖱️ Botão do Meio')
                         .replace('Mouse4', '🖱️ Botão Voltar')
                         .replace('Mouse5', '🖱️ Botão Avançar')
                         .replace('Space', 'Espaço')
                         .replace('CapsLock', 'Caps Lock')
    : 'Nenhum';

  return (
    <div className="settings-section">
      {/* Volume */}
      <div className="setting-group">
        <label>Volume da Voz do Bill: {settings.voiceVolume}%</label>
        <input
          type="range"
          min="0"
          max="150"
          step="5"
          value={settings.voiceVolume}
          onChange={(e) => onSettingsChange({ ...settings, voiceVolume: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>

      {/* Seletor de Microfone */}
      <div className="setting-group" style={{ marginTop: '18px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎤 Microfone para Gravação
        </label>
        <MicrophoneSelector settings={settings} onSettingsChange={onSettingsChange} />
      </div>

      {/* Hotkey do microfone */}
      <div className="setting-group" style={{ marginTop: '18px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎤 Tecla de Ativação do Microfone
        </label>
        <small style={{ color: 'var(--text-secondary)', marginBottom: '10px', display: 'block', lineHeight: 1.5 }}>
          Segure essa tecla para gravar voz no chat. Funciona globalmente no app.
          Suporta teclas do teclado e botões extras do mouse (Mouse4, Mouse5).
        </small>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={startCapture}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '6px',
              border: isCapturing ? '2px solid var(--accent)' : '1px solid var(--border-color)',
              background: isCapturing ? 'var(--accent)' : 'var(--bg-input)',
              color: isCapturing ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.15s',
              animation: isCapturing ? 'mic-pulse 1s ease-in-out infinite' : 'none',
            }}
          >
            {isCapturing ? '🎙️ Pressione a tecla...' : (
              settings.micHotkey ? `⌨️ ${hotkeyLabel}` : '+ Definir tecla'
            )}
          </button>

          {settings.micHotkey && !isCapturing && (
            <button
              onClick={clearHotkey}
              title="Remover atalho"
              style={{
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e53e3e'; e.currentTarget.style.borderColor = '#e53e3e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
              ✕
            </button>
          )}
        </div>

        {isCapturing && (
          <small style={{ color: 'var(--accent)', marginTop: '6px', display: 'block' }}>
            Clique fora para cancelar. Aguardando por 5 segundos...
          </small>
        )}
      </div>
    </div>
  );
}
