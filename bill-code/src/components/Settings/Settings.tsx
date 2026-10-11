import { useState, useEffect } from 'react';
import { SettingsType } from '../../App';
import './Settings.css';

// ============================================
// ÁUDIO/VOZ IMPLEMENTAÇÃO - VERSÃO INLINE
// ============================================

interface SettingsPanelProps {
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}

type ApiProvider = 'ollama' | 'gemini' | 'openrouter' | 'anthropic' | 'openai' | 'custom';

interface SavedModel {
  id: string;
  name: string;       // display name
  provider: ApiProvider;
  model: string;      // model id
  apiKey?: string;
  baseUrl?: string;
  customName?: string;
}

const PROVIDER_INFO: Record<ApiProvider, { label: string; description: string }> = {
  ollama: { label: '🦙 Ollama (Local — Gratuito)', description: 'Roda modelos localmente. Requer Ollama instalado.' },
  gemini: { label: '✨ Google Gemini (Nuvem)', description: 'Modelos Gemini Pro/Flash do Google.' },
  openrouter: { label: '🌐 OpenRouter (Nuvem)', description: 'Acessa múltiplos modelos: Claude, GPT-4, Llama, etc.' },
  anthropic: { label: '🧠 Anthropic Claude (Nuvem)', description: 'Claude Sonnet, Haiku, Opus.' },
  openai: { label: '🤖 OpenAI GPT (Nuvem)', description: 'GPT-4o, GPT-4 Turbo e outros.' },
  custom: { label: '🔧 Personalizado (Custom API)', description: 'Endpoint compatível com OpenAI (LM Studio, vLLM, etc.)' },
};

const STORAGE_KEY = 'bill-saved-models';

function loadSavedModels(): SavedModel[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function persistSavedModels(models: SavedModel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

// Componente para selecionar microfone
function MicrophoneSelector({ settings, onSettingsChange }: { settings: SettingsType; onSettingsChange: (s: SettingsType) => void }) {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function loadMicrophones() {
      try {
        // Pede permissão primeiro
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // Para o stream depois de pedir permissão
        
        // Lista dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        
        console.log('[Settings] Microfones encontrados:', mics.length);
        mics.forEach((m, i) => console.log(`  ${i + 1}. ${m.label || 'Sem nome'}`));
        
        setMicrophones(mics);
        
        // Se não tem microfone selecionado, usa o primeiro
        if (!settings.selectedMicId && mics.length > 0) {
          console.log('[Settings] Selecionando microfone padrão:', mics[0].label);
          onSettingsChange({ ...settings, selectedMicId: mics[0].deviceId });
        }
      } catch (err: any) {
        console.error('[Settings] Erro ao listar microfones:', err);
        setError(err.message || 'Erro ao acessar microfones');
      } finally {
        setLoading(false);
      }
    }
    
    loadMicrophones();
  }, []); // Dependência vazia é OK aqui - só roda uma vez

  if (loading) {
    return (
      <div className="setting-row">
        <label>Microfone</label>
        <small style={{ color: 'var(--text-secondary)' }}>⏳ Carregando microfones...</small>
      </div>
    );
  }

  if (error) {
    return (
      <div className="setting-row">
        <label>Microfone</label>
        <small style={{ color: '#ef4444' }}>❌ Erro: {error}</small>
      </div>
    );
  }

  if (microphones.length === 0) {
    return (
      <div className="setting-row">
        <label>Microfone</label>
        <small style={{ color: '#ef4444' }}>❌ Nenhum microfone detectado. Verifique as permissões no Windows.</small>
      </div>
    );
  }

  return (
    <div className="setting-row">
      <label>Microfone</label>
      <select
        value={settings.selectedMicId || ''}
        onChange={(e) => onSettingsChange({ ...settings, selectedMicId: e.target.value })}
      >
        {microphones.map((mic, i) => (
          <option key={mic.deviceId} value={mic.deviceId}>
            {mic.label || `Microfone ${i + 1}`}
          </option>
        ))}
      </select>
      <small>
        🎤 Microfone usado para gravação de áudio. {microphones.length} dispositivo(s) encontrado(s).
      </small>
    </div>
  );
}

// Componente para gerenciar cache de downloads
function CacheManager() {
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const checkCache = async () => {
    setLoading(true);
    setMessage('');
    const api = (window as any).electronAPI;
    if (!api) return;
    
    const result = await api.checkDownloadCache();
    setCacheInfo(result);
    setLoading(false);
  };

  const clearCache = async () => {
    if (!confirm('Tem certeza que deseja limpar o cache de downloads do YouTube?')) return;
    
    setLoading(true);
    setMessage('');
    const api = (window as any).electronAPI;
    if (!api) return;
    
    const result = await api.clearDownloadCache();
    setLoading(false);
    
    if (result.success) {
      setMessage(`✅ ${result.message}`);
      checkCache(); // Atualiza informações
    } else {
      setMessage(`❌ Erro: ${result.error}`);
    }
  };

  useEffect(() => {
    checkCache();
  }, []);

  if (loading && !cacheInfo) {
    return <div style={{ padding: '10px', color: 'var(--text-secondary)' }}>⏳ Carregando...</div>;
  }

  if (!cacheInfo) {
    return <div style={{ padding: '10px', color: '#ef4444' }}>❌ Erro ao carregar informações do cache</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ 
        padding: '12px', 
        background: 'var(--bg-secondary)', 
        borderRadius: '6px',
        fontSize: '13px'
      }}>
        {cacheInfo.exists ? (
          <>
            <div style={{ marginBottom: '8px' }}>
              📦 <strong>{cacheInfo.count}</strong> arquivo(s) em cache
            </div>
            <div style={{ marginBottom: '8px' }}>
              💾 Tamanho total: <strong>{cacheInfo.sizeMB} MB</strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              📁 Pasta: {cacheInfo.path}
            </div>
          </>
        ) : (
          <div>✨ Nenhum cache encontrado</div>
        )}
      </div>

      {message && (
        <div style={{ 
          padding: '10px', 
          background: message.startsWith('✅') ? '#22c55e22' : '#ef444422',
          color: message.startsWith('✅') ? '#22c55e' : '#ef4444',
          borderRadius: '4px',
          fontSize: '13px'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={checkCache}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          {loading ? '⏳ Atualizando...' : '🔄 Atualizar'}
        </button>
        
        {cacheInfo.exists && cacheInfo.count > 0 && (
          <button
            onClick={clearCache}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            {loading ? '⏳ Limpando...' : '🗑️ Limpar Cache'}
          </button>
        )}
      </div>

      <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
        💡 Vídeos baixados do YouTube ficam salvos temporariamente. Limpe o cache para liberar espaço em disco.
      </small>
    </div>
  );
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
  ollama: '🦙', gemini: '✨', openrouter: '🌐', anthropic: '🧠', openai: '🤖', custom: '🔧',
};

export default function Settings({ settings, onSettingsChange }: SettingsPanelProps) {
  const update = (partial: Partial<SettingsType>) =>
    onSettingsChange({ ...settings, ...partial });

  const provider = settings.apiProvider;

  const [savedModels, setSavedModels] = useState<SavedModel[]>(loadSavedModels);
  const [saveName, setSaveName] = useState('');

  useEffect(() => { persistSavedModels(savedModels); }, [savedModels]);

  const handleSaveModel = () => {
    const modelId = getModelIdFromSettings(settings);
    const displayName = saveName.trim() || `${PROVIDER_ICON[provider]} ${modelId || provider}`;
    const newModelId = Date.now().toString();
    const entry: SavedModel = {
      id: newModelId,
      name: displayName,
      provider,
      model: modelId,
      apiKey: getApiKeyFromSettings(settings),
      baseUrl: getBaseUrlFromSettings(settings),
      customName: settings.customName,
    };
    
    // Se é o primeiro modelo sendo salvo OU não há boss definido ainda, define como IA Chefe automaticamente
    const isFirstModel = savedModels.length === 0;
    const noBossDefined = !settings.bossModelId;
    
    if (isFirstModel || (savedModels.length > 0 && noBossDefined)) {
      console.log('[Settings] Definindo primeiro modelo como IA Chefe automaticamente');
      onSettingsChange({ ...settings, bossModelId: newModelId });
    }
    
    setSavedModels(prev => [entry, ...prev]);
    setSaveName('');
  };

  const handleDeleteModel = (id: string) =>
    setSavedModels(prev => prev.filter(m => m.id !== id));

  const handleLoadModel = (m: SavedModel) => {
    const patch: Partial<SettingsType> = { apiProvider: m.provider };
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

  return (
    <div className="settings-full-panel">
      <div className="settings-full-header">
        <h2>⚙️ Configurações</h2>
      </div>

      <div className="settings-full-content">

        {/* ── Meus Modelos ── */}
        <div className="settings-section">
          <h3>⭐ Meus Modelos</h3>

          {savedModels.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Nenhum modelo salvo. Configure um provedor abaixo e clique em &quot;Salvar modelo atual&quot;.
            </p>
          )}

          {savedModels.map(m => (
            <div key={m.id} className="saved-model-item">
              <button className="saved-model-load" onClick={() => handleLoadModel(m)} title="Carregar este modelo">
                <span className="saved-model-icon">{PROVIDER_ICON[m.provider]}</span>
                <span className="saved-model-info">
                  <span className="saved-model-name">{m.name}</span>
                  <span className="saved-model-sub">{m.model}{m.baseUrl ? ` · ${m.baseUrl}` : ''}</span>
                </span>
              </button>
              <button className="saved-model-delete" onClick={() => handleDeleteModel(m.id)} title="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}

          <div className="saved-model-save-row">
            <input
              type="text"
              className="saved-model-name-input"
              placeholder="Nome (opcional)"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveModel(); }}
            />
            <button className="saved-model-save-btn" onClick={handleSaveModel}>
              + Salvar modelo atual
            </button>
          </div>
        </div>

        {/* ── Provedor ── */}
        <div className="settings-section">
          <h3>🤖 Provedor de IA</h3>

          <div className="setting-row">
            <label>Provedor ativo</label>
            <select
              value={provider}
              onChange={(e) => update({ apiProvider: e.target.value as ApiProvider })}
            >
              {(Object.keys(PROVIDER_INFO) as ApiProvider[]).map((key) => (
                <option key={key} value={key}>{PROVIDER_INFO[key].label}</option>
              ))}
            </select>
            <small>{PROVIDER_INFO[provider].description}</small>
          </div>

          {/* Ollama */}
          {provider === 'ollama' && (
            <div className="setting-row">
              <label>Modelo Ollama</label>
              <input
                type="text"
                value={settings.ollamaModel}
                onChange={(e) => update({ ollamaModel: e.target.value })}
                placeholder="gemma3:4b, codellama, mistral..."
              />
              <small>
                Instale: <code>ollama pull codellama</code> &nbsp;·&nbsp;
                Inicie: <code>ollama serve</code>
              </small>
            </div>
          )}

          {/* Gemini */}
          {provider === 'gemini' && (
            <>
              <div className="setting-row">
                <label>API Key do Gemini</label>
                <input
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => update({ geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                />
                <small>Obtenha em: <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a></small>
              </div>
              <div className="setting-row">
                <label>Modelo</label>
                <input
                  type="text"
                  value={settings.geminiModel || 'gemini-2.0-flash'}
                  onChange={(e) => update({ geminiModel: e.target.value })}
                  placeholder="gemini-2.0-flash"
                />
                <small>Ex: gemini-2.0-flash · gemini-1.5-pro · gemini-2.5-pro-preview</small>
              </div>
            </>
          )}

          {/* OpenRouter */}
          {provider === 'openrouter' && (
            <>
              <div className="setting-row">
                <label>API Key do OpenRouter</label>
                <input
                  type="password"
                  value={settings.openrouterApiKey || ''}
                  onChange={(e) => update({ openrouterApiKey: e.target.value })}
                  placeholder="sk-or-..."
                />
                <small>Obtenha em: <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a></small>
              </div>
              <div className="setting-row">
                <label>Modelo</label>
                <input
                  type="text"
                  value={settings.openrouterModel || 'meta-llama/llama-3-70b-instruct'}
                  onChange={(e) => update({ openrouterModel: e.target.value })}
                  placeholder="meta-llama/llama-3-70b-instruct"
                />
                <small>Ex: anthropic/claude-sonnet-4 · openai/gpt-4o · google/gemini-2.0-flash</small>
              </div>
              <div className="setting-row">
                <label>URL da API (opcional)</label>
                <input
                  type="text"
                  value={settings.openrouterUrl || ''}
                  onChange={(e) => update({ openrouterUrl: e.target.value })}
                  placeholder="https://openrouter.ai/api/v1/chat/completions"
                />
                <small>Deixe vazio para usar o padrão do OpenRouter</small>
              </div>
            </>
          )}

          {/* Anthropic */}
          {provider === 'anthropic' && (
            <>
              <div className="setting-row">
                <label>API Key da Anthropic</label>
                <input
                  type="password"
                  value={settings.anthropicApiKey || ''}
                  onChange={(e) => update({ anthropicApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                />
                <small>Obtenha em: <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a></small>
              </div>
              <div className="setting-row">
                <label>Modelo Claude</label>
                <input
                  type="text"
                  value={settings.anthropicModel || 'claude-sonnet-4-20250514'}
                  onChange={(e) => update({ anthropicModel: e.target.value })}
                  placeholder="claude-sonnet-4-20250514"
                />
                <small>Ex: claude-opus-4 · claude-sonnet-4-20250514 · claude-haiku-3-5</small>
              </div>
            </>
          )}

          {/* OpenAI */}
          {provider === 'openai' && (
            <>
              <div className="setting-row">
                <label>API Key da OpenAI</label>
                <input
                  type="password"
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => update({ openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <small>Obtenha em: <a href="https://platform.openai.com" target="_blank">platform.openai.com</a></small>
              </div>
              <div className="setting-row">
                <label>Modelo GPT</label>
                <input
                  type="text"
                  value={settings.openaiModel || 'gpt-4o'}
                  onChange={(e) => update({ openaiModel: e.target.value })}
                  placeholder="gpt-4o"
                />
                <small>Ex: gpt-4o · gpt-4o-mini · gpt-4-turbo · o3-mini</small>
              </div>
              <div className="setting-row">
                <label>URL base (opcional)</label>
                <input
                  type="text"
                  value={settings.openaiUrl || ''}
                  onChange={(e) => update({ openaiUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
                <small>Para compatíveis com OpenAI (LM Studio, etc.)</small>
              </div>
            </>
          )}

          {/* Custom */}
          {provider === 'custom' && (
            <>
              <div className="setting-row">
                <label>Nome do Provedor</label>
                <input
                  type="text"
                  value={settings.customName || ''}
                  onChange={(e) => update({ customName: e.target.value })}
                  placeholder="Ex: Meu Servidor, LM Studio, vLLM"
                />
                <small>Identificação visual para este provedor</small>
              </div>
              <div className="setting-row">
                <label>URL Base</label>
                <input
                  type="text"
                  value={settings.customBaseUrl || ''}
                  onChange={(e) => update({ customBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434/v1 ou http://localhost:1234/v1"
                />
                <small>Endpoint completo da API compatível com OpenAI</small>
              </div>
              <div className="setting-row">
                <label>API Key</label>
                <input
                  type="password"
                  value={settings.customApiKey || ''}
                  onChange={(e) => update({ customApiKey: e.target.value })}
                  placeholder="sk-... ou deixe vazio"
                />
                <small>Chave de autenticação (opcional)</small>
              </div>
              <div className="setting-row">
                <label>Modelo</label>
                <input
                  type="text"
                  value={settings.customModel || ''}
                  onChange={(e) => update({ customModel: e.target.value })}
                  placeholder="nome-do-modelo"
                />
                <small>Nome exato do modelo configurado no servidor</small>
              </div>
            </>
          )}
        </div>

        {/* ── Geração de Imagens IA ── */}
        <div className="settings-section">
          <h3>🎨 Geração de Imagens (Pollinations)</h3>
          <div className="setting-row">
            <label>API Key da Pollinations</label>
            <input
              type="password"
              value={settings.pollinationsApiKey || ''}
              onChange={(e) => update({ pollinationsApiKey: e.target.value })}
              placeholder="sk_... ou pk_..."
            />
            <small>
              Obrigatório para gerar imagens nos editores de foto e vídeo. Obtenha em:{' '}
              <a href="https://enter.pollinations.ai" target="_blank">enter.pollinations.ai</a>
            </small>
          </div>
        </div>

        {/* ── Web Search ── */}
        <div className="settings-section">
          <h3>🌐 Pesquisa Web</h3>
          <div className="setting-row">
            <label>Motor de busca padrão</label>
            <select
              value={settings.searchEngine || 'google'}
              onChange={(e) => update({ searchEngine: e.target.value as 'google' | 'duckduckgo' | 'brave' | 'bing' })}
            >
              <option value="google">Google</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="brave">Brave Search</option>
              <option value="bing">Bing</option>
            </select>
            <small>Motor usado no modo Web do chat</small>
          </div>
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={settings.noFilter || false}
                onChange={(e) => update({ noFilter: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              Desabilitar filtros de conteúdo
            </label>
            <small style={{ color: '#ef4444' }}>
              Remove filtros SafeSearch e blacklist de domínios. Use com responsabilidade.
            </small>
          </div>
        </div>

        {/* ── Áudio/Voz ── */}
        <div className="settings-section">
          <h3>🎤 Áudio/Voz</h3>
          
          <div className="setting-row">
            <label>Volume da voz (TTS)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.voiceVolume}
              onChange={(e) => update({ voiceVolume: parseInt(e.target.value) })}
            />
            <small>{settings.voiceVolume}%</small>
          </div>

          <div className="setting-row">
            <label>Microfone para gravação</label>
            <select
              value={settings.selectedMicId || 'default'}
              onChange={(e) => {
                const value = e.target.value === 'default' ? undefined : e.target.value;
                update({ selectedMicId: value });
              }}
            >
              <option value="default">Microfone padrão do sistema</option>
            </select>
            <small>🎤 Selecione o microfone para gravação de áudio. A lista será carregada quando você der permissão.</small>
          </div>
        </div>

        {/* ── IA Chefe ── */}
        <div className="settings-section">
          <h3>👑 IA Chefe</h3>
          
          <div className="setting-row">
            <label>IA Chefe (Gerenciamento Automático)</label>
            <select
              value={settings.bossModelId || ''}
              onChange={(e) => update({ bossModelId: e.target.value || undefined })}
            >
              <option value="">Nenhuma (desabilitado)</option>
              {(() => {
                try {
                  const models = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
                  return models.map((model: any) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ));
                } catch {
                  return null;
                }
              })()}
            </select>
            <small>👑 A IA Chefe recebe lembretes, alertas e tarefas automáticas. Aparece com uma coroa branca na lista de contatos e é usada na aba Home.</small>
          </div>
        </div>

        {/* ── Aparência ── */}
        <div className="settings-section">
          <h3>🎨 Aparência</h3>
          <div className="setting-row">
            <label>Tema</label>
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as SettingsType['theme'] })}
            >
              <option value="billeditor">🌙 Dark</option>
              <option value="facebook">☀️ Light</option>
            </select>
          </div>
        </div>

        {/* ── Atalhos ── */}
        <div className="settings-section">
          <h3>⌨️ Atalhos de Teclado</h3>
          <div className="shortcuts-table">
            {[
              ['Ctrl', 'S', 'Salvar arquivo atual'],
              ['Ctrl', '`', 'Mostrar/ocultar terminal'],
              ['Ctrl', 'P', 'Buscar arquivo (Quick Open)'],
              ['Shift', 'Enter', 'Nova linha no chat'],
              ['Enter', '', 'Enviar mensagem no chat'],
            ].map(([k1, k2, desc]) => (
              <div className="shortcut-row" key={desc}>
                <div className="shortcut-keys">
                  <kbd>{k1}</kbd>
                  {k2 && <><span>+</span><kbd>{k2}</kbd></>}
                </div>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Botão de Salvar ── */}
        <div className="settings-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px' }}>
          <button 
            className="save-settings-btn"
            onClick={() => {
              onSettingsChange(settings);
              const btn = document.querySelector('.save-settings-btn') as HTMLButtonElement;
              if (btn) {
                const originalText = btn.innerText;
                btn.innerText = '✅ CONFIGURAÇÕES SALVAS!';
                btn.style.background = '#4CAF50';
                setTimeout(() => {
                  btn.innerText = originalText;
                  btn.style.background = '';
                }, 2000);
              }
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            SALVAR CONFIGURAÇÕES
          </button>
        </div>

        {/* ── Cache e Armazenamento ── */}
        <div className="settings-section">
          <h3>🗑️ Cache e Armazenamento</h3>
          <CacheManager />
        </div>

        {/* ── Sobre ── */}
        <div className="settings-section">
          <h3>📖 Sobre</h3>
          <div className="about-info">
            <p><strong>Gabiru</strong> v1.1.0</p>
            <p>Editor de código moderno com IA integrada.</p>
            <p>Inspirado no VSCode, OpenClaude e Antigravity.</p>
            <p>Suporta: Ollama · Gemini · OpenRouter · Anthropic · OpenAI</p>
          </div>
        </div>

      </div>
    </div>
  );
}
