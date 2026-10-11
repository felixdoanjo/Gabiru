import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Bell, X, Download, Menu, Monitor, Search, LayoutGrid, Newspaper, History, Trash2 } from 'lucide-react';
import Sidebar from './components/Sidebar/Sidebar';
import CodeSidebar from './components/CodeSidebar/CodeSidebar';
import Editor from './components/Editor/Editor';
import Chat, { MouseAvatar } from './components/Chat/Chat';
import VideoEditor, { VideoEditorHandle } from './components/VideoEditor/VideoEditor';
import PhotoEditor from './components/PhotoEditor/PhotoEditor';
import HomeNewsPanel from './components/HomeNews/HomeNews';
// Importa imagens do ratinho para uso no SVG
import mouseOpenImg from '/mouse-open.png?url';
import mouseBlinkImg from '/mouse-blink.png?url';
import HomeActivityDashboard, { TerminalCard } from './components/HomeActivity/HomeActivity';
import Store from './components/Store/Store';
import ChangePreview from './components/ChangePreview/ChangePreview';
import { DependencyInstaller } from './components/DependencyInstaller/DependencyInstaller';
import ResearchPanel from './components/ResearchPanel/ResearchPanel';
import CustomPanel from './components/CustomPanel/CustomPanel';
import MyResearch from './components/MyResearch/MyResearch';
import './styles/vscode-theme.css';
import './styles/themes.css';

// Sistema de captura de logs
const capturedLogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  const logMsg = `[${timestamp}] LOG: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  capturedLogs.push(logMsg);
  if (capturedLogs.length > 500) capturedLogs.shift();
  originalLog(...args);
};

console.error = (...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  const logMsg = `[${timestamp}] ERROR: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  capturedLogs.push(logMsg);
  if (capturedLogs.length > 500) capturedLogs.shift();
  originalError(...args);
};

console.warn = (...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23);
  const logMsg = `[${timestamp}] WARN: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  capturedLogs.push(logMsg);
  if (capturedLogs.length > 500) capturedLogs.shift();
  originalWarn(...args);
};

(window as any).__getCapturedLogs = () => capturedLogs;
(window as any).__saveLogs = async () => {
  const logs = capturedLogs.join('\n');
  const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
  const filename = `debug-log-${timestamp}.txt`;
  const tempDir = await (window as any).electronAPI.executeCommand('echo %APPDATA%');
  const logPath = `${tempDir.output?.trim()}\\bill-code\\logs\\${filename}`;
  await (window as any).electronAPI.writeFile(logPath, logs);
  return logPath;
};

export interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughts?: string;
  modelColor?: string;
  modelName?: string;
  modelAvatar?: string;
  image?: string; // base64 da imagem ou URL
  imageFile?: string; // nome do arquivo original
}

// Sistema de Aprovação de Mudanças
export interface PendingChange {
  id: string;
  type: 'create' | 'edit' | 'delete' | 'rename' | 'move' | 'command';
  filePath: string;
  content?: string; // Novo conteúdo (para create/edit)
  oldContent?: string; // Conteúdo anterior (para edit)
  newPath?: string; // Para rename/move
  command?: string; // Para commands
  timestamp: number;
  reason?: string; // Por que essa mudança
}

export interface ChangeHistory {
  id: string;
  change: PendingChange;
  action: 'accepted' | 'rejected';
  timestamp: number;
}

export type ApiProvider = 'ollama' | 'gemini' | 'openrouter' | 'anthropic' | 'openai' | 'custom';

export interface SavedModel {
  id: string;
  name: string;
  provider: ApiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customName?: string;
  color?: string;
  avatar?: string;
  voice?: string; // Voz TTS específica para este modelo
  role?: 'owner' | 'manager' | 'employee'; // Cargo na equipe
}

export interface SettingsType {
  workFolder: string;
  userName?: string;
  userAvatar?: string;
  ollamaModel: string;
  ollamaModels: string[];
  apiProvider: 'ollama' | 'gemini' | 'openrouter' | 'anthropic' | 'openai' | 'custom';
  // Ollama
  ollamaUrl?: string;
  // Gemini
  geminiApiKey?: string;
  geminiModel?: string;
  // OpenRouter
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterUrl?: string;
  // Anthropic
  anthropicApiKey?: string;
  anthropicModel?: string;
  // OpenAI
  openaiApiKey?: string;
  openaiModel?: string;
  openaiUrl?: string;
  // Custom
  customName?: string;
  customBaseUrl?: string;
  customApiKey?: string;
  customModel?: string;
  // Pollinations (geração de imagens IA)
  pollinationsApiKey?: string;
  // Web Search
  searchProvider?: 'tavily' | 'google' | 'brave' | 'duckduckgo';
  tavilyApiKey?: string;
  googleApiKey?: string;
  googleCseId?: string;
  braveApiKey?: string;
  googleApiKey?: string;
  googleCx?: string;
  braveApiKey?: string;
  // Theme
  theme: 'dark' | 'claude' | 'light' | 'facebook' | 'youtube' | 'billeditor' | 'green' | 'pink' | 'rgb';
  // View state
  activeMainView?: 'home' | 'code' | 'video' | 'photo' | 'web' | 'paint' | 'stories' | 'monitor' | 'biblia' | 'pluto';
  // Voice
  voiceVolume: number;
  micHotkey?: string; // ex: 'F9', 'Mouse4', 'Mouse5', 'CapsLock'
  // Vision
  visionMode?: 'api' | 'moondream' | 'api-then-moondream' | 'moondream-then-api' | 'disabled';
  moondreamModel?: string; // modelo do Ollama para visão local (padrão: moondream)
  // Active model identity (from saved model card)
  activeModelColor?: string;
  activeModelName?: string;
  activeModelAvatar?: string;
  // Boss Model (IA Chefe)
  bossModelId?: string; // ID do modelo que é a IA Chefe
  // User Profile
  userAvatar?: string; // Foto de perfil do usuário
  userName?: string; // Nome do usuário
  userColor?: string; // Cor do perfil do usuário
}

interface ElectronAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  listDirectory: (dirPath: string) => Promise<{ success: boolean; items?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  listRecursive: (dirPath: string) => Promise<{ success: boolean; items?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
  patchFile: (filePath: string, search: string, replace: string) => Promise<{ success: boolean; error?: string }>;
  seeScreen: (mode?: 'describe' | 'ocr') => Promise<{ success: boolean; content?: string; error?: string }>;
  loadProjectMemory: (dirPath: string) => Promise<{ success: boolean; memory?: any; error?: string }>;
  saveProjectMemory: (dirPath: string, memory: any) => Promise<{ success: boolean; error?: string }>;
  executeCommand: (command: string, cwd?: string) => Promise<{ success: boolean; output?: string; exitCode?: number; error?: string }>;
  generateImage: (payload: { prompt: string; apiKey?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
  ollamaChat: (messages: any[], model: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  ollamaListModels: () => Promise<{ success: boolean; models?: Array<{ name: string }>; error?: string }>;
  ollamaStream: (messages: any[], model: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  geminiChat: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  geminiStream: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  openrouterChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  openrouterStream: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  anthropicChat: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  anthropicStream: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  openaiChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  openaiStream: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  fetchCustomModels: (url: string, key?: string) => Promise<{ success: boolean; models?: string[]; error?: string }>;
  onOllamaChunk: (callback: (chunk: string) => void) => () => void;
  onOllamaThought: (callback: (thought: string) => void) => () => void;
  onGeminiChunk: (callback: (chunk: string) => void) => () => void;
  onGeminiThought: (callback: (thought: string) => void) => () => void;
  onOpenRouterChunk: (callback: (chunk: string) => void) => () => void;
  onOpenRouterThought: (callback: (thought: string) => void) => () => void;
  onAnthropicChunk: (callback: (chunk: string) => void) => () => void;
  onAnthropicThought: (callback: (thought: string) => void) => () => void;
  onOpenAIChunk: (callback: (chunk: string) => void) => () => void;
  onOpenAIThought: (callback: (thought: string) => void) => () => void;
  processWithBill: (message: string) => void;
  onBillMessage: (callback: (content: string) => void) => () => void;
  onBillProgress: (callback: (progress: number, label: string) => void) => () => void;
  onBillBrowserOpen: (callback: (url: string, newTab: boolean) => void) => () => void;
  onBillBrowserClose: (callback: (id: any) => void) => () => void;
  onBillBrowserSwitch: (callback: (id: any) => void) => () => void;
  readSoul: () => Promise<any>;
  saveSoul: (soulData: any) => Promise<any>;
  installPlugin: (pluginId: string, url: string) => Promise<{ success: boolean; error?: string }>;
  uninstallPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  checkPluginInstalled: (pluginId: string) => Promise<{ installed: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const DEFAULT_SETTINGS: SettingsType = {
  workFolder: '',
  ollamaModel: '',
  ollamaModels: [],
  apiProvider: 'ollama',
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openrouterApiKey: '',
  openrouterModel: 'meta-llama/llama-3-70b-instruct',
  openrouterUrl: 'https://openrouter.ai/api/v1/chat/completions',
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-20250514',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  openaiUrl: 'https://api.openai.com/v1/chat/completions',
  theme: 'billeditor',
  activeMainView: 'home',
  voiceVolume: 100,
  micHotkey: '',
  visionMode: 'disabled',
  moondreamModel: 'moondream',
  customName: '',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
  pollinationsApiKey: '',
  searchProvider: 'tavily',
  tavilyApiKey: '',
  googleApiKey: '',
  googleCx: '',
  braveApiKey: '',
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Retorna o nome do modelo atual baseado no provider */
function getCurrentModelName(settings: SettingsType): string {
  switch (settings.apiProvider) {
    case 'ollama': return settings.ollamaModel || '(sem modelo)';
    case 'gemini': return settings.geminiModel || 'gemini-2.0-flash';
    case 'openrouter': return settings.openrouterModel || 'meta-llama/llama-3-70b-instruct';
    case 'anthropic': return settings.anthropicModel || 'claude-sonnet-4-20250514';
    case 'openai': return settings.openaiModel || 'gpt-4o';
    case 'custom': return settings.customModel || settings.customName || 'custom-model';
    default: return '?';
  }
}

/** Chama a IA sem streaming (para auto-correção de erros) */
async function callAINonStreaming(
  messages: Message[],
  settings: SettingsType
): Promise<string | null> {
  let result: { success: boolean; response?: any; error?: string } | undefined;

  try {
    switch (settings.apiProvider) {
      case 'ollama':
        result = await window.electronAPI.ollamaChat(messages, settings.ollamaModel);
        break;
      case 'gemini':
        result = await window.electronAPI.geminiChat(messages, settings.geminiModel || 'gemini-2.0-flash', settings.geminiApiKey || '');
        break;
      case 'openrouter':
        result = await window.electronAPI.openrouterChat(messages, settings.openrouterModel || 'meta-llama/llama-3-70b-instruct', settings.openrouterApiKey || '', settings.openrouterUrl);
        break;
      case 'anthropic':
        result = await window.electronAPI.anthropicChat(messages, settings.anthropicModel || 'claude-sonnet-4-20250514', settings.anthropicApiKey || '');
        break;
      case 'openai':
        result = await window.electronAPI.openaiChat(messages, settings.openaiModel || 'gpt-4o', settings.openaiApiKey || '');
        break;
      case 'custom':
        result = await window.electronAPI.openaiChat(messages, settings.customModel || '', settings.customApiKey || '', settings.customBaseUrl || '');
        break;
    }
  } catch (e: any) {
    console.error('[AI] Erro ao chamar IA:', e.message);
    return null;
  }

  if (result?.success && result.response?.message?.content) {
    return result.response.message.content as string;
  }
  return null;
}

// â”€â”€â”€ Componente Principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- Plugin Loader Dinâmico ---
function ensurePluginGlobals() {
  const win = window as any;
  win.React = win.React || React;
  win.ReactDOM = win.ReactDOM || ReactDOM;
  if (!win.process?.env) {
    win.process = { env: { NODE_ENV: 'production' } };
  }
}

function isReactComponent(exp: unknown): exp is React.ComponentType<any> {
  if (!exp) return false;
  if (typeof exp === 'function') return true;
  if (typeof exp === 'object' && (exp as { $$typeof?: unknown }).$$typeof) return true;
  return false;
}

function executePluginUmd(code: string) {
  const win = window as any;
  const saved = { module: win.module, exports: win.exports, define: win.define };

  try {
    // UMD detecta CommonJS/AMD e não grava em window.PaintPlugin — forçar caminho browser.
    delete win.module;
    delete win.exports;
    win.define = undefined;

    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
    script.remove();
  } finally {
    if (saved.module !== undefined) win.module = saved.module;
    else delete win.module;
    if (saved.exports !== undefined) win.exports = saved.exports;
    else delete win.exports;
    win.define = saved.define;
  }
}

function resolvePluginExport(pluginId: string) {
  const globalName = `${pluginId.charAt(0).toUpperCase() + pluginId.slice(1)}Plugin`;
  const scope = window as any;
  let exported = scope[globalName];

  if (!exported) {
    const keys = Object.keys(scope).filter(k => {
      const lower = k.toLowerCase();
      return lower.includes(pluginId.toLowerCase()) && lower.includes('plugin');
    });
    if (keys.length > 0) exported = scope[keys[0]];
  }

  if (!exported) return null;
  if (exported.default && isReactComponent(exported.default)) return exported.default;
  if (isReactComponent(exported)) return exported;
  return null;
}

function PluginLoader({ pluginId, pluginRef, fallback }: { pluginId: string, pluginRef?: React.Ref<any>, fallback?: React.ReactNode }) {
  const [Component, setComponent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugin() {
      try {
        ensurePluginGlobals();

        const appDataRes = await window.electronAPI.executeCommand('echo %APPDATA%');
        const appData = appDataRes.output?.trim();
        const pluginDir = `${appData}\\bill-code\\plugins\\${pluginId}`;
        const searchCommand = await window.electronAPI.executeCommand(`powershell -Command "Get-ChildItem -Path '${pluginDir}' -Filter '*.umd.js' -Recurse | Select-Object -First 1 -ExpandProperty FullName"`);
        
        let pluginFile = searchCommand.output?.trim();
        
        if (!pluginFile || !pluginFile.endsWith('.umd.js')) {
          throw new Error(`Nenhum arquivo compilado (.umd.js) encontrado dentro de ${pluginDir}. Você esqueceu de rodar o build ou de subir a pasta compilada no Github?`);
        }
        
        const res = await window.electronAPI.readFile(pluginFile);
        if (!res.success) {
          throw new Error(`Falha ao ler o arquivo: ${pluginFile}`);
        }

        ensurePluginGlobals();
        try {
          executePluginUmd(res.content || '');
        } catch (scriptErr: any) {
          throw new Error(`Erro ao executar plugin: ${scriptErr.message || scriptErr}`);
        }

        const exported = resolvePluginExport(pluginId);
        if (!exported) {
          throw new Error(`Plugin carregado, mas componente não encontrado em window.${pluginId.charAt(0).toUpperCase() + pluginId.slice(1)}Plugin`);
        }

        setComponent(() => exported);
      } catch (err: any) {
        console.error('Erro ao carregar plugin:', err);
        setError(err.message);
      }
    }
    loadPlugin();
  }, [pluginId]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>
        <h2>Erro ao carregar plugin: {pluginId}</h2>
        <p style={{ color: '#ef4444', marginTop: 10 }}>{error}</p>
        <p style={{ marginTop: 20 }}>Lembre-se: O Github precisa ter a versão <b>compilada (.umd.js)</b> para o Gabiru conseguir injetar a tela aqui dentro.</p>
      </div>
    );
  }

  if (!Component) {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
        <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 10 }}>Carregando plugin {pluginId}...</span>
      </div>
    );
  }

  // Renderiza passando todas as props possíveis (o plugin pode ignorá-las)
  return <Component ref={pluginRef} />;
}

type BrowserTab = { id: string; url: string; title: string; favicon?: string; pinned?: boolean; isAnonymous?: boolean };

function getFaviconFallback(url: string): string {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function faviconMatchesTab(favicon: string, tabUrl: string): boolean {
  if (favicon.startsWith('data:')) return true;
  try {
    const tabHost = getHostname(tabUrl);
    if (favicon.includes('google.com/s2/favicons')) {
      const domainParam = new URL(favicon).searchParams.get('domain') || '';
      const favHost = domainParam.replace(/^www\./, '');
      return favHost === tabHost || tabHost.endsWith('.' + favHost) || favHost.endsWith('.' + tabHost);
    }
    const faviconHost = new URL(favicon).hostname.replace(/^www\./, '');
    return faviconHost === tabHost || faviconHost.endsWith('.' + tabHost) || tabHost.endsWith('.' + faviconHost);
  } catch {
    return false;
  }
}

// ── Screenshot Editor Component ──
function ScreenshotEditor({ base64, onClose }: { base64: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgDimensions({ width: img.width, height: img.height });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
      }
    };
    img.src = `data:image/png;base64,${base64}`;
  }, [base64]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) * (imgDimensions.width / rect.width);
    const y = (e.clientY - rect.top) * (imgDimensions.height / rect.height);
    setStartPos({ x, y });
    setIsSelecting(true);
    setSelection(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPos) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) * (imgDimensions.width / rect.width);
    const y = (e.clientY - rect.top) * (imgDimensions.height / rect.height);
    
    const width = x - startPos.x;
    const height = y - startPos.y;
    
    setSelection({
      x: width < 0 ? x : startPos.x,
      y: height < 0 ? y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleSaveFull = async () => {
    const result = await (window as any).electronAPI?.saveScreenshot(base64);
    if (result?.success) {
      console.log('[Screenshot] Salvo em:', result.path);
    }
    onClose();
  };

  const handleSaveCrop = async () => {
    if (!selection || !canvasRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = selection.width;
    canvas.height = selection.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const img = new Image();
      img.onload = async () => {
        ctx.drawImage(
          img,
          selection.x, selection.y, selection.width, selection.height,
          0, 0, selection.width, selection.height
        );
        
        const croppedBase64 = canvas.toDataURL('image/png').split(',')[1];
        const result = await (window as any).electronAPI?.saveScreenshot(croppedBase64);
        if (result?.success) {
          console.log('[Screenshot] Recorte salvo em:', result.path);
        }
        onClose();
      };
      img.src = `data:image/png;base64,${base64}`;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(90vh - 80px)',
            cursor: 'crosshair',
            border: '2px solid var(--border)'
          }}
        />
        {selection && (
          <div style={{
            position: 'absolute',
            left: `${(selection.x / imgDimensions.width) * 100}%`,
            top: `${(selection.y / imgDimensions.height) * 100}%`,
            width: `${(selection.width / imgDimensions.width) * 100}%`,
            height: `${(selection.height / imgDimensions.height) * 100}%`,
            border: '2px solid #00ff00',
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
          }} />
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={handleSaveFull}
          style={{
            padding: '12px 24px',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          Salvar Tudo
        </button>
        {selection && selection.width > 10 && selection.height > 10 && (
          <button
            onClick={handleSaveCrop}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Salvar Recorte
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '12px 24px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          Cancelar
        </button>
      </div>
      
      <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '12px' }}>
        Arraste para selecionar uma área para recortar
      </div>
    </div>
  );
}

const STORAGE_KEY = 'bill-saved-models';

function loadSavedModels(): SavedModel[] {
  try { 
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); 
  } catch { 
    return []; 
  }
}

function App() {
  // Limpa históricos corrompidos ao iniciar
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      const chatKeys = keys.filter(k => k.startsWith('bill-chat-'));
      
      let cleaned = 0;
      chatKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (!data) return;
          
          const size = data.length;
          // Se maior que 500KB, é histórico corrompido
          if (size > 500 * 1024) {
            console.warn('[App] Removendo histórico corrompido (>500KB):', key, Math.round(size / 1024), 'KB');
            localStorage.removeItem(key);
            cleaned++;
            return;
          }
          
          // Histórico OK - mantém
        } catch (e) {
          console.error('[App] Erro ao verificar', key, e);
          localStorage.removeItem(key);
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        console.log('[App] ✅ Limpou', cleaned, 'chats ao iniciar');
      }
    } catch (e) {
      console.error('[App] Erro na limpeza inicial:', e);
    }
  }, []);

  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'settings'>('explorer');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [homeChatMessages, setHomeChatMessages] = useState<Message[]>([]);
  const [videoChatMessages, setVideoChatMessages] = useState<Message[]>([]);
  const [photoChatMessages, setPhotoChatMessages] = useState<Message[]>([]);
  const [paintChatMessages, setPaintChatMessages] = useState<Message[]>([]);
  const [webChatMessages, setWebChatMessages] = useState<Message[]>([]);
  // Mensagens de chats individuais (contatos/modelos salvos)
  const [contactChatMessages, setContactChatMessages] = useState<Record<string, Message[]>>({});
  const [contactChatVersion, setContactChatVersion] = useState(0); // Força re-render do Chat
  
  // LOG: Debug contactChatVersion
  useEffect(() => {
    console.log('[App] contactChatVersion mudou para:', contactChatVersion);
  }, [contactChatVersion]);
  
  // Refs para acessar os arrays de mensagens atualizados (evita closure stale)
  const chatMessagesRef = useRef<Message[]>([]);
  const homeChatMessagesRef = useRef<Message[]>([]);
  const videoChatMessagesRef = useRef<Message[]>([]);
  const photoChatMessagesRef = useRef<Message[]>([]);
  const paintChatMessagesRef = useRef<Message[]>([]);
  const webChatMessagesRef = useRef<Message[]>([]);
  
  // Sincroniza refs com estados
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { homeChatMessagesRef.current = homeChatMessages; }, [homeChatMessages]);
  useEffect(() => { videoChatMessagesRef.current = videoChatMessages; }, [videoChatMessages]);
  useEffect(() => { photoChatMessagesRef.current = photoChatMessages; }, [photoChatMessages]);
  useEffect(() => { paintChatMessagesRef.current = paintChatMessages; }, [paintChatMessages]);
  useEffect(() => { webChatMessagesRef.current = webChatMessages; }, [webChatMessages]);
  
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  
  // Helper para adicionar linha no terminal
  const addTerminal = useCallback((line: string) => {
    setTerminalOutput((prev) => [...prev, line]);
  }, []);
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [projectMemory, setProjectMemory] = useState<any>(null);
  const loadDirectory = async (dirPath: string) => {
    console.log('[App] loadDirectory chamado para:', dirPath);
    const result = await window.electronAPI.listDirectory(dirPath);
    console.log('[App] listDirectory resultado:', result);
    if (result.success && result.items) {
      console.log('[App] Arquivos carregados:', result.items.length);
      setFiles(result.items);
    } else {
      console.error('[App] Erro ao carregar arquivos:', result.error);
    }
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // SISTEMA DE APROVAÇÃO DE MUDANÇAS (Supervised Mode)
  // ═══════════════════════════════════════════════════════════════════════════
  const [supervisedMode, setSupervisedMode] = useState<boolean>(true); // true = Supervised sempre ativo
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [showChangePreview, setShowChangePreview] = useState<boolean>(false);
  const pendingChangesRef = useRef<PendingChange[]>([]);
  
  // Sincroniza ref
  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
  }, [pendingChanges]);
  
  // Adiciona uma mudança pendente (usado quando supervisedMode = true)
  const addPendingChange = useCallback((change: Omit<PendingChange, 'id' | 'timestamp'>) => {
    const newChange: PendingChange = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    setPendingChanges(prev => [...prev, newChange]);
    // setShowChangePreview(true); // REMOVIDO - botões agora no chat
    return newChange.id;
  }, []);
  
  // Aceita uma mudança
  const acceptChange = useCallback(async (changeId: string) => {
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;
    
    // Executa a mudança
    try {
      switch (change.type) {
        case 'create':
        case 'edit':
          if (change.content !== undefined) {
            await window.electronAPI.writeFile(change.filePath, change.content);
            addTerminal(`✅ Arquivo ${change.type === 'create' ? 'criado' : 'editado'}: ${change.filePath}`);
            loadDirectory(settings.workFolder);
            if (change.type === 'edit' && selectedFile === change.filePath) {
              setFileContent(change.content);
            }
          }
          break;
          
        case 'delete':
          await window.electronAPI.executeCommand(`del "${change.filePath}"`, settings.workFolder);
          addTerminal(`✅ Arquivo deletado: ${change.filePath}`);
          loadDirectory(settings.workFolder);
          if (selectedFile === change.filePath) {
            setSelectedFile(null);
            setFileContent('');
          }
          break;
          
        case 'rename':
        case 'move':
          if (change.newPath) {
            await window.electronAPI.executeCommand(`move "${change.filePath}" "${change.newPath}"`, settings.workFolder);
            addTerminal(`✅ Arquivo ${change.type === 'rename' ? 'renomeado' : 'movido'}: ${change.newPath}`);
            loadDirectory(settings.workFolder);
          }
          break;
          
        case 'command':
          if (change.command) {
            addTerminal(`$ ${change.command}`);
            const result = await window.electronAPI.executeCommand(change.command, settings.workFolder);
            if (result.output) addTerminal(result.output);
            if (result.exitCode === 0) {
              addTerminal('✅ Comando executado com sucesso!');
            }
          }
          break;
      }
      
      // Adiciona ao histórico
      setChangeHistory(prev => [...prev, {
        id: `history-${Date.now()}`,
        change,
        action: 'accepted',
        timestamp: Date.now()
      }]);
      
      // Remove das pendentes
      setPendingChanges(prev => prev.filter(c => c.id !== changeId));
      
    } catch (error: any) {
      addTerminal(`❌ Erro ao aplicar mudança: ${error.message}`);
    }
  }, [pendingChanges, settings.workFolder, selectedFile, addTerminal, loadDirectory]);
  
  // Rejeita uma mudança
  const rejectChange = useCallback((changeId: string) => {
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;
    
    addTerminal(`🚫 Mudança rejeitada: ${change.filePath}`);
    
    // Adiciona ao histórico
    setChangeHistory(prev => [...prev, {
      id: `history-${Date.now()}`,
      change,
      action: 'rejected',
      timestamp: Date.now()
    }]);
    
    // Remove das pendentes
    setPendingChanges(prev => prev.filter(c => c.id !== changeId));
  }, [pendingChanges, addTerminal]);
  
  // Aceita todas as mudanças
  const acceptAllChanges = useCallback(async () => {
    for (const change of pendingChanges) {
      await acceptChange(change.id);
    }
  }, [pendingChanges, acceptChange]);
  
  // Rejeita todas as mudanças
  const rejectAllChanges = useCallback(() => {
    pendingChanges.forEach(change => rejectChange(change.id));
  }, [pendingChanges, rejectChange]);

  
  // Sistema de streaming por modelo (permite múltiplos streams simultâneos)
  const [streamingModels, setStreamingModels] = useState<Record<string, { isStreaming: boolean; modelName: string }>>({});
  
  // Função auxiliar para verificar se um modelo específico está streaming
  const isModelStreaming = (modelId: string) => streamingModels[modelId]?.isStreaming || false;
  const getStreamingModelName = (modelId: string) => streamingModels[modelId]?.modelName || '';
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTokens, setStreamingTokens] = useState(0);
  const [streamingMode, setStreamingMode] = useState<string>('');
  const lastStreamingTokensRef = useRef(0);
  // Token bars â€” fora do Chat para persistir entre trocas de aba
  const [tokenBars, setTokenBars] = useState<Array<{ id: number; tokens: number; growing: boolean }>>([]);
  const cancelStreamRef = useRef<boolean>(false);
  const unsubStreamRef = useRef<(() => void) | null>(null);
  const streamIdRef = useRef<number>(0);
  
  // Map de buffers por chatId para permitir m�ltiplos streams simult�neos
  const chatBuffersRef = useRef<Map<string, Message[]>>(new Map());
  
  // Expõe função global para limpar buffer de chat (usado pelo endCall)
  useEffect(() => {
    (window as any).clearChatBuffer = (chatId: string, cleanedMessages: Message[]) => {
      if (chatBuffersRef.current && chatBuffersRef.current.has(chatId)) {
        chatBuffersRef.current.set(chatId, cleanedMessages);
        console.log('[App] Buffer limpo para chat:', chatId, 'mensagens restantes:', cleanedMessages.length);
      }
    };
    return () => {
      delete (window as any).clearChatBuffer;
    };
  }, []);
  
  // Listener para deletar mensagem do buffer quando Chat.tsx dispara o evento
  useEffect(() => {
    const handleDeleteMessage = (e: CustomEvent) => {
      const { chatId, messageIndex } = e.detail;
      console.log('[App] Recebeu evento bill-delete-message, chatId:', chatId, 'índice:', messageIndex);
      
      if (chatBuffersRef.current && chatBuffersRef.current.has(chatId)) {
        const currentBuffer = chatBuffersRef.current.get(chatId) || [];
        const updated = currentBuffer.filter((_, i) => i !== messageIndex);
        chatBuffersRef.current.set(chatId, updated);
        console.log('[App] Mensagem deletada do buffer em memória, antes:', currentBuffer.length, 'depois:', updated.length);
        
        // Também atualiza o estado React correspondente
        setContactChatMessages(prev => ({
          ...prev,
          [chatId]: updated
        }));
        
        // Força re-render
        setContactChatVersion(v => v + 1);
      }
    };
    
    window.addEventListener('bill-delete-message', handleDeleteMessage as EventListener);
    return () => window.removeEventListener('bill-delete-message', handleDeleteMessage as EventListener);
  }, []);
  
  // Ref para armazenar o activeChat atual (para usar em listeners globais como speech)
  const activeChatRef = useRef<string | null>(null);
  // â”€â”€ Terminal Agent (comunicação multi-agente pelo terminal da Home) â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [terminalAgent, setTerminalAgent] = useState<'code' | 'video' | 'photo' | 'web' | null>(null);
  const terminalAgentRef = useRef<string | null>(null);
  useEffect(() => { terminalAgentRef.current = terminalAgent; }, [terminalAgent]);
  const [reminderNotification, setReminderNotification] = useState<{ title: string; time: string } | null>(null);
  // Estado para chamada recebida de lembrete
  const [incomingReminderCall, setIncomingReminderCall] = useState<{ title: string; time: string; notes?: string; id: string } | null>(null);
  const [showNewsPanel, setShowNewsPanel] = useState(true);
  const [newsFullScreen, setNewsFullScreen] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'normal' | 'fullscreen' | 'floating'>('normal');
  // â”€â”€ Floating terminal â€” drag + resize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [floatPos, setFloatPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 504) : 0,
    y: typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 424) : 0,
  }));
  const [floatSize, setFloatSize] = useState({ w: 480, h: 400 });
  const floatRef = useRef<{
    mode: 'idle' | 'drag' | 'resize';
    dir: string;
    mx0: number; my0: number;
    x0: number; y0: number;
    w0: number; h0: number;
  }>({ mode: 'idle', dir: '', mx0: 0, my0: 0, x0: 0, y0: 0, w0: 0, h0: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = floatRef.current;
      if (r.mode === 'idle') return;
      const dx = e.clientX - r.mx0, dy = e.clientY - r.my0;
      if (r.mode === 'drag') {
        setFloatPos({ x: Math.max(0, r.x0 + dx), y: Math.max(0, r.y0 + dy) });
      } else {
        const { dir, w0, h0, x0, y0 } = r;
        let nw = w0, nh = h0, nx = x0, ny = y0;
        if (dir.includes('e')) nw = Math.max(280, w0 + dx);
        if (dir.includes('w')) { nw = Math.max(280, w0 - dx); nx = x0 + w0 - nw; }
        if (dir.includes('s')) nh = Math.max(200, h0 + dy);
        if (dir.includes('n')) { nh = Math.max(200, h0 - dy); ny = y0 + h0 - nh; }
        setFloatSize({ w: nw, h: nh });
        if (dir.includes('w') || dir.includes('n')) setFloatPos({ x: nx, y: ny });
      }
    };
    const onUp = () => { floatRef.current.mode = 'idle'; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  const startFloatDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    floatRef.current = { mode: 'drag', dir: '', mx0: e.clientX, my0: e.clientY, x0: floatPos.x, y0: floatPos.y, w0: floatSize.w, h0: floatSize.h };
  };
  const startFloatResize = (e: React.MouseEvent, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    document.body.style.userSelect = 'none';
    floatRef.current = { mode: 'resize', dir, mx0: e.clientX, my0: e.clientY, x0: floatPos.x, y0: floatPos.y, w0: floatSize.w, h0: floatSize.h };
  };

  const cancelStream = () => {
    cancelStreamRef.current = true;
    if (unsubStreamRef.current) { unsubStreamRef.current(); unsubStreamRef.current = null; }
    setIsStreaming(false);
    // Remove mensagem vazia ou parcial da IA
    setChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
    setHomeChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
    setVideoChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
    setPhotoChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
    setPaintChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
    setWebChatMessages(prev => { const last = prev[prev.length-1]; return (last?.role === 'assistant' && !last.content) ? prev.slice(0,-1) : prev; });
  };
  const [activeMainView, setActiveMainView] = useState<'home' | 'code' | 'video' | 'photo' | 'web' | 'paint' | 'stories' | 'monitor' | 'biblia' | 'pluto' | 'news'>(() => 'home'); // Sempre inicia na home
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());
  const [showDependencyInstaller, setShowDependencyInstaller] = useState(false);
  const [dependenciesInstalled, setDependenciesInstalled] = useState(false);

  // Verifica dependências na primeira vez que o app abre
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const result = await (window as any).electronAPI.checkRuntimeInstalled();
        setDependenciesInstalled(result.installed);
        
        // Se não estiver instalado, mostra o modal bloqueante
        if (!result.installed) {
          setShowDependencyInstaller(true);
        }
      } catch (error) {
        console.error('Erro ao verificar dependências:', error);
      }
    };
    checkFirstRun();
  }, []);

  useEffect(() => {
    const checkPlugins = async () => {
      try {
        const res = await window.electronAPI?.checkPluginInstalled('paint');
        setInstalledPlugins(prev => {
          const next = new Set(prev);
          if (res?.installed) next.add('paint');
          else next.delete('paint');
          return next;
        });
      } catch (e) {}
    };
    checkPlugins();
    const interval = setInterval(checkPlugins, 2000);
    return () => clearInterval(interval);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [codeSidebarCollapsed, setCodeSidebarCollapsed] = useState(true);
  
  const [gamingMode, setGamingMode] = useState(false);
  const [gamingMini, setGamingMini] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [selectedHtmlElement, setSelectedHtmlElement] = useState<any>(null);
  const [activeProject, setActiveProject] = useState<{ id: string; name: string; description: string; blockType: string; deadline?: string; deadlineTime?: string; workFolder?: string; saveId?: string } | null>(null);
  const [projectMetadata, setProjectMetadata] = useState<{
    name: string;
    platform: string;
    referenceUrl: string | null;
    referenceFidelity: 'inspiration' | 'exact';
    referenceImage: string | null;
    scrapedData: any;
    createdAt: number;
  } | null>(null);
  
  // Auto-abre index.html quando Design é ativado pela primeira vez
  useEffect(() => {
    const autoOpenIndexHtml = async () => {
      // Se Design foi ativado e não há arquivo HTML aberto
      if (showDesignPreview && settings.workFolder) {
        const currentExt = selectedFile?.split('.').pop()?.toLowerCase() || '';
        const isHtmlOpen = ['html', 'htm'].includes(currentExt);
        
        // Se já tem um HTML aberto, não faz nada
        if (isHtmlOpen) return;
        
        // Procura por index.html na pasta do projeto
        const indexPath = settings.workFolder + (settings.workFolder.endsWith('\\') ? '' : '\\') + 'index.html';
        
        try {
          const result = await window.electronAPI.readFile(indexPath);
          if (result.success && result.content !== undefined) {
            console.log('[App] 📄 Abrindo index.html automaticamente');
            setSelectedFile(indexPath);
            setFileContent(result.content);
          }
        } catch (err) {
          // Se não encontrou index.html, não faz nada (silencioso)
          console.log('[App] index.html não encontrado no projeto');
        }
      }
    };
    
    autoOpenIndexHtml();
  }, [showDesignPreview, settings.workFolder]); // Não inclui selectedFile para evitar loop
  
  // Contador de mensagens para resumo automático
  const messageCountSinceLastSummaryRef = useRef<number>(0);
  const isGeneratingSummaryRef = useRef<boolean>(false);
  
  // Função para adicionar nota ao projeto ativo (com debounce para evitar lag)
  const addProjectNoteTimeoutRef = useRef<number | null>(null);
  const addProjectNote = useCallback((noteText: string) => {
    if (!activeProject) {
      console.log('[App] addProjectNote: Nenhum projeto ativo');
      return;
    }
    
    console.log('[App] addProjectNote chamado:', noteText, 'para projeto:', activeProject.name);
    
    // Cancela timer anterior se existir
    if (addProjectNoteTimeoutRef.current) {
      clearTimeout(addProjectNoteTimeoutRef.current);
    }
    
    // Debounce de 1 segundo para evitar múltiplas escritas
    addProjectNoteTimeoutRef.current = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('bill-plans');
        if (!saved) {
          console.log('[App] Nenhum plano encontrado no localStorage');
          return;
        }
        
        const plans = JSON.parse(saved);
        let updated = false;
        
        const updatedPlans = plans.map((plan: any) => {
          const updatedBlocks = plan.blocks.map((block: any) => {
            if (block.id === activeProject.id) {
              updated = true;
              const notes = block.notes || [];
              notes.push({ timestamp: Date.now(), text: noteText });
              console.log('[App] Nota adicionada. Total de notas:', notes.length);
              return { ...block, notes, projectStarted: true };
            }
            return block;
          });
          return { ...plan, blocks: updatedBlocks };
        });
        
        if (updated) {
          localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
          console.log('[App] Plano atualizado e salvo no localStorage');
          // Dispara evento customizado para notificar HomePlanner
          window.dispatchEvent(new CustomEvent('plans-updated'));
        } else {
          console.log('[App] Bloco não encontrado para adicionar nota');
        }
      } catch (err) {
        console.error('[App] Erro ao adicionar nota:', err);
      }
    }, 1000);
  }, [activeProject]);
  
  // Função para carregar projeto por ID
  const loadProjectById = useCallback(async (projectId: string, projectType: string, workFolder?: string) => {
    console.log('[App] loadProjectById chamado:', projectId, projectType, 'workFolder:', workFolder);
    
    // PRIMEIRO: Garante que o bloco tenha um saveId único E pega todos os dados do bloco
    let blockData: any = null;
    try {
      const saved = localStorage.getItem('bill-plans');
      if (saved) {
        const plans = JSON.parse(saved);
        let needsUpdate = false;
        
        const updatedPlans = plans.map((plan: any) => {
          const updatedBlocks = plan.blocks.map((block: any) => {
            if (block.id === projectId) {
              if (!block.saveId) {
                needsUpdate = true;
                block.saveId = `save_${projectId}_${Date.now()}`;
                console.log('[App] Criando saveId para bloco:', block.saveId);
              }
              // Salva referência completa do bloco
              blockData = { ...block };
            }
            return block;
          });
          return { ...plan, blocks: updatedBlocks };
        });
        
        if (needsUpdate) {
          localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
          window.dispatchEvent(new CustomEvent('plans-updated'));
        }
      }
    } catch (err) {
      console.error('[App] Erro ao gerenciar saveId:', err);
    }
    
    // SEGUNDO: Seta o activeProject com TODOS os dados incluindo saveId
    if (blockData) {
      console.log('[App] Setando activeProject com saveId:', blockData.saveId);
      setActiveProject({
        id: blockData.id,
        name: blockData.label,
        description: blockData.description,
        blockType: blockData.type,
        deadline: blockData.deadline,
        deadlineTime: blockData.deadlineTime,
        workFolder: blockData.workFolder || workFolder,
        saveId: blockData.saveId
      });
    }
    
    // TERCEIRO: Se tem workFolder definido no bloco, carrega ele
    const targetWorkFolder = blockData?.workFolder || workFolder;
    if (targetWorkFolder) {
      console.log('[App] Carregando workFolder:', targetWorkFolder);
      setSettings((prev) => ({ ...prev, workFolder: targetWorkFolder }));
      loadDirectory(targetWorkFolder);
      // Carregar memória do projeto
      const mRes = await window.electronAPI.loadProjectMemory(targetWorkFolder);
      if (mRes.success && mRes.memory) {
        setProjectMemory(mRes.memory);
      }
    }
    
    // QUARTO: Muda para a aba correta
    if (projectType === 'photo') {
      console.log('[App] Mudando para aba photo');
      setActiveMainView('photo');
    } else if (projectType === 'paint') {
      console.log('[App] Mudando para aba paint');
      setActiveMainView('paint');
    } else if (projectType === 'video') {
      console.log('[App] Mudando para aba video');
      setActiveMainView('video');
    } else if (projectType === 'code') {
      console.log('[App] Mudando para aba code');
      setActiveMainView('code');
    } else if (projectType === 'web') {
      console.log('[App] Mudando para aba web');
      setActiveMainView('web');
    }
  }, []);
  
  // Função para atualizar preview do projeto ativo
  const updateProjectPreview = useCallback((previewDataUrl: string) => {
    if (!activeProject) {
      console.log('[App] updateProjectPreview: Nenhum projeto ativo');
      return;
    }
    
    console.log('[App] ========================================');
    console.log('[App] updateProjectPreview CHAMADO');
    console.log('[App] Projeto:', activeProject.name);
    console.log('[App] Projeto blockType:', activeProject.blockType);
    console.log('[App] activeMainView:', activeMainView);
    console.log('[App] Preview tamanho:', previewDataUrl.length);
    
    // IMPORTANTE: Só atualiza preview se o tipo do projeto bate com a view ativa
    const isPhotoMode = activeMainView === 'photo';
    const isPaintMode = activeMainView === 'paint';
    const isVideoMode = activeMainView === 'video';
    const isPhotoProject = activeProject.blockType === 'photo';
    const isPaintProject = activeProject.blockType === 'paint';
    const isVideoProject = activeProject.blockType === 'video';
    
    if (isPhotoMode && !isPhotoProject) {
      console.log('[App] ❌ IGNORADO: PhotoEditor tentou atualizar preview de projeto tipo:', activeProject.blockType);
      return;
    }
    if (isPaintMode && !isPaintProject) {
      console.log('[App] ❌ IGNORADO: Paint tentou atualizar preview de projeto tipo:', activeProject.blockType);
      return;
    }
    if (isVideoMode && !isVideoProject) {
      console.log('[App] ❌ IGNORADO: VideoEditor tentou atualizar preview de projeto tipo:', activeProject.blockType);
      return;
    }
    
    console.log('[App] ✅ VALIDAÇÃO PASSOU - Atualizando preview');
    
    try {
      const saved = localStorage.getItem('bill-plans');
      if (!saved) return;
      
      const plans = JSON.parse(saved);
      let updated = false;
      
      const updatedPlans = plans.map((plan: any) => {
        const updatedBlocks = plan.blocks.map((block: any) => {
          if (block.id === activeProject.id) {
            updated = true;
            console.log('[App] ✅ Preview atualizado para bloco:', block.label);
            return { ...block, preview: previewDataUrl };
          }
          return block;
        });
        return { ...plan, blocks: updatedBlocks };
      });
      
      if (updated) {
        localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
        window.dispatchEvent(new CustomEvent('plans-updated'));
        console.log('[App] ✅ Preview salvo no localStorage e evento disparado');
      } else {
        console.log('[App] ❌ Bloco não encontrado para atualizar preview');
      }
    } catch (err) {
      console.error('[App] Erro ao atualizar preview:', err);
    }
    console.log('[App] ========================================');
  }, [activeProject, activeMainView]);
  
  // Marca projeto como iniciado quando ativado
  useEffect(() => {
    if (!activeProject) return;
    
    try {
      const saved = localStorage.getItem('bill-plans');
      if (!saved) return;
      
      const plans = JSON.parse(saved);
      let needsUpdate = false;
      
      const updatedPlans = plans.map((plan: any) => {
        const updatedBlocks = plan.blocks.map((block: any) => {
          if (block.id === activeProject.id && !block.projectStarted) {
            needsUpdate = true;
            console.log('[App] Marcando projeto como iniciado:', block.label);
            return { ...block, projectStarted: true };
          }
          return block;
        });
        return { ...plan, blocks: updatedBlocks };
      });
      
      if (needsUpdate) {
        localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
        // Debounce: só adiciona nota uma vez
        const timer = setTimeout(() => {
          addProjectNote('Projeto iniciado');
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.error('[App] Erro ao marcar projeto como iniciado:', err);
    }
  }, [activeProject]);
  
  // Gera resumo automático da conversa a cada 5 mensagens
  useEffect(() => {
    if (!activeProject) return;
    
    const activeMainViewRef = settingsRef.current.activeMainView || 'home';
    let messages: Message[] = [];
    
    if (activeMainViewRef === 'paint') messages = paintChatMessages;
    else if (activeMainViewRef === 'photo') messages = photoChatMessages;
    else if (activeMainViewRef === 'video') messages = videoChatMessages;
    else if (activeMainViewRef === 'web') messages = webChatMessages;
    else if (activeMainViewRef === 'code') messages = chatMessages;
    else messages = homeChatMessages;
    
    // Conta apenas mensagens do usuário
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Se chegou a 5 mensagens do usuário desde o último resumo, gera um novo
    if (userMessages.length > 0 && userMessages.length % 5 === 0 && !isGeneratingSummaryRef.current) {
      const currentCount = userMessages.length;
      
      // Evita gerar resumo duplicado
      if (currentCount === messageCountSinceLastSummaryRef.current) return;
      
      console.log('[App] 🤖 Gerando resumo automático da conversa...');
      isGeneratingSummaryRef.current = true;
      messageCountSinceLastSummaryRef.current = currentCount;
      
      // Pega as últimas 5 mensagens (usuário + IA)
      const recentMessages = messages.slice(-10);
      const conversationText = recentMessages
        .map(m => `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`)
        .join('\n');
      
      // Gera resumo via IA
      const summaryPrompt = `Você é um assistente que resume conversas de forma concisa.

Analise esta conversa recente e crie UM ÚNICO resumo em português de NO MÁXIMO 60 caracteres descrevendo o que foi discutido/feito:

${conversationText}

REGRAS ESTRITAS:
- Máximo 60 caracteres
- Foco em AÇÕES e DECISÕES concretas
- Use verbos no passado
- Seja específico (não genérico)
- Responda APENAS o resumo, sem explicações

Exemplos de BOM resumo:
"Ajustou cores e adicionou sombra no texto"
"Discutiu ideias para logo da empresa"
"Pediu ajuda com animação de personagem"

Exemplos de resumo RUIM:
"Conversou sobre o projeto" (muito vago)
"Falou sobre edição" (não específico)`;

      callAINonStreaming([{ role: 'user', content: summaryPrompt }], settingsRef.current)
        .then(summary => {
          if (summary && summary.trim()) {
            const cleanSummary = summary.trim().replace(/^["']|["']$/g, '').slice(0, 60);
            console.log('[App] 📝 Resumo gerado:', cleanSummary);
            addProjectNote(cleanSummary);
          }
        })
        .catch(err => console.error('[App] Erro ao gerar resumo:', err))
        .finally(() => {
          isGeneratingSummaryRef.current = false;
        });
    }
  }, [paintChatMessages, photoChatMessages, videoChatMessages, webChatMessages, chatMessages, homeChatMessages, activeProject, addProjectNote]);
  
  // Debug: rastreia mudanças no activeProject
  useEffect(() => {
    console.log('[App] Estado activeProject mudou:', activeProject);
  }, [activeProject]);
  const gamingMiniRef = useRef(false);
  const [miniIconBlink, setMiniIconBlink] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [miniIconDragging, setMiniIconDragging] = useState(false);
  const [miniIconPos, setMiniIconPos] = useState({ x: 0, y: 0 });
  const miniDragRef = useRef({ startX: 0, startY: 0, moved: false });
  const [currentActivity, setCurrentActivity] = useState<{ app: string; title: string } | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);

  // Mantém ref sincronizada
  useEffect(() => {
    gamingMiniRef.current = gamingMini;
  }, [gamingMini]);

  // Monitora atividade (jogo/app ativo)
  useEffect(() => {
    // Pega atividade inicial
    (window as any).electronAPI.getCurrentActivity?.().then((activity: any) => {
      if (activity) setCurrentActivity(activity);
    });
    
    // Escuta mudanças
    const unsub = (window as any).electronAPI.onActivityChanged?.((activity: any) => {
      setCurrentActivity(activity);
    });
    
    return () => unsub?.();
  }, []);

  // Quando mini: aplica fundo escuro
  useEffect(() => {
    if (gamingMini) {
      document.body.classList.add('gaming-mini-active');
      document.documentElement.classList.add('gaming-mini-active');
      document.body.style.background = '#1a1a1a';
      document.documentElement.style.background = '#1a1a1a';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('gaming-mini-active');
      document.documentElement.classList.remove('gaming-mini-active');
      document.body.style.background = '';
      document.documentElement.style.background = '';
      document.body.style.overflow = '';
    }
  }, [gamingMini]);

  // Quando mini: ativa/desativa mouse events baseado se está no círculo do ícone
  useEffect(() => {
    if (!gamingMini) return;
    const handler = (e: MouseEvent) => {
      const size = 48;
      const cx = size / 2;
      const cy = size / 2;
      const dist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));
      const inside = dist <= size / 2;
      (window as any).electronAPI.setIgnoreMouseEvents(!inside);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [gamingMini]);

  // Animação do ícone mini: piscar aleatório
  useEffect(() => {
    if (!gamingMini) return;
    const blink = () => {
      setMiniIconBlink(true);
      setTimeout(() => setMiniIconBlink(false), 150);
    };
    const randomBlink = () => {
      blink();
      const next = 2000 + Math.random() * 3000;
      return setTimeout(randomBlink, next);
    };
    const timer = randomBlink();
    return () => clearTimeout(timer);
  }, [gamingMini]);
  
  const addToTerminal = (line: string) => {
    setTerminalOutput(prev => [...prev, line]);
  };
  // Ref para o VideoEditor â€” permite o AI controlar o editor diretamente
  const videoEditorRef = useRef<VideoEditorHandle>(null);
  // Ref para o PhotoEditor â€” permite o AI controlar o editor diretamente
  const photoEditorRef = useRef<any>(null);
  // Ref para o Paint â€” permite o AI controlar o paint diretamente
  const paintRef = useRef<any>(null);
  // Ref para conteúdo da página web atual (para o Bill Web resumir/analisar)
  const webPageContentRef = useRef<string>('');
  // Ref para última imagem clicada no webview (para send-to-photo-editor sem URL)
  const lastClickedImageRef = useRef<string>('');
  // Ref para o input da barra de URL do navegador
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([
    { id: Date.now().toString(), url: 'https://www.google.com', title: 'Google' }
  ]);
  const [showWebMenu, setShowWebMenu] = useState(false);
  
  // Estados para Histórico de Navegação
  const [showBrowserHistory, setShowBrowserHistory] = useState(false);
  const [browserHistory, setBrowserHistory] = useState<Array<{url: string; title: string; timestamp: number}>>(() => {
    try {
      const saved = localStorage.getItem('billcode_browser_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Estados para Atalhos Personalizados
  const [customShortcuts, setCustomShortcuts] = useState<Array<{id: string; name: string; url: string; favicon?: string}>>(() => {
    try {
      const saved = localStorage.getItem('billcode_custom_shortcuts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddShortcut, setShowAddShortcut] = useState(false);
  const [shortcutName, setShortcutName] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');
  
  // Estados para Video Downloader
  const [showVideoDownloader, setShowVideoDownloader] = useState(false);
  const [videoDownloadUrl, setVideoDownloadUrl] = useState('');
  const [videoFormats, setVideoFormats] = useState<any[]>([]);
  const [isLoadingFormats, setIsLoadingFormats] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [videoDownloadPath, setVideoDownloadPath] = useState<string>('');
  const [videoDownloadStatus, setVideoDownloadStatus] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Estados para Downloads Manager
  const [showDownloadsManager, setShowDownloadsManager] = useState(false);
  const [downloadsList, setDownloadsList] = useState<Array<{
    id: string;
    filename: string;
    url: string;
    path: string;
    totalBytes: number;
    receivedBytes: number;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    startTime: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('bill-downloads-list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Salva downloads no localStorage quando mudar
  useEffect(() => {
    try {
      localStorage.setItem('bill-downloads-list', JSON.stringify(downloadsList));
    } catch (error) {
      console.error('[Downloads] Erro ao salvar:', error);
    }
  }, [downloadsList]);
  
  // Listener para atualizações de download
  useEffect(() => {
    const handleDownloadUpdate = (_: any, downloadInfo: any) => {
      setDownloadsList(prev => {
        const existing = prev.findIndex(d => d.id === downloadInfo.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = downloadInfo;
          return updated;
        } else {
          return [downloadInfo, ...prev];
        }
      });
    };
    
    if ((window as any).electronAPI?.onDownloadUpdate) {
      (window as any).electronAPI.onDownloadUpdate(handleDownloadUpdate);
    }
    
    return () => {
      if ((window as any).electronAPI?.removeDownloadListener) {
        (window as any).electronAPI.removeDownloadListener(handleDownloadUpdate);
      }
    };
  }, []);
  
  // Estados para Tradutor
  const [showTranslator, setShowTranslator] = useState(false);
  const [translateText, setTranslateText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translateFrom, setTranslateFrom] = useState('en');
  const [translateTo, setTranslateTo] = useState('pt-br');
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Menu de contexto personalizado para seleção de texto
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  
  // Função para adicionar ao histórico
  const addToHistory = (url: string, title: string) => {
    const newEntry = { url, title, timestamp: Date.now() };
    const updated = [newEntry, ...browserHistory.filter(h => h.url !== url)].slice(0, 30); // Mantém últimos 30, remove duplicatas
    setBrowserHistory(updated);
    localStorage.setItem('billcode_browser_history', JSON.stringify(updated));
  };
  
  // Função para adicionar atalho
  const addCustomShortcut = () => {
    if (!shortcutName.trim() || !shortcutUrl.trim()) return;
    
    let url = shortcutUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      const urlObj = new URL(url);
      const favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
      
      const newShortcut = {
        id: Date.now().toString(),
        name: shortcutName.trim(),
        url: url,
        favicon: favicon
      };
      
      const updated = [...customShortcuts, newShortcut];
      setCustomShortcuts(updated);
      localStorage.setItem('billcode_custom_shortcuts', JSON.stringify(updated));
      
      // Limpa e fecha
      setShortcutName('');
      setShortcutUrl('');
      setShowAddShortcut(false);
    } catch (err) {
      console.error('URL inválida:', err);
    }
  };
  
  // Função para remover atalho
  const removeCustomShortcut = (id: string) => {
    const updated = customShortcuts.filter(s => s.id !== id);
    setCustomShortcuts(updated);
    localStorage.setItem('billcode_custom_shortcuts', JSON.stringify(updated));
  };

  
  // Estados para Pesquisa Avançada
  const [webMenuView, setWebMenuView] = useState<'main' | 'advanced-search' | 'panel' | 'panel-history'>('main');
  const [searchType, setSearchType] = useState<'auto' | 'custom' | null>(null);
  const [selectedSearchModel, setSelectedSearchModel] = useState<SavedModel | null>(null);
  const [selectedSearchProvider, setSelectedSearchProvider] = useState<'tavily' | 'google' | 'brave' | 'duckduckgo' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customSearchUrls, setCustomSearchUrls] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>(() => {
    // Carrega criativos salvos do localStorage na inicialização
    try {
      const saved = localStorage.getItem('billcode_custom_panels');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('[Criativos] Erro ao carregar criativos:', e);
      return [];
    }
  });
  const [selectedResearch, setSelectedResearch] = useState<any | null>(null); // Criativo selecionado para exibir no painel
  const [showCustomPanel, setShowCustomPanel] = useState(false); // Controla visualização do painel customizado
  const [showMyResearch, setShowMyResearch] = useState(false); // Controla visualização de Minhas Pesquisas
  
  // Atualiza lista de criativos sempre que mudar (re-carrega do localStorage)
  useEffect(() => {
    const updateCreatives = async () => {
      try {
        // Carrega do localStorage
        const saved = localStorage.getItem('billcode_custom_panels');
        let panels = saved ? JSON.parse(saved) : [];
        
        // Se usa IndexedDB, carrega também de lá
        const usesIndexedDB = localStorage.getItem('billcode_uses_indexeddb');
        if (usesIndexedDB === 'true') {
          try {
            const dbPanels = await loadFromIndexedDB();
            // Mescla os dois (IndexedDB tem prioridade para itens com mesmo ID)
            const allPanels = [...panels];
            dbPanels.forEach((dbPanel: any) => {
              const existingIndex = allPanels.findIndex((p: any) => p.id === dbPanel.id);
              if (existingIndex >= 0) {
                allPanels[existingIndex] = dbPanel; // Substitui
              } else {
                allPanels.push(dbPanel); // Adiciona
              }
            });
            panels = allPanels;
            console.log('[Criativos] Carregados do IndexedDB:', dbPanels.length);
          } catch (e) {
            console.error('[Criativos] Erro ao carregar do IndexedDB:', e);
          }
        }
        
        setSearchResults(panels);
        console.log('[Criativos] Lista atualizada:', panels.length, 'criativos');
      } catch (e) {
        console.error('[Criativos] Erro ao atualizar lista:', e);
      }
    };

    // Função auxiliar para carregar do IndexedDB
    const loadFromIndexedDB = (): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('billcode_db', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('panels')) {
            resolve([]);
            return;
          }
          
          const transaction = db.transaction(['panels'], 'readonly');
          const store = transaction.objectStore('panels');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        };
      });
    };

    // Atualiza ao montar e quando showCustomPanel fecha
    if (!showCustomPanel) {
      updateCreatives();
    }

    // Listener para mudanças no localStorage
    window.addEventListener('storage', updateCreatives);
    return () => window.removeEventListener('storage', updateCreatives);
  }, [showCustomPanel]);
  
  // Estados do Menu Web
  const [webMenuSearch, setWebMenuSearch] = useState('');
  const [webNotifications, setWebNotifications] = useState<Array<{id: string, message: string, timestamp: number}>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState<string>('');
  const [selectedBrowserTabIds, setSelectedBrowserTabIds] = useState<string[]>([]); // Multi-select para split view
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const initialTabUrlsRef = useRef<Map<string, string>>(new Map()); // Armazena URL inicial de cada aba
  const dragMovedRef = useRef(false);
  // Stable insertion-order for webviews — never reordered, only appended/removed.
  // This prevents Electron from reloading webviews when tabs are dragged.
  const webviewInsertionOrder = useRef<string[]>([browserTabs[0].id]);
  const [, forceWebviewRender] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const [screenshotEditorData, setScreenshotEditorData] = useState<{ base64: string } | null>(null);
  // Extensões do Chrome
  const [extensions, setExtensions] = useState<Array<{ id: string; name: string; version: string; path: string; icon: string | null }>>([]);
  const [showExtPanel, setShowExtPanel] = useState(false);
  const [showDownloadsPanel, setShowDownloadsPanel] = useState(false);
  const [detectedExtensions, setDetectedExtensions] = useState<any[]>([]);
  const [showChromeExts, setShowChromeExts] = useState(false);


  // Menu de contexto do webview (clique direito em imagem)
  const [imgContextMenu, setImgContextMenu] = useState<{ x: number; y: number; url: string; isLink?: boolean; linkUrl?: string; imgUrl?: string } | null>(null);
  
  // Ref para escapar de closures no onBillMessage
  const parseAndExecuteAIActionsRef = useRef<any>(null);
  // Refs para evitar closure stale nos handlers de browser IPC
  const activeBrowserTabIdRef = useRef<string>('');
  const activeMainViewRef = useRef<string>('chat');
  const handleSendMessageRef = useRef<any>(null);

  // Inicializar activeBrowserTabId após carregar a primeira aba
  useEffect(() => {
    if (browserTabs.length > 0 && activeBrowserTabId === '') {
      setActiveBrowserTabId(browserTabs[0].id);
    }
  }, [browserTabs, activeBrowserTabId]);

  // Deep Research - Pesquisa iterativa profunda
  const performDeepResearch = async () => {
    if (!searchQuery.trim() || !selectedSearchModel || !selectedSearchProvider) {
      setSearchProgress('Preencha todos os campos antes de iniciar!');
      return;
    }
    
    setIsSearching(true);
    setSearchProgress('Iniciando pesquisa profunda...');
    console.log('[DeepResearch] Iniciando pesquisa profunda...');
    console.log('[DeepResearch] Query:', searchQuery);
    console.log('[DeepResearch] Modelo:', selectedSearchModel.name);
    console.log('[DeepResearch] Provider:', selectedSearchProvider);
    console.log('[DeepResearch] Tipo:', searchType);
    console.log('[DeepResearch] URLs customizadas:', customSearchUrls);
    
    const maxIterations = 3;
    let currentQuery = searchQuery;
    let allFindings: string[] = [];
    let allSources: string[] = [];
    
    try {
      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        setSearchProgress(`Iteração ${iteration}/${maxIterations}: Pesquisando "${currentQuery}"...`);
        console.log(`[DeepResearch] === Iteração ${iteration}/${maxIterations} ===`);
        console.log(`[DeepResearch] Query atual: ${currentQuery}`);
        
        // 1. Fazer a pesquisa web
        const searchApiKeys = {
          tavilyApiKey: settings.tavilyApiKey,
          googleApiKey: settings.googleApiKey,
          googleCseId: settings.googleCseId,
          braveApiKey: settings.braveApiKey,
        };
        
        const webSearchResult = await (window as any).electronAPI.webResearch(
          currentQuery, 
          selectedSearchProvider, 
          searchApiKeys
        );
        
        if (!webSearchResult.success) {
          console.error(`[DeepResearch] Erro na pesquisa:`, webSearchResult.error);
          throw new Error(webSearchResult.error || 'Erro na pesquisa web');
        }
        
        const searchResultsText = webSearchResult.content || ''; // FIX: era 'results', correto é 'content'
        console.log(`[DeepResearch] Resultados obtidos: ${searchResultsText.length} caracteres`);
        allFindings.push(`\n### Iteração ${iteration}: ${currentQuery}\n${searchResultsText}`);
        
        // Extrai URLs dos resultados se houver
        const urlMatches = searchResultsText.match(/https?:\/\/[^\s\)]+/g);
        if (urlMatches) {
          allSources.push(...urlMatches.slice(0, 5)); // Top 5 URLs
        }
        
        // 2. Enviar para a IA analisar e gerar próxima pergunta
        if (iteration < maxIterations) {
          setSearchProgress(`Iteração ${iteration}/${maxIterations}: Analisando resultados com ${selectedSearchModel.name}...`);
          
          const analysisPrompt = `Você é um pesquisador profundo. Analise os resultados abaixo e gere UMA nova pergunta de pesquisa para aprofundar o tema original: "${searchQuery}".

Resultados da pesquisa "${currentQuery}":
${searchResultsText}

Responda APENAS com a nova pergunta de pesquisa (sem explicações).`;
          
          console.log(`[DeepResearch] Enviando para IA analisar...`);
          
          // Chama a IA usando o modelo selecionado
          let nextQuery = '';
          
          try {
            const provider = selectedSearchModel.provider;
            const model = selectedSearchModel.model;
            const apiKey = selectedSearchModel.apiKey;
            const baseUrl = selectedSearchModel.baseUrl;
            
            if (provider === 'openrouter') {
              const response = await (window as any).electronAPI.openrouterStream(
                [{ role: 'user', content: analysisPrompt }],
                model,
                apiKey,
                baseUrl || 'https://openrouter.ai/api/v1/chat/completions'
              );
              
              // Aguarda chunks
              let fullResponse = '';
              await new Promise<void>((resolve) => {
                const handler = (chunk: string) => {
                  fullResponse += chunk;
                };
                window.electronAPI.onOpenRouterChunk(handler);
                setTimeout(() => {
                  window.electronAPI.onOpenRouterChunk(() => {});
                  resolve();
                }, 5000); // Timeout de 5s
              });
              
              nextQuery = fullResponse.trim();
            } else if (provider === 'ollama') {
              const response = await (window as any).electronAPI.ollamaChat(
                [{ role: 'user', content: analysisPrompt }],
                model,
                baseUrl || 'http://localhost:11434'
              );
              nextQuery = response.message?.content || '';
            } else if (provider === 'gemini') {
              const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: analysisPrompt }] }]
                })
              });
              const data = await response.json();
              nextQuery = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            
            console.log(`[DeepResearch] Próxima query gerada: ${nextQuery}`);
            currentQuery = nextQuery || searchQuery; // Fallback para query original
          } catch (err) {
            console.error(`[DeepResearch] Erro ao chamar IA:`, err);
            currentQuery = searchQuery; // Continua com query original
          }
        }
      }
      
      setSearchProgress('Finalizando e salvando resultados...');
      
      // Finaliza e formata resultado em texto limpo
      const finalReport = `Pesquisa: ${searchQuery}

Tipo: ${searchType === 'auto' ? 'Automática' : 'Personalizada'}
Modelo IA: ${selectedSearchModel.name}
Provedor de Busca: ${selectedSearchProvider}
Data: ${new Date().toLocaleString('pt-BR')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESCOBERTAS

${allFindings.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FONTES

${allSources.length > 0 ? allSources.map((url, i) => `${i + 1}. ${url}`).join('\n\n') : 'Nenhuma fonte específica extraída'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pesquisa concluída em ${maxIterations} iterações
`;
      
      // NÃO salva mais em Criativos - apenas em "Minhas Pesquisas"
      
      // Salva automaticamente em "Minhas Pesquisas" como artigo
      try {
        const saved = localStorage.getItem('billcode_my_researches');
        const existingResearches = saved ? JSON.parse(saved) : [];
        
        // Cria artigo com o resultado da pesquisa
        const newResearch = {
          id: Date.now().toString(),
          title: searchQuery,
          content: finalReport,
          links: allSources, // URLs pesquisadas
          images: [],
          timestamp: Date.now()
        };
        
        const updatedResearches = [...existingResearches, newResearch];
        localStorage.setItem('billcode_my_researches', JSON.stringify(updatedResearches));
        console.log('[DeepResearch] ✓ Salvo em Minhas Pesquisas:', searchQuery);
      } catch (e) {
        console.error('[DeepResearch] Erro ao salvar em Minhas Pesquisas:', e);
      }
      
      console.log('[DeepResearch] ✓ Pesquisa concluída!');
      setSearchProgress('Pesquisa concluída e salva!');
      
      // Adiciona notificação
      setWebNotifications(prev => [...prev, {
        id: Date.now().toString(),
        message: `Pesquisa salva em "Minhas Pesquisas": ${searchQuery}`,
        timestamp: Date.now()
      }]);
      
      // Aguarda 2s para mostrar mensagem de conclusão
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Volta para o menu principal e abre Minhas Pesquisas
      setWebMenuView('main');
      setShowMyResearch(true);
      setSearchQuery('');
      setCustomSearchUrls('');
      setSearchProgress('');
      setSearchType(null);
      setSelectedSearchModel(null);
      setSelectedSearchProvider(null);
      
    } catch (err: any) {
      console.error('[DeepResearch] Erro:', err);
      setSearchProgress(`Erro: ${err.message}`);
      
      // Adiciona notificação de erro
      setWebNotifications(prev => [...prev, {
        id: Date.now().toString(),
        message: `Erro na pesquisa: ${err.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper: abre uma nova aba no navegador
  const openNewTab = (url: string) => {
    const newTabId = Date.now().toString();
    webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
    forceWebviewRender(n => n + 1);
    setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Nova Aba' }]);
    setActiveBrowserTabId(newTabId);
    setUrlBarValue('');
    newTabJustCreatedRef.current = true;
    setTimeout(() => { newTabJustCreatedRef.current = false; }, 0);
  };

  // Foca na barra de URL apenas quando uma nova aba é criada
  const newTabJustCreatedRef = useRef(false);
  const handleAddBrowserTab = () => {
    openNewTab('https://www.google.com');
  };

  // Mantém refs sempre atualizadas (evita closure stale nos IPC handlers)
  useEffect(() => { activeBrowserTabIdRef.current = activeBrowserTabId; }, [activeBrowserTabId]);
  useEffect(() => { activeMainViewRef.current = activeMainView; }, [activeMainView]);

// Tab drag handlers - drag animation + swap on drop
  useEffect(() => {
    let draggedEl: HTMLElement | null = null;
    let draggedId: string | null = null;
    let draggedIndex: number = -1;
    let startX = 0;
    let lastSwapTime = 0;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tabEl = target.closest('[data-tab-id]') as HTMLElement;
      if (!tabEl || e.button !== 0) return;
      
      const tabId = tabEl.dataset.tabId;
      if (!tabId) return;
      
      // Não permite arrastar abas fixadas
      const tab = browserTabs.find(t => t.id === tabId);
      if (tab?.pinned) return;
      
      // NÃO previne default aqui - só quando começar a arrastar

      draggedEl = tabEl;
      draggedId = tabId;
      draggedIndex = browserTabs.findIndex(t => t.id === tabId);
      startX = e.clientX;
      lastSwapTime = 0;

      dragMovedRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedEl || !draggedId || draggedIndex === -1) return;
      
      const deltaX = e.clientX - startX;
      const delta = Math.abs(deltaX);
      
      // Só ativa drag visual após mover 5px
      if (delta > 5 && !dragMovedRef.current) {
        dragMovedRef.current = true;
        // Agora sim aplica estilos de drag
        draggedEl.style.transition = 'none';
        draggedEl.style.zIndex = '1000';
        draggedEl.style.opacity = '0.8';
        draggedEl.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      
      if (!dragMovedRef.current) return; // Não move até confirmar drag
      
      // Move dragged tab
      draggedEl.style.transform = `translateX(${deltaX}px)`;

      // Get tab width for swap detection
      const tabWidth = draggedEl.offsetWidth;
      const swapThreshold = tabWidth * 0.6;
      
      // Prevent rapid swaps
      const now = Date.now();
      if (now - lastSwapTime < 150) return;

      // Check if should swap with left neighbor
      if (deltaX < -swapThreshold && draggedIndex > 0) {
        const newIndex = draggedIndex - 1;
        const leftTab = browserTabs[newIndex];
        
        // Não permite trocar com aba fixada
        if (leftTab?.pinned) return;
        
        lastSwapTime = now;
        
        setBrowserTabs(prev => {
          const arr = [...prev];
          [arr[draggedIndex], arr[newIndex]] = [arr[newIndex], arr[draggedIndex]];
          return arr;
        });
        
        // Update tracking
        draggedIndex = newIndex;
        startX = e.clientX;
        draggedEl.style.transform = 'translateX(0)';
      }
      // Check if should swap with right neighbor
      else if (deltaX > swapThreshold && draggedIndex < browserTabs.length - 1) {
        lastSwapTime = now;
        const newIndex = draggedIndex + 1;
        
        setBrowserTabs(prev => {
          const arr = [...prev];
          [arr[draggedIndex], arr[newIndex]] = [arr[newIndex], arr[draggedIndex]];
          return arr;
        });
        
        // Update tracking
        draggedIndex = newIndex;
        startX = e.clientX;
        draggedEl.style.transform = 'translateX(0)';
      }
    };

    const handleMouseUp = () => {
      if (draggedEl) {
        draggedEl.style.transition = 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)';
        draggedEl.style.transform = 'translateX(0)';
        setTimeout(() => {
          if (draggedEl) {
            draggedEl.style.zIndex = '';
            draggedEl.style.opacity = '';
            draggedEl.style.cursor = '';
            draggedEl.style.transition = '';
          }
        }, 200);
      }
      document.body.style.userSelect = '';
      draggedEl = null;
      draggedId = null;
      draggedIndex = -1;
      dragMovedRef.current = false;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [browserTabs]);

  // Carrega extensões instaladas do processo principal
  const refreshExtensions = async () => {
    if ((window as any).electronAPI?.getExtensions) {
      const exts = await (window as any).electronAPI.getExtensions();
      setExtensions(exts || []);
    }
  };
  useEffect(() => { refreshExtensions(); }, []);

  // Escuta did-navigate nos webviews para manter URL real sincronizada
  useEffect(() => {
    if (!activeBrowserTabId) return;
    const webview = document.getElementById(`webview-${activeBrowserTabId}`) as any;
    if (!webview) return;

    const onNavigate = (e: any) => {
      const newUrl = e.url || '';
      if (!newUrl || newUrl === 'about:blank') return;
      // Só atualiza barra â€” NÃƒO chama setBrowserTabs para evitar loop de re-render
      setUrlBarValue(newUrl);
    };

    // Captura middle-click em links (+ Ctrl+click, window.open) e abre em nova aba
    const onNewWindow = (e: any) => {
      const url = e.url || '';
      if (!url || url === 'about:blank') return;
      e.preventDefault();
      e.stopPropagation();
      // Destrói o WebContents pendente para evitar janela fantasma
      if (e.webContents) e.webContents.destroy();
      openNewTab(url);
    };

    const onConsoleMessage = (e: any) => {
      if (e.message && e.message.startsWith('BILL_NEW_TAB:')) {
        const url = e.message.substring(13);
        openNewTab(url);
      }
    };

    webview.addEventListener('did-navigate', onNavigate);
    webview.addEventListener('new-window', onNewWindow);
    webview.addEventListener('console-message', onConsoleMessage);

    return () => {
      webview.removeEventListener('did-navigate', onNavigate);
      webview.removeEventListener('new-window', onNewWindow);
      webview.removeEventListener('console-message', onConsoleMessage);
    };
  }, [activeBrowserTabId]);

  // Título e favicon de todas as abas (inclui abas em background)
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    const attachListeners = () => {
      for (const tab of browserTabs) {
        const webview = document.getElementById(`webview-${tab.id}`) as any;
        if (!webview || webview.dataset.faviconListenersAttached === tab.id) continue;

        const tabId = tab.id;
        webview.dataset.faviconListenersAttached = tabId;

        const onTitleUpdate = (e: any) => {
          const title = e.title || '';
          if (!title) return;
          setBrowserTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              // Adiciona ao histórico quando título é atualizado (exceto abas anônimas)
              const url = (typeof webview.getURL === 'function' ? webview.getURL() : '') || t.url;
              if (!t.isAnonymous && url && url !== 'about:blank' && !url.startsWith('chrome://')) {
                addToHistory(url, title);
              }
              return { ...t, title };
            }
            return t;
          }));
        };

        const onFaviconUpdate = (e: any) => {
          const favicons: string[] = e.favicons || [];
          if (!favicons.length) return;
          const currentUrl: string = (typeof webview.getURL === 'function' ? webview.getURL() : '') || '';
          setBrowserTabs(prev => prev.map(t => {
            if (t.id !== tabId) return t;
            const urlForMatch = currentUrl || t.url;
            const matching = favicons.find(f => faviconMatchesTab(f, urlForMatch));
            const pick = matching || favicons[0];
            if (t.favicon && faviconMatchesTab(t.favicon, urlForMatch) && !faviconMatchesTab(pick, urlForMatch)) {
              return t;
            }
            const urlUpdate = currentUrl && currentUrl !== t.url ? { url: currentUrl } : {};
            return { ...t, ...urlUpdate, favicon: pick };
          }));
        };

        const onNavigate = (e: any) => {
          const newUrl = e.url || '';
          if (!newUrl || newUrl === 'about:blank') return;
          setBrowserTabs(prev => {
            // Previne re-render se a URL não mudou
            const currentTab = prev.find(t => t.id === tabId);
            if (currentTab && currentTab.url === newUrl) return prev;
            
            return prev.map(t => {
              if (t.id !== tabId) return t;
              const hostnameChanged = getHostname(t.url) !== getHostname(newUrl);
              return { ...t, url: newUrl, ...(hostnameChanged ? { favicon: undefined } : {}) };
            });
          });
          if (tabId === activeBrowserTabIdRef.current) {
            setUrlBarValue(newUrl);
          }
        };

        const onNavigateInPage = (e: any) => {
          const newUrl = e.url || '';
          if (!newUrl || newUrl === 'about:blank') return;
          setBrowserTabs(prev => {
            // Previne re-render se a URL não mudou
            const currentTab = prev.find(t => t.id === tabId);
            if (currentTab && currentTab.url === newUrl) return prev;
            
            return prev.map(t => t.id === tabId ? { ...t, url: newUrl } : t);
          });
          if (tabId === activeBrowserTabIdRef.current) {
            setUrlBarValue(newUrl);
          }
        };

        webview.addEventListener('page-title-updated', onTitleUpdate);
        webview.addEventListener('page-favicon-updated', onFaviconUpdate);
        webview.addEventListener('did-navigate', onNavigate);
        
        // Context menu - Mostra menu com opções Copiar e Traduzir
        const handleContextMenu = (e: any) => {
          webview.executeJavaScript('window.getSelection().toString()')
            .then((selectedText: string) => {
              if (selectedText && selectedText.trim()) {
                // Pega posição do mouse relativa à janela
                const bounds = webview.getBoundingClientRect();
                setContextMenu({
                  x: e.params?.x || 0,
                  y: e.params?.y || 0,
                  text: selectedText.trim()
                });
              }
            })
            .catch(() => {});
        };
        
        webview.addEventListener('context-menu', handleContextMenu);
        
        // Fix: Força scroll a sempre funcionar
        const fixScroll = () => {
          webview.executeJavaScript(`
            (function() {
              const style = document.createElement('style');
              style.id = 'bill-scroll-fix';
              style.textContent = 'html { overflow-y: scroll !important; } body { overflow: visible !important; }';
              const existing = document.getElementById('bill-scroll-fix');
              if (existing) existing.remove();
              document.head.appendChild(style);
              
              // Remove listeners que bloqueiam scroll
              document.body.style.overflow = '';
              document.documentElement.style.overflow = '';
            })();
          `).catch(() => {});
        };
        
        webview.addEventListener('dom-ready', fixScroll);
        // Reaplica quando navegação interna acontece (ex: abrir imagem)
        webview.addEventListener('did-navigate-in-page', fixScroll);
        
        // Monitora mudanças no DOM que podem bloquear scroll
        const recheckScroll = setInterval(() => {
          if (document.getElementById(`webview-${tabId}`)) {
            fixScroll();
          } else {
            clearInterval(recheckScroll);
          }
        }, 1000);
        
        cleanups.push(() => clearInterval(recheckScroll));
        webview.addEventListener('did-navigate-in-page', onNavigateInPage);

        cleanups.push(() => {
          delete webview.dataset.faviconListenersAttached;
          webview.removeEventListener('page-title-updated', onTitleUpdate);
          webview.removeEventListener('page-favicon-updated', onFaviconUpdate);
          webview.removeEventListener('did-navigate', onNavigate);
          webview.removeEventListener('did-navigate-in-page', onNavigateInPage);
          webview.removeEventListener('context-menu', handleContextMenu);
        });
      }
    };

    // Aguarda um pouco antes de anexar (garante que webviews estão no DOM)
    const timer = setTimeout(attachListeners, 100);

    return () => {
      clearTimeout(timer);
      cleanups.forEach(fn => fn());
    };
  }, [browserTabs.length]); // Só re-anexa quando número de abas muda, não quando conteúdo muda

  // Fecha menu de contexto ao clicar fora (mousedown no document, capture phase)
  useEffect(() => {
    if (!imgContextMenu) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('img-context-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setImgContextMenu(null);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('click', handler, true);
    document.addEventListener('contextmenu', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('click', handler, true);
      document.removeEventListener('contextmenu', handler, true);
    };
  }, [imgContextMenu]);

  // Fecha menu de contexto das abas ao clicar fora
  useEffect(() => {
    if (!tabContextMenu) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('tab-context-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setTabContextMenu(null);
    };
    document.addEventListener('mousedown', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
    };
  }, [tabContextMenu]);

  // Fecha menu de contexto de seleção de texto ao clicar fora
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('text-context-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('click', handler, true);
    };
  }, [contextMenu]);

  // Função para fixar/desfixar aba
  const togglePinTab = (tabId: string) => {
    setBrowserTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      
      const isPinned = tab.pinned;
      const updated = prev.map(t => t.id === tabId ? { ...t, pinned: !isPinned } : t);
      
      // Reorganiza: abas fixadas primeiro, depois não fixadas
      const pinned = updated.filter(t => t.pinned);
      const unpinned = updated.filter(t => !t.pinned);
      
      return [...pinned, ...unpinned];
    });
    setTabContextMenu(null);
  };

  // Listener de context-menu no webview ativo (imagem clicada com botão direito)
  useEffect(() => {
    if (!activeBrowserTabId) return;
    const webview = document.getElementById(`webview-${activeBrowserTabId}`) as any;
    if (!webview) return;

    const handleContextMenu = (e: any) => {
      // params vem de contextmenu event do webview Electron
      const params = e.params || {};
      if (params.linkURL || params.mediaType === 'image' || params.srcURL) {
        const linkUrl = params.linkURL || '';
        const imgUrl = params.srcURL || '';
        if (linkUrl || imgUrl) {
          if (imgUrl) lastClickedImageRef.current = imgUrl; // salva também no clique direito
          setImgContextMenu({ 
            x: e.x ?? params.x ?? 0, 
            y: e.y ?? params.y ?? 0, 
            url: linkUrl || imgUrl, 
            isLink: !!linkUrl, 
            linkUrl: linkUrl, 
            imgUrl: imgUrl 
          });
        }
      }
    };

    // Injeta listener de clique em imagens dentro do webview
    const injectClickTracker = () => {
      const script = `(function() {
        if (window.__billClickListenerActive) return;
        window.__billClickListenerActive = true;
        if (!('__billLastClickedImg' in window)) window.__billLastClickedImg = null;
        document.addEventListener('click', function(e) {
          var el = e.target;
          for (var i = 0; i < 5; i++) {
            if (!el) break;
            if (el.tagName === 'IMG' && el.src && el.src.startsWith('http')) {
              window.__billLastClickedImg = el.src;
              break;
            }
            try {
              var bg = window.getComputedStyle(el).backgroundImage;
              if (bg && bg !== 'none') {
                var m = bg.match(/url\\(["']?(https?:[^"')]+)["']?\\)/);
                if (m) { window.__billLastClickedImg = m[1]; break; }
              }
            } catch(ex) {}
            el = el.parentElement;
          }
        }, true);
        document.addEventListener('auxclick', function(e) {
          if (e.button === 1) { // Middle click
            var el = e.target;
            for (var i = 0; i < 5; i++) {
              if (!el) break;
              if (el.tagName === 'A' && el.href) {
                e.preventDefault();
                e.stopPropagation();
                console.log('BILL_NEW_TAB:' + el.href);
                break;
              }
              el = el.parentElement;
            }
          }
        }, true);
      })()`;
      webview.executeJavaScript(script).catch(() => {});
    };

    // Reinjecta em cada nova página (reseta o guard pois é um novo document)
    const onDomReady = () => {
      webview.executeJavaScript(`window.__billClickListenerActive = false; window.__billLastClickedImg = null;`)
        .then(() => injectClickTracker())
        .catch(() => {});
    };

    webview.addEventListener('dom-ready', onDomReady);
    webview.addEventListener('context-menu', handleContextMenu);

    // NÃƒO chama injectClickTracker() imediatamente â€” espera dom-ready
    // Se o webview já está pronto (dom-ready já disparou), tenta injetar com guard
    const tryInjectIfReady = () => {
      try {
        if (webview.getWebContentsId && webview.getWebContentsId() > 0) {
          injectClickTracker();
        }
      } catch { /* webview ainda não está pronto, aguarda dom-ready */ }
    };
    setTimeout(tryInjectIfReady, 100);

    return () => {
      webview.removeEventListener('context-menu', handleContextMenu);
      webview.removeEventListener('dom-ready', onDomReady);
    };
  }, [activeBrowserTabId]);

  // --- DESABILITADO: INTEGRAÇÃƒO COM BILL WORKER (PYTHON) ---
  // Sistema antigo Elysa que interceptava mensagens na Home
  // Para reativar, descomente todo este useEffect:
  /*
  useEffect(() => {
    const cleanupMsg = window.electronAPI.onBillMessage((content: string) => {
      // Grampo: Salvar TUDO que chega da IA num arquivo de debug para podermos ler a formatação real
      window.electronAPI.writeFile("C:\\Users\\Administrator\\Desktop\\aqui\\debug_ipc.txt", content).catch(() => {});

      // O Python já entrega o texto com as quebras de linha reais
      let displayContent = content;
      const thinkMatch = displayContent.match(/\[THINK:\s*(.*?)\]/s);
      if (thinkMatch) {
        // Remove da mensagem principal se quiser, ou deixa. Vamos manter por enquanto.
      }

      // Captura Comandos [SHELL: ...] ou [PYTHON: ...]
      const cmdMatches = [...displayContent.matchAll(/\[(SHELL|PYTHON|COMMAND|TELEGRAM|PATCH|PERFIL|FECHAR):\s*(.*?)\]/gs)];
      cmdMatches.forEach(match => {
        const type = match[1];
        const cmd = match[2];
        setTerminalOutput(prev => [...prev, `[${type}] ${cmd}`]);
      });

      // Captura Resultados [RESULTADO: ...]
      const resMatches = [...displayContent.matchAll(/\[RESULTADO:\s*(.*?)\]/gs)];
      resMatches.forEach(match => {
        setTerminalOutput(prev => [...prev, `> ${match[1]}`]);
      });

      const currentView = activeMainViewRef.current;
      const setCurrentMessages = currentView === 'video' ? setVideoChatMessages : (currentView === 'photo' ? setPhotoChatMessages : (currentView === 'paint' ? setPaintChatMessages : (currentView === 'web' ? setWebChatMessages : (currentView === 'home' ? setHomeChatMessages : setChatMessages))));

      setCurrentMessages((prev) => {
        // Se a última mensagem for do assistente e estiver vazia (placeholder), substitui
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { 
            role: 'assistant', 
            content: displayContent,
            thoughts: thinkMatch ? thinkMatch[1] : undefined
          };
          return newMsgs;
        }
        return [...prev, { 
          role: 'assistant', 
          content: displayContent,
          thoughts: thinkMatch ? thinkMatch[1] : undefined
        }];
      });
      setIsStreaming(false);

      // --- O PULO DO GATO: ACIONA O PARSER DE ARQUIVOS ---
      if (parseAndExecuteAIActionsRef.current) {
        parseAndExecuteAIActionsRef.current(displayContent);
      }
    });

    const cleanupProg = window.electronAPI.onBillProgress((progress: number, label: string) => {
      setTerminalOutput((prev) => [...prev, `[SISTEMA] ${label} (${progress}%)`]);
    });

    const cleanupBrowserOpen = window.electronAPI.onBillBrowserOpen((url: string, newTab: boolean) => {
      const currentView = activeMainViewRef.current;
      const currentTabId = activeBrowserTabIdRef.current;
      const newTabId = Date.now().toString();

      // Helper: após navegação para YouTube, o main.ts cuida do autoplay via did-finish-load
      const forcePlayAfterLoad = (_webview: any) => {
        // Autoplay é tratado no processo principal (electron/main.ts)
        // via contents.executeJavaScript no evento did-finish-load
      };

      if (newTab) {
        webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
        forceWebviewRender(n => n + 1);
        setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
        setActiveBrowserTabId(newTabId);
        activeBrowserTabIdRef.current = newTabId;

        if (currentView !== 'web') {
          setActiveMainView('web');
          activeMainViewRef.current = 'web';
          setTimeout(() => {
            setActiveMainView(currentView);
            activeMainViewRef.current = currentView;
          }, 800);
        }

        setTimeout(() => {
          const webview = document.getElementById(`webview-${newTabId}`) as any;
          if (webview) {
            webview.focus();
            webview.loadURL(url);
            forcePlayAfterLoad(webview);
          }
        }, 300);
      } else {
        // Navega na aba ativa e garante que a view web está visível
        setActiveMainView('web');
        activeMainViewRef.current = 'web';

        setTimeout(() => {
          setBrowserTabs(prev => {
            const current = [...prev];
            const activeIdx = current.findIndex(t => String(t.id) === String(currentTabId));
            if (activeIdx !== -1) {
              current[activeIdx] = { ...current[activeIdx], url, favicon: undefined };
            }
            return current;
          });
          const webview = document.getElementById(`webview-${currentTabId}`) as any;
          if (webview) {
            webview.focus();
            webview.loadURL(url);
            forcePlayAfterLoad(webview);
          }
        }, 300);
      }
    });

    const cleanupBrowserClose = window.electronAPI.onBillBrowserClose((id: any) => {
      setBrowserTabs(prev => {
        const filtered = prev.filter(t => String(t.id) !== String(id));
        if (filtered.length === 0) return [{ id: Date.now().toString(), url: 'https://www.google.com', title: 'Google' }];
        return filtered;
      });
    });

    const cleanupBrowserSwitch = window.electronAPI.onBillBrowserSwitch((id: any) => {
      setActiveMainView('web');
      setActiveBrowserTabId(String(id));
    });

    const cleanupSpeech = window.electronAPI.onBillUserSpeech((content: string) => {
      console.log('[Bill Speech] Recebido transcrição do PTT/Mic:', content);
      if (handleSendMessageRef.current) {
        // Usa a ref do activeChat para enviar no chat correto
        const currentActiveChat = activeChatRef.current;
        console.log('[Bill Speech] Enviando para chat:', currentActiveChat || 'nenhum (chat principal)');
        handleSendMessageRef.current(content, undefined, currentActiveChat || undefined);
      }
    });

    return () => {
      cleanupMsg();
      cleanupProg();
      cleanupBrowserOpen();
      cleanupBrowserClose();
      cleanupBrowserSwitch();
      cleanupSpeech();
    };
  }, []); // refs garantem acesso ao valor atual sem re-registrar listeners
  */

  const activeTabObj = browserTabs.find(t => t.id === activeBrowserTabId) || browserTabs[0];

  // URL exibida na barra â€” atualiza quando o webview navega
  const [urlBarValue, setUrlBarValue] = useState('');

  // Sincroniza a barra de URL com a aba ativa (e foca em nova aba - sem sobrescrever)
  useEffect(() => {
    if (newTabJustCreatedRef.current) {
      // NÃO reseta o ref aqui (senão Strict Mode cairia no else na 2Âª execução)
      // O setTimeout no handler reseta o ref DEPOIS de todos os effects
      setUrlBarValue('');
      urlInputRef.current?.focus();
      return;
    }
    // Não sobrescreve a barra se o usuário estiver digitando nela
    if (document.activeElement !== urlInputRef.current) {
      setUrlBarValue(activeTabObj?.url || '');
    }
  }, [activeBrowserTabId, activeTabObj?.url]);

  // Refs para evitar race conditions no streaming
  const streamingContentRef = useRef<string>('');
  const settingsRef = useRef<SettingsType>(DEFAULT_SETTINGS);
  const callVolumeRef = useRef<number | null>(null); // Volume da chamada ativa
  const settingsSavedRef = useRef<boolean>(false); // só salvar DEPOIS do primeiro carregamento
  
  // Expõe callVolumeRef globalmente para o Chat acessar
  useEffect(() => {
    (window as any).callVolumeRef = callVolumeRef;
  }, []);

  // Manter ref de settings sempre atualizada (evita closures stale)
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // â”€â”€ Carregar settings e modelos ao iniciar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    window.electronAPI.loadSettings().then((result) => {
      if (result.success && result.settings && Object.keys(result.settings).length > 0) {
        console.log('[Settings] Carregadas do arquivo:', JSON.stringify({
          searchProvider: result.settings.searchProvider,
          tavilyApiKey: result.settings.tavilyApiKey ? '***' : '',
          googleApiKey: result.settings.googleApiKey ? '***' : '',
          googleCx: result.settings.googleCx ? '***' : '',
          braveApiKey: result.settings.braveApiKey ? '***' : '',
        }));
        const merged = { ...DEFAULT_SETTINGS, ...result.settings };
        console.log('[Settings] Após merge:', JSON.stringify({
          searchProvider: merged.searchProvider,
          tavilyApiKey: merged.tavilyApiKey ? '***' : '',
          googleApiKey: merged.googleApiKey ? '***' : '',
          googleCx: merged.googleCx ? '***' : '',
          braveApiKey: merged.braveApiKey ? '***' : '',
        }));
        setSettings(merged);
        settingsRef.current = merged;
        // REMOVIDO: não restaura activeMainView - sempre inicia na home
        if (merged.workFolder) {
          loadDirectory(merged.workFolder);
          window.electronAPI.loadProjectMemory(merged.workFolder).then(mRes => {
            if (mRes.success && mRes.memory) setProjectMemory(mRes.memory);
          });
        }
      }
      settingsSavedRef.current = true;
    });
    loadOllamaModels();
  }, []);

  // ── Screenshot Editor Listener ──
  useEffect(() => {
    const handleScreenshotEditor = (e: Event) => {
      const customEvent = e as CustomEvent<{ base64: string }>;
      setScreenshotEditorData(customEvent.detail);
    };
    
    window.addEventListener('open-screenshot-editor', handleScreenshotEditor);
    return () => window.removeEventListener('open-screenshot-editor', handleScreenshotEditor);
  }, []);

  // ── Checagem de Lembretes a cada minuto ──
  useEffect(() => {
    const checkReminders = () => {
      try {
        const saved = localStorage.getItem('bill-reminders');
        console.log('[Reminders] Checando lembretes...', saved ? 'Encontrou lembretes' : 'Nenhum lembrete');
        
        if (!saved) return;
        
        const reminders = JSON.parse(saved);
        console.log('[Reminders] Lembretes:', reminders);
        
        // Busca lembretes já exibidos
        const shownRemindersKey = localStorage.getItem('bill-reminders-shown');
        const shownReminders = shownRemindersKey ? JSON.parse(shownRemindersKey) : [];
        console.log('[Reminders] Lembretes já mostrados:', shownReminders);
        
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().slice(0, 5);
        
        console.log('[Reminders] Agora:', currentDate, currentTime);
        
        // Busca lembretes que devem disparar (exato ou atrasados até 24h)
        const triggeredReminder = reminders.find((r: any) => {
          // Se já foi mostrado, pula
          if (shownReminders.includes(r.id)) {
            console.log('[Reminders] Lembrete já foi mostrado:', r.id);
            return false;
          }
          
          const reminderDateTime = new Date(`${r.date}T${r.time}:00`);
          const nowDateTime = new Date();
          const diffMs = nowDateTime.getTime() - reminderDateTime.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);
          
          // Dispara se está no momento certo OU está atrasado até 24 horas (1440 minutos)
          const shouldTrigger = diffMinutes >= 0 && diffMinutes <= 1440;
          
          console.log('[Reminders] Checando:', r.date, r.time, '| Diferença:', diffMinutes, 'min | Disparar?', shouldTrigger);
          
          return shouldTrigger;
        });
        
        console.log('[Reminders] Lembrete disparado:', triggeredReminder);
        console.log('[Reminders] Chamada recebida atual:', incomingReminderCall);
        
        if (triggeredReminder && !incomingReminderCall) {
          console.log('[Reminders] LEMBRETE DISPARADO!', triggeredReminder.title, 'Tipo:', triggeredReminder.type || 'call');
          
          // Marca como exibido
          shownReminders.push(triggeredReminder.id);
          localStorage.setItem('bill-reminders-shown', JSON.stringify(shownReminders));
          console.log('[Reminders] Marcado como exibido:', triggeredReminder.id);
          
          // Verifica o tipo de lembrete
          const reminderType = triggeredReminder.type || 'call'; // Default é chamada para compatibilidade
          
          if (reminderType === 'call') {
            // CHAMADA: Inicia overlay de chamada recebida
            console.log('[Reminders] Disparando como CHAMADA');
            setIncomingReminderCall({ 
              title: triggeredReminder.title, 
              time: triggeredReminder.time,
              notes: triggeredReminder.notes,
              id: triggeredReminder.id
            });
          } else {
            // MENSAGEM: Envia mensagem direto para IA Chefe
            console.log('[Reminders] Disparando como MENSAGEM');
            if (settings.bossModelId) {
              const now = new Date();
              const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const reminderMessage = `[SISTEMA: LEMBRETE AGENDADO]

ATENÇÃO: Um lembrete agendado está sendo disparado neste momento (${currentTime}).

📌 ${triggeredReminder.title}
🕐 Horário: ${triggeredReminder.time}${triggeredReminder.notes ? `\n📝 ${triggeredReminder.notes}` : ''}

INSTRUÇÃO: Envie uma mensagem direta e séria informando sobre este lembrete agendado. Este é um recado importante que o usuário programou.`;
              
              // Envia mensagem para o chat da IA Chefe (marcada como sistema para não aparecer visualmente)
              handleSendMessage(reminderMessage, undefined, settings.bossModelId, undefined, true);
              console.log('[Reminders] Mensagem enviada para IA Chefe:', settings.bossModelId);
            } else {
              console.warn('[Reminders] IA Chefe não configurada, não pode enviar mensagem');
            }
          }
        }
      } catch (e) {
        console.error('[Reminders] Erro ao checar lembretes:', e);
      }
    };
    
    console.log('[Reminders] Iniciando checagem de lembretes...');
    checkReminders();
    const interval = setInterval(checkReminders, 30000); // 30 segundos para ser mais responsivo
    return () => {
      console.log('[Reminders] Parando checagem de lembretes');
      clearInterval(interval);
    };
  }, [incomingReminderCall]);

  // Checagem de Projetos Atrasados a cada minuto
  useEffect(() => {
    const checkDelayedProjects = () => {
    try {
      const saved = localStorage.getItem('bill-plans');
      console.log('[Delays] ==================== NOVA CHECAGEM ====================');
      console.log('[Delays] Verificando planos...', saved ? 'encontrou' : 'vazio');
      if (!saved) {
        console.log('[Delays] Nenhum plano salvo no localStorage');
        return;
      }

      const plans = JSON.parse(saved);
      console.log('[Delays] Total de planos:', plans.length);
        
        const shownDelaysKey = localStorage.getItem('bill-delays-shown');
        const shownDelays = shownDelaysKey ? JSON.parse(shownDelaysKey) : [];
        console.log('[Delays] Atrasos já notificados:', shownDelays);
        
        const now = new Date();
        console.log('[Delays] Data/hora atual:', now.toISOString());
        
        plans.forEach((plan: any) => {
          console.log('[Delays] Checando plano:', plan.name, 'blocos:', plan.blocks.length);
          plan.blocks.forEach((block: any) => {
            console.log('[Delays] Bloco:', block.label, 'tipo:', block.type, 'projectStarted:', block.projectStarted, 'deadline:', block.deadline, 'deadlineTime:', block.deadlineTime, 'status:', block.status);
            
            // Ignora blocos start/end
            if (block.type === 'start' || block.type === 'end') {
              console.log('[Delays] Bloco de controle (start/end), pulando');
              return;
            }
            
            // Ignora se já foi concluído ou se já notificou
            if (block.status === 'completed') {
              console.log('[Delays] Bloco já concluído, pulando');
              return;
            }
            if (shownDelays.includes(block.id)) {
              console.log('[Delays] Já notificado antes, pulando');
              return;
            }
            
            // Verifica se tem deadline e está atrasado
            if (block.deadline && block.deadlineTime) {
              const deadlineDate = new Date(`${block.deadline}T${block.deadlineTime}`);
              console.log('[Delays] Deadline do bloco:', deadlineDate.toISOString());
              console.log('[Delays] Comparação:', now.getTime(), '>', deadlineDate.getTime(), '=', now > deadlineDate);
              
              if (now > deadlineDate) {
                console.log('[Delays] 🚨 PROJETO ATRASADO DETECTADO:', block.label);
                
                // Só notifica se não tiver notificação ativa
                if (reminderNotification) {
                  console.log('[Delays] Já existe uma notificação ativa, pulando');
                  return;
                }
                
                // Notifica no chat
                setReminderNotification({ 
                  title: `🚨 ATENÇÃO! O projeto "${block.label}" está ATRASADO. Prazo era ${block.deadline} às ${block.deadlineTime}.`,
                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                });
                
                // Notifica via voz da IA (Piper TTS)
                const speak = async () => {
                  try {
                    console.log('[Delays] Tentando falar notificação...');
                    
                    if (!window.electronAPI?.speak) {
                      console.error('[Delays] window.electronAPI.speak não está disponível!');
                      return;
                    }
                    
                    const message = `Alerta! O projeto ${block.label} está atrasado. Prazo era ${block.deadline.split('-').reverse().join(' de ')} às ${block.deadlineTime}.`;
                    
                    console.log('[Delays] Mensagem:', message);
                    console.log('[Delays] Falando com volume 100 (fixo para notificações)');
                    
                    const result = await window.electronAPI.speak(message, 100);
                    console.log('[Delays] Resultado do speak:', result);
                  } catch (error) {
                    console.error('[Delays] Erro ao falar notificação:', error);
                  }
                };
                speak();
                
                // Marca como notificado
                shownDelays.push(block.id);
                localStorage.setItem('bill-delays-shown', JSON.stringify(shownDelays));
                console.log('[Delays] Notificação enviada e marcada como exibida');
              }
            } else {
              console.log('[Delays] Bloco sem deadline definido');
            }
          });
        });
      } catch (e) {
        console.error('[Delays] Erro ao checar atrasos:', e);
      }
    };
    
    console.log('[Delays] Iniciando checagem de atrasos...');
    checkDelayedProjects();
    const interval = setInterval(checkDelayedProjects, 60000); // 1 minuto
    return () => {
      console.log('[Delays] Parando checagem de atrasos');
      clearInterval(interval);
    };
  }, [reminderNotification]);

  // Sincronizar view ativa com settings para persistência
  useEffect(() => {
    if (settingsSavedRef.current && activeMainView !== settings.activeMainView) {
      setSettings(prev => ({ ...prev, activeMainView }));
    }
  }, [activeMainView]);

  // â”€â”€ Salvar settings ao mudar (só depois de carregar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (settingsSavedRef.current) {
      console.log('[Settings] Salvando configurações:', JSON.stringify({
        searchProvider: settings.searchProvider,
        tavilyApiKey: settings.tavilyApiKey ? '***' : '',
        googleApiKey: settings.googleApiKey ? '***' : '',
        googleCx: settings.googleCx ? '***' : '',
        braveApiKey: settings.braveApiKey ? '***' : '',
      }));
      window.electronAPI.saveSettings(settings);
    }
  }, [settings]);

  // â”€â”€ Carregar modelos Ollama â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadOllamaModels = async () => {
    try {
      const result = await window.electronAPI.ollamaListModels();
      if (result.success && result.models && result.models.length > 0) {
        const modelNames = result.models.map((m: any) => m.name);
        setSettings((prev) => {
          const updated = { ...prev, ollamaModels: modelNames };
          if (!prev.ollamaModel && modelNames.length > 0) {
            updated.ollamaModel = modelNames[0];
          }
          return updated;
        });
      }
    } catch (e) {
      console.warn('[Ollama] Não foi possível listar modelos (Ollama pode estar offline)');
    }
  };

  // â”€â”€ Browser Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCloseBrowserTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (browserTabs.length === 1) return;
    const newTabs = browserTabs.filter(t => t.id !== id);
    setBrowserTabs(newTabs);
    if (activeBrowserTabId === id) {
      setActiveBrowserTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleUpdateTabUrl = (id: string, url: string) => {
    setBrowserTabs(prev => prev.map(t => t.id === id ? { ...t, url, favicon: undefined } : t));
  };

  // â”€â”€ File System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Carrega arquivos quando workFolder muda (incluindo projetos internos)
  useEffect(() => {
    // DESABILITADO: causa loop infinito
    // console.log('[App] useEffect settings.workFolder disparado:', settings.workFolder);
    if (!settings.workFolder) return; // Não faz nada se não tem workFolder
    
    if (settings.workFolder) {
      console.log('[App] ============================================');
      console.log('[App] WorkFolder mudou, carregando arquivos:', settings.workFolder);
      loadDirectory(settings.workFolder);
      
      // Carregar memória do projeto
      window.electronAPI.loadProjectMemory(settings.workFolder).then(mRes => {
        if (mRes.success && mRes.memory) {
          setProjectMemory(mRes.memory);
          console.log('[App] Memória do projeto carregada');
        } else {
          setProjectMemory(null);
          console.log('[App] Sem memória do projeto');
        }
      });
      
      // Carregar metadados do projeto (.project-meta.json)
      window.electronAPI.readFile(`${settings.workFolder}\\.project-meta.json`).then(result => {
        if (result.success && result.content) {
          try {
            const metadata = JSON.parse(result.content);
            setProjectMetadata(metadata);
            console.log('[App] Metadados do projeto carregados:', metadata);
          } catch (e) {
            console.log('[App] Erro ao parsear metadados');
            setProjectMetadata(null);
          }
        } else {
          setProjectMetadata(null);
          console.log('[App] Sem metadados do projeto');
        }
      });
      
      // NÃO muda para aba Code automaticamente - deixa o usuário no controle
      console.log('[App] ============================================');
    } else {
      // Se workFolder foi limpo, limpa os arquivos
      // console.log('[App] WorkFolder vazio, limpando arquivos');
      setFiles([]);
    }
  }, [settings.workFolder]); // REMOVIDO activeMainView e loadDirectory das dependências

  const handleSelectFolder = async () => {
    const result = await window.electronAPI.selectFolder();
    if (result.success && result.path) {
      // Limpa o arquivo selecionado e conteúdo para forçar reload
      setSelectedFile(null);
      setFileContent('');
      
      setSettings((prev) => ({ ...prev, workFolder: result.path! }));
      loadDirectory(result.path);
      // Carregar memória do novo projeto
      const mRes = await window.electronAPI.loadProjectMemory(result.path);
      if (mRes.success && mRes.memory) {
        setProjectMemory(mRes.memory);
      } else {
        setProjectMemory(null);
      }
    }
  };

  const handleFileClick = async (filePath: string) => {
    setSelectedFile(filePath);
    const result = await window.electronAPI.readFile(filePath);
    if (result.success && result.content !== undefined) {
      setFileContent(result.content);
    }
  };

  const handleFileChange = async (newContent: string) => {
    console.log('[App] 🔵 handleFileChange chamado, tamanho:', newContent.length);
    setFileContent(newContent);
    if (selectedFile) {
      console.log('[App] 🔵 Salvando arquivo:', selectedFile);
      const result = await window.electronAPI.writeFile(selectedFile, newContent);
      console.log('[App] 🔵 Resultado do writeFile:', result);
      if (result.success) {
        console.log('[App] ✅ Arquivo salvo com sucesso!');
      } else {
        console.error('[App] ❌ Erro ao salvar arquivo:', result.error);
      }
    } else {
      console.warn('[App] ⚠️ selectedFile é null, não salvou!');
    }
  };

  // â”€â”€ Parser de açÃµes da IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const parseAndExecuteAIActions = useCallback(async (
    content: string,
    retryCount: number = 0
  ): Promise<void> => {
    const workFolder = settingsRef.current.workFolder;
    console.log('[parseAndExecuteAIActions] Chamado. Tamanho:', content.length);
    console.log('[parseAndExecuteAIActions] Projeto ativo:', activeProject);
    if (content.includes('```add-note')) {
      console.log('[parseAndExecuteAIActions] BLOCO add-note DETECTADO!');
      const matches = content.match(/```add-note\n([\s\S]*?)```/gi);
      console.log('[parseAndExecuteAIActions] Matches:', matches);
    }

    if (!workFolder) {
      addTerminal('âš ï¸ Pasta de trabalho não definida. Selecione uma pasta no explorador.');
      return;
    }

    const fileRegex = /```file:([^\n]+)\n([\s\S]*?)```/gi;
    const patchRegex = /```file-patch:([^\n]+)\n([\s\S]*?)```/gi;
    const memoryRegex = /```save-memory\n([\s\S]*?)```/gi;
    const addNoteRegex = /```add-note\n([\s\S]*?)```/gi;
    // Permite "command", "shell", "bash", "cmd", "powershell" - case insensitive
    const commandRegex = /```(?:command|shell|bash|cmd|powershell)\n([\s\S]*?)```/gi;
    
    // Super Heurística Rebelde: Captura **nome.ext** \n\n ```lang ... ou apenas nome.ext \n ```lang
    const rebelFileRegex = /(?:^|\n)[ \t]*\*?\*?[ \t]*([a-zA-Z0-9._\-\/]+\.[a-zA-Z0-9]+)[ \t]*\*?\*?[ \t]*\n(?:[ \t]*\n)?[ \t]*```[a-zA-Z0-9]*\n([\s\S]*?)```/gi;

    let hasActions = false;
    let match: RegExpExecArray | null;

    // â”€â”€ Criar arquivos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    while ((match = fileRegex.exec(content)) !== null) {
      hasActions = true;
      let filePath = match[1].trim();
      const fileContentStr = match[2];

      // Normalizar separadores para Windows
      filePath = filePath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');

      // Remover prefixo da workFolder se a IA incluiu o caminho absoluto
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      if (filePath.toLowerCase().startsWith(normalizedWorkFolder.toLowerCase())) {
        filePath = filePath.substring(normalizedWorkFolder.length).replace(/^[\\]+/, '');
      }

      const fullPath = normalizedWorkFolder.endsWith('\\')
        ? normalizedWorkFolder + filePath
        : normalizedWorkFolder + '\\' + filePath;

      const lastSlash = fullPath.lastIndexOf('\\');
      const dir = lastSlash > 0 ? fullPath.substring(0, lastSlash) : normalizedWorkFolder;

      addTerminal(`ðŸ“ Criando: ${fullPath}`);

      // Criar diretório pai se necessário
      if (dir && dir !== normalizedWorkFolder) {
        const dirResult = await window.electronAPI.createDirectory(dir);
        if (!dirResult.success) {
          addTerminal(`âš ï¸ Aviso ao criar diretório: ${dirResult.error}`);
        }
      }

      // Escrever arquivo
      const writeResult = await window.electronAPI.writeFile(fullPath, fileContentStr);
      if (writeResult.success) {
        addTerminal(`âœ… Arquivo criado: ${fullPath}`);
        loadDirectory(workFolder);
        setSelectedFile(fullPath);
        setFileContent(fileContentStr);
      } else {
        addTerminal(`âŒ Erro ao criar arquivo: ${writeResult.error}`);
      }
    }

    // â”€â”€ Salvar arquivos (Heurística Rebelde) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    while ((match = rebelFileRegex.exec(content)) !== null) {
      // Se já foi processado pelo regex padrão, pula (evita duplicidade)
      if (content.substring(match.index, Math.min(match.index + 40, content.length)).includes('file:')) continue;

      hasActions = true;
      let filePath = match[1].trim();
      const fileContentStr = match[2];

      filePath = filePath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      const isAbsolute = filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(filePath);
      const fullPath = isAbsolute ? filePath : `${normalizedWorkFolder}\\${filePath}`.replace(/\\\\+/g, '\\');

      addTerminal(`ðŸ¤– Interceptado bloco rebelde: ${fullPath}`);
      const writeResult = await window.electronAPI.writeFile(fullPath, fileContentStr);
      if (writeResult.success) {
        addTerminal(`âœ… Arquivo criado via heurística: ${fullPath}`);
        loadDirectory(workFolder);
        if (selectedFile === fullPath) setFileContent(fileContentStr);
      }
    }

    // â”€â”€ Salvar Memória de Projeto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    while ((match = memoryRegex.exec(content)) !== null) {
      hasActions = true;
      try {
        const newMemory = JSON.parse(match[1]);
        const updatedMemory = { ...(projectMemory || {}), ...newMemory };
        const saveRes = await window.electronAPI.saveProjectMemory(workFolder, updatedMemory);
        if (saveRes.success) {
          setProjectMemory(updatedMemory);
          addTerminal('ðŸ§  Memória de Projeto atualizada com sucesso!');
        } else {
          addTerminal(`âŒ Erro ao salvar memória: ${saveRes.error}`);
        }
      } catch (e: any) {
        addTerminal(`âŒ Erro de JSON no bloco save-memory: ${e.message}`);
      }
    }


    // Adicionar Nota ao Projeto
    while ((match = addNoteRegex.exec(content)) !== null) {
      hasActions = true;
      const noteText = match[1].trim();
      console.log('[parseAndExecuteAIActions] Bloco add-note detectado:', noteText);
      console.log('[parseAndExecuteAIActions] Projeto ativo:', activeProject);
      if (activeProject && noteText) {
        addProjectNote(noteText);
        addTerminal(`📝 Nota: ${noteText}`);
      } else if (!activeProject) {
        console.log('[parseAndExecuteAIActions] AVISO: Nenhum projeto ativo, nota ignorada');
      }
    }
    // â”€â”€ Aplicar patches (Edição Inteligente) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    while ((match = patchRegex.exec(content)) !== null) {
      hasActions = true;
      let filePath = match[1].trim();
      const patchContent = match[2];

      // Normalizar caminho
      filePath = filePath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      const isAbsolute = filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(filePath);
      const fullPath = isAbsolute ? filePath : `${normalizedWorkFolder}\\${filePath}`.replace(/\\\\+/g, '\\');

      addTerminal(`ðŸ› ï¸ Aplicando Patch em: ${fullPath}`);

      // Parsear SEARCH/REPLACE
      const searchMatch = /<<<< SEARCH\n([\s\S]*?)\n====/.exec(patchContent);
      const replaceMatch = /====\n([\s\S]*?)\n>>>>/.exec(patchContent);

      if (searchMatch && replaceMatch) {
        const searchText = searchMatch[1];
        const replaceText = replaceMatch[1];

        const patchResult = await window.electronAPI.patchFile(fullPath, searchText, replaceText);
        if (patchResult.success) {
          addTerminal(`âœ… Patch aplicado com sucesso!`);
          // Recarregar arquivo â€” compara paths normalizados para evitar mismatch
          const normSelected = (selectedFile || '').replace(/\//g, '\\').toLowerCase();
          const normFull = fullPath.replace(/\//g, '\\').toLowerCase();
          if (normSelected === normFull || normSelected.endsWith('\\' + filePath.toLowerCase())) {
            const readRes = await window.electronAPI.readFile(fullPath);
            if (readRes.success) setFileContent(readRes.content || '');
          }
        } else {
          addTerminal(`âŒ Erro no Patch: ${patchResult.error}`);
          // Fallback: aplica diretamente no fileContent em memória se for o arquivo selecionado
          const normSelected = (selectedFile || '').replace(/\//g, '\\').toLowerCase();
          const normFull = fullPath.replace(/\//g, '\\').toLowerCase();
          const isCurrentFile = normSelected === normFull || normSelected.endsWith('\\' + filePath.toLowerCase());
          if (isCurrentFile && fileContent.includes(searchText)) {
            const newContent = fileContent.replace(searchText, replaceText);
            setFileContent(newContent);
            await window.electronAPI.writeFile(fullPath, newContent);
            addTerminal(`âœ… Patch aplicado via fallback (conteúdo em memória)`);
          }
        }
      } else {
        addTerminal(`âŒ Formato de Patch inválido. Use <<<< SEARCH, ==== e >>>>`);
      }
    }

    // ── Scaffold: Criar estrutura de pastas ──────────────────────────────────
    const scaffoldRegex = /```scaffold\n([\s\S]*?)```/gi;
    while ((match = scaffoldRegex.exec(content)) !== null) {
      hasActions = true;
      const structure = match[1];
      
      addTerminal('🏗️ Criando estrutura de pastas...');
      
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      const lines = structure.split('\n').filter(line => line.trim().length > 0);
      
      const foldersToCreate: string[] = [];
      
      // Parse da estrutura hierárquica
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // Ignora comentários
        
        // Remove caracteres de árvore (│, ├, └, ─, etc)
        const cleaned = trimmed.replace(/[│├└─\s]+/g, '').trim();
        if (!cleaned) continue;
        
        // Remove trailing slash
        const folderPath = cleaned.replace(/\/$/, '');
        
        // Constrói caminho baseado na indentação
        const indent = line.search(/\S/);
        const depth = Math.floor(indent / 2); // 2 espaços = 1 nível
        
        // Adiciona à lista de pastas
        foldersToCreate.push(folderPath);
      }
      
      // Alternativa: parse simples linha por linha
      const simpleParse = structure.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .map(line => {
          // Remove caracteres de decoração
          return line.replace(/[│├└─\s│]/g, '').replace(/\/$/, '').trim();
        })
        .filter(line => line.length > 0);
      
      // Detecta estrutura hierárquica ou lista simples
      let folders: string[] = [];
      let currentPath: string[] = [];
      
      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        
        const indent = line.search(/\S/);
        const depth = Math.floor(indent / 2);
        
        // Remove decorações
        const cleaned = line.trim()
          .replace(/^[│├└─\s]+/, '')
          .replace(/\/$/, '')
          .trim();
        
        if (!cleaned) continue;
        
        // Ajusta o caminho atual baseado na profundidade
        currentPath = currentPath.slice(0, depth);
        currentPath.push(cleaned);
        
        const fullPath = currentPath.join('\\');
        folders.push(fullPath);
      }
      
      // Se não detectou hierarquia, usa parse simples
      if (folders.length === 0) {
        folders = simpleParse.map(f => f.replace(/\//g, '\\'));
      }
      
      // Remove duplicatas
      folders = [...new Set(folders)];
      
      let created = 0;
      let skipped = 0;
      
      // Cria todas as pastas
      for (const folder of folders) {
        const fullPath = `${normalizedWorkFolder}\\${folder}`.replace(/\\\\+/g, '\\');
        
        try {
          const result = await window.electronAPI.createDirectory(fullPath);
          if (result.success) {
            created++;
            addTerminal(`  📁 ${folder}`);
          } else {
            if (result.error?.includes('já existe') || result.error?.includes('already exists')) {
              skipped++;
            } else {
              addTerminal(`  ⚠️ Erro em ${folder}: ${result.error}`);
            }
          }
        } catch (error: any) {
          addTerminal(`  ⚠️ Erro em ${folder}: ${error.message}`);
        }
      }
      
      if (created > 0) {
        addTerminal(`✅ ${created} pasta(s) criada(s)${skipped > 0 ? `, ${skipped} já existiam` : ''}!`);
        loadDirectory(workFolder);
      } else if (skipped > 0) {
        addTerminal(`✅ Estrutura já existe (${skipped} pasta(s))`);
      } else {
        addTerminal(`⚠️ Nenhuma pasta foi criada`);
      }
    }

    // ── Deletar arquivos ──────────────────────────────────────────────────────
    const deleteRegex = /```delete:([^\n]+)```/gi;
    while ((match = deleteRegex.exec(content)) !== null) {
      hasActions = true;
      let filePath = match[1].trim();
      
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      filePath = filePath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');
      
      if (filePath.toLowerCase().startsWith(normalizedWorkFolder.toLowerCase())) {
        filePath = filePath.substring(normalizedWorkFolder.length).replace(/^[\\]+/, '');
      }
      
      const isAbsolute = /^[a-zA-Z]:\\/.test(filePath);
      const fullPath = isAbsolute ? filePath : `${normalizedWorkFolder}\\${filePath}`.replace(/\\\\+/g, '\\');
      
      // 🔒 SUPERVISED MODE: Interceptar delete
      if (supervisedMode) {
        addTerminal(`⏸️ Mudança pendente (deletar): ${fullPath}`);
        addPendingChange({
          type: 'delete',
          filePath: fullPath,
          reason: 'Deletar arquivo'
        });
        continue;
      }

      addTerminal(`🗑️ Deletando: ${fullPath}`);
      
      try {
        const readResult = await window.electronAPI.readFile(fullPath);
        if (!readResult.success) {
          addTerminal(`⚠️ Arquivo não existe`);
          continue;
        }
        
        const deleteResult = await window.electronAPI.executeCommand(`del "${fullPath}"`, workFolder);
        if (deleteResult.exitCode === 0) {
          addTerminal(`✅ Arquivo deletado!`);
          loadDirectory(workFolder);
          if (selectedFile === fullPath) {
            setSelectedFile(null);
            setFileContent('');
          }
        } else {
          addTerminal(`❌ Erro ao deletar`);
        }
      } catch (error: any) {
        addTerminal(`❌ Erro: ${error.message}`);
      }
    }

    // ── Renomear/Mover arquivos ───────────────────────────────────────────────
    const renameRegex = /```(?:rename|move):([^\n]+?)->([^\n]+?)```/gi;
    while ((match = renameRegex.exec(content)) !== null) {
      hasActions = true;
      let oldPath = match[1].trim();
      let newPath = match[2].trim();
      
      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      oldPath = oldPath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');
      newPath = newPath.replace(/\//g, '\\').replace(/\\\\+/g, '\\');
      
      if (oldPath.toLowerCase().startsWith(normalizedWorkFolder.toLowerCase())) {
        oldPath = oldPath.substring(normalizedWorkFolder.length).replace(/^[\\]+/, '');
      }
      if (newPath.toLowerCase().startsWith(normalizedWorkFolder.toLowerCase())) {
        newPath = newPath.substring(normalizedWorkFolder.length).replace(/^[\\]+/, '');
      }
      
      const isOldAbs = /^[a-zA-Z]:\\/.test(oldPath);
      const isNewAbs = /^[a-zA-Z]:\\/.test(newPath);
      const fullOldPath = isOldAbs ? oldPath : `${normalizedWorkFolder}\\${oldPath}`.replace(/\\\\+/g, '\\');
      const fullNewPath = isNewAbs ? newPath : `${normalizedWorkFolder}\\${newPath}`.replace(/\\\\+/g, '\\');
      
      // 🔒 SUPERVISED MODE: Interceptar rename/move
      if (supervisedMode) {
        addTerminal(`⏸️ Mudança pendente (renomear/mover): ${fullOldPath} → ${fullNewPath}`);
        addPendingChange({
          type: oldPath === newPath ? 'rename' : 'move',
          filePath: fullOldPath,
          newPath: fullNewPath,
          reason: `${oldPath === newPath ? 'Renomear' : 'Mover'} arquivo`
        });
        continue;
      }

      addTerminal(`📝 Renomeando/Movendo: ${fullOldPath} → ${fullNewPath}`);
      
      try {
        const readResult = await window.electronAPI.readFile(fullOldPath);
        if (!readResult.success) {
          addTerminal(`⚠️ Arquivo não existe`);
          continue;
        }
        
        const lastSlash = fullNewPath.lastIndexOf('\\');
        if (lastSlash > 0) {
          await window.electronAPI.createDirectory(fullNewPath.substring(0, lastSlash));
        }
        
        const moveResult = await window.electronAPI.executeCommand(`move "${fullOldPath}" "${fullNewPath}"`, workFolder);
        if (moveResult.exitCode === 0) {
          addTerminal(`✅ Operação concluída!`);
          loadDirectory(workFolder);
          if (selectedFile === fullOldPath) {
            setSelectedFile(fullNewPath);
            setFileContent(readResult.content || '');
          }
        } else {
          addTerminal(`❌ Erro na operação`);
        }
      } catch (error: any) {
        addTerminal(`❌ Erro: ${error.message}`);
      }
    }

    let commandsExecuted = 0;
    let allSuccessOutputs = "";

    // â”€â”€ Executar comandos com auto-correção â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    while ((match = commandRegex.exec(content)) !== null) {
      commandsExecuted++;
      hasActions = true;
      const cmd = match[1].trim();
      
      // ðŸ¦… Lógica do EAGLE-EYE (Visão de Ãguia)
      if (cmd.toLowerCase() === 'eagle-eye') {
        addTerminal('ðŸ¦… Iniciando Visão de Ãguia (Analisando projeto...)');
        const recursiveResult = await window.electronAPI.listRecursive(workFolder);
        if (recursiveResult.success && recursiveResult.items) {
          const fileTree = recursiveResult.items
            .map(item => `${item.isDirectory ? '[DIR]' : '[FILE]'} ${item.path.replace(workFolder, '')}`)
            .join('\n');
          
          addTerminal(`âœ… Projeto analisado! ${recursiveResult.items.length} arquivos encontrados.`);
          
          // Enviar o resultado de volta para a IA como contexto
          const contextMsg: Message = {
            role: 'system',
            content: `ðŸ¦… VISÃƒO DE ÃGUIA - ESTRUTURA DO PROJETO:\n\n${fileTree}\n\nAgora vocÃª conhece todos os arquivos. Use essa informação para planejar suas mudanças.`
          };
          setChatMessages(prev => [...prev, contextMsg]);
        } else {
          addTerminal(`âŒ Erro na Visão de Ãguia: ${recursiveResult.error}`);
        }
        continue;
      }

      // ðŸ‘€ Lógica do SEE-SCREEN e READ-SCREEN (Visão)
      if (cmd.toLowerCase() === 'see-screen' || cmd.toLowerCase() === 'read-screen') {
        const mode = cmd.toLowerCase() === 'read-screen' ? 'ocr' : 'describe';
        addTerminal(`ðŸ‘€ Bill está ${mode === 'ocr' ? 'lendo' : 'olhando'} para sua tela...`);
        
        const visionResult = await window.electronAPI.seeScreen(mode);
        if (visionResult.success && visionResult.content) {
          addTerminal('âœ… Visão concluída!');
          const contextMsg: Message = {
            role: 'system',
            content: `ðŸ‘€ VISÃƒO DO BILL (${mode === 'ocr' ? 'OCR' : 'CENA'}):\n\n${visionResult.content}\n\nUse essa informação para entender o estado atual do computador do usuário.`
          };
          setChatMessages(prev => [...prev, contextMsg]);
        } else {
          addTerminal(`âŒ Erro na Visão: ${visionResult.error}`);
        }
        continue;
      }

      // 🔒 SUPERVISED MODE: Interceptar comando
      if (supervisedMode) {
        addTerminal(`⏸️ Comando pendente: ${cmd}`);
        addPendingChange({
          type: 'command',
          filePath: workFolder, // Usar workFolder como contexto
          command: cmd,
          reason: 'Executar comando no terminal'
        });
        continue;
      }

      addTerminal(`$ ${cmd}`);

      const result = await window.electronAPI.executeCommand(cmd, workFolder);

      if (result.output) {
        addTerminal(result.output);
      }

      const failed = result.error || (result.exitCode !== undefined && result.exitCode !== 0);

      if (failed && retryCount < 3) {
        const errorMsg = result.error || `Exit code ${result.exitCode}`;
        addTerminal(`âŒ Erro: ${errorMsg}`);
        addTerminal(`ðŸ”„ Auto-corrigindo... (tentativa ${retryCount + 1}/3)`);

        const correctionMessages: Message[] = [
          {
            role: 'system',
            content: `Você é o Gabiru, um especialista em depuração no WINDOWS.
Sua tarefa é analisar o comando que falhou e a saída do terminal para fornecer uma solução REAL.

## ðŸ§  GUIA DE DEPURAÇÃƒO:
1. **Erro de Sintaxe (Usage/Help)**: Se a saída mostrar o "usage:" ou ajuda do comando, vocÃª errou os argumentos (ex: esqueceu o '=', usou separador errado ou faltou um parÃ¢metro). CORRIJA O COMANDO.
2. **Arquivo não encontrado**: Só crie o arquivo com \`\`\`file:\`\`\` se a mensagem disser claramente "File not found", "No such file" ou "não encontrado". Se o arquivo já foi criado antes, NÃƒO o crie de novo, apenas corrija o caminho ou o comando.
3. **Erro de Python/Script**: Se o erro for um Traceback dentro do script, corrija o CÃ“DIGO do arquivo usando \`\`\`file:\`\`\`.
4. **Comandos de Linux**: Se vocÃª usou 'ls', 'cat', 'rm -rf' ou 'mkdir -p', mude para o equivalente de Windows (dir, type, del, mkdir).

SEJA PRECISO. Não tente adivinhar. Analise o LOG do terminal abaixo.`
          },
          {
            role: 'user',
            content: `Comando que falhou:
\`\`\`command
${cmd}
\`\`\`

Saída completa do Terminal:
\`\`\`
${result.output || errorMsg}
\`\`\`

Analise o erro acima e resolva o problema. Use \`\`\`file:\`\`\` se precisar mudar código/criar arquivo ou \`\`\`command\`\`\` se precisar mudar o comando.`
          }
        ];

        const correction = await callAINonStreaming(correctionMessages, settingsRef.current);
        if (correction) {
          addTerminal(`ðŸ¤– Correção: ${correction.substring(0, 150)}...`);
          await parseAndExecuteAIActions(correction, retryCount + 1);
        } else {
          addTerminal('âš ï¸ Não foi possível gerar correção automática.');
        }
      } else if (!failed) {
        addTerminal('âœ… Comando executado com sucesso!');
      }
    }

    // â”€â”€ Salvar blocos genéricos (Fallback Inteligente) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Se o modelo usou ```html, ```css, ```python etc. em vez de ```file:, tentamos salvar mesmo assim.
    const genericCodeBlockRegex = /```([a-zA-Z0-9]+)\n([\s\S]*?)```/g;
    const langToFilename: Record<string, string> = {
      html: 'index.html', css: 'style.css', javascript: 'script.js', js: 'script.js',
      typescript: 'index.ts', ts: 'index.ts', python: 'main.py', py: 'main.py',
      json: 'data.json', xml: 'data.xml', sql: 'query.sql', java: 'Main.java',
      cpp: 'main.cpp', c: 'main.c', go: 'main.go', rust: 'main.rs', php: 'index.php',
    };
    const skipLangs = ['command', 'shell', 'bash', 'cmd', 'powershell', 'save-memory', 'file-patch', 'add-note', 'text', 'plaintext'];
    let gMatch: RegExpExecArray | null;
    while ((gMatch = genericCodeBlockRegex.exec(content)) !== null) {
      const lang = gMatch[1].toLowerCase();
      const blockCode = gMatch[2];
      if (skipLangs.includes(lang) || lang.startsWith('file')) continue;

      // Já foi processado pela heurística rebelde? Verifica texto antes do bloco
      const before = content.substring(Math.max(0, gMatch.index - 120), gMatch.index);
      if (before.includes('file:')) continue;

      // Tenta inferir o nome do arquivo a partir do texto imediatamente antes do bloco
      // Captura padrÃµes como: "### index.html", "**style.css**", "index.html:", "> script.js"
      const filenameInContext = before.match(/(?:###?#?\s+|>\s+|\*\*|`|:\s*\n?\s*)([a-zA-Z0-9._\-\/]+\.[a-zA-Z0-9]{1,5})\s*(?:\*\*|`|:|\n|$)/);
      let inferredName = filenameInContext ? filenameInContext[1].trim() : (langToFilename[lang] || null);

      if (!inferredName) {
        addTerminal(`âš ï¸ Bloco \`\`\`${lang} ignorado (sem nome de arquivo detectado)`);
        continue;
      }

      // Evita duplicar arquivos já salvos pelo regex principal
      if (content.includes('```file:' + inferredName)) continue;

      const normalizedWorkFolder = workFolder.replace(/\//g, '\\');
      const isAbsolute = inferredName.startsWith('/') || /^[a-zA-Z]:\\/.test(inferredName);
      const fullPath = isAbsolute ? inferredName : `${normalizedWorkFolder}\\${inferredName}`.replace(/\\\\+/g, '\\');

      addTerminal(`ðŸ¤– Salvando bloco \`\`\`${lang} como: ${fullPath}`);
      hasActions = true;
      const wRes = await window.electronAPI.writeFile(fullPath, blockCode);
      if (wRes.success) {
        addTerminal(`âœ… Arquivo salvo via fallback: ${fullPath}`);
        loadDirectory(workFolder);
        setSelectedFile(fullPath);
        setFileContent(blockCode);
      } else {
        addTerminal(`âŒ Erro ao salvar ${inferredName}: ${wRes.error}`);
      }
    }

    if (!hasActions && retryCount === 0) {
      // Resposta apenas textual - sem açÃµes a executar
      console.log('[PARSER] Resposta textual sem açÃµes de arquivo/comando.');
    }
  }, [addTerminal, activeProject, addProjectNote, supervisedMode, addPendingChange]);

  // Atualiza o Ref com a função mais recente
  useEffect(() => {
    parseAndExecuteAIActionsRef.current = parseAndExecuteAIActions;
  }, [parseAndExecuteAIActions]);

  // â"€â"€ Helper: Extrai palavras-chave relevantes da mensagem do usuário â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const extractKeywords = (message: string): string[] => {
    if (!message) return [];
    
    // Remove stopwords comuns em português
    const stopwords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'por', 'como', 'que', 'é', 'são', 'foi', 'está', 'e', 'ou', 'se', 'me', 'te', 'lo', 'la', 'lhe', 'seu', 'sua']);
    
    // Extrai palavras (2+ caracteres) e filtra stopwords
    const words = message.toLowerCase()
      .replace(/[^\w\sáàâãéèêíïóôõöúçñ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopwords.has(w));
    
    // Remove duplicatas e retorna até 10 palavras mais relevantes
    return [...new Set(words)].slice(0, 10);
  };

  // ── Helper: Extrai imports de um arquivo ────────────────────────────────────
  const extractImports = (content: string, filePath: string): string[] => {
    const imports: string[] = [];
    
    // Regex para diferentes tipos de imports
    const patterns = [
      // ES6: import ... from './path'
      /import\s+.*?\s+from\s+['"](.+?)['"]/g,
      // CommonJS: require('./path')
      /require\s*\(\s*['"](.+?)['"]\s*\)/g,
      // Dynamic import: import('./path')
      /import\s*\(\s*['"](.+?)['"]\s*\)/g,
      // Python: from ... import / import ...
      /(?:from|import)\s+([a-zA-Z0-9_\.]+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        
        // Ignora imports de node_modules ou absolutos
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;
        
        imports.push(importPath);
      }
    }
    
    return [...new Set(imports)]; // Remove duplicatas
  };

  // ── Helper: Resolve caminho de import relativo ──────────────────────────────
  const resolveImportPath = (importPath: string, fromFile: string, workFolder: string): string | null => {
    try {
      // Normaliza o caminho do arquivo atual
      const fromDir = fromFile.substring(0, fromFile.lastIndexOf('\\'));
      
      // Remove ./ ou ../ e constrói o caminho completo
      let resolvedPath = importPath;
      if (importPath.startsWith('./')) {
        resolvedPath = `${fromDir}\\${importPath.substring(2)}`;
      } else if (importPath.startsWith('../')) {
        const parts = importPath.split('/');
        let currentDir = fromDir;
        for (const part of parts) {
          if (part === '..') {
            currentDir = currentDir.substring(0, currentDir.lastIndexOf('\\'));
          } else if (part !== '.') {
            currentDir += `\\${part}`;
          }
        }
        resolvedPath = currentDir;
      } else {
        resolvedPath = `${fromDir}\\${importPath}`;
      }
      
      // Normaliza barras
      resolvedPath = resolvedPath.replace(/\//g, '\\');
      
      // Tenta diferentes extensões se não tiver extensão
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.vue', '.svelte', ''];
      
      for (const ext of extensions) {
        const testPath = resolvedPath.endsWith(ext) ? resolvedPath : `${resolvedPath}${ext}`;
        // Retorna o caminho que será testado
        return testPath;
      }
      
      return resolvedPath;
    } catch (error) {
      console.error('[resolveImportPath] Erro:', error);
      return null;
    }
  };

  // ── Helper: Lê arquivo e seus imports recursivamente ────────────────────────
  const readFileWithImports = async (
    filePath: string, 
    workFolder: string, 
    visited: Set<string> = new Set(),
    depth: number = 0,
    maxDepth: number = 2,
    maxFiles: number = 10,
    dependencyGraph: Map<string, string[]> = new Map(),
    currentPath: string[] = []
  ): Promise<Array<{path: string, content: string}>> => {
    try {
      // Limites de segurança
      if (depth >= maxDepth || visited.size >= maxFiles) return [];
      if (visited.has(filePath)) {
        // Detectou ciclo!
        if (currentPath.includes(filePath)) {
          console.log(`[CICLO DETECTADO] ${currentPath.join(' → ')} → ${filePath}`);
        }
        return [];
      }
      
      visited.add(filePath);
      currentPath.push(filePath);
      
      // Lê o arquivo principal
      const readResult = await window.electronAPI.readFile(filePath);
      if (!readResult.success || !readResult.content) {
        currentPath.pop();
        return [];
      }
      
      const files: Array<{path: string, content: string}> = [{
        path: filePath,
        content: readResult.content.slice(0, 3000)
      }];
      
      // Extrai imports
      const imports = extractImports(readResult.content, filePath);
      
      // Registra no grafo de dependências
      if (!dependencyGraph.has(filePath)) {
        dependencyGraph.set(filePath, []);
      }
      
      // Segue cada import (até o limite)
      for (const importPath of imports) {
        if (visited.size >= maxFiles) break;
        
        const resolvedPath = resolveImportPath(importPath, filePath, workFolder);
        if (!resolvedPath) continue;
        
        // Adiciona ao grafo
        dependencyGraph.get(filePath)!.push(resolvedPath);
        
        // Tenta ler o arquivo importado recursivamente
        const importedFiles = await readFileWithImports(
          resolvedPath,
          workFolder,
          visited,
          depth + 1,
          maxDepth,
          maxFiles,
          dependencyGraph,
          [...currentPath]
        );
        
        files.push(...importedFiles);
      }
      
      currentPath.pop();
      return files;
    } catch (error) {
      console.error('[readFileWithImports] Erro:', error);
      return [];
    }
  };

  // ── Helper: Analisa grafo de dependências e detecta ciclos ──────────────────
  const analyzeDependencies = (dependencyGraph: Map<string, string[]>, workFolder: string): string => {
    let analysis = '';
    
    // 1. Resumo do grafo
    const totalFiles = dependencyGraph.size;
    let totalDeps = 0;
    dependencyGraph.forEach(deps => totalDeps += deps.length);
    
    analysis += `\n## Análise de Dependências:\n`;
    analysis += `- Total de arquivos analisados: ${totalFiles}\n`;
    analysis += `- Total de dependências: ${totalDeps}\n\n`;
    
    // 2. Mapa de dependências
    if (dependencyGraph.size > 0) {
      analysis += `### Grafo de Dependências:\n`;
      dependencyGraph.forEach((deps, file) => {
        const fileName = file.replace(workFolder, '').replace(/^\\+/, '');
        if (deps.length > 0) {
          const depNames = deps.map(d => d.replace(workFolder, '').replace(/^\\+/, '')).join(', ');
          analysis += `- \`${fileName}\` → importa: ${depNames}\n`;
        } else {
          analysis += `- \`${fileName}\` → sem imports locais\n`;
        }
      });
      analysis += '\n';
    }
    
    // 3. Detecta ciclos usando DFS
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    
    const detectCycle = (node: string, path: string[]): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);
      
      const neighbors = dependencyGraph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor, [...path])) return true;
        } else if (recStack.has(neighbor)) {
          // Ciclo encontrado!
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
          return true;
        }
      }
      
      recStack.delete(node);
      return false;
    };
    
    // Executa DFS em todos os nós
    for (const node of dependencyGraph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node, []);
      }
    }
    
    // 4. Reporta ciclos
    if (cycles.length > 0) {
      analysis += `### ⚠️ CICLOS DETECTADOS (${cycles.length}):\n`;
      cycles.forEach((cycle, idx) => {
        const cycleStr = cycle.map(f => f.replace(workFolder, '').replace(/^\\+/, '')).join(' → ');
        analysis += `${idx + 1}. ${cycleStr}\n`;
      });
      analysis += `\n> ATENÇÃO: Dependências circulares podem causar problemas de carregamento e dificultar manutenção.\n\n`;
    } else {
      analysis += `### ✅ Nenhum ciclo detectado\n\n`;
    }
    
    // 5. Arquivos mais dependentes (hubs)
    const inDegree = new Map<string, number>();
    dependencyGraph.forEach(deps => {
      deps.forEach(dep => {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      });
    });
    
    const hubs = Array.from(inDegree.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (hubs.length > 0) {
      analysis += `### 📌 Arquivos mais importados (hubs):\n`;
      hubs.forEach(([file, count]) => {
        const fileName = file.replace(workFolder, '').replace(/^\\+/, '');
        analysis += `- \`${fileName}\` (importado ${count}x)\n`;
      });
      analysis += '\n';
    }
    
    return analysis;
  };

  // ── Helper: Encontra arquivos relevantes baseado em palavras-chave ──────────────────────────────────
  const findRelevantFiles = async (
    keywords: string[], 
    workFolder: string, 
    maxFiles: number = 5
  ): Promise<{files: Array<{path: string, content: string}>, dependencyGraph: Map<string, string[]>}> => {
    try {
      // Lista arquivos do projeto
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) return {files: [], dependencyGraph: new Map()};
      
      const relevantFiles: Array<{path: string, score: number}> = [];
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.txt', '.vue', '.svelte'];
      
      // Pontuação de arquivos baseado em keywords
      for (const file of listResult.files) {
        if (file.isDirectory) continue;
        
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !extensions.includes(`.${ext}`)) continue;
        
        const nameLower = file.name.toLowerCase();
        const pathLower = file.path.toLowerCase();
        
        let score = 0;
        for (const keyword of keywords) {
          if (nameLower.includes(keyword)) score += 10;
          if (pathLower.includes(keyword)) score += 5;
        }
        
        if (score > 0) {
          relevantFiles.push({ path: file.path, score });
        }
      }
      
      // Ordena por pontuação e pega os top N
      relevantFiles.sort((a, b) => b.score - a.score);
      const topFiles = relevantFiles.slice(0, Math.min(3, maxFiles)); // Pega no máximo 3 arquivos iniciais
      
      // Para cada arquivo relevante, também lê seus imports
      const allFiles: Array<{path: string, content: string}> = [];
      const visited = new Set<string>();
      const dependencyGraph = new Map<string, string[]>();
      
      for (const file of topFiles) {
        const filesWithImports = await readFileWithImports(
          file.path,
          workFolder,
          visited,
          0, // depth inicial
          2, // máximo 2 níveis de profundidade
          maxFiles, // limite total de arquivos
          dependencyGraph,
          []
        );
        
        allFiles.push(...filesWithImports);
        
        // Para se já temos arquivos suficientes
        if (allFiles.length >= maxFiles) break;
      }
      
      // Remove duplicatas por path
      const uniqueFiles = Array.from(
        new Map(allFiles.map(f => [f.path, f])).values()
      );
      
      return {
        files: uniqueFiles.slice(0, maxFiles),
        dependencyGraph
      };
    } catch (error) {
      console.error('[findRelevantFiles] Erro:', error);
      return {files: [], dependencyGraph: new Map()};
    }
  };

  // ── Helper: Detecta erros de compilação no projeto ─────────────────────────
  const detectCompilationErrors = async (workFolder: string): Promise<string> => {
    try {
      let errorsContext = '';
      
      // 1. Verifica se tem TypeScript (tsconfig.json)
      const tsconfigPath = `${workFolder}\\tsconfig.json`;
      const tsconfigResult = await window.electronAPI.readFile(tsconfigPath);
      
      if (tsconfigResult.success) {
        // Tem TypeScript - roda tsc --noEmit para checar erros
        try {
          addTerminal('🔷 Verificando erros TypeScript...');
          const tscCommand = 'npx tsc --noEmit --pretty false 2>&1';
          const tscResult = await window.electronAPI.executeCommand(tscCommand, workFolder);
          
          if (tscResult.output && tscResult.output.trim()) {
            // Parse erros do TypeScript
            const errors = tscResult.output.split('\n')
              .filter(line => line.includes('error TS'))
              .slice(0, 10); // Limita a 10 erros
            
            if (errors.length > 0) {
              addTerminal(`⚠️ ${errors.length} erro(s) TypeScript encontrado(s)`);
              errorsContext += `\n## ⚠️ ERROS DE TYPESCRIPT DETECTADOS:\n`;
              errors.forEach((error, idx) => {
                errorsContext += `${idx + 1}. ${error.trim()}\n`;
              });
              errorsContext += `\n> Total: ${errors.length} erro(s) de TypeScript encontrado(s)\n`;
            } else {
              addTerminal('✅ TypeScript OK');
            }
          } else {
            addTerminal('✅ TypeScript OK');
          }
        } catch (tscError) {
          console.log('[detectCompilationErrors] TypeScript check falhou:', tscError);
          addTerminal('⚠️ Não foi possível verificar TypeScript');
        }
      }
      
      // 2. Verifica se tem ESLint (.eslintrc, eslint.config.js, etc)
      const eslintConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js'];
      let hasEslint = false;
      
      for (const configFile of eslintConfigs) {
        const eslintPath = `${workFolder}\\${configFile}`;
        const eslintResult = await window.electronAPI.readFile(eslintPath);
        if (eslintResult.success) {
          hasEslint = true;
          break;
        }
      }
      
      if (hasEslint) {
        try {
          addTerminal('📋 Verificando ESLint...');
          const eslintCommand = 'npx eslint . --format json 2>&1';
          const eslintResult = await window.electronAPI.executeCommand(eslintCommand, workFolder);
          
          if (eslintResult.output) {
            try {
              // Tenta parsear JSON do ESLint
              const jsonMatch = eslintResult.output.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const eslintData = JSON.parse(jsonMatch[0]);
                const filesWithErrors = eslintData.filter((f: any) => f.errorCount > 0).slice(0, 5);
                
                if (filesWithErrors.length > 0) {
                  const totalErrors = filesWithErrors.reduce((sum: number, f: any) => sum + f.errorCount, 0);
                  addTerminal(`⚠️ ${totalErrors} erro(s) ESLint encontrado(s)`);
                  errorsContext += `\n## ⚠️ ERROS DE ESLINT DETECTADOS:\n`;
                  filesWithErrors.forEach((file: any) => {
                    const fileName = file.filePath.split('\\').pop() || file.filePath.split('/').pop();
                    errorsContext += `\n### ${fileName}:\n`;
                    file.messages.slice(0, 3).forEach((msg: any) => {
                      errorsContext += `- Linha ${msg.line}: ${msg.message} (${msg.ruleId})\n`;
                    });
                  });
                } else {
                  addTerminal('✅ ESLint OK');
                }
              }
            } catch (parseError) {
              // ESLint output não é JSON válido, ignora
              addTerminal('✅ ESLint OK');
            }
          }
        } catch (eslintError) {
          console.log('[detectCompilationErrors] ESLint check falhou:', eslintError);
          addTerminal('⚠️ Não foi possível verificar ESLint');
        }
      }
      
      // 3. Verifica package.json para outros comandos de build
      const packageJsonPath = `${workFolder}\\package.json`;
      const pkgResult = await window.electronAPI.readFile(packageJsonPath);
      
      if (pkgResult.success && pkgResult.content) {
        try {
          const pkg = JSON.parse(pkgResult.content);
          
          // Se tem script "check" ou "type-check"
          if (pkg.scripts?.check || pkg.scripts?.['type-check']) {
            const checkCmd = pkg.scripts.check || pkg.scripts['type-check'];
            try {
              addTerminal(`⚙️ Rodando: ${checkCmd}`);
              const checkResult = await window.electronAPI.executeCommand(checkCmd, workFolder);
              if (checkResult.output && checkResult.output.includes('error')) {
                const errors = checkResult.output.split('\n')
                  .filter(line => line.toLowerCase().includes('error'))
                  .slice(0, 5);
                
                if (errors.length > 0) {
                  addTerminal(`⚠️ ${errors.length} erro(s) encontrado(s)`);
                  errorsContext += `\n## ⚠️ ERROS DO COMANDO '${checkCmd}':\n`;
                  errors.forEach((error, idx) => {
                    errorsContext += `${idx + 1}. ${error.trim()}\n`;
                  });
                } else {
                  addTerminal('✅ Check OK');
                }
              } else {
                addTerminal('✅ Check OK');
              }
            } catch (checkError) {
              console.log('[detectCompilationErrors] Check command falhou:', checkError);
              addTerminal('⚠️ Check falhou');
            }
          }
        } catch (jsonError) {
          console.log('[detectCompilationErrors] Package.json parse falhou:', jsonError);
        }
      }
      
      if (!errorsContext) {
        errorsContext = `\n## ✅ Nenhum erro de compilação detectado\n`;
      }
      
      return errorsContext;
    } catch (error) {
      console.error('[detectCompilationErrors] Erro geral:', error);
      return '';
    }
  };

  // ── Helper: Sugere melhorias de código automaticamente ──────────────────────
  const suggestCodeImprovements = async (workFolder: string): Promise<string> => {
    try {
      let suggestionsContext = '';
      
      addTerminal('💡 Analisando código para sugestões...');
      
      // Lista arquivos de código do projeto
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) {
        return '';
      }
      
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'];
      const codeFiles = listResult.files
        .filter(f => !f.isDirectory && codeExtensions.some(ext => f.name.endsWith(ext)))
        .slice(0, 10); // Limita a 10 arquivos
      
      if (codeFiles.length === 0) {
        return '';
      }
      
      const issues: Array<{file: string, type: string, severity: string, message: string}> = [];
      const refactoringSuggestions: Array<{file: string, type: string, issue: string, suggestion: string, codeSnippet?: string}> = [];
      
      // Analisa cada arquivo
      for (const file of codeFiles) {
        const readResult = await window.electronAPI.readFile(file.path);
        if (!readResult.success || !readResult.content) continue;
        
        const content = readResult.content;
        const fileName = file.name;
        const lines = content.split('\n');
        
        // 1. Code Smells - Funções muito grandes
        const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*\{/g);
        if (functionMatches && functionMatches.length > 0) {
          // Conta linhas entre { e }
          const functionSizes = [];
          let braceCount = 0;
          let functionStart = -1;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('function')) {
              functionStart = i;
              braceCount = 0;
            }
            if (functionStart >= 0) {
              braceCount += (line.match(/\{/g) || []).length;
              braceCount -= (line.match(/\}/g) || []).length;
              if (braceCount === 0 && line.includes('}')) {
                const size = i - functionStart;
                if (size > 50) {
                  functionSizes.push(size);
                  issues.push({
                    file: fileName,
                    type: 'Code Smell',
                    severity: 'Médio',
                    message: `Função muito grande (~${size} linhas). Considere quebrar em funções menores para melhor manutenção.`
                  });
                }
                functionStart = -1;
              }
            }
          }
        }
        
        // 2. Segurança - eval(), innerHTML, dangerouslySetInnerHTML
        if (content.includes('eval(')) {
          issues.push({
            file: fileName,
            type: 'Segurança',
            severity: 'Alto',
            message: 'Uso de eval() detectado. Evite eval() por riscos de segurança (code injection).'
          });
        }
        
        if (content.includes('innerHTML') || content.includes('dangerouslySetInnerHTML')) {
          issues.push({
            file: fileName,
            type: 'Segurança',
            severity: 'Médio',
            message: 'Uso de innerHTML/dangerouslySetInnerHTML. Cuidado com XSS - sanitize o conteúdo antes.'
          });
        }
        
        // 3. Performance - console.log em produção
        const consoleCount = (content.match(/console\.log\(/g) || []).length;
        if (consoleCount > 5) {
          issues.push({
            file: fileName,
            type: 'Performance',
            severity: 'Baixo',
            message: `${consoleCount} console.log() encontrados. Remova em produção ou use logger adequado.`
          });
        }
        
        // 4. Boas Práticas - var vs const/let
        const varCount = (content.match(/\bvar\s+/g) || []).length;
        if (varCount > 0) {
          issues.push({
            file: fileName,
            type: 'Boas Práticas',
            severity: 'Baixo',
            message: `${varCount} declarações com 'var'. Prefira 'const' ou 'let' (ES6+).`
          });
        }
        
        // 5. Boas Práticas - Callbacks aninhados (callback hell)
        let maxNesting = 0;
        let currentNesting = 0;
        for (const line of lines) {
          currentNesting += (line.match(/\bfunction\s*\(/g) || []).length;
          currentNesting += (line.match(/=>\s*\{/g) || []).length;
          if (currentNesting > maxNesting) maxNesting = currentNesting;
          currentNesting -= (line.match(/\}\s*\)/g) || []).length;
        }
        if (maxNesting > 3) {
          issues.push({
            file: fileName,
            type: 'Boas Práticas',
            severity: 'Médio',
            message: `Callbacks muito aninhados (${maxNesting} níveis). Considere usar async/await ou Promises.`
          });
        }
        
        // 6. Performance - Loops desnecessários
        if (content.includes('.forEach(') && content.includes('.map(')) {
          const forEachCount = (content.match(/\.forEach\(/g) || []).length;
          const mapCount = (content.match(/\.map\(/g) || []).length;
          if (forEachCount > 3 || mapCount > 3) {
            issues.push({
              file: fileName,
              type: 'Performance',
              severity: 'Baixo',
              message: 'Múltiplos .forEach/.map. Se processar o mesmo array várias vezes, considere combinar em um único loop.'
            });
          }
        }
        
        // 7. Boas Práticas - Magic numbers
        const numberLiterals = content.match(/\b\d{3,}\b/g);
        if (numberLiterals && numberLiterals.length > 5) {
          issues.push({
            file: fileName,
            type: 'Boas Práticas',
            severity: 'Baixo',
            message: `Números mágicos encontrados (${numberLiterals.length}). Considere usar constantes nomeadas.`
          });
        }
        
        // 8. Segurança - Senhas/secrets hardcoded
        const secretPatterns = [
          /password\s*[:=]\s*['"][^'"]{3,}['"]/i,
          /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/i,
          /secret\s*[:=]\s*['"][^'"]{5,}['"]/i,
          /token\s*[:=]\s*['"][^'"]{10,}['"]/i,
        ];
        
        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            issues.push({
              file: fileName,
              type: 'Segurança',
              severity: 'Alto',
              message: 'Possível senha/secret/token hardcoded. Use variáveis de ambiente (.env) ao invés.'
            });
            break;
          }
        }
        
        // 9. Boas Práticas - Try/catch vazio
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
          issues.push({
            file: fileName,
            type: 'Boas Práticas',
            severity: 'Médio',
            message: 'Bloco catch vazio detectado. Sempre trate ou registre erros adequadamente.'
          });
        }
        
        // 10. Performance - Imports não utilizados (básico)
        const imports = content.match(/import\s+.*?\s+from/g);
        if (imports && imports.length > 20) {
          issues.push({
            file: fileName,
            type: 'Performance',
            severity: 'Baixo',
            message: `Muitos imports (${imports.length}). Verifique se todos são necessários (tree-shaking).`
          });
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // REFATORAÇÃO AUTOMÁTICA - Detecta oportunidades de melhorar o código
        // ═══════════════════════════════════════════════════════════════════════
        
        // REFACTOR 1: Código duplicado (funções/blocos similares)
        const functionBodies: Array<{start: number, end: number, code: string}> = [];
        let braceDepth = 0;
        let funcStart = -1;
        let funcCode = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/function\s+\w+|const\s+\w+\s*=\s*\(/)) {
            funcStart = i;
            funcCode = '';
            braceDepth = 0;
          }
          if (funcStart >= 0) {
            funcCode += line + '\n';
            braceDepth += (line.match(/\{/g) || []).length;
            braceDepth -= (line.match(/\}/g) || []).length;
            
            if (braceDepth === 0 && line.includes('}')) {
              functionBodies.push({ start: funcStart, end: i, code: funcCode });
              funcStart = -1;
            }
          }
        }
        
        // Detecta duplicação (comparação simples - 70% de similaridade)
        for (let i = 0; i < functionBodies.length; i++) {
          for (let j = i + 1; j < functionBodies.length; j++) {
            const code1 = functionBodies[i].code.replace(/\s+/g, ' ').toLowerCase();
            const code2 = functionBodies[j].code.replace(/\s+/g, ' ').toLowerCase();
            
            // Similaridade simples: conta palavras em comum
            const words1 = new Set(code1.split(' ').filter(w => w.length > 3));
            const words2 = new Set(code2.split(' ').filter(w => w.length > 3));
            const commonWords = [...words1].filter(w => words2.has(w)).length;
            const similarity = commonWords / Math.max(words1.size, words2.size);
            
            if (similarity > 0.7 && functionBodies[i].code.length > 100) {
              refactoringSuggestions.push({
                file: fileName,
                type: 'Duplicação',
                issue: `Código duplicado detectado (${Math.round(similarity * 100)}% similar)`,
                suggestion: 'Extraia a lógica comum em uma função reutilizável',
                codeSnippet: functionBodies[i].code.slice(0, 200)
              });
              break; // Evita múltiplos alertas para o mesmo código
            }
          }
        }
        
        // REFACTOR 2: Variáveis com nomes ruins (x, y, temp, data, obj, arr, etc.)
        const badVarNames = content.match(/\b(?:const|let|var)\s+(x|y|z|temp|tmp|data|obj|arr|foo|bar|test|a|b|c)\b/g);
        if (badVarNames && badVarNames.length > 0) {
          refactoringSuggestions.push({
            file: fileName,
            type: 'Nomenclatura',
            issue: `${badVarNames.length} variável(is) com nome genérico: ${badVarNames.slice(0, 3).join(', ')}`,
            suggestion: 'Renomeie variáveis para nomes descritivos que expliquem seu propósito'
          });
        }
        
        // REFACTOR 3: Condicionais aninhadas demais (> 3 níveis)
        let maxIfNesting = 0;
        let currentIfNesting = 0;
        let deeplyNestedLine = -1;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/\bif\s*\(/)) {
            currentIfNesting++;
            if (currentIfNesting > maxIfNesting) {
              maxIfNesting = currentIfNesting;
              deeplyNestedLine = i;
            }
          }
          if (line.includes('}') && currentIfNesting > 0) {
            currentIfNesting--;
          }
        }
        
        if (maxIfNesting > 3) {
          const snippet = lines.slice(Math.max(0, deeplyNestedLine - 2), deeplyNestedLine + 3).join('\n');
          refactoringSuggestions.push({
            file: fileName,
            type: 'Complexidade',
            issue: `Condicionais aninhadas demais (${maxIfNesting} níveis)`,
            suggestion: 'Use early return, guard clauses ou extraia em funções menores',
            codeSnippet: snippet
          });
        }
        
        // REFACTOR 4: Parâmetros demais em funções (> 4)
        const functionWithManyParams = content.match(/function\s+\w+\s*\(([^)]{50,})\)/g);
        if (functionWithManyParams && functionWithManyParams.length > 0) {
          refactoringSuggestions.push({
            file: fileName,
            type: 'Assinatura de Função',
            issue: `${functionWithManyParams.length} função(ões) com muitos parâmetros`,
            suggestion: 'Agrupe parâmetros relacionados em um objeto de configuração',
            codeSnippet: functionWithManyParams[0]
          });
        }
        
        // REFACTOR 5: Strings concatenadas em loops
        if (content.includes('+=') && (content.includes('for (') || content.includes('while ('))) {
          const loopStrConcat = content.match(/for\s*\([^)]+\)[^{]*\{[^}]*\+=\s*['"`]/);
          if (loopStrConcat) {
            refactoringSuggestions.push({
              file: fileName,
              type: 'Performance',
              issue: 'Concatenação de string dentro de loop detectada',
              suggestion: 'Use array.push() + array.join() ou template literals para melhor performance'
            });
          }
        }
        
        // REFACTOR 6: Números mágicos repetidos
        const numberMatches = content.match(/\b\d{2,}\b/g);
        if (numberMatches) {
          const numberCounts = new Map<string, number>();
          numberMatches.forEach(num => {
            numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
          });
          
          const repeatedNumbers = Array.from(numberCounts.entries())
            .filter(([_, count]) => count >= 3)
            .map(([num]) => num);
          
          if (repeatedNumbers.length > 0) {
            refactoringSuggestions.push({
              file: fileName,
              type: 'Constantes',
              issue: `Números repetidos: ${repeatedNumbers.slice(0, 3).join(', ')} (usados 3+ vezes)`,
              suggestion: 'Extraia para constantes nomeadas no topo do arquivo'
            });
          }
        }
        
        // REFACTOR 7: Switch/if-else muito longo (> 5 casos)
        const switchCases = content.match(/case\s+[^:]+:/g);
        if (switchCases && switchCases.length > 5) {
          refactoringSuggestions.push({
            file: fileName,
            type: 'Estrutura',
            issue: `Switch com ${switchCases.length} cases (muito complexo)`,
            suggestion: 'Considere usar um objeto/Map de estratégias ou pattern matching'
          });
        }
        
        // REFACTOR 8: Comentários explicando código (código não auto-explicativo)
        const explainComments = lines.filter(line => {
          const comment = line.match(/\/\/\s*(.+)/);
          if (!comment) return false;
          const text = comment[1].toLowerCase();
          return text.includes('this ') || text.includes('here ') || text.includes('below') || 
                 text.includes('aqui') || text.includes('isso') || text.includes('abaixo');
        });
        
        if (explainComments.length > 3) {
          refactoringSuggestions.push({
            file: fileName,
            type: 'Legibilidade',
            issue: `${explainComments.length} comentários explicando código`,
            suggestion: 'Refatore o código para ser auto-explicativo (nomes claros, funções pequenas) ao invés de usar comentários'
          });
        }
      }
      
      // Monta o contexto de sugestões
      if (issues.length > 0) {
        // Agrupa por severidade
        const highIssues = issues.filter(i => i.severity === 'Alto');
        const mediumIssues = issues.filter(i => i.severity === 'Médio');
        const lowIssues = issues.filter(i => i.severity === 'Baixo');
        
        suggestionsContext += `\n## 💡 SUGESTÕES DE MELHORIA:\n`;
        suggestionsContext += `Total: ${issues.length} sugestão(ões) encontrada(s)\n`;
        
        if (highIssues.length > 0) {
          addTerminal(`🔴 ${highIssues.length} problema(s) de alta prioridade`);
          suggestionsContext += `\n### 🔴 ALTA PRIORIDADE (${highIssues.length}):\n`;
          highIssues.slice(0, 5).forEach(issue => {
            suggestionsContext += `- **${issue.file}** [${issue.type}]: ${issue.message}\n`;
          });
        }
        
        if (mediumIssues.length > 0) {
          addTerminal(`🟡 ${mediumIssues.length} problema(s) de média prioridade`);
          suggestionsContext += `\n### 🟡 MÉDIA PRIORIDADE (${mediumIssues.length}):\n`;
          mediumIssues.slice(0, 5).forEach(issue => {
            suggestionsContext += `- **${issue.file}** [${issue.type}]: ${issue.message}\n`;
          });
        }
        
        if (lowIssues.length > 0) {
          addTerminal(`🟢 ${lowIssues.length} sugestão(ões) de melhoria`);
          suggestionsContext += `\n### 🟢 MELHORIAS SUGERIDAS (${lowIssues.length}):\n`;
          lowIssues.slice(0, 5).forEach(issue => {
            suggestionsContext += `- **${issue.file}** [${issue.type}]: ${issue.message}\n`;
          });
        }
        
        suggestionsContext += `\n> 💡 Dica: Você pode pedir para o Bill corrigir automaticamente estes problemas!\n`;
      } else {
        addTerminal('✅ Nenhum problema detectado!');
        suggestionsContext += `\n## ✅ CÓDIGO LIMPO:\nNenhum problema detectado na análise automática!\n`;
      }
      
      // Adiciona sugestões de refatoração
      if (refactoringSuggestions.length > 0) {
        addTerminal(`🔧 ${refactoringSuggestions.length} oportunidade(s) de refatoração`);
        suggestionsContext += `\n## 🔧 OPORTUNIDADES DE REFATORAÇÃO:\n`;
        suggestionsContext += `Total: ${refactoringSuggestions.length} oportunidade(s) detectada(s)\n\n`;
        
        refactoringSuggestions.slice(0, 8).forEach((ref, idx) => {
          suggestionsContext += `### ${idx + 1}. ${ref.file} - ${ref.type}\n`;
          suggestionsContext += `**Problema:** ${ref.issue}\n`;
          suggestionsContext += `**Sugestão:** ${ref.suggestion}\n`;
          if (ref.codeSnippet) {
            suggestionsContext += `\`\`\`\n${ref.codeSnippet.slice(0, 150)}${ref.codeSnippet.length > 150 ? '...' : ''}\n\`\`\`\n`;
          }
          suggestionsContext += '\n';
        });
        
        suggestionsContext += `> 🔧 Dica: Diga "refatore o código" ou "aplique as refatorações" para o Bill fazer automaticamente!\n`;
      }
      
      return suggestionsContext;
    } catch (error) {
      console.error('[suggestCodeImprovements] Erro:', error);
      addTerminal('⚠️ Erro ao analisar código');
      return '';
    }
  };

  // ── Helper: Sugere breakpoints e estratégias de debugging ────────────────────
  const suggestDebuggingStrategy = async (workFolder: string): Promise<string> => {
    try {
      let debugContext = '';
      
      addTerminal('🐛 Analisando pontos de debug...');
      
      // Lista arquivos de código
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) {
        return '';
      }
      
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs'];
      const codeFiles = listResult.files
        .filter(f => !f.isDirectory && codeExtensions.some(ext => f.name.endsWith(ext)))
        .slice(0, 10);
      
      if (codeFiles.length === 0) {
        return '';
      }
      
      const debuggingSuggestions: Array<{
        file: string,
        line: number,
        type: 'breakpoint' | 'logging' | 'watch' | 'conditional' | 'race-condition',
        reason: string,
        code: string,
        strategy: string
      }> = [];
      
      for (const file of codeFiles) {
        const readResult = await window.electronAPI.readFile(file.path);
        if (!readResult.success || !readResult.content) continue;
        
        const content = readResult.content;
        const fileName = file.name;
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();
          
          // 1. BREAKPOINT - Chamadas de API/fetch
          if (/fetch\(|axios\.|\.get\(|\.post\(|\.put\(|\.delete\(/i.test(trimmed)) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'breakpoint',
              reason: 'Chamada de API - verifique request/response',
              code: trimmed.slice(0, 60),
              strategy: 'Coloque breakpoint ANTES e DEPOIS da chamada para inspecionar dados enviados e recebidos'
            });
          }
          
          // 2. BREAKPOINT - Loops com lógica complexa
          if ((/for\s*\(|while\s*\(|\.map\(|\.filter\(|\.reduce\(/.test(trimmed)) && 
              (lines[i + 1]?.includes('if') || lines[i + 2]?.includes('if'))) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'breakpoint',
              reason: 'Loop com condicionais - verifique iterações',
              code: trimmed.slice(0, 60),
              strategy: 'Breakpoint dentro do loop para ver valores a cada iteração'
            });
          }
          
          // 3. LOGGING - Try/catch sem log adequado
          if (trimmed.startsWith('catch') && i + 1 < lines.length) {
            const catchBlock = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
            if (!catchBlock.includes('console.') && !catchBlock.includes('logger.') && !catchBlock.includes('print(')) {
              debuggingSuggestions.push({
                file: fileName,
                line: i + 1,
                type: 'logging',
                reason: 'Catch sem logging - adicione log de erro',
                code: trimmed,
                strategy: 'Adicione console.error(error) ou logger.error() para capturar detalhes do erro'
              });
            }
          }
          
          // 4. LOGGING - Funções assíncronas sem tratamento
          if (/async\s+function|async\s+\(|=\s*async\s*\(/.test(trimmed)) {
            const funcBlock = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');
            if (!funcBlock.includes('try') && !funcBlock.includes('catch') && 
                (funcBlock.includes('await') || funcBlock.includes('.then'))) {
              debuggingSuggestions.push({
                file: fileName,
                line: i + 1,
                type: 'logging',
                reason: 'Async sem try/catch - adicione tratamento de erro',
                code: trimmed.slice(0, 60),
                strategy: 'Envolva código async em try/catch e adicione logging de erros'
              });
            }
          }
          
          // 5. WATCH - Mutação de estado/variável importante
          if (/setState|setData|set[A-Z]|\.push\(|\.pop\(|\.shift\(|\.splice\(/.test(trimmed)) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'watch',
              reason: 'Mutação de estado - monitore valor antes/depois',
              code: trimmed.slice(0, 60),
              strategy: 'Use "watch" no debugger para monitorar essa variável em tempo real'
            });
          }
          
          // 6. CONDITIONAL BREAKPOINT - Condições complexas
          if (/if\s*\([^)]{30,}\)|&&.*&&|(\|\|.*){2,}/.test(trimmed)) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'conditional',
              reason: 'Condição complexa - pode ter lógica errada',
              code: trimmed.slice(0, 60),
              strategy: 'Breakpoint condicional: pare apenas quando a condição específica ocorrer'
            });
          }
          
          // 7. RACE CONDITION - setTimeout/setInterval + mutação
          if (/(setTimeout|setInterval|Promise\.race)/i.test(trimmed)) {
            const contextLines = lines.slice(Math.max(0, i - 2), Math.min(i + 5, lines.length)).join('\n');
            if (/setState|setData|\.push\(|=/.test(contextLines)) {
              debuggingSuggestions.push({
                file: fileName,
                line: i + 1,
                type: 'race-condition',
                reason: 'Possível race condition - operação assíncrona com mutação',
                code: trimmed.slice(0, 60),
                strategy: 'Verifique se múltiplas operações assíncronas não estão modificando o mesmo dado'
              });
            }
          }
          
          // 8. BREAKPOINT - Cálculos/operações matemáticas complexas
          if (/[\+\-\*\/]\s*[\+\-\*\/]|Math\.|parseFloat|parseInt|\.toFixed/.test(trimmed) && 
              trimmed.length > 40) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'breakpoint',
              reason: 'Cálculo complexo - verifique valores intermediários',
              code: trimmed.slice(0, 60),
              strategy: 'Breakpoint para inspecionar valores antes e depois do cálculo'
            });
          }
          
          // 9. LOGGING - Callbacks aninhados (callback hell)
          let callbackDepth = 0;
          for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].includes('function(') || lines[j].includes('=>')) callbackDepth++;
          }
          if (callbackDepth >= 2) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'logging',
              reason: 'Callbacks aninhados - difícil rastrear fluxo',
              code: trimmed.slice(0, 60),
              strategy: 'Adicione console.log com label em cada callback para rastrear execução'
            });
          }
          
          // 10. BREAKPOINT - Manipulação de DOM
          if (/document\.|getElementById|querySelector|\.innerHTML|\.appendChild/.test(trimmed)) {
            debuggingSuggestions.push({
              file: fileName,
              line: i + 1,
              type: 'breakpoint',
              reason: 'Manipulação DOM - elemento pode não existir',
              code: trimmed.slice(0, 60),
              strategy: 'Breakpoint para verificar se elemento existe antes de manipular'
            });
          }
        }
      }
      
      if (debuggingSuggestions.length === 0) {
        addTerminal('✅ Código parece saudável para debug');
        return '';
      }
      
      // Agrupa por tipo
      const breakpoints = debuggingSuggestions.filter(s => s.type === 'breakpoint');
      const logging = debuggingSuggestions.filter(s => s.type === 'logging');
      const watch = debuggingSuggestions.filter(s => s.type === 'watch');
      const conditional = debuggingSuggestions.filter(s => s.type === 'conditional');
      const raceConditions = debuggingSuggestions.filter(s => s.type === 'race-condition');
      
      addTerminal(`🐛 ${debuggingSuggestions.length} sugestão(ões) de debugging`);
      
      debugContext += `\n## 🐛 ESTRATÉGIAS DE DEBUGGING:\n`;
      debugContext += `Total: ${debuggingSuggestions.length} sugestão(ões) para facilitar debug\n\n`;
      
      // BREAKPOINTS
      if (breakpoints.length > 0) {
        debugContext += `### 🔴 BREAKPOINTS RECOMENDADOS (${breakpoints.length}):\n`;
        breakpoints.slice(0, 5).forEach((sugg, idx) => {
          debugContext += `\n**${idx + 1}. ${sugg.file}:${sugg.line}**\n`;
          debugContext += `📍 **Motivo:** ${sugg.reason}\n`;
          debugContext += `\`\`\`\n${sugg.code}\n\`\`\`\n`;
          debugContext += `💡 **Estratégia:** ${sugg.strategy}\n`;
        });
      }
      
      // LOGGING
      if (logging.length > 0) {
        debugContext += `\n### 📝 ADICIONAR LOGGING (${logging.length}):\n`;
        logging.slice(0, 5).forEach((sugg, idx) => {
          debugContext += `\n**${idx + 1}. ${sugg.file}:${sugg.line}**\n`;
          debugContext += `- ${sugg.reason}\n`;
          debugContext += `  💡 ${sugg.strategy}\n`;
        });
      }
      
      // WATCH EXPRESSIONS
      if (watch.length > 0) {
        debugContext += `\n### 👁️ VARIÁVEIS PARA MONITORAR (${watch.length}):\n`;
        watch.slice(0, 3).forEach((sugg) => {
          debugContext += `- **${sugg.file}:${sugg.line}** - ${sugg.reason}\n`;
        });
      }
      
      // CONDITIONAL BREAKPOINTS
      if (conditional.length > 0) {
        debugContext += `\n### ⚙️ BREAKPOINTS CONDICIONAIS (${conditional.length}):\n`;
        conditional.slice(0, 3).forEach((sugg) => {
          debugContext += `- **${sugg.file}:${sugg.line}** - ${sugg.reason}\n`;
          debugContext += `  \`${sugg.code}\`\n`;
        });
      }
      
      // RACE CONDITIONS
      if (raceConditions.length > 0) {
        debugContext += `\n### ⚠️ POSSÍVEIS RACE CONDITIONS (${raceConditions.length}):\n`;
        raceConditions.forEach((sugg) => {
          debugContext += `- **${sugg.file}:${sugg.line}** - ${sugg.reason}\n`;
          debugContext += `  💡 ${sugg.strategy}\n`;
        });
      }
      
      debugContext += `\n### 🎯 DICAS GERAIS DE DEBUGGING:\n`;
      debugContext += `1. **VS Code**: F9 para toggle breakpoint, F5 para iniciar debug\n`;
      debugContext += `2. **Chrome DevTools**: F12 → Sources → Clique na linha para breakpoint\n`;
      debugContext += `3. **Console tricks**: Use \`console.table()\` para arrays/objetos, \`console.trace()\` para stack trace\n`;
      debugContext += `4. **Network tab**: Monitore requisições HTTP para debug de APIs\n`;
      debugContext += `5. **Debugger statement**: Adicione \`debugger;\` no código para pausar execução\n`;
      
      debugContext += `\n> 🐛 Dica: Diga "adicione logs de debug" ou "coloque breakpoints" para o Bill implementar automaticamente!\n`;
      
      return debugContext;
    } catch (error) {
      console.error('[suggestDebuggingStrategy] Erro:', error);
      addTerminal('⚠️ Erro ao analisar debugging');
      return '';
    }
  };

  // ── Helper: Lê e analisa logs de erro automaticamente ────────────────────────
  const analyzeErrorLogs = async (workFolder: string): Promise<string> => {
    try {
      let logsContext = '';
      
      addTerminal('📋 Analisando logs de erro...');
      
      // Lista arquivos no projeto
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) {
        return '';
      }
      
      // Procura por arquivos de log comuns
      const logPatterns = [
        '.log', 'error.log', 'errors.log', 'debug.log', 'app.log',
        'npm-debug.log', 'yarn-error.log', 'pnpm-debug.log',
        'output.log', 'server.log', 'access.log', 'crash.log'
      ];
      
      const logFiles = listResult.files.filter(f => 
        !f.isDirectory && logPatterns.some(pattern => f.name.toLowerCase().includes(pattern))
      );
      
      // Também procura em subpastas comuns de logs
      const logFolders = ['logs', 'log', '.logs', 'var/log'];
      for (const folder of logFolders) {
        const folderPath = `${workFolder}\\${folder}`;
        const folderResult = await window.electronAPI.listDirectory(folderPath);
        if (folderResult.success && folderResult.files) {
          logFiles.push(...folderResult.files.filter(f => !f.isDirectory && f.name.endsWith('.log')));
        }
      }
      
      if (logFiles.length === 0) {
        addTerminal('ℹ️ Nenhum arquivo de log encontrado');
        return '';
      }
      
      addTerminal(`📂 ${logFiles.length} arquivo(s) de log encontrado(s)`);
      
      // Estrutura para armazenar erros encontrados
      const errors: Array<{
        file: string,
        level: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO',
        message: string,
        stackTrace?: string,
        timestamp?: string,
        relatedFile?: string,
        lineNumber?: number
      }> = [];
      
      // Analisa cada arquivo de log (limita tamanho para não sobrecarregar)
      for (const logFile of logFiles.slice(0, 5)) {
        const readResult = await window.electronAPI.readFile(logFile.path);
        if (!readResult.success || !readResult.content) continue;
        
        const content = readResult.content;
        const fileName = logFile.name;
        
        // Pega apenas as últimas 2000 linhas (logs mais recentes)
        const lines = content.split('\n').slice(-2000);
        
        // Regex patterns para detectar erros
        const errorPatterns = [
          // Node.js / JavaScript errors
          /^Error:\s*(.+)$/i,
          /^(.+Error):\s*(.+)$/,
          /^(TypeError|ReferenceError|SyntaxError|RangeError):\s*(.+)$/,
          
          // Python errors
          /^(\w+Error):\s*(.+)$/,
          /^Traceback \(most recent call last\):/,
          
          // Java errors
          /^Exception in thread ".*?" (\w+Exception):\s*(.+)$/,
          
          // Generic error patterns
          /\[ERROR\]\s*(.+)$/i,
          /ERROR:\s*(.+)$/i,
          /\[CRITICAL\]\s*(.+)$/i,
          /CRITICAL:\s*(.+)$/i,
          /\[FATAL\]\s*(.+)$/i,
          /FATAL:\s*(.+)$/i,
          
          // Warning patterns
          /\[WARN\]\s*(.+)$/i,
          /WARNING:\s*(.+)$/i,
        ];
        
        let i = 0;
        while (i < lines.length) {
          const line = lines[i];
          
          // Detecta nível do erro
          let level: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO' = 'INFO';
          if (/CRITICAL|FATAL/i.test(line)) level = 'CRITICAL';
          else if (/ERROR|Exception|Error:/i.test(line)) level = 'ERROR';
          else if (/WARN/i.test(line)) level = 'WARN';
          
          // Tenta extrair timestamp (ISO, Unix, ou formato comum)
          const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}|\d{10,13}|^\[\d{2}:\d{2}:\d{2}\])/);
          const timestamp = timestampMatch ? timestampMatch[1] : undefined;
          
          // Verifica se a linha contém erro
          for (const pattern of errorPatterns) {
            const match = line.match(pattern);
            if (match) {
              let errorMessage = match[2] || match[1] || line.trim();
              let stackTrace = '';
              let relatedFile: string | undefined;
              let lineNumber: number | undefined;
              
              // Captura stack trace (próximas linhas que começam com espaço ou "at")
              let j = i + 1;
              while (j < lines.length && j < i + 15) {
                const nextLine = lines[j];
                if (nextLine.startsWith('    at ') || nextLine.startsWith('  at ') || 
                    nextLine.match(/^\s+at\s+/) || nextLine.match(/^\s+File\s+"/) ||
                    nextLine.match(/^\s+\w+\.[\w.]+/)) {
                  stackTrace += nextLine + '\n';
                  
                  // Extrai arquivo e linha do stack trace
                  const fileMatch = nextLine.match(/\(([^:)]+):(\d+):\d+\)/) || 
                                   nextLine.match(/at\s+([^:]+):(\d+):\d+/) ||
                                   nextLine.match(/File "([^"]+)", line (\d+)/);
                  if (fileMatch && !relatedFile) {
                    relatedFile = fileMatch[1];
                    lineNumber = parseInt(fileMatch[2]);
                  }
                  j++;
                } else if (nextLine.trim().length === 0) {
                  j++;
                } else {
                  break;
                }
              }
              
              // Remove caminhos absolutos longos para deixar mensagem mais limpa
              errorMessage = errorMessage.replace(/[A-Z]:\\[^\s]+\\([^\s\\]+\.\w+)/g, '$1');
              errorMessage = errorMessage.replace(/\/[^\s]+\/([^\s\/]+\.\w+)/g, '$1');
              
              errors.push({
                file: fileName,
                level,
                message: errorMessage.slice(0, 200), // Limita tamanho
                stackTrace: stackTrace.slice(0, 500),
                timestamp,
                relatedFile,
                lineNumber
              });
              
              i = j - 1; // Pula as linhas do stack trace
              break;
            }
          }
          
          i++;
        }
      }
      
      if (errors.length === 0) {
        addTerminal('✅ Nenhum erro encontrado nos logs');
        logsContext += `\n## 📋 ANÁLISE DE LOGS:\n`;
        logsContext += `✅ Logs analisados: nenhum erro crítico encontrado\n`;
        return logsContext;
      }
      
      // Agrupa por nível
      const critical = errors.filter(e => e.level === 'CRITICAL');
      const error = errors.filter(e => e.level === 'ERROR');
      const warn = errors.filter(e => e.level === 'WARN');
      
      addTerminal(`❌ ${critical.length + error.length} erro(s) encontrado(s) nos logs`);
      if (warn.length > 0) {
        addTerminal(`⚠️ ${warn.length} aviso(s) encontrado(s)`);
      }
      
      logsContext += `\n## 📋 ANÁLISE DE LOGS:\n`;
      logsContext += `Arquivos analisados: ${logFiles.slice(0, 5).map(f => f.name).join(', ')}\n`;
      logsContext += `Total: ${critical.length} crítico(s), ${error.length} erro(s), ${warn.length} aviso(s)\n\n`;
      
      // CRÍTICOS
      if (critical.length > 0) {
        logsContext += `### 🔴 ERROS CRÍTICOS (${critical.length}):\n`;
        critical.slice(0, 3).forEach((err, idx) => {
          logsContext += `\n**${idx + 1}. ${err.file}**${err.timestamp ? ` [${err.timestamp}]` : ''}\n`;
          logsContext += `\`\`\`\n${err.message}\n`;
          if (err.stackTrace) {
            logsContext += `${err.stackTrace.split('\n').slice(0, 5).join('\n')}\n`;
          }
          logsContext += `\`\`\`\n`;
          if (err.relatedFile) {
            logsContext += `📁 Arquivo relacionado: \`${err.relatedFile}:${err.lineNumber || '?'}\`\n`;
          }
        });
      }
      
      // ERROS
      if (error.length > 0) {
        logsContext += `\n### ❌ ERROS (${error.length}):\n`;
        error.slice(0, 5).forEach((err, idx) => {
          logsContext += `\n**${idx + 1}. ${err.file}**${err.timestamp ? ` [${err.timestamp}]` : ''}\n`;
          logsContext += `- ${err.message}\n`;
          if (err.relatedFile) {
            logsContext += `  📁 \`${err.relatedFile}:${err.lineNumber || '?'}\`\n`;
          }
        });
        if (error.length > 5) {
          logsContext += `\n... e mais ${error.length - 5} erro(s)\n`;
        }
      }
      
      // AVISOS
      if (warn.length > 0 && warn.length <= 10) {
        logsContext += `\n### ⚠️ AVISOS (${warn.length}):\n`;
        warn.slice(0, 3).forEach((err, idx) => {
          logsContext += `- ${err.message.slice(0, 100)}\n`;
        });
      } else if (warn.length > 10) {
        logsContext += `\n### ⚠️ AVISOS: ${warn.length} encontrado(s) (não críticos)\n`;
      }
      
      logsContext += `\n> 🔧 Dica: Analise os erros acima e diga "corrija os erros dos logs" para o Bill resolver automaticamente!\n`;
      
      return logsContext;
    } catch (error) {
      console.error('[analyzeErrorLogs] Erro:', error);
      addTerminal('⚠️ Erro ao analisar logs');
      return '';
    }
  };

  // ── Helper: Detecta e analisa padrões de código do projeto ───────────────────
  const analyzeCodePatterns = async (workFolder: string): Promise<string> => {
    try {
      let patternsContext = '';
      
      addTerminal('🔍 Detectando padrões do projeto...');
      
      // Lista arquivos de código
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) {
        return '';
      }
      
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.cpp', '.go', '.rs'];
      const codeFiles = listResult.files
        .filter(f => !f.isDirectory && codeExtensions.some(ext => f.name.endsWith(ext)))
        .slice(0, 15); // Analisa até 15 arquivos
      
      if (codeFiles.length === 0) {
        return '';
      }
      
      // Padrões detectados
      const patterns = {
        // Nomenclatura
        variableNaming: { camelCase: 0, snake_case: 0, PascalCase: 0, UPPER_CASE: 0 },
        functionNaming: { camelCase: 0, snake_case: 0, PascalCase: 0 },
        classNaming: { PascalCase: 0, snake_case: 0, camelCase: 0 },
        
        // Estrutura
        indentation: { spaces2: 0, spaces4: 0, tabs: 0 },
        quotes: { single: 0, double: 0, backtick: 0 },
        semicolons: { always: 0, never: 0 },
        
        // Imports/Exports
        importStyle: { esm: 0, commonjs: 0, both: 0 },
        pathStyle: { relative: 0, absolute: 0, alias: 0 },
        
        // Arquitetura
        folderStructure: [] as string[],
        namingConventions: [] as string[],
        
        // Framework/Library
        framework: null as string | null,
        testFramework: null as string | null,
      };
      
      let totalLines = 0;
      
      for (const file of codeFiles) {
        const readResult = await window.electronAPI.readFile(file.path);
        if (!readResult.success || !readResult.content) continue;
        
        const content = readResult.content;
        const lines = content.split('\n');
        totalLines += lines.length;
        
        // 1. INDENTAÇÃO
        for (const line of lines) {
          if (line.startsWith('  ') && !line.startsWith('   ')) patterns.indentation.spaces2++;
          else if (line.startsWith('    ')) patterns.indentation.spaces4++;
          else if (line.startsWith('\t')) patterns.indentation.tabs++;
        }
        
        // 2. ASPAS (quotes)
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        const backticks = (content.match(/`/g) || []).length;
        patterns.quotes.single += singleQuotes;
        patterns.quotes.double += doubleQuotes;
        patterns.quotes.backtick += backticks;
        
        // 3. PONTO E VÍRGULA
        const withSemicolon = lines.filter(l => l.trim().endsWith(';') || l.trim().endsWith('};')).length;
        const withoutSemicolon = lines.filter(l => {
          const trimmed = l.trim();
          return trimmed.length > 0 && 
                 !trimmed.endsWith(';') && 
                 !trimmed.endsWith('{') && 
                 !trimmed.endsWith('}') &&
                 !trimmed.startsWith('//') &&
                 !trimmed.startsWith('/*');
        }).length;
        patterns.semicolons.always += withSemicolon;
        patterns.semicolons.never += withoutSemicolon;
        
        // 4. NOMENCLATURA DE VARIÁVEIS
        const varDeclarations = content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
        if (varDeclarations) {
          varDeclarations.forEach(decl => {
            const varName = decl.split(/\s+/)[1];
            if (!varName) return;
            
            if (/^[a-z][a-zA-Z0-9]*$/.test(varName)) patterns.variableNaming.camelCase++;
            else if (/^[a-z][a-z0-9_]*$/.test(varName)) patterns.variableNaming.snake_case++;
            else if (/^[A-Z][a-zA-Z0-9]*$/.test(varName)) patterns.variableNaming.PascalCase++;
            else if (/^[A-Z][A-Z0-9_]*$/.test(varName)) patterns.variableNaming.UPPER_CASE++;
          });
        }
        
        // 5. NOMENCLATURA DE FUNÇÕES
        const funcDeclarations = content.match(/(?:function|const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?\(|=\s*function|\()/g);
        if (funcDeclarations) {
          funcDeclarations.forEach(decl => {
            const funcName = decl.match(/(?:function|const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.[1];
            if (!funcName) return;
            
            if (/^[a-z][a-zA-Z0-9]*$/.test(funcName)) patterns.functionNaming.camelCase++;
            else if (/^[a-z][a-z0-9_]*$/.test(funcName)) patterns.functionNaming.snake_case++;
            else if (/^[A-Z][a-zA-Z0-9]*$/.test(funcName)) patterns.functionNaming.PascalCase++;
          });
        }
        
        // 6. NOMENCLATURA DE CLASSES
        const classDeclarations = content.match(/class\s+([A-Z][a-zA-Z0-9_]*)/g);
        if (classDeclarations) {
          classDeclarations.forEach(decl => {
            const className = decl.split(/\s+/)[1];
            if (/^[A-Z][a-zA-Z0-9]*$/.test(className)) patterns.classNaming.PascalCase++;
            else if (/^[a-z][a-z0-9_]*$/.test(className)) patterns.classNaming.snake_case++;
            else if (/^[a-z][a-zA-Z0-9]*$/.test(className)) patterns.classNaming.camelCase++;
          });
        }
        
        // 7. ESTILO DE IMPORTS
        const esmImports = (content.match(/import\s+.*\s+from/g) || []).length;
        const commonjsImports = (content.match(/require\s*\(/g) || []).length;
        if (esmImports > 0 && commonjsImports === 0) patterns.importStyle.esm++;
        else if (commonjsImports > 0 && esmImports === 0) patterns.importStyle.commonjs++;
        else if (esmImports > 0 && commonjsImports > 0) patterns.importStyle.both++;
        
        // 8. ESTILO DE CAMINHOS
        const relativeImports = (content.match(/from\s+['"]\.\.?\//g) || []).length;
        const absoluteImports = (content.match(/from\s+['"][^.@]/g) || []).length;
        const aliasImports = (content.match(/from\s+['"]@\//g) || []).length;
        patterns.pathStyle.relative += relativeImports;
        patterns.pathStyle.absolute += absoluteImports;
        patterns.pathStyle.alias += aliasImports;
      }
      
      // 9. ESTRUTURA DE PASTAS
      const folders = listResult.files.filter(f => f.isDirectory).map(f => f.name);
      patterns.folderStructure = folders;
      
      // 10. DETECTA FRAMEWORK
      const pkgJsonPath = `${workFolder}\\package.json`;
      const pkgResult = await window.electronAPI.readFile(pkgJsonPath);
      if (pkgResult.success && pkgResult.content) {
        try {
          const pkg = JSON.parse(pkgResult.content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          if (deps.react) patterns.framework = 'React';
          else if (deps.vue) patterns.framework = 'Vue';
          else if (deps['@angular/core']) patterns.framework = 'Angular';
          else if (deps.svelte) patterns.framework = 'Svelte';
          else if (deps.next) patterns.framework = 'Next.js';
          else if (deps.express) patterns.framework = 'Express';
          else if (deps.fastify) patterns.framework = 'Fastify';
          
          if (deps.jest) patterns.testFramework = 'Jest';
          else if (deps.vitest) patterns.testFramework = 'Vitest';
          else if (deps.mocha) patterns.testFramework = 'Mocha';
        } catch (e) {}
      }
      
      // ANÁLISE E DECISÃO DE PADRÕES
      const getWinner = (obj: Record<string, number>) => {
        const entries = Object.entries(obj);
        if (entries.length === 0) return null;
        return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
      };
      
      const indentWinner = getWinner(patterns.indentation);
      const quoteWinner = getWinner(patterns.quotes);
      const semicolonWinner = getWinner(patterns.semicolons);
      const varNamingWinner = getWinner(patterns.variableNaming);
      const funcNamingWinner = getWinner(patterns.functionNaming);
      const classNamingWinner = getWinner(patterns.classNaming);
      const importStyleWinner = getWinner(patterns.importStyle);
      const pathStyleWinner = getWinner(patterns.pathStyle);
      
      // MONTA CONTEXTO
      patternsContext += `\n## 🎨 PADRÕES DE CÓDIGO DO PROJETO:\n`;
      addTerminal(`✅ Padrões detectados (${codeFiles.length} arquivos, ${totalLines} linhas)`);
      
      patternsContext += `\n### 📐 Formatação:\n`;
      if (indentWinner === 'spaces2') {
        patternsContext += `- **Indentação**: 2 espaços (padrão do projeto)\n`;
      } else if (indentWinner === 'spaces4') {
        patternsContext += `- **Indentação**: 4 espaços (padrão do projeto)\n`;
      } else if (indentWinner === 'tabs') {
        patternsContext += `- **Indentação**: Tabs (padrão do projeto)\n`;
      }
      
      if (quoteWinner === 'single') {
        patternsContext += `- **Aspas**: Single quotes 'string' (padrão do projeto)\n`;
      } else if (quoteWinner === 'double') {
        patternsContext += `- **Aspas**: Double quotes "string" (padrão do projeto)\n`;
      } else if (quoteWinner === 'backtick') {
        patternsContext += `- **Aspas**: Template literals \`string\` (padrão do projeto)\n`;
      }
      
      if (semicolonWinner === 'always') {
        patternsContext += `- **Ponto e vírgula**: Sempre usar ';' no final (padrão do projeto)\n`;
      } else if (semicolonWinner === 'never') {
        patternsContext += `- **Ponto e vírgula**: Não usar ';' (padrão do projeto)\n`;
      }
      
      patternsContext += `\n### 🏷️ Nomenclatura:\n`;
      if (varNamingWinner === 'camelCase') {
        patternsContext += `- **Variáveis**: camelCase (ex: userName, totalPrice)\n`;
      } else if (varNamingWinner === 'snake_case') {
        patternsContext += `- **Variáveis**: snake_case (ex: user_name, total_price)\n`;
      } else if (varNamingWinner === 'UPPER_CASE') {
        patternsContext += `- **Constantes**: UPPER_CASE (ex: MAX_SIZE, API_URL)\n`;
      }
      
      if (funcNamingWinner === 'camelCase') {
        patternsContext += `- **Funções**: camelCase (ex: getUserData, calculateTotal)\n`;
      } else if (funcNamingWinner === 'snake_case') {
        patternsContext += `- **Funções**: snake_case (ex: get_user_data, calculate_total)\n`;
      }
      
      if (classNamingWinner === 'PascalCase') {
        patternsContext += `- **Classes**: PascalCase (ex: UserService, PaymentProcessor)\n`;
      }
      
      patternsContext += `\n### 📦 Imports/Exports:\n`;
      if (importStyleWinner === 'esm') {
        patternsContext += `- **Estilo**: ES Modules (import/export)\n`;
      } else if (importStyleWinner === 'commonjs') {
        patternsContext += `- **Estilo**: CommonJS (require/module.exports)\n`;
      } else if (importStyleWinner === 'both') {
        patternsContext += `- **Estilo**: Misto (ESM + CommonJS)\n`;
      }
      
      if (pathStyleWinner === 'relative') {
        patternsContext += `- **Caminhos**: Relativos (ex: '../utils/helper')\n`;
      } else if (pathStyleWinner === 'alias') {
        patternsContext += `- **Caminhos**: Alias (ex: '@/utils/helper')\n`;
      } else if (pathStyleWinner === 'absolute') {
        patternsContext += `- **Caminhos**: Absolutos (ex: 'utils/helper')\n`;
      }
      
      if (patterns.framework) {
        patternsContext += `\n### 🚀 Framework Detectado:\n`;
        patternsContext += `- **Framework**: ${patterns.framework}\n`;
        
        // Convenções específicas do framework
        if (patterns.framework === 'React') {
          patternsContext += `- **Convenções React**:\n`;
          patternsContext += `  - Componentes em PascalCase\n`;
          patternsContext += `  - Hooks customizados começam com 'use'\n`;
          patternsContext += `  - Props interface com sufixo 'Props'\n`;
          patternsContext += `  - Arquivos .tsx para componentes com JSX\n`;
        } else if (patterns.framework === 'Vue') {
          patternsContext += `- **Convenções Vue**:\n`;
          patternsContext += `  - Componentes em PascalCase ou kebab-case\n`;
          patternsContext += `  - Composables começam com 'use'\n`;
          patternsContext += `  - Arquivos .vue para componentes\n`;
        } else if (patterns.framework === 'Next.js') {
          patternsContext += `- **Convenções Next.js**:\n`;
          patternsContext += `  - pages/ para rotas automáticas\n`;
          patternsContext += `  - api/ para API routes\n`;
          patternsContext += `  - Componentes de página exportam default\n`;
        }
      }
      
      if (patterns.testFramework) {
        patternsContext += `- **Testes**: ${patterns.testFramework}\n`;
      }
      
      if (patterns.folderStructure.length > 0) {
        patternsContext += `\n### 📁 Estrutura de Pastas:\n`;
        const mainFolders = patterns.folderStructure.filter(f => 
          !f.startsWith('.') && f !== 'node_modules'
        ).slice(0, 8);
        patternsContext += mainFolders.map(f => `  - ${f}/`).join('\n') + '\n';
      }
      
      patternsContext += `\n> ⚠️ **IMPORTANTE**: Ao criar ou modificar código, SEMPRE siga os padrões acima para manter consistência no projeto!\n`;
      
      return patternsContext;
    } catch (error) {
      console.error('[analyzeCodePatterns] Erro:', error);
      addTerminal('⚠️ Erro ao analisar padrões');
      return '';
    }
  };

  // ── Helper: Adiciona documentação automaticamente ───────────────────────────
  const generateDocumentation = async (workFolder: string): Promise<string> => {
    try {
      let docContext = '';
      
      addTerminal('📝 Analisando documentação...');
      
      // Lista arquivos de código
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (!listResult.success || !listResult.files) {
        return '';
      }
      
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.cpp', '.php', '.go', '.rs'];
      const codeFiles = listResult.files
        .filter(f => !f.isDirectory && codeExtensions.some(ext => f.name.endsWith(ext)))
        .slice(0, 10);
      
      if (codeFiles.length === 0) {
        return '';
      }
      
      const undocumentedItems: Array<{
        file: string,
        type: 'function' | 'class' | 'method' | 'complex-block',
        name: string,
        line: number,
        signature?: string,
        reason: string
      }> = [];
      
      let totalFunctions = 0;
      let documentedFunctions = 0;
      
      for (const file of codeFiles) {
        const readResult = await window.electronAPI.readFile(file.path);
        if (!readResult.success || !readResult.content) continue;
        
        const content = readResult.content;
        const fileName = file.name;
        const lines = content.split('\n');
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        
        // Detecta funções não documentadas (JS/TS)
        if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
          // Regex para funções
          const functionPatterns = [
            /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,  // function name()
            /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,  // const name = () =>
            /(\w+)\s*:\s*\(([^)]*)\)\s*=>/g,  // name: () =>
          ];
          
          for (const pattern of functionPatterns) {
            let match;
            pattern.lastIndex = 0;
            while ((match = pattern.exec(content)) !== null) {
              const funcName = match[1];
              const params = match[2];
              const funcIndex = match.index;
              
              // Ignora funções privadas/helpers pequenos
              if (funcName.startsWith('_') || funcName.length <= 2) continue;
              
              totalFunctions++;
              
              // Verifica se tem JSDoc antes (/** ... */)
              const beforeFunc = content.substring(Math.max(0, funcIndex - 200), funcIndex);
              const hasJSDoc = /\/\*\*[\s\S]*?\*\/\s*$/.test(beforeFunc);
              const hasSingleComment = /\/\/.*\n\s*$/.test(beforeFunc);
              
              if (hasJSDoc || hasSingleComment) {
                documentedFunctions++;
              } else {
                const lineNum = content.substring(0, funcIndex).split('\n').length;
                undocumentedItems.push({
                  file: fileName,
                  type: 'function',
                  name: funcName,
                  line: lineNum,
                  signature: `${funcName}(${params})`,
                  reason: 'Sem JSDoc ou comentário explicativo'
                });
              }
            }
          }
          
          // Detecta classes não documentadas
          const classPattern = /(?:export\s+)?class\s+(\w+)/g;
          let classMatch;
          while ((classMatch = classPattern.exec(content)) !== null) {
            const className = classMatch[1];
            const classIndex = classMatch.index;
            
            const beforeClass = content.substring(Math.max(0, classIndex - 200), classIndex);
            const hasDoc = /\/\*\*[\s\S]*?\*\/\s*$/.test(beforeClass);
            
            if (!hasDoc) {
              const lineNum = content.substring(0, classIndex).split('\n').length;
              undocumentedItems.push({
                file: fileName,
                type: 'class',
                name: className,
                line: lineNum,
                reason: 'Classe sem documentação JSDoc'
              });
            }
          }
        }
        
        // Detecta funções Python não documentadas
        if (ext === 'py') {
          const pythonFuncPattern = /def\s+(\w+)\s*\(([^)]*)\)/g;
          let pyMatch;
          while ((pyMatch = pythonFuncPattern.exec(content)) !== null) {
            const funcName = pyMatch[1];
            const params = pyMatch[2];
            
            if (funcName.startsWith('_')) continue; // Private
            
            totalFunctions++;
            
            const funcIndex = pyMatch.index;
            const lineNum = content.substring(0, funcIndex).split('\n').length;
            
            // Verifica se tem docstring (""" ... """)
            const afterFunc = content.substring(funcIndex, funcIndex + 300);
            const hasDocstring = /def\s+\w+[^:]*:\s*\n\s*"""/.test(afterFunc) || 
                                 /def\s+\w+[^:]*:\s*\n\s*'''/.test(afterFunc);
            
            if (hasDocstring) {
              documentedFunctions++;
            } else {
              undocumentedItems.push({
                file: fileName,
                type: 'function',
                name: funcName,
                line: lineNum,
                signature: `${funcName}(${params})`,
                reason: 'Sem docstring Python'
              });
            }
          }
          
          // Classes Python
          const pyClassPattern = /class\s+(\w+)/g;
          let pyClassMatch;
          while ((pyClassMatch = pyClassPattern.exec(content)) !== null) {
            const className = pyClassMatch[1];
            const classIndex = pyClassMatch.index;
            
            const afterClass = content.substring(classIndex, classIndex + 200);
            const hasDocstring = /class\s+\w+[^:]*:\s*\n\s*"""/.test(afterClass);
            
            if (!hasDocstring) {
              const lineNum = content.substring(0, classIndex).split('\n').length;
              undocumentedItems.push({
                file: fileName,
                type: 'class',
                name: className,
                line: lineNum,
                reason: 'Classe Python sem docstring'
              });
            }
          }
        }
        
        // Detecta métodos Java/C# não documentados
        if (['java', 'cs'].includes(ext)) {
          const methodPattern = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+)\s+(\w+)\s*\(([^)]*)\)/g;
          let methodMatch;
          while ((methodMatch = methodPattern.exec(content)) !== null) {
            const methodName = methodMatch[1];
            const params = methodMatch[2];
            
            totalFunctions++;
            
            const methodIndex = methodMatch.index;
            const beforeMethod = content.substring(Math.max(0, methodIndex - 200), methodIndex);
            const hasXmlDoc = /\/\*\*[\s\S]*?\*\/\s*$/.test(beforeMethod) || 
                              /\/\/\/\s*<summary>/.test(beforeMethod);
            
            if (hasXmlDoc) {
              documentedFunctions++;
            } else {
              const lineNum = content.substring(0, methodIndex).split('\n').length;
              undocumentedItems.push({
                file: fileName,
                type: 'method',
                name: methodName,
                line: lineNum,
                signature: `${methodName}(${params})`,
                reason: ext === 'cs' ? 'Sem XML documentation' : 'Sem JavaDoc'
              });
            }
          }
        }
        
        // Detecta blocos complexos sem comentários (loops aninhados, lógica complexa)
        let braceDepth = 0;
        let complexBlockStart = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Detecta início de bloco complexo (for dentro de for, if dentro de loop, etc)
          if ((line.includes('for ') || line.includes('while ')) && braceDepth > 0) {
            complexBlockStart = i;
          }
          
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          
          if (complexBlockStart >= 0 && braceDepth === 0) {
            const blockSize = i - complexBlockStart;
            if (blockSize > 10) {
              // Verifica se tem comentário explicativo antes
              const beforeBlock = lines[Math.max(0, complexBlockStart - 2)];
              const hasComment = beforeBlock.includes('//') || beforeBlock.includes('/*');
              
              if (!hasComment) {
                undocumentedItems.push({
                  file: fileName,
                  type: 'complex-block',
                  name: `Bloco linha ${complexBlockStart + 1}`,
                  line: complexBlockStart + 1,
                  reason: `Bloco complexo de ${blockSize} linhas sem comentário explicativo`
                });
              }
            }
            complexBlockStart = -1;
          }
        }
      }
      
      // Verifica se projeto tem README
      const readmePath = `${workFolder}\\README.md`;
      const readmeResult = await window.electronAPI.readFile(readmePath);
      const hasReadme = readmeResult.success && readmeResult.content && readmeResult.content.length > 100;
      
      // Monta contexto
      const coveragePercent = totalFunctions > 0 ? Math.round((documentedFunctions / totalFunctions) * 100) : 100;
      
      docContext += `\n## 📝 ANÁLISE DE DOCUMENTAÇÃO:\n`;
      
      if (totalFunctions > 0) {
        addTerminal(`📊 Cobertura de documentação: ${coveragePercent}% (${documentedFunctions}/${totalFunctions})`);
        docContext += `\n### Cobertura de Documentação:\n`;
        docContext += `- **${documentedFunctions}** de **${totalFunctions}** funções/métodos documentados (${coveragePercent}%)\n`;
        
        if (coveragePercent < 50) {
          docContext += `- ⚠️ **Cobertura BAIXA** - Menos de 50% do código está documentado\n`;
        } else if (coveragePercent < 80) {
          docContext += `- 🟡 **Cobertura MÉDIA** - ${100 - coveragePercent}% do código ainda precisa de documentação\n`;
        } else {
          docContext += `- ✅ **Boa cobertura** - Maioria das funções documentadas!\n`;
        }
      }
      
      if (!hasReadme) {
        addTerminal('⚠️ README.md não encontrado ou vazio');
        docContext += `\n### ⚠️ README.md:\n`;
        docContext += `- Projeto **NÃO possui README.md** adequado\n`;
        docContext += `- README é essencial para explicar: o que é o projeto, como instalar, como usar\n`;
      } else {
        addTerminal('✅ README.md encontrado');
        docContext += `\n### ✅ README.md encontrado\n`;
      }
      
      if (undocumentedItems.length > 0) {
        addTerminal(`📝 ${undocumentedItems.length} item(ns) sem documentação`);
        docContext += `\n### Itens Não Documentados (${undocumentedItems.length}):\n`;
        
        // Agrupa por tipo
        const functions = undocumentedItems.filter(i => i.type === 'function');
        const classes = undocumentedItems.filter(i => i.type === 'class');
        const methods = undocumentedItems.filter(i => i.type === 'method');
        const complexBlocks = undocumentedItems.filter(i => i.type === 'complex-block');
        
        if (functions.length > 0) {
          docContext += `\n**Funções sem documentação (${functions.length}):**\n`;
          functions.slice(0, 5).forEach(item => {
            docContext += `- \`${item.file}:${item.line}\` - **${item.signature || item.name}**\n`;
          });
          if (functions.length > 5) {
            docContext += `- ... e mais ${functions.length - 5} funções\n`;
          }
        }
        
        if (classes.length > 0) {
          docContext += `\n**Classes sem documentação (${classes.length}):**\n`;
          classes.slice(0, 3).forEach(item => {
            docContext += `- \`${item.file}:${item.line}\` - class **${item.name}**\n`;
          });
        }
        
        if (methods.length > 0) {
          docContext += `\n**Métodos sem documentação (${methods.length}):**\n`;
          methods.slice(0, 3).forEach(item => {
            docContext += `- \`${item.file}:${item.line}\` - **${item.signature || item.name}**\n`;
          });
        }
        
        if (complexBlocks.length > 0) {
          docContext += `\n**Blocos complexos sem comentários (${complexBlocks.length}):**\n`;
          complexBlocks.slice(0, 3).forEach(item => {
            docContext += `- \`${item.file}:${item.line}\` - ${item.reason}\n`;
          });
        }
        
        docContext += `\n> 📝 Dica: Diga "documente o código" ou "adicione comentários" para o Bill fazer automaticamente!\n`;
      } else if (totalFunctions > 0) {
        addTerminal('✅ Todas as funções documentadas!');
        docContext += `\n✅ **Excelente!** Todo o código público está documentado.\n`;
      }
      
      return docContext;
    } catch (error) {
      console.error('[generateDocumentation] Erro:', error);
      addTerminal('⚠️ Erro ao analisar documentação');
      return '';
    }
  };

  // ── Helper: Roda testes automaticamente ─────────────────────────────────────
  const runAutomaticTests = async (workFolder: string): Promise<string> => {
    try {
      let testsContext = '';
      
      // Lê package.json para descobrir qual test runner usar
      const packageJsonPath = `${workFolder}\\package.json`;
      const pkgResult = await window.electronAPI.readFile(packageJsonPath);
      
      if (!pkgResult.success || !pkgResult.content) {
        return '';
      }
      
      const pkg = JSON.parse(pkgResult.content);
      
      // Detecta qual test runner está instalado
      const testRunners = {
        jest: pkg.devDependencies?.jest || pkg.dependencies?.jest,
        vitest: pkg.devDependencies?.vitest || pkg.dependencies?.vitest,
        mocha: pkg.devDependencies?.mocha || pkg.dependencies?.mocha,
        ava: pkg.devDependencies?.ava || pkg.dependencies?.ava,
        'node:test': pkg.scripts?.test?.includes('node --test'),
      };
      
      let testCommand = '';
      let testRunner = '';
      
      // Prioriza o que está configurado
      if (pkg.scripts?.test) {
        testCommand = pkg.scripts.test;
        // Detecta qual runner pelo comando
        if (testCommand.includes('jest')) testRunner = 'Jest';
        else if (testCommand.includes('vitest')) testRunner = 'Vitest';
        else if (testCommand.includes('mocha')) testRunner = 'Mocha';
        else if (testCommand.includes('ava')) testRunner = 'Ava';
        else if (testCommand.includes('node --test')) testRunner = 'Node.js Test Runner';
        else testRunner = 'Test Runner Customizado';
      } else if (testRunners.jest) {
        testCommand = 'npx jest --passWithNoTests --silent';
        testRunner = 'Jest';
      } else if (testRunners.vitest) {
        testCommand = 'npx vitest run --reporter=verbose';
        testRunner = 'Vitest';
      } else if (testRunners.mocha) {
        testCommand = 'npx mocha';
        testRunner = 'Mocha';
      } else if (testRunners.ava) {
        testCommand = 'npx ava';
        testRunner = 'Ava';
      } else {
        // Sem test runner detectado
        return '';
      }
      
      // Roda os testes com timeout de 30 segundos
      try {
        addTerminal(`🧪 Rodando testes (${testRunner})...`);
        console.log(`[runAutomaticTests] Rodando testes com: ${testCommand}`);
        const testResult = await Promise.race([
          window.electronAPI.executeCommand(testCommand, workFolder),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
        ]);
        
        if (testResult.output) {
          const output = testResult.output;
          
          // Parse resultados
          const lines = output.split('\n');
          
          // Conta testes
          const passedMatch = output.match(/(\d+)\s+(?:passed|pass)/i);
          const failedMatch = output.match(/(\d+)\s+(?:failed|fail)/i);
          const totalMatch = output.match(/Tests:\s+(\d+)/i) || output.match(/(\d+)\s+total/i);
          
          const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
          const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
          const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;
          
          testsContext += `\n## 🧪 RESULTADOS DOS TESTES (${testRunner}):\n`;
          
          if (failed > 0) {
            addTerminal(`❌ ${failed} teste(s) falhando de ${total} total`);
            testsContext += `\n### ❌ ${failed} teste(s) falhando de ${total} total\n\n`;
            
            // Extrai testes que falharam
            const failureLines = lines.filter(line => 
              line.includes('FAIL') || 
              line.includes('✕') || 
              line.includes('×') ||
              line.includes('Expected') ||
              line.trim().startsWith('at ')
            ).slice(0, 15);
            
            if (failureLines.length > 0) {
              testsContext += `### Detalhes dos Erros:\n`;
              failureLines.forEach(line => {
                testsContext += `${line.trim()}\n`;
              });
              testsContext += '\n';
            }
          } else if (passed > 0) {
            addTerminal(`✅ Todos os ${passed} teste(s) passando!`);
            testsContext += `\n### ✅ Todos os ${passed} teste(s) passando!\n\n`;
          } else if (total === 0) {
            addTerminal('⚠️ Nenhum teste encontrado');
            testsContext += `\n### ⚠️ Nenhum teste encontrado no projeto\n\n`;
          }
          
          // Coverage info se disponível
          const coverageMatch = output.match(/All files[^\n]*\|\s*(\d+\.?\d*)/);
          if (coverageMatch) {
            addTerminal(`📊 Cobertura: ${coverageMatch[1]}%`);
            testsContext += `> Cobertura de código: ${coverageMatch[1]}%\n\n`;
          }
          
        }
      } catch (testError: any) {
        if (testError.message === 'timeout') {
          addTerminal('⏱️ Testes demoraram >30s (interrompido)');
          testsContext += `\n## ⏱️ TESTES:\nTestes demoraram mais de 30s e foram interrompidos (não bloqueado).\n`;
        } else {
          console.log('[runAutomaticTests] Erro ao rodar testes:', testError);
          addTerminal('⚠️ Não foi possível executar os testes');
          testsContext += `\n## ⚠️ TESTES:\nNão foi possível executar os testes automaticamente.\n`;
        }
      }
      
      return testsContext;
    } catch (error) {
      console.error('[runAutomaticTests] Erro geral:', error);
      return '';
    }
  };

  // â"€â"€ Helper: Lê contexto essencial do projeto â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const readProjectContext = async (workFolder: string): Promise<string> => {
    try {
      let context = '';
      
      // 1. Lê package.json se existir
      const packageJsonPath = `${workFolder}\\package.json`;
      const pkgResult = await window.electronAPI.readFile(packageJsonPath);
      if (pkgResult.success && pkgResult.content) {
        context += `\n## package.json:\n\`\`\`json\n${pkgResult.content.slice(0, 2000)}\n\`\`\`\n`;
      }
      
      // 2. Lê README.md se existir
      const readmePath = `${workFolder}\\README.md`;
      const readmeResult = await window.electronAPI.readFile(readmePath);
      if (readmeResult.success && readmeResult.content) {
        context += `\n## README.md:\n${readmeResult.content.slice(0, 2000)}\n`;
      }
      
      // 3. Lista estrutura de pastas (nível 1)
      const listResult = await window.electronAPI.listDirectory(workFolder);
      if (listResult.success && listResult.files) {
        const folders = listResult.files.filter(f => f.isDirectory).map(f => f.name);
        const files = listResult.files.filter(f => !f.isDirectory).map(f => f.name);
        context += `\n## Estrutura do projeto:\nPastas: ${folders.join(', ') || 'nenhuma'}\nArquivos raiz: ${files.slice(0, 20).join(', ')}\n`;
      }
      
      return context;
    } catch (error) {
      console.error('[readProjectContext] Erro:', error);
      return '';
    }
  };

  // â”€â”€ Helper: System prompt do modo Code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buildCodeSystemPrompt = async (userMessage?: string): Promise<string> => {
    const wf = settingsRef.current.workFolder || 'C:\\\\Users\\\\Administrator\\\\Desktop\\\\testes';
    const ext = selectedFile?.split('.').pop()?.toLowerCase() || '';
    const isHtml = ['html', 'htm', 'svg'].includes(ext);
    // Se a mensagem já vem do design com file-patch, não passa o HTML completo
    // (a IA já tem o trecho relevante na mensagem)
    const isDesignPatch = userMessage?.startsWith('USE file-patch');
    const htmlContext = isHtml && fileContent && !isDesignPatch
      ? `\n\n## ARQUIVO HTML ATUAL (${selectedFile?.split('\\').pop() || selectedFile?.split('/').pop()}):\n\`\`\`html\n${fileContent.slice(0, 8000)}\n\`\`\`\n\nQUANDO O USUÃRIO PEDIR PARA ALTERAR COR, TEXTO, ESTILO OU QUALQUER DETALHE PONTUAL: USE OBRIGATORIAMENTE \`\`\`file-patch\`\`\` com SEARCH/REPLACE. NUNCA reescreva o arquivo inteiro para mudanças pequenas.`
      : isHtml && fileContent && isDesignPatch
      ? `\n\n## ARQUIVO: ${selectedFile?.split('\\').pop() || selectedFile?.split('/').pop() || 'index.html'}\nPASTA: ${wf}\nUSE file-patch com SEARCH/REPLACE para cada mudança. O HTML do elemento está na mensagem do usuário â€” use como referÃªncia para o SEARCH exato.`
      : '';
    
    // Lê contexto inteligente do projeto
    let projectContext = '';
    
    // Log inicial
    addTerminal('🔍 Analisando projeto...');
    
    // 1. Analisa logs de erro primeiro (prioridade alta)
    const errorLogsAnalysis = await analyzeErrorLogs(wf);
    if (errorLogsAnalysis) {
      projectContext += errorLogsAnalysis;
    }
    
    // 2. Detecta padrões de código do projeto
    const codePatterns = await analyzeCodePatterns(wf);
    if (codePatterns) {
      projectContext += codePatterns;
    }
    
    // 3. Sempre lê contexto essencial (package.json, README, estrutura)
    const essentialContext = await readProjectContext(wf);
    projectContext += essentialContext;
    
    // 1.5. Detecta erros de compilação automaticamente
    let compilationErrors = await detectCompilationErrors(wf);
    if (compilationErrors) {
      projectContext += compilationErrors;
    }
    
    // 1.5.1. Auto-correção de erros TypeScript/ESLint
    let autoFixAttempts = 0;
    const maxAutoFixAttempts = 3;
    
    while (compilationErrors.includes('⚠️ ERROS') && autoFixAttempts < maxAutoFixAttempts) {
      autoFixAttempts++;
      addTerminal(`🤖 Tentando corrigir erros automaticamente (tentativa ${autoFixAttempts}/${maxAutoFixAttempts})...`);
      
      // Chama a IA para corrigir os erros
      const fixMessages: Message[] = [
        {
          role: 'system',
          content: `Você é um expert em correção de código. Analise os erros abaixo e corrija-os automaticamente usando \`\`\`file-patch ou \`\`\`file: blocos.

${compilationErrors}

IMPORTANTE:
- Use \`\`\`file-patch para correções pontuais
- Use \`\`\`file: apenas se precisar reescrever arquivo inteiro
- Corrija TODOS os erros detectados
- Seja preciso e eficiente
- Não adicione features, apenas corrija os erros`
        },
        {
          role: 'user',
          content: 'Corrija todos os erros detectados no projeto.'
        }
      ];
      
      try {
        const fixResponse = await callAINonStreaming(fixMessages, settingsRef.current);
        if (fixResponse) {
          addTerminal(`📝 Aplicando correções...`);
          // Executa as correções
          await parseAndExecuteAIActions(fixResponse, 0);
          
          // Re-verifica os erros
          addTerminal('🔍 Verificando correções...');
          compilationErrors = await detectCompilationErrors(wf);
          
          if (!compilationErrors.includes('⚠️ ERROS')) {
            addTerminal('✅ Todos os erros corrigidos!');
            projectContext += `\n## 🤖 AUTO-CORREÇÃO:\nErros foram detectados e corrigidos automaticamente em ${autoFixAttempts} tentativa(s).\n`;
            break;
          } else {
            addTerminal(`⚠️ Ainda há erros, tentando novamente...`);
          }
        } else {
          addTerminal('⚠️ Não foi possível gerar correção');
          break;
        }
      } catch (fixError) {
        console.error('[Auto-fix] Erro:', fixError);
        addTerminal('⚠️ Erro ao tentar corrigir automaticamente');
        break;
      }
    }
    
    if (compilationErrors.includes('⚠️ ERROS') && autoFixAttempts >= maxAutoFixAttempts) {
      addTerminal(`⚠️ Não foi possível corrigir todos os erros após ${maxAutoFixAttempts} tentativas`);
      projectContext += `\n## ⚠️ AUTO-CORREÇÃO INCOMPLETA:\nApós ${maxAutoFixAttempts} tentativas, alguns erros ainda persistem.\n`;
    }
    
    // 1.6. Roda testes automaticamente
    let testResults = await runAutomaticTests(wf);
    if (testResults) {
      projectContext += testResults;
    }
    
    // 1.6.1. Auto-correção de testes falhando
    let testFixAttempts = 0;
    const maxTestFixAttempts = 3;
    
    while (testResults.includes('❌') && testFixAttempts < maxTestFixAttempts) {
      testFixAttempts++;
      addTerminal(`🤖 Tentando corrigir testes falhando (tentativa ${testFixAttempts}/${maxTestFixAttempts})...`);
      
      // Chama a IA para corrigir os testes
      const fixTestMessages: Message[] = [
        {
          role: 'system',
          content: `Você é um expert em testes de software. Analise os testes falhando abaixo e corrija o código para fazê-los passar.

${testResults}

IMPORTANTE:
- Corrija o código de PRODUÇÃO (não os testes)
- Use \`\`\`file-patch para correções pontuais
- Faça os testes passarem sem quebrar funcionalidades
- Seja preciso e objetivo`
        },
        {
          role: 'user',
          content: 'Corrija o código para fazer os testes passarem.'
        }
      ];
      
      try {
        const fixTestResponse = await callAINonStreaming(fixTestMessages, settingsRef.current);
        if (fixTestResponse) {
          addTerminal(`📝 Aplicando correções nos testes...`);
          // Executa as correções
          await parseAndExecuteAIActions(fixTestResponse, 0);
          
          // Re-roda os testes
          addTerminal('🧪 Rodando testes novamente...');
          testResults = await runAutomaticTests(wf);
          
          if (!testResults.includes('❌')) {
            addTerminal('✅ Todos os testes passando!');
            projectContext += `\n## 🤖 AUTO-CORREÇÃO DE TESTES:\nTestes falhando foram corrigidos automaticamente em ${testFixAttempts} tentativa(s).\n`;
            break;
          } else {
            addTerminal(`⚠️ Ainda há testes falhando, tentando novamente...`);
          }
        } else {
          addTerminal('⚠️ Não foi possível gerar correção para testes');
          break;
        }
      } catch (fixTestError) {
        console.error('[Auto-fix tests] Erro:', fixTestError);
        addTerminal('⚠️ Erro ao tentar corrigir testes automaticamente');
        break;
      }
    }
    
    if (testResults.includes('❌') && testFixAttempts >= maxTestFixAttempts) {
      addTerminal(`⚠️ Não foi possível corrigir todos os testes após ${maxTestFixAttempts} tentativas`);
      projectContext += `\n## ⚠️ AUTO-CORREÇÃO DE TESTES INCOMPLETA:\nApós ${maxTestFixAttempts} tentativas, alguns testes ainda falham.\n`;
    }
    
    // 1.7. Sugere melhorias de código
    const codeSuggestions = await suggestCodeImprovements(wf);
    if (codeSuggestions) {
      projectContext += codeSuggestions;
    }
    
    // 1.8. Analisa documentação
    const docAnalysis = await generateDocumentation(wf);
    if (docAnalysis) {
      projectContext += docAnalysis;
    }
    
    // 1.9. Sugere estratégias de debugging
    const debugStrategy = await suggestDebuggingStrategy(wf);
    if (debugStrategy) {
      projectContext += debugStrategy;
    }
    
    addTerminal('✅ Análise completa!');
    
    // 2. Se houver mensagem do usuário, busca arquivos relevantes
    if (userMessage && userMessage.length > 10 && !isDesignPatch) {
      const keywords = extractKeywords(userMessage);
      if (keywords.length > 0) {
        const result = await findRelevantFiles(keywords, wf, 8); // Aumentado para 8 (incluindo imports)
        if (result.files.length > 0) {
          projectContext += `\n## Arquivos relevantes e suas dependências:\n`;
          for (const file of result.files) {
            const fileName = file.path.split('\\').pop() || file.path.split('/').pop();
            const relativePath = file.path.replace(wf, '').replace(/^\\+/, '');
            projectContext += `\n### ${fileName} (${relativePath}):\n\`\`\`\n${file.content}\n\`\`\`\n`;
          }
          projectContext += `\n> Total: ${result.files.length} arquivo(s) carregado(s) (incluindo imports)\n`;
          
          // Adiciona análise de dependências
          if (result.dependencyGraph.size > 0) {
            projectContext += analyzeDependencies(result.dependencyGraph, wf);
          }
        }
      }
    }
    
    return `Você é o GABIRU, um engenheiro de software sênior e autônomo rodando no Windows. Você deve responder SEMPRE em português brasileiro.${htmlContext}${projectContext ? `\n\n## CONTEXTO DO PROJETO:\n${projectContext}` : ''}

## REGRAS ABSOLUTAS PARA CRIAR/EDITAR ARQUIVOS:
Para salvar um arquivo no disco, use EXATAMENTE este formato (sem espaços extras):
\`\`\`file:nome_do_arquivo.ext
conteúdo completo do arquivo aqui
\`\`\`

## REGRAS PARA EXECUTAR COMANDOS:
\`\`\`command
seu comando powershell ou npm aqui
\`\`\`

## REGRAS PARA CRIAR ESTRUTURA DE PASTAS:
\`\`\`scaffold
src/
  components/
  utils/
  hooks/
tests/
  unit/
  integration/
\`\`\`

## REGRAS PARA EDITAR PARTES DE UM ARQUIVO (patch):
\`\`\`file-patch:caminho/arquivo.ext
<<<< SEARCH
texto antigo exato
====
texto novo
>>>>
\`\`\`

## REGRAS PARA DELETAR ARQUIVOS:
\`\`\`delete:caminho/arquivo.ext
\`\`\`

## REGRAS PARA RENOMEAR ARQUIVOS:
\`\`\`rename:caminho/antigo.ext->caminho/novo.ext
\`\`\`

## REGRAS PARA MOVER ARQUIVOS:
\`\`\`move:origem/arquivo.ext->destino/arquivo.ext
\`\`\`

## REGRAS PARA REFATORAR CÓDIGO:
Quando o contexto mostrar "🔧 OPORTUNIDADES DE REFATORAÇÃO", você DEVE refatorar automaticamente se o usuário pedir ("refatore", "melhore o código", "aplique refatorações").

**Tipos de refatoração que você deve fazer:**
1. **Código Duplicado**: Extraia lógica comum em funções reutilizáveis
2. **Nomenclatura Ruim**: Renomeie variáveis genéricas (x, temp, data) para nomes descritivos
3. **Condicionais Aninhadas**: Use early return ou extraia em funções
4. **Muitos Parâmetros**: Agrupe em objeto de configuração
5. **String Concatenation em Loop**: Use array.join()
6. **Números Mágicos**: Extraia para constantes nomeadas
7. **Switch Longo**: Use objeto/Map de estratégias
8. **Comentários Explicativos**: Refatore para código auto-explicativo

**Como refatorar:**
- Use \`\`\`file-patch para mudanças pontuais
- Use \`\`\`file: se precisar reescrever arquivo inteiro
- MANTENHA O COMPORTAMENTO ORIGINAL (não quebre funcionalidades)
- Adicione comentários APENAS quando necessário (código auto-explicativo é melhor)

## REGRAS PARA ADICIONAR DOCUMENTAÇÃO:
Quando o contexto mostrar "📝 ANÁLISE DE DOCUMENTAÇÃO" com itens não documentados, você DEVE documentar automaticamente se o usuário pedir ("documente", "adicione comentários", "adicione JSDoc").

**Formatos de documentação por linguagem:**

### JavaScript/TypeScript - JSDoc:
\`\`\`javascript
/**
 * Calcula o total de um pedido com desconto
 * @param {Object} order - Objeto do pedido
 * @param {number} order.subtotal - Subtotal do pedido
 * @param {number} order.discount - Desconto em porcentagem (0-100)
 * @returns {number} Total calculado após desconto
 */
function calculateTotal(order) {
  return order.subtotal * (1 - order.discount / 100);
}
\`\`\`

### Python - Docstring:
\`\`\`python
def calculate_total(order):
    """
    Calcula o total de um pedido com desconto.
    
    Args:
        order (dict): Dicionário contendo 'subtotal' e 'discount'
        
    Returns:
        float: Total calculado após aplicar o desconto
        
    Raises:
        ValueError: Se o desconto for inválido (< 0 ou > 100)
    """
    if order['discount'] < 0 or order['discount'] > 100:
        raise ValueError("Desconto deve estar entre 0 e 100")
    return order['subtotal'] * (1 - order['discount'] / 100)
\`\`\`

### Java - JavaDoc:
\`\`\`java
/**
 * Calcula o total de um pedido com desconto
 * @param order Objeto Order contendo subtotal e desconto
 * @return Total calculado após desconto
 * @throws IllegalArgumentException se o desconto for inválido
 */
public double calculateTotal(Order order) {
    return order.getSubtotal() * (1 - order.getDiscount() / 100);
}
\`\`\`

### C# - XML Documentation:
\`\`\`csharp
/// <summary>
/// Calcula o total de um pedido com desconto
/// </summary>
/// <param name="order">Objeto Order contendo subtotal e desconto</param>
/// <returns>Total calculado após desconto</returns>
/// <exception cref="ArgumentException">Lançado quando o desconto é inválido</exception>
public double CalculateTotal(Order order) {
    return order.Subtotal * (1 - order.Discount / 100);
}
\`\`\`

### Blocos Complexos - Comentários Inline:
\`\`\`javascript
// Processa pedidos em lote e agrupa por status
// Primeiro filtra pedidos válidos, depois agrupa e calcula totais
for (const order of orders) {
  if (!order.validated) continue;
  
  // Agrupa por status (pending, completed, canceled)
  const status = order.status;
  if (!grouped[status]) grouped[status] = [];
  grouped[status].push(order);
}
\`\`\`

**README.md - Estrutura Básica:**
Se o projeto não tiver README.md, crie com estas seções:
\`\`\`markdown
# Nome do Projeto

Breve descrição do que o projeto faz

## 🚀 Instalação

\\\`\\\`\\\`bash
npm install
\\\`\\\`\\\`

## 📖 Como Usar

\\\`\\\`\\\`javascript
const app = require('./app');
app.start();
\\\`\\\`\\\`

## 🛠️ Tecnologias

- Node.js
- Express
- MongoDB

## 📝 Licença

MIT
\`\`\`

**Como documentar:**
- Use \`\`\`file-patch para adicionar documentação em arquivos existentes
- Use \`\`\`file:README.md para criar README novo
- Documente TODAS as funções/classes públicas (não privadas com _ ou __)
- Explique: O QUE faz, PARÂMETROS, RETORNO, EXCEÇÕES (se houver)
- Seja claro e conciso

## IMPORTANTE:
- Pasta de trabalho: ${wf}
- Caminhos relativos são salvos dentro da pasta de trabalho acima.
- NÃƒO use blocos \`\`\`html, \`\`\`python, \`\`\`css sem o prefixo file: â€” eles serão IGNORADOS pelo sistema.
- Quando o usuário pedir um site, script ou ferramenta: CRIE OS ARQUIVOS AGORA, não explique apenas.
- VocÃª tem acesso total ao PC via \`\`\`command.
- ⚠️ **SEGUIR PADRÕES**: O contexto mostra "🎨 PADRÕES DE CÓDIGO" detectados. Siga: indentação, aspas, ponto e vírgula, nomenclatura e imports do projeto!
- 📋 **LOGS DE ERRO**: Se o contexto mostrar "📋 ANÁLISE DE LOGS" com erros, priorize corrigir esses erros antes de outras tarefas. Use o stack trace para localizar o problema exato.
- 🐛 **DEBUGGING**: Se o contexto mostrar "🐛 ESTRATÉGIAS DE DEBUGGING", use essas sugestões ao adicionar logs ou breakpoints. Siga as estratégias recomendadas para cada ponto crítico.

Exemplo correto para criar um site:
\`\`\`file:index.html
<!DOCTYPE html><html><body><h1>Olá</h1></body></html>
\`\`\`
\`\`\`command
start index.html
\`\`\``;
  };

  // -- Helper: Instruções de pesquisa web (reutilizável em todos os prompts)
  const getWebResearchInstructions = (): string => {
    return `
🌐 PESQUISA WEB DISPONÍVEL
Você tem acesso à internet via \`web-action:research\`.

⚠️ REGRA CRÍTICA: APENAS pesquise quando o usuário MANDAR EXPLICITAMENTE usando palavras como:
- "pesquisa X"
- "busca Y"
- "procura Z"
- "search"

NUNCA pesquise automaticamente só porque é uma pergunta sobre fatos, notícias, eventos, preços, etc.
Se o usuário NÃO pedir para pesquisar, responda com seu conhecimento interno.

Sintaxe (use APENAS quando mandarem pesquisar):
\`\`\`web-action:research
{"query": "termo de busca específico"}
\`\`\`

Exemplos CORRETOS:
- "pesquisa quando lança GTA 6" → \`\`\`web-action:research\\n{"query": "GTA 6 data lançamento"}\\n\`\`\`
- "busca preço do iPhone 15" → \`\`\`web-action:research\\n{"query": "iPhone 15 preço Brasil"}\\n\`\`\`

Exemplos INCORRETOS (NÃO pesquisar):
- "quando lança GTA 6?" → Responda com seu conhecimento, NÃO pesquise
- "quanto custa o iPhone 15?" → Responda com seu conhecimento, NÃO pesquise

IMPORTANTE: NUNCA diga que a pesquisa está desabilitada ou que precisa ativar algo.
`;
  };

  // -- Helper: System prompt do modo Paint
  const buildPaintSystemPrompt = (): string => {
    return `VocÃª é o BILL PAINT, assistente especialista em artes visuais integrado ao Bill Paint Editor. Artista digital profissional â€” anatomia, perspectiva, teoria das cores, estilos (anime, realismo, concept art).

MODOS DE RESPOSTA:

1. QUANDO VER O CANVAS (snapshot enviado):
   - Descreva em UMA frase curta o que viu
   - Ofereça UMA sugestão ou pergunta específica
   - Não dÃª lista de dicas, não explique tudo de uma vez

2. QUANDO O USUÃRIO PEDIR DICAS/MELHORIAS ("como melhorar?", "o que acha?", "dá uma dica"):
   - NÃƒO descreva o canvas de novo (vocÃª já viu antes)
   - DÃª 2-3 dicas ESPECÃFICAS e PRÃTICAS sobre o que precisa melhorar
   - Seja direta: "As chamas estão simétricas demais â€” tente variar o tamanho e direção. As proporçÃµes do tronco estão um pouco largas para a idade do personagem."
   - Ofereça uma ação concreta no final: buscar referÃªncia, gerar imagem base, etc.

3. QUANDO EXECUTAR AÇÃƒO:
\`\`\`paint-action:ACAO
{"param": valor}
\`\`\`
   - search-and-add-reference {"query": "mão segurando espada anime", "opacity": 50} â€" BUSCA imagem no Bing e adiciona como referÃªncia (layer semi-transparente fora do canvas principal). Use quando o usuário pedir "referÃªncia", "inspiração", "imagem de base", ou quiser estudar anatomia/poses sem desenhar direto.
   - generate-and-add-reference {"prompt": "...", "opacity": 50}
   - generate-and-add-layer {"prompt": "...", "opacity": 100}
   - edge-detect {}
   - add-layer {}
   - clear-layer {}
   - set-brush-color {"color": "#ff0000"}
   - set-brush-size {"size": 20}

REGRAS GERAIS:
- Responda SEMPRE em portuguÃªs
- NUNCA pergunte "posso fazer?" â€” se pediu, execute
- Quando confirmar ("sim", "pode"): execute a ação do contexto sem perguntar
- Respostas curtas e diretas. Máximo 3 linhas de texto por resposta`;
  };

  // -- Helper: System prompt do modo Video com estado LIVE do editor
  const buildVideoSystemPrompt = (): string => {
    const wf = settingsRef.current.workFolder || 'C:\\Users\\Administrator\\Desktop\\testes';
    const editorState = videoEditorRef.current?.getEditorState?.();
    let stateBlock = 'Nenhum clipe na timeline. Peca ao usuario importar um video.';
    if (editorState && editorState.clipCount > 0) {
      const sel = editorState.selectedClip;
      const clipList = (editorState.clips || []).map((c: any, ci: number) =>
        `  ${ci+1}. "${c.name}" [${c.type}] | ${c.duration}s | inicio:${c.startTime}s | trilha:${c.track} | vel:${c.speed}x | vol:${c.volume}% | id:${c.id}`
      ).join('\n') || '  (vazio)';
      stateBlock = `ESTADO DO EDITOR - Total:${editorState.totalDuration?.toFixed(1)}s | Playhead:${Math.round(editorState.currentTime)}s | Clipes:${editorState.clipCount}\n` +
        (sel ? `SELECIONADO: "${sel.name}" [${sel.type}] | ${sel.duration}s | vel:${sel.speed}x | vol:${sel.volume}% | brilho:${sel.brightness}% | contraste:${sel.contrast}% | sat:${sel.saturation}% | escala:${sel.scale}% | efeito:${sel.effect || 'nenhum'} | id:${sel.id}\n` : 'Nenhum clipe selecionado\n') +
        `CLIPES:\n${clipList}`;
    }
    const relativeNote = `VALORES RELATIVOS: Use "+20" (adiciona 20), "-10" (subtrai 10), "+20%" (percentual), ou valor absoluto (ex: 130). Exemplos: set-brightness +20 = aumenta 20 pontos; set-saturation +20% = aumenta 20% do valor atual.`;
    const actions = `set-speed(speed:0.5=slow/2=fast) [APENAS CLIPS DE VIDEO] | set-volume(volume:"+20") | mute | set-brightness(value:"+20") | set-contrast(value:"+15") | set-saturation(value:"-30") | color-grade(brightness,contrast,saturation) | delete | trim(trimStart,trimEnd) | split | add-text(text,fontSize,color,y,duration,fontFamily) | seek(time) | set-effect(effect:"nome") | set-scale(value:"+10") | set-opacity(value:80) | move(startTime,track) | select(clipId) | set-chroma(enabled,color,similarity) | generate-image(prompt:"gato fofo") | auto-cut() [CORTA SILÃŠNCIOS AUTOMATICAMENTE, ISOLA VOZ PRIMEIRO] | isolate-voice() [REMOVE RUÃDO DE FUNDO/CHIADO] | auto-subtitle() [LEGENDA AUTOMÃTICA TODO O CLIPE] | set-subtitle-color(color:"#ffff00") | set-subtitle-stroke(color:"#000000",width:2) | set-subtitle-size(size:24) | set-subtitle-font(fontFamily:"Outfit") | make-shorts() [AJUSTA TELA 9:16, +20 SAT, +10 CON, CORTE AUTO, LEGENDA AUTO E EXPORTA PARA SHORTS/TIKTOK]`;
    const visualEffects = `EFEITOS VISUAIS (usar em set-effect):
  Cor/Estilo: sepia_pro(Sepia Pro) | warm(Quente) | cold(Frio) | bw_classic(P&B Classico) | bw_high_con(P&B Contraste) | bw_muted(P&B Suave) | horror_red(Terror Vermelho) | cinema_scope(Cinema Scope) | iso_red(Focar Vermelho) | cyberpunk(Cyberpunk) | night_vision(Visao Noturna) | dramatic(Dramatico) | vintage_70s(Vintage 70s) | pastel(Tons Pastel)
  Animacao/Movimento: shake(Tremor) | pulse(Pulso) | zoom(Zoom Pump) | slowzoom(Zoom Lento) | sway(Barco/Mar) | flash(Flash) | rainbow(Arco-Iris) | colorshift(Troca Cor)
  Artistico: noir(Noir) | vhs(VHS Retro) | vibrant(Vibrante) | cinema(Cinema) | glitch(Glitch) | horror(Horror) | dream(Sonho) | retro80s(80s Retro) | sepia(Sepia Gold) | negative(Negativo) | oldfilm(Filme Antigo) | ghost(Fantasma) | crt(CRT Antigo)
  Desfoque/Distorcao: blur(Desfoque) | blurpulse(Desfoque Pulso) | pixelate(Pixelar)`;
    const transitions = `TRANSICOES (usar em set-effect para clips de transicao):
  fade(Dissolver) | slideleft(Deslizar Esq) | slideright(Deslizar Dir) | slideup(Subir) | slidedown(Descer) | zoomin(Zoom In) | zoomout(Zoom Out) | wipe(Varredura) | spin(Girar) | blurtrans(Blur Trans) | glitchtrans(Glitch Trans) | flashwhite(Flash Branco) | pixelate(Pixelar) | iris(Iris Circular) | flip(Vira-pagina)`;
    const fonts = `FONTES para add-text/set-subtitle-font: Arial | Impact | Outfit | JetBrains Mono | Roboto | Inter | Montserrat | Open Sans | Lato | Poppins | Playfair Display | Oswald | Times New Roman | Georgia | Verdana`;
    const rules = `REGRAS CRITICAS E INFORMACOES:
1. set-speed NUNCA aplica em clip tipo "audio" - se selectedClip for audio, omita clipId e o sistema auto-seleciona o video
2. Use values RELATIVOS quando o usuario disser "aumenta X%", "diminui X", "mais X", "menos X"
3. blurpulse = "Desfoque Pulso". Quando o usuario pedir um efeito em pt-BR (ex: "Desfoque Pulso"), deduza a string do ID (ex: "blurpulse").
4. ATALHOS DO TECLADO: O usuario PODE USAR atalhos nativos no editor: Ctrl+Z (Desfazer), Ctrl+Y ou Ctrl+Shift+Z (Refazer), Delete/Backspace (Apagar clipe selecionado), Espaco (Play/Pause), S (Cortar o clipe ao meio). Se ele perguntar sobre atalhos, informe-o!
5. GERADOR DE IMAGENS: Se o usuario pedir "crie a imagem", "gere a imagem", "desenhe...", "faca a imagem de..." ou similar (inclusive de pessoas reais, celebridades, jogadores de futebol ou qualquer tema), use EXCLUSIVAMENTE a acao generate-image. NUNCA diga que voce nao consegue gerar imagens ou que tem limitacoes tecnicas. Voce possui uma ferramenta local dedicada que fara o download e criacao de forma totalmente automatica, portanto sua unica tarefa e enviar o bloco \`\`\`video-action:generate-image\`\`\` correspondente.
6. CORTE AUTOMATICO: Se o usuario pedir "corta o video", "tira os silÃªncios", "corta automaticamente" ou similar SEM especificar como, use SEMPRE auto-cut. Nao use split nem trim para isso.
7. ISOLAR VOZ: Se o usuario pedir "tira o ruído", "isola a voz", "remove o chiado", "limpa o audio" ou similar, use SEMPRE isolate-voice.
8. LEGENDA AUTOMATICA: Se o usuario pedir "legenda o video", "coloca legenda", "legenda automaticamente" ou "legendar o video todo", use SEMPRE auto-subtitle.
9. MUDAR COR DA LEGENDA: Se o usuario pedir "muda a cor da legenda", "legenda amarela", "deixa a legenda vermelha" ou similar, use set-subtitle-color e aplica em TODAS.
10. MUDAR CONTORNO DA LEGENDA: Se o usuario pedir "muda o contorno", "borda preta na legenda" ou similar, use set-subtitle-stroke e aplica em TODAS.
11. FORMATO SHORTS / REELS / TIKTOK: Se o usuario pedir "edita no estilo shorts", "formato tiktok", "cria um shorts", ou similar, use EXCLUSIVAMENTE a acao \`make-shorts\`. NAO tente fazer os passos manualmente (nao chame set-scale, set-saturation, etc separadamente). \`make-shorts\` ja faz tudo sozinho!
12. MUDAR TAMANHO DA LEGENDA: Se o usuario pedir "aumenta a legenda", "muda o tamanho da legenda", "legenda tamanho 24" ou similar, use set-subtitle-size e aplica em TODAS.
13. MUDAR A FONTE DA LEGENDA: Se o usuario pedir "muda a fonte da legenda" para alguma fonte (ex: Outfit, Roboto, Inter, Arial, Impact etc.), use set-subtitle-font e aplica em TODAS.
14. EVITE DIZER 'JÃ FEITO' OU RECUSAR: Se o usuario pedir para executar uma acao (como legendar o video, mudar cor/contorno/tamanho da legenda, isolar voz, cortar automaticamente, etc.), voce DEVE SEMPRE gerar e incluir o bloco de codigo \`\`\`video-action:...\`\`\` na sua resposta atual, MESMO QUE o historico de chat mostre que voce ja fez isso anteriormente. O usuario pode ter limpado a timeline ou quer repetir o processo, por isso NUNCA diga 'ja fiz' ou 'ja foi feito' sem enviar o comando correspondente.
15. AÇÕES GLOBAIS vs LOCAIS: Se o usuário pedir para alterar/mutar/remover/ajustar propriedades (saturação, brilho, contraste, velocidade, volume, opacidade, escala, efeitos visuais, silenciar/remover áudio/mute) do VÃDEO INTEIRO, de TODOS os clipes, ou de forma genérica sem especificar um clipe (ex: "retirar toda saturação", "mudar velocidade do vídeo todo", "remover todo áudio", "silenciar tudo"), vocÃª DEVE passar \`"clipId": "all"\` no payload da ação correspondente. Caso o usuário especifique um clipe por índice, nome ou ordem (ex: "no terceiro clipe", "no primeiro clipe", "no clipe X"), vocÃª DEVE passar o índice correspondente como número (ex: \`"clipId": 3\`), a string ordinal (ex: \`"clipId": "primeiro"\`) ou o ID específico do clipe listado no estado do editor (ex: \`"clipId": "clip-id-aqui"\`).`;
    return `Voce e o EDITOR DE VIDEO, editor autonomo integrado ao Video Editor. Voce CONHECE TODOS os efeitos, transicoes, fontes e parametros do app.\n\n${stateBlock}\n\n${relativeNote}\n\n${rules}\n\nCOMO AGIR:\n\`\`\`video-action:ACAO\n{"param": valor}\n\`\`\`\nACOES: ${actions}\n\n${visualEffects}\n\n${transitions}\n\n${fonts}\n\nPara multiplas acoes use varios blocos. FFmpeg so para exportar/converter/legendas.\nPASTA: ${wf}. Apos agir: confirme e sugira proximo passo.`;
  };

  // -- Helper: System prompt do modo Photo com estado LIVE do editor
  const buildPhotoSystemPrompt = (): string => {
    const wf = settingsRef.current.workFolder || 'C:\\Users\\Administrator\\Desktop\\testes';
    const editorState = photoEditorRef.current?.getEditorState?.();
    let stateBlock = 'Nenhum elemento no canvas atualmente.';

    if (editorState) {
      const cw = editorState.canvasWidth || 1280;
      const ch = editorState.canvasHeight || 720;

      // Converte coordenadas numéricas em descrição posicional legível pela IA
      const describePos = (e: any): string => {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        const pctX = cx / cw;
        const pctY = cy / ch;
        const coverW = Math.round((e.w / cw) * 100);
        const coverH = Math.round((e.h / ch) * 100);

        const hPos = pctX < 0.35 ? 'esquerda' : pctX > 0.65 ? 'direita' : 'centro';
        const vPos = pctY < 0.35 ? 'topo' : pctY > 0.65 ? 'base' : 'meio';
        const posDesc = vPos === 'meio' && hPos === 'centro' ? 'centro do canvas'
          : `${vPos}-${hPos}`;

        return `${posDesc} | ocupa ${coverW}% da largura e ${coverH}% da altura`;
      };

      const sel = editorState.selectedElement;
      const elList = (editorState.elements || []).map((e: any, idx: number) =>
        `  ${idx+1}. ID: ${e.id} | Tipo: ${e.type}${e.type === 'image' ? ' (IMAGEM)' : ''}${e.customName ? ` | Nome: "${e.customName}"` : ''}${e.customCategory ? ` | Categoria: ${e.customCategory}` : ''} | x:${Math.round(e.x)} y:${Math.round(e.y)} w:${Math.round(e.w)} h:${Math.round(e.h)} | zIndex:${e.zIndex} | Região: ${describePos(e)}` +
        (e.text ? ` | Texto: "${e.text}"` : '') +
        (e.shapeKind ? ` | Forma: ${e.shapeKind}` : '')
      ).join('\n') || '  (vazio)';
      
      stateBlock = `ESTADO DO CANVAS PRINCIPAL - DimensÃµes: ${editorState.canvasWidth}x${editorState.canvasHeight} | Fundo: ${editorState.canvasBg} | Total Elementos: ${editorState.elements?.length || 0}${editorState.isDraftMode ? ' | (Usuário está no modo Rascunho agora)' : ''}\n` +
        (sel ? `SELECIONADO/VINCULADO: ID:${sel.id} | Tipo:${sel.type} | x:${Math.round(sel.x)} y:${Math.round(sel.y)} w:${Math.round(sel.w)} h:${Math.round(sel.h)} | rotação:${sel.rotation} | opacidade:${sel.opacity}%` + 
          (sel.type === 'text' ? ` | fontSize:${sel.fontSize}px | textColor:${sel.textColor} | textStrokeWidth:${sel.textStrokeWidth ?? 0}px | textStrokeColor:${sel.textStrokeColor ?? '#000000'} | textHollowEnabled:${!!sel.textHollowEnabled} | textShadowOffsetX:${sel.textShadowOffsetX ?? 0}px | textShadowOffsetY:${sel.textShadowOffsetY ?? 0}px` : '') +
          (sel.type === 'shape' ? ` | fillColor:${sel.fillColor} | strokeColor:${sel.strokeColor} | strokeWidth:${sel.strokeWidth}px | shapeKind:${sel.shapeKind}` : '') +
          (sel.type === 'image' ? ` | brightness:${sel.brightness}% | contrast:${sel.contrast}% | saturation:${sel.saturation}% | blur:${sel.blur}% | duotoneEnabled:${!!sel.duotoneEnabled} | duotoneColor1:${sel.duotoneColor1} | duotoneColor2:${sel.duotoneColor2}` : '') + '\n' : 'Nenhum elemento selecionado\n') +
        `ELEMENTOS NO CANVAS PRINCIPAL:\n${elList}` +
        (editorState.draft?.hasContent
          ? `\nRASCUNHO ATIVO: Sim â€” imagem do esboço enviada na mensagem. Elementos vinculados: ${(editorState.draft.linkedElementIds || []).join(', ') || 'nenhum'}. Use o esboço como roteiro de posição, tamanho, cores e layout.`
          : editorState.draft ? '\nRASCUNHO: Existe mas ainda está vazio â€” peça ao usuário desenhar o esboço primeiro.' : '');
    }

    const actions = `
- add-text(text: "Título", fontSize: 48, textColor: "#ffffff", x: 100, y: 150, w: 400, h: 80, fontFamily: "Inter", textAlign: "center")
- add-shape(shapeKind: "rect"|"circle"|"triangle"|"star"|"heart"|"diamond"|"cross"|"hexagon", fillColor: "#7c5cfc", strokeColor: "#ffffff", strokeWidth: 2, x: 200, y: 200, w: 100, h: 100)
- add-image(imageSrc: "https://url-ou-dataurl", w: 400, h: 300) â€” adiciona imagem ao canvas por URL direta
- search-and-add-image(query: "neymar jogador", skip: 0) â€” BUSCA imagem no Bing e coloca direto no canvas (skip=0 pega 1ª, skip=1 pega 2ª, etc.)
- search-and-add-reference(query: "paisagem por do sol", label: "Referência", skip: 0) – BUSCA imagem no Bing e coloca como REFERÊNCIA fora do canvas + extrai paleta de cores automaticamente. Use quando o usuário pedir "referência", "inspiração", "paleta de cores", "cores de X" ou quiser estudar uma imagem sem colocar no canvas.
- generate-image(prompt: "gato realista astronauta no espaço") â€” GERA uma imagem inédita do zero usando inteligÃªncia artificial (Pollinations) e adiciona ao canvas
- set-background(color: "#ffffff" ou degradÃª CSS)
- update-element(elementId: "ID", text, fontSize, fontFamily, fontWeight, fontStyle, textAlign, textColor, textStrokeWidth, textStrokeColor, textHollowEnabled: true|false, textShadowOffsetX, textShadowOffsetY, textShadowColor, textShadowBlur, fillColor, strokeColor, strokeWidth, opacity, rotation, locked, zIndex, x, y, w, h)
  * fontFamily: "Inter", "Poppins", "Montserrat", "Roboto", "Bebas Neue", "Arial", etc.
  * fontWeight: "400" (normal), "700" (negrito/bold)
  * fontStyle: "normal", "italic"
  * textAlign: "left", "center", "right"
- set-filter(elementId: "ID", brightness, contrast, saturation, blur, hueRotate, duotoneEnabled: true|false, duotoneColor1: "#hex", duotoneColor2: "#hex", flipX: true|false, flipY: true|false)
- set-overlay(elementId: "ID", overlayType: "fade"|"fade-inferior"|"fade-left"|"fade-right"|"fade-bottom"|"fade-radial"|"fade-duplo-v"|"fade-duplo-h"|"degrade"|"degrade-horizontal"|"degrade-vertical"|"glow"|"glow-top"|"glow-bottom"|"glow-neon"|"xadrez"|"dots"|"stripes"|"grid"|"zigzag"|"waves"|"noise"|"scanlines"|"vignette-overlay", overlayColor1: "#hex") â€” aplica overlay/efeito visual em cima de uma imagem
- add-overlay(overlayType: "fade"|"fade-inferior"|"fade-left"|"fade-right"|"fade-bottom"|"fade-radial"|"fade-duplo-v"|"fade-duplo-h"|"degrade"|"degrade-horizontal"|"degrade-vertical"|"glow"|"glow-top"|"glow-bottom"|"glow-neon"|"glow-multicolor"|"xadrez"|"dots"|"stripes"|"grid"|"zigzag"|"waves"|"noise"|"scanlines"|"vignette-overlay", overlayColor1: "#hex", x, y, w, h, opacity) â€” adiciona overlay como ELEMENTO NOVO independente (igual à aba Elementos). Use SEMPRE este ao invés de set-overlay quando o usuário pedir para adicionar fade/efeito/overlay.
- delete-element(elementId: "ID")
- add-page(w: 1080, h: 1080, preset: "Post Instagram"|"Banner Web"|"Story", name: "Nome", bgColor: "#ffffff") — ADICIONA nova página/canvas SEM APAGAR a atual. Use quando pedir "novo canvas", "nova página", "banner". Se não especificar tamanho, copia do atual. Presets: "Post Instagram" (1080x1080), "Instagram Retrato" (1080x1350), "Story" (1080x1920), "Banner Web" (1200x628), "Capa YouTube" (2560x1440), "Apresentação" (1280x720).
- duplicate-element(elementId: "ID")
- clear-canvas()
- set-canvas-size(w: 1080, h: 1080, preset: "Post Instagram")
- select-element(elementId: "ID")
- apply-from-draft() â€” ativa o canvas principal para aplicar o roteiro do rascunho
- undo()
- redo()
- remove-background(elementId: "ID") â€” remove o fundo automático de uma imagem usando IA (rembg). Apenas para elementos do tipo 'image'.
- enhance-image(elementId: "ID") â€” melhora a qualidade/nitidez de uma imagem automaticamente. Use quando o usuário pedir "melhorar qualidade", "aumentar nitidez", "melhorar resolução", "upscale" ou similar.
- export()
`;

    const rules = `
REGRAS DO EDITOR DE FOTOS:
1. Responda SEMPRE em português brasileiro.
2. Identifique os elementos no canvas com base no ID listado no estado do editor. Para alterar um elemento específico, passe a propriedade "elementId" correspondente no payload.
3. Se o usuário pedir para mudar uma propriedade (ex: cor da letra, tamanho da fonte, espessura do contorno, adicionar sombra, etc.) de um elemento específico ou do elemento selecionado, use a ação "update-element".
4. EFEITO DE CONTORNO VAZADO (TEXTO HOLLOW): Se o usuário pedir para deixar o texto vazado, transparente por dentro ou apenas o contorno, use a ação "update-element" com {"textHollowEnabled": true} e defina a cor e espessura do contorno.
5. FILTRO DUOTONE: Se o usuário pedir para aplicar efeito Duotone na imagem, use a ação "set-filter" com {"duotoneEnabled": true, "duotoneColor1": "#cor1", "duotoneColor2": "#cor2"}.
6. Para realizar múltiplas açÃµes seguidas, vocÃª pode gerar múltiplos blocos sequencialmente.
7. EVITE DIZER 'JÃ FEITO' OU RECUSAR: Se o usuário pedir para realizar uma ação, gere SEMPRE o bloco correspondente.
8. REMOÇÃƒO DE FUNDO AUTOMÃTICA: Se o usuário pedir "retira o fundo", "remove o fundo", "tira o fundo", "remove background", "transparente" ou similar de uma imagem, use SEMPRE a ação remove-background(elementId). A IA de remoção de fundo (rembg) é executada automaticamente. NUNCA tente fazer isso manualmente com set-filter ou outras açÃµes.
9. BUSCAR vs GERAR IMAGEM: Se o usuário pedir para "buscar", "procurar", "achar" ou "colocar foto de X", use search-and-add-image. Se ele pedir para "gerar", "criar", "desenhar com IA" ou "inventar" uma imagem do zero (ex: "crie um gato voando", "gerar imagem de dragão"), use SEMPRE a ação generate-image com o prompt descritivo em inglÃªs (melhor compatibilidade com Pollinations). NUNCA use search-and-add-image quando ele pedir para criar/gerar.
10. RASCUNHO COM REMOÇÃƒO DE FUNDO: Quando interpretar um rascunho que indica "remover fundo", "sem fundo", "fundo transparente" em um elemento, gere a ação remove-background com o elementId correspondente. O elemento de imagem está listado como Tipo: image (IMAGEM) na lista de ELEMENTOS. Use o ID desse elemento. Se houver só uma imagem no canvas, use o ID dela diretamente.
11. INVERTER IMAGEM: Se o usuário pedir "inverte a imagem", "espelha", "flip horizontal", "flip vertical", "inverter" ou similar, use update-element ou set-filter com flipX: true (horizontal) ou flipY: true (vertical). Para desfazer, use flipX: false ou flipY: false.
12. POSICIONAMENTO â€” REGRAS MATEMÃTICAS OBRIGATÃ“RIAS. Canvas = ${editorState?.canvasWidth ?? 1280}x${editorState?.canvasHeight ?? 720}px. SEMPRE calcule x,y,w,h em pixels absolutos:
  - "preencher o canvas" / "fundo" / "cobrir tudo": x=0, y=0, w=${editorState?.canvasWidth ?? 1280}, h=${editorState?.canvasHeight ?? 720}
  - "esquerda": x=0, w=metade do canvas (${Math.round((editorState?.canvasWidth ?? 1280)/2)})
  - "direita": x=metade do canvas, w=metade do canvas
  - "topo": y=0, h=metade do canvas (${Math.round((editorState?.canvasHeight ?? 720)/2)})
  - "base" / "baixo": y=metade do canvas, h=metade do canvas
  - "centro": x=(canvasW-w)/2, y=(canvasH-h)/2
  - "em cima de [elemento]": use as mesmas coordenadas x,y,w,h do elemento alvo
  - "acima de [elemento]": y = elemento.y - h (acima, não sobreposto)
  - "abaixo de [elemento]": y = elemento.y + elemento.h
13. RASCUNHO (ESBOÇO): Quando existir rascunho com conteúdo, analise a IMAGEM do esboço enviada. O usuário desenhou à mão um roteiro de layout. Ao receber "aplica o rascunho" ou similar: execute MÃšLTIPLAS photo-actions no CANVAS PRINCIPAL. Use a regra 12 para calcular coordenadas precisas. As coordenadas do esboço (${editorState?.canvasWidth ?? 1280}x${editorState?.canvasHeight ?? 720}px) correspondem 1:1 ao canvas.
14. ADICIONAR vs LIMPAR CANVAS: MUITO IMPORTANTE! Quando o usuário pedir "adiciona um novo canvas", "cria uma nova página", "faz um banner", "adiciona um story", use SEMPRE a ação add-page. NUNCA use clear-canvas para isso! A ação clear-canvas APAGA TODOS os elementos do canvas atual e SÓ deve ser usada quando o usuário EXPLICITAMENTE pedir para "limpar", "apagar tudo", "zerar o canvas". A ação add-page ADICIONA uma nova página SEM apagar nada.
15. NOMES E CATEGORIAS REGISTRADOS: REGRA CRÍTICA! Quando um elemento tiver "Nome: 'xxxx'" ou "Categoria: yyyy" na lista de ELEMENTOS, você DEVE usar essas informações como PRIORIDADE MÁXIMA para identificá-lo. PROCESSO OBRIGATÓRIO:
   a) Usuário pede "apaga a chuteira" → você PROCURA na lista de ELEMENTOS por Nome que contenha "chuteira" (case-insensitive)
   b) Encontrou? Use o ID desse elemento diretamente
   c) Não encontrou? Procure por Categoria relevante (ex: "objeto", "animal")
   d) Ainda não encontrou? AÍ SIM pergunte ao usuário ou use posição
   EXEMPLOS PRÁTICOS:
   - "apaga a sniper" → busca Nome: contém "sniper" → usa o ID encontrado
   - "logo em vermelho" → busca Nome: contém "logo" → aplica filtro no ID encontrado
   - "aumenta o jogador" → busca Nome: contém "jogador" OU Categoria: "pessoa" → redimensiona o ID encontrado
   NUNCA diga "não consigo identificar" se existir um elemento com nome/categoria que corresponda ao que o usuário pediu!
`;

    return `Você é o EDITOR DE FOTOS, assistente autônomo de edição de imagens integrado ao Photo Editor. Você conhece e gerencia perfeitamente todos os elementos do canvas.\n\n${stateBlock}\n\n${rules}\n\nCOMO AGIR:\n\`\`\`photo-action:ACAO\n{"param": valor}\n\`\`\`\nAÇÕES SUPORTADAS:\n${actions}\n\nPASTA DE TRABALHO: ${wf}. Confirme a ação realizada e indique as opções disponíveis.\n\n${getWebResearchInstructions()}`;
  };

  // -- Parser de açÃµes do Paint (paint-action: blocks)
  const parseAndExecutePaintActions = (response: string): void => {
    const paintActionRegex = /```paint-action:([^\n]+)\n([\s\S]*?)```/gi;
    let m;
    while ((m = paintActionRegex.exec(response)) !== null) {
      const actionName = m[1].trim();
      const payloadStr = m[2].trim();
      let payload: any = {};
      try { payload = JSON.parse(payloadStr || '{}'); } catch { payload = {}; }

      if (actionName === 'search-and-add-reference') {
        const query = payload.query || '';
        const skip = payload.skip ?? 0;
        const opacity = payload.opacity ?? 50;
        if (!query) { addToTerminal('[Paint IA] Query vazia'); continue; }
        addToTerminal(`[Paint IA] Buscando referÃªncia: "${query}"...`);
        (window as any).electronAPI.searchImageAsDataUrl(query, skip)
          .then((res: any) => {
            // Backend pode retornar success:false mas com resultado real no campo 'error' como string
            let result = res;
            if (res && !res.success && res.error && typeof res.error === 'string') {
              try {
                const lines = res.error.trim().split('\n');
                const firstLine = lines[0];
                result = JSON.parse(firstLine);
              } catch { result = res; }
            }
            
            if (result && result.success && (result.dataUrl || result.path)) {
              const src = result.dataUrl || ('file://' + result.path.replace(/\\/g, '/'));
              paintRef.current?.applyPaintAction('add-reference', { src, opacity });
              addToTerminal(`[Paint IA] ✅ "${query}" adicionada!`);
            } else {
              addToTerminal(`[Paint IA] ❌ Não encontrei`);
            }
          })
          .catch((err: any) => {
            addToTerminal(`[Paint IA] ❌ Erro: ${err.message}`);
          });
        continue;
      }

      if (actionName === 'generate-and-add-reference') {
        const prompt = payload.prompt || '';
        const opacity = payload.opacity ?? 50;
        if (!prompt) { addToTerminal('[Paint IA] Prompt vazio'); continue; }
        addToTerminal(`[Paint IA] Gerando referÃªncia: "${prompt}"...`);
        (window as any).electronAPI.generateImage({ prompt })
          .then((res: any) => {
            if (res.success && res.path) {
              const src = 'file://' + res.path.replace(/\\/g, '/');
              paintRef.current?.applyPaintAction('add-reference', { src, opacity });
              addToTerminal(`[Paint IA] ReferÃªncia gerada e adicionada!`);
            } else {
              addToTerminal(`[Paint IA] Falha ao gerar: ${res.error}`);
            }
          });
        continue;
      }

      if (actionName === 'generate-and-add-layer') {
        const prompt = payload.prompt || '';
        const opacity = payload.opacity ?? 100;
        if (!prompt) { addToTerminal('[Paint IA] Prompt vazio'); continue; }
        addToTerminal(`[Paint IA] Gerando imagem para camada: "${prompt}"...`);
        (window as any).electronAPI.generateImage({ prompt })
          .then((res: any) => {
            if (res.success && res.path) {
              const src = 'file://' + res.path.replace(/\\/g, '/');
              paintRef.current?.applyPaintAction('add-layer-from-image', { src, opacity, name: 'IA' });
              addToTerminal(`[Paint IA] Camada IA adicionada!`);
            } else {
              addToTerminal(`[Paint IA] Falha: ${res.error}`);
            }
          });
        continue;
      }

      // Direct actions
      if (paintRef.current) {
        const result = paintRef.current.applyPaintAction(actionName, payload);
        addToTerminal(`[Paint IA] ${result}`);
      }
    }
  };

  // -- Parser de açÃµes diretas no editor de fotos (photo-action: blocks)
  const parseAndExecutePhotoActions = (response: string, draftVisionText?: string): void => {
    const photoActionRegex = /```photo-action:([^\n]+)\n([\s\S]*?)```/gi;
    let pMatch;
    const executedActions: string[] = [];

    while ((pMatch = photoActionRegex.exec(response)) !== null) {
      const actionName = pMatch[1].trim();
      const payloadStr = pMatch[2].trim();
      let payload: any = {};
      try { payload = JSON.parse(payloadStr || '{}'); } catch { payload = {}; }

      if (actionName === 'search-and-add-image') {
        const query = payload.query || '';
        const skip = typeof payload.skip === 'number' ? payload.skip : 0;
        if (!query) { addToTerminal('[Photo] Query vazia para busca de imagem'); continue; }
        addToTerminal(`[Photo] Buscando imagem: "${query}"...`);
        (window as any).electronAPI.searchImageAsDataUrl(query, skip)
          .then((res: any) => {
            // Backend pode retornar success:false mas com resultado real no campo 'error' como string
            let result = res;
            if (res && !res.success && res.error && typeof res.error === 'string') {
              try {
                const lines = res.error.trim().split('\n');
                const firstLine = lines[0];
                result = JSON.parse(firstLine);
              } catch { result = res; }
            }
            
            if (result && result.success && (result.dataUrl || result.path)) {
              const src = result.dataUrl || ('file://' + result.path.replace(/\\/g, '/'));
              photoEditorRef.current?.applyAIAction('add-image', { imageSrc: src });
              addToTerminal(`[Photo] ✅ "${query}" adicionada!`);
            } else {
              addToTerminal(`[Photo] ❌ Não encontrei`);
            }
          })
          .catch((err: any) => {
            addToTerminal(`[Bill Photo] ❌ Erro: ${err.message}`);
          });
        continue;
      }

      if (actionName === 'search-and-add-reference') {
        const query = payload.query || '';
        const label = payload.label || 'Referência';
        const skip = typeof payload.skip === 'number' ? payload.skip : 0;
        if (!query) { addToTerminal('[Photo] Query vazia para referência'); continue; }
        addToTerminal(`[Photo] Buscando referência: "${query}"...`);
        (window as any).electronAPI.searchImageAsDataUrl(query, skip)
          .then((res: any) => {
            // Backend pode retornar success:false mas com resultado real no campo 'error' como string
            let result = res;
            if (res && !res.success && res.error && typeof res.error === 'string') {
              try {
                const lines = res.error.trim().split('\n');
                const firstLine = lines[0];
                result = JSON.parse(firstLine);
              } catch { result = res; }
            }
            
            if (result && result.success && (result.dataUrl || result.path)) {
              const src = result.dataUrl || ('file://' + result.path.replace(/\\/g, '/'));
              photoEditorRef.current?.applyAIAction('add-reference', { imageSrc: src, label });
              addToTerminal(`[Bill Photo] ✅ Referência "${query}" com paleta de cores adicionada!`);
            } else {
              addToTerminal(`[Bill Photo] ❌ Não encontrei referência`);
            }
          })
          .catch((err: any) => {
            addToTerminal(`[Bill Photo] ❌ Erro: ${err.message}`);
          });
        continue;
      }

      executedActions.push(actionName);
      if (photoEditorRef.current) {
        const result = photoEditorRef.current.applyAIAction(actionName, payload);
        addToTerminal(`[Bill Photo] ${result}`);
      } else {
        addToTerminal('[Bill Photo] Editor não disponível');
      }
    }

    // Se o rascunho pediu remoção de fundo e a IA não gerou o bloco, executa automaticamente
    if (draftVisionText && !executedActions.includes('remove-background')) {
      const removeBgPattern = /tira(r)?(\s+o)?\s+fundo|remove(r|a)?(\s+o)?\s+fundo|sem\s+fundo|fundo\s+transparente|remove?\s*background|retira(r)?(\s+o)?\s+fundo|apaga(r)?(\s+o)?\s+fundo/i;
      addToTerminal(`[Debug] draftVisionText: ${draftVisionText.slice(0, 300)}`);
      addToTerminal(`[Debug] removeBgPattern match: ${removeBgPattern.test(draftVisionText)}`);
      if (removeBgPattern.test(draftVisionText)) {
        const editorState = photoEditorRef.current?.getEditorState?.();
        const imageEls = (editorState?.elements || []).filter((e: any) => e.type === 'image');
        addToTerminal(`[Debug] imageEls encontrados: ${imageEls.length}`);
        if (imageEls.length > 0) {
          addToTerminal(`[Bill Photo] Rascunho pediu remoção de fundo â€” executando automaticamente...`);
          imageEls.forEach((imgEl: any) => {
            photoEditorRef.current?.applyAIAction('remove-background', { elementId: imgEl.id });
          });
        }
      }
    }
  };
  const parseAndExecuteVideoActions = (response: string): void => {
    const videoActionRegex = /```video-action:([^\n]+)\n([\s\S]*?)```/gi;
    let vMatch;
    while ((vMatch = videoActionRegex.exec(response)) !== null) {
      const actionName = vMatch[1].trim();
      const payloadStr = vMatch[2].trim();
      let payload: any = {};
      try { payload = JSON.parse(payloadStr || '{}'); } catch { payload = {}; }
      if (videoEditorRef.current) {
        const result = videoEditorRef.current.applyAIAction(actionName, payload);
        addToTerminal(`[Video] ${result}`);
      } else {
        addToTerminal('[Video] Editor nao disponivel');
      }
    }
  };

  // -- Helper: System prompt do modo Criativo
  const buildCreativeSystemPrompt = (): string => {
    if (!selectedResearch) return '';
    
    // Extrai todos os textos dos blocos
    const blockTexts = (selectedResearch.blocks || [])
      .map(block => block.text)
      .filter(text => text && text.trim().length > 0)
      .join('\n\n');
    
    // Carrega pesquisas anexadas
    const researchIds = selectedResearch.researches || [];
    let researchesContent = '';
    
    if (researchIds.length > 0) {
      const saved = localStorage.getItem('billcode_my_researches');
      const allResearches = saved ? JSON.parse(saved) : [];
      
      researchesContent = researchIds
        .map(id => {
          const research = allResearches.find((r: any) => r.id === id);
          if (!research) return '';
          
          let content = `\n### Pesquisa: ${research.title}\n`;
          if (research.content) content += `${research.content}\n`;
          if (research.links && research.links.length > 0) {
            content += `Links:\n${research.links.join('\n')}\n`;
          }
          return content;
        })
        .filter(c => c.length > 0)
        .join('\n');
    }
    
    if (!blockTexts && !researchesContent) return '';
    
    return `\n\n=== CONTEXTO DO CRIATIVO ===
Você está visualizando o criativo: "${selectedResearch.name}"

${blockTexts ? `TEXTOS DOS BLOCOS:\n${blockTexts}\n` : ''}
${researchesContent ? `\nPESQUISAS ANEXADAS:${researchesContent}` : ''}

Use essas informações para contextualizar suas respostas sobre este criativo.`;
  };

  // -- Helper: System prompt do modo Web
  const buildWebSystemPrompt = (userMessage?: string): string => {
    // Pega a URL real do webview ativo (mais atualizada que o state)
    const tabId = activeBrowserTabIdRef.current;
    const webview = document.getElementById(`webview-${tabId}`) as any;
    let activeUrl = 'https://www.google.com';
    try {
      if (webview && webview.getURL) activeUrl = webview.getURL() || activeUrl;
      else activeUrl = browserTabs.find(t => t.id === tabId)?.url || activeUrl;
    } catch { activeUrl = browserTabs.find(t => t.id === tabId)?.url || activeUrl; }

    const cleanMsg = (userMessage || '').trim().toLowerCase().replace(/[!.?]/g, '');
    
    // Lista de agradecimentos e reações curtas (quando são EXATAMENTE isso, sem conteúdo da página)
    const thankYouPhrases = ['obrigado', 'obrigada', 'muito obrigado', 'muito obrigada', 'valeu', 'vlw', 'obg', 'thanks', 'tks'];
    const shortReactions = ['ok', 'show', 'boa', 'top', 'de nada', 'entendi', 'blz', 'beleza', 'perfeito', 'ótimo', 'otimo', 'legal', 'certo', 'entendido'];
    const casualReactions = ['kkk', 'kkkk', 'kkkkk', 'haha', 'rsrs', 'mano', 'caramba', 'nossa', 'uepa', 'uau'];
    const positiveReactions = ['mt bom', 'muito bom', 'boa demais', 'que loucura', 'ajudou', 'ajudou muito', 'salvou', 'arrasou', 'excelente', 'incrível', 'sensacional'];
    
    const allShortPhrases = [...thankYouPhrases, ...shortReactions, ...casualReactions, ...positiveReactions];
    const isShortAcknowledgement = allShortPhrases.some(phrase => cleanMsg === phrase || (cleanMsg.length < 25 && cleanMsg.includes(phrase)));

    const pageContent = (webPageContentRef.current && !isShortAcknowledgement)
      ? `\nCONTEÃšDO DA PÃGINA ATUAL (texto extraído):\n"""\n${webPageContentRef.current}\n"""\n`
      : '';

    const lastImg = lastClickedImageRef.current;
    const clickedImageBlock = lastImg
      ? `\nÃšLTIMA IMAGEM CLICADA PELO USUÃRIO: ${lastImg}\nSe o usuário pedir para mandar uma imagem pro editor, usar ESTA URL acima no send-to-photo-editor.\n`
      : '';

    return `Você é o NAVEGADOR WEB, assistente autônomo de navegação integrado ao navegador interno do app. Você controla diretamente o navegador do usuário.

⚠️ IMPORTANTE: NÃO se apresente ou explique quem você é em TODA resposta. Apenas responda naturalmente ao que o usuário perguntou. Só se apresente quando o usuário perguntar especificamente quem você é.

⚠️ PRIORIDADE: Se o usuário anexou um ARQUIVO (você verá "[Arquivo: nome.ext]" na mensagem), responda SOBRE O ARQUIVO, não sobre o conteúdo da página web. O arquivo tem prioridade máxima.

🌐 PESQUISA WEB DISPONÍVEL
Você tem acesso à internet via research.

⚠️ REGRA CRÍTICA: APENAS pesquise quando o usuário MANDAR EXPLICITAMENTE usando palavras como "pesquisa", "busca", "procura", "search".

NUNCA pesquise automaticamente só porque é uma pergunta sobre fatos. Se o usuário NÃO pedir para pesquisar, responda com seu conhecimento interno.

URL ATUAL DA ABA: ${activeUrl}
IMPORTANTE: Quando usar send-to-video-editor, coloque EXATAMENTE esta URL no campo "url": "${activeUrl}"
${clickedImageBlock}${pageContent}

COMO AGIR â€” use blocos web-action para controlar o navegador:
\`\`\`web-action:ACAO
{"param": "valor"}
\`\`\`

AÇÕES DISPONÃVEIS:
- navigate â†’ {"url": "https://..."} â€” abre qualquer URL no navegador interno (MUDA A ABA ATUAL)
- youtube-play â†’ {"query": "nome da música ou vídeo"} â€” busca e toca no YouTube
- google-search â†’ {"query": "termo de busca"} â€” faz uma busca no Google (MUDA A ABA ATUAL)
- research â†’ {"query": "termo de busca"} â€” pesquisa em BACKGROUND sem sair da página atual, extrai o conteúdo e responde. USE ESTE quando precisa buscar informação para responder ao usuário sem interromper o que ele está fazendo.
- new-tab â†’ {"url": "https://..."} â€” abre em nova aba
- go-back â†’ {} â€” volta à página anterior
- go-forward â†’ {} â€” avança à próxima página
- download-image â†’ {"url": "https://url-da-imagem.jpg", "name": "nome_opcional.jpg"} â€” baixa uma imagem
- search-and-download-image â†’ {"query": "descrição da imagem", "skip": 0} â€” pesquisa imagem e baixa
- send-to-photo-editor â†’ {} â€” manda a imagem clicada pro editor de fotos (não precisa de URL)
- send-to-video-editor â†’ {"mode": "video", "url": "URL_ATUAL"} â€” baixa vídeo pro editor
- send-to-video-editor â†’ {"mode": "audio", "url": "URL_ATUAL"} â€” baixa áudio pro editor
- send-to-video-editor â†’ {"mode": "image"} â€” manda a imagem clicada pro editor de vídeo

REGRAS RÃGIDAS DE COMPORTAMENTO:
1. SE O USUÃRIO FIZER QUALQUER PERGUNTA sobre notícias, fatos, comentários, curiosidades, preços, horários ou detalhes externos que NÃƒO estejam no CONTEÃšDO DA PÃGINA ATUAL: GERE APENAS o bloco research, SEM NENHUM TEXTO antes ou depois. NENHUMA saudação, NENHUM aviso, NENHUM emoji. APENAS o bloco de ação.
2. SE O USUÃRIO AGRADECER (obrigado, valeu, thanks, etc.): responda APENAS "De nada! 😊" ou similar. NUNCA liste funcionalidades, NUNCA mencione "modo online", "modo offline", "pesquisa", "internet" ou qualquer aspecto técnico.
3. NUNCA use navigate ou google-search para responder a perguntas informativas, para não mudar a aba do usuário de forma invasiva.
4. Quando o resultado do research retornar, responda à pergunta diretamente e de forma natural, fingindo que já sabia a resposta desde o início, sem citar que pesquisou.
5. SE O USUÃRIO PEDIR MAIS DETALHES ou fizer perguntas de acompanhamento após uma resposta sua: FAÇA OUTRA PESQUISA research com query mais específica. NUNCA recuse, NUNCA diga que não pode pesquisar novamente.
4. Quando o usuário pedir para tocar música, ouvir algo, use SEMPRE youtube-play.
5. Quando pedir para NAVEGAR para um site específico, use navigate ou google-search (mudam a aba).
6. Quando pedir para BAIXAR a imagem da tela, use download-image.
7. Quando pedir para baixar imagem que não está na tela, use search-and-download-image.
8. QUANDO O USUÃRIO PEDIR PARA MANDAR/ENVIAR/ABRIR UMA IMAGEM NO EDITOR DE FOTOS/IMAGENS: use OBRIGATORIAMENTE send-to-photo-editor. NUNCA use download-image, search-and-download-image ou research para este pedido.
9. Responda em portuguÃªs brasileiro de forma natural e curta.
10. NUNCA se apresente, NUNCA diga "TÃ´ online como BILL WEB", NUNCA liste suas capacidades a não ser que o usuário pergunte explicitamente. Responda diretamente o que foi perguntado. Se já houve conversa antes, continue de onde parou â€” sem introduçÃµes.

Exemplos:
Usuário: "manda pro editor de fotos" / "abre no editor de imagens" / "edita essa imagem" / "manda essa foto pro editor"
\`\`\`web-action:send-to-photo-editor
{}
\`\`\`
Enviando para o editor de fotos!

Usuário: "baixa essa imagem" (quando há uma imagem aberta ou visível na URL atual)
\`\`\`web-action:download-image
{"url": "URL_DA_IMAGEM_ATUAL", "name": "imagem.jpg"}
\`\`\`
Baixando a imagem!

Exemplos:
Usuário: "baixa essa imagem" (quando há uma imagem aberta ou visível na URL atual)
\`\`\`web-action:download-image
{"url": "URL_DA_IMAGEM_ATUAL", "name": "imagem.jpg"}
\`\`\`
Baixando a imagem!

Usuário: "baixa uma foto de pÃ´r do sol"
\`\`\`web-action:search-and-download-image
{"query": "pÃ´r do sol paisagem", "skip": 0}
\`\`\`
Pesquisando e baixando foto de pÃ´r do sol.

Usuário: "baixa outra" (depois de já ter baixado uma)
\`\`\`web-action:search-and-download-image
{"query": "pÃ´r do sol paisagem", "skip": 1}
\`\`\`
Baixando uma imagem diferente!

Usuário: "toca bohemian rhapsody"
\`\`\`web-action:youtube-play
{"query": "bohemian rhapsody queen"}
\`\`\`
Pronto! Abrindo Bohemian Rhapsody no YouTube.

Usuário: "pesquisa receita de bolo"
\`\`\`web-action:google-search
{"query": "receita de bolo"}
\`\`\`
Buscando receita de bolo no Google.

Usuário: "vai para o instagram"
\`\`\`web-action:navigate
{"url": "https://www.instagram.com"}
\`\`\`
Navegando para o Instagram.

Usuário: "quando é o próximo jogo da Spirit no Major?"
\`\`\`web-action:research
{"query": "Spirit CS2 IEM Cologne Major playoffs schedule 2025"}
\`\`\`

Usuário: "qual o resultado do último jogo?"
\`\`\`web-action:research
{"query": "Spirit CS2 último resultado 2025"}
\`\`\`

Usuário: "que horas é o jogo do brasil hoje?"
\`\`\`web-action:research
{"query": "jogo Brasil hoje horário 2026"}
\`\`\`

Usuário: "vai no hltv e vÃª a tabela"
\`\`\`web-action:navigate
{"url": "https://www.hltv.org/events"}
\`\`\`
Abrindo o HLTV!

Usuário: "manda esse vídeo pro editor"
\`\`\`web-action:send-to-video-editor
{"mode": "video", "url": "URL_ATUAL"}
\`\`\`
Baixando e mandando para o editor de vídeo!

Usuário: "baixa o áudio dessa música" (ou "manda o áudio pro editor")
\`\`\`web-action:send-to-video-editor
{"mode": "audio", "url": "URL_ATUAL"}
\`\`\`
Extraindo o áudio e mandando pro editor!`;
  };

  // ── SISTEMA UNIVERSAL DE PESQUISA WEB ─────────────────────────────────────
  // Processa qualquer resposta de IA e detecta se precisa fazer pesquisa web
  // Funciona em TODAS as abas e chats (Home, Web, Contatos, Grupos, etc)
  const processResearchIfNeeded = async (
    response: string,
    context: {
      messages: Message[];
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
      chatId?: string | null;
      systemPrompt: string;
      settings: any;
      effectiveView: string;
    }
  ): Promise<string> => {
    
    console.log('[Research] Verificando resposta...');
    console.log('[Research] Aba/View:', context.effectiveView);
    console.log('[Research] Chat ID:', context.chatId || 'global');
    
    // 1. Detecta se a resposta contém bloco de pesquisa
    const researchMatch = response.match(/```web-action:research\n([\s\S]*?)```/);
    if (!researchMatch) {
      console.log('[Research] ❌ Sem bloco de pesquisa - retornando resposta original');
      return response; // Sem pesquisa, retorna resposta original
    }
    
    console.log('[Research] ✅ Bloco de pesquisa detectado!');
    
    // 2. Extrai a query de pesquisa
    let query = '';
    try {
      query = JSON.parse(researchMatch[1].trim()).query || '';
      console.log('[Research] Query extraída (JSON):', query);
    } catch {
      query = researchMatch[1].trim();
      console.log('[Research] Query extraída (texto):', query);
    }
    
    if (!query) {
      console.log('[Research] ❌ Query vazia - abortando');
      return response;
    }
    
    const searchProvider = context.settings.searchProvider || 'tavily';
    const apiKeys = {
      tavilyApiKey: context.settings.tavilyApiKey || '',
      googleApiKey: context.settings.googleApiKey || '',
      googleCx: context.settings.googleCx || '',
      braveApiKey: context.settings.braveApiKey || '',
    };
    
    console.log('[Research] Provider:', searchProvider);
    console.log('[Research] Context.settings:', JSON.stringify({
      searchProvider: context.settings.searchProvider,
      tavilyApiKey: context.settings.tavilyApiKey ? '***' : 'vazio',
      googleApiKey: context.settings.googleApiKey ? '***' : 'vazio',
      googleCx: context.settings.googleCx ? '***' : 'vazio',
      braveApiKey: context.settings.braveApiKey ? '***' : 'vazio',
    }));
    
    // DEBUG TEMPORÁRIO
    if (!context.settings.searchProvider) {
      console.error('[Research] ERRO: searchProvider está undefined!');
      console.error('[Research] Todas as settings:', context.settings);
    }
    
    addToTerminal(`[Research/${context.effectiveView}] Provider: ${searchProvider}, Pesquisando: "${query}"...`);
    
    // 3. Substitui a última mensagem assistant pelo placeholder "Pesquisando..."
    console.log('[Research] Substituindo última mensagem assistant por placeholder...');
    context.setMessages((prev: Message[]) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx]?.role === 'assistant') {
        updated[lastIdx] = { ...updated[lastIdx], content: '__RESEARCHING__' };
      }
      return updated;
    });
    
    // 4. Executa a pesquisa
    try {
      console.log('[Research] Chamando electronAPI.webResearch...');
      const resResult = await (window as any).electronAPI.webResearch(query, searchProvider, apiKeys);
      
      console.log('[Research] Resultado recebido:', { success: resResult?.success, hasContent: !!resResult?.content, url: resResult?.url });
      
      if (!resResult?.success || !resResult?.content) {
        console.log('[Research] ❌ Pesquisa falhou ou sem conteúdo');
        addToTerminal(`[Research] Sem resultado para: "${query}"`);
        return `Não encontrei informações atualizadas sobre "${query}".`;
      }
      
      console.log('[Research] ✅ Conteúdo obtido:', resResult.content.substring(0, 100) + '...');
      addToTerminal(`[Research] Conteúdo extraído de: ${resResult.url}`);
      
      // 5. Monta prompt com os resultados da pesquisa
      const contextPrompt = `Para a pergunta sobre "${query}", aqui está o conteúdo pesquisado na internet (fonte: ${resResult.url}):\n\n${resResult.content}\n\nCom base nesses fatos reais, responda diretamente à pergunta de forma curta e natural em português. Não diga que pesquisou. Apenas responda.`;
      
      // 6. Prepara mensagens para chamar a IA novamente
      const researchMessages = [
        { role: 'system' as const, content: context.systemPrompt },
        ...context.messages.filter(m => m.content && !m.content.includes('web-action:research')).slice(-3),
        { role: 'user' as const, content: contextPrompt },
      ];
      
      console.log('[Research] Preparando chamada à IA com resultados...');
      console.log('[Research] Provider:', context.settings.apiProvider);
      console.log('[Research] Total mensagens:', researchMessages.length);
      console.log('[Research] Última mensagem user:', researchMessages[researchMessages.length - 1].content.substring(0, 200));
      
      // 7. Limpa placeholder antes de fazer streaming
      console.log('[Research] Limpando placeholder...');
      context.setMessages((prev: Message[]) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx]?.role === 'assistant' && updated[lastIdx].content === '__RESEARCHING__') {
          updated[lastIdx] = { ...updated[lastIdx], content: '__GENERATING__' };
        }
        return updated;
      });
      
      // 8. Faz streaming da resposta final com os resultados
      let researchContent = '';
      const myCancelVersion = ++streamIdRef.current;
      
      console.log('[Research] Iniciando streaming (version:', myCancelVersion, ')...');
      
      await new Promise<void>((resolve) => {
        let settled = false;
        const chunkHandlers: Array<() => void> = [];
        const finish = () => { 
          if (!settled) { 
            settled = true; 
            chunkHandlers.forEach(h => h()); 
            console.log('[Research] Streaming finalizado. Total chars:', researchContent.length);
            resolve(); 
          } 
        };
        let timeoutId = setTimeout(finish, 60000);

        const handleChunk = (chunk: string) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(finish, 60000);
          if (streamIdRef.current !== myCancelVersion) { 
            finish(); 
            return; 
          }
          researchContent += chunk;
          console.log('[Research/Chunk] Atualizando com', researchContent.length, 'chars');
          // Atualiza a última mensagem
          context.setMessages((prev: Message[]) => { 
            const msgs = [...prev];
            console.log('[Research/Chunk] Mensagens antes:', msgs.length, 'última:', msgs[msgs.length-1]?.content?.substring(0, 30));
            if (msgs.length > 0) {
              msgs[msgs.length-1] = { ...msgs[msgs.length-1], content: researchContent }; 
            }
            console.log('[Research/Chunk] Mensagens depois:', msgs.length, 'última:', msgs[msgs.length-1]?.content?.substring(0, 30));
            return msgs; 
          });
        };

        const s = context.settings;
        console.log('[Research] Chamando provider:', s.apiProvider);
        
        switch (s.apiProvider) {
          case 'ollama':
            chunkHandlers.push(window.electronAPI.onOllamaChunk(handleChunk));
            window.electronAPI.ollamaStream(researchMessages, s.ollamaModel || '').then(finish).catch(err => {
              console.error('[Research] Erro Ollama:', err);
              finish();
            });
            break;
          case 'gemini':
            chunkHandlers.push(window.electronAPI.onGeminiChunk(handleChunk));
            window.electronAPI.geminiStream(researchMessages, s.geminiModel || 'gemini-2.0-flash', s.geminiApiKey || '').then(finish).catch(err => {
              console.error('[Research] Erro Gemini:', err);
              finish();
            });
            break;
          case 'openrouter':
            chunkHandlers.push(window.electronAPI.onOpenRouterChunk(handleChunk));
            window.electronAPI.openrouterStream(researchMessages, s.openrouterModel || '', s.openrouterApiKey || '', s.openrouterUrl).then(finish).catch(err => {
              console.error('[Research] Erro OpenRouter:', err);
              finish();
            });
            break;
          case 'anthropic':
            chunkHandlers.push(window.electronAPI.onAnthropicChunk(handleChunk));
            window.electronAPI.anthropicStream(researchMessages, s.anthropicModel || '', s.anthropicApiKey || '').then(finish).catch(err => {
              console.error('[Research] Erro Anthropic:', err);
              finish();
            });
            break;
          case 'openai':
          case 'custom': {
            const key = s.apiProvider === 'openai' ? s.openaiApiKey : s.customApiKey;
            const url = s.apiProvider === 'openai' ? s.openaiUrl : s.customBaseUrl;
            const mod = s.apiProvider === 'openai' ? s.openaiModel : s.customModel;
            chunkHandlers.push(window.electronAPI.onOpenAIChunk(handleChunk));
            window.electronAPI.openaiStream(researchMessages, mod || '', key || '', url).then(finish).catch(err => {
              console.error('[Research] Erro OpenAI/Custom:', err);
              finish();
            });
            break;
          }
          default:
            console.log('[Research] ❌ Provider desconhecido:', s.apiProvider);
            finish();
        }
      });
      
      if (!researchContent.trim()) {
        console.log('[Research] ❌ Resposta vazia da IA');
        return `Não consegui formular uma resposta com os resultados da pesquisa sobre "${query}".`;
      }
      
      console.log('[Research] ✅ Resposta final gerada:', researchContent.substring(0, 100) + '...');
      addToTerminal(`[Research] Resposta gerada (${researchContent.length} caracteres)`);
      return researchContent;
      
    } catch (err: any) {
      console.error('[Research] ❌ ERRO CRÍTICO:', err);
      addToTerminal(`[Research] Erro: ${err.message}`);
      return `Erro ao pesquisar: ${err.message}`;
    }
  };
  
  // -- Parser de açÃµes web (web-action: blocks)
  const parseAndExecuteWebActions = (response: string, chatIdOverride?: string | null, setMessagesOverride?: React.Dispatch<React.SetStateAction<Message[]>> | null): void => {
    const webActionRegex = /```web-action:([^\n]+)\n([\s\S]*?)```/gi;
    let wMatch;
    while ((wMatch = webActionRegex.exec(response)) !== null) {
      const actionName = wMatch[1].trim();
      
      // RESEARCH não é processado aqui - vai pra processResearchIfNeeded()
      if (actionName === 'research') continue;
      
      const payloadStr = wMatch[2].trim();
      let payload: any = {};
      try { payload = JSON.parse(payloadStr || '{}'); } catch { payload = {}; }

      const tabId = activeBrowserTabIdRef.current;

      const doNavigate = (url: string, newTab = false) => {
        setActiveMainView('web');
        activeMainViewRef.current = 'web';
        if (newTab) {
          const newTabId = Date.now().toString();
          webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
          forceWebviewRender(n => n + 1);
          setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
          setActiveBrowserTabId(newTabId);
          activeBrowserTabIdRef.current = newTabId;
          setTimeout(() => {
            const webview = document.getElementById(`webview-${newTabId}`) as any;
            if (webview) { webview.focus(); webview.loadURL(url); }
          }, 300);
        } else {
          setBrowserTabs(prev => prev.map(t => t.id === tabId ? { ...t, url, favicon: undefined } : t));
          setTimeout(() => {
            const webview = document.getElementById(`webview-${tabId}`) as any;
            if (webview) { webview.focus(); webview.loadURL(url); }
          }, 300);
        }
      };

      if (actionName === 'navigate') {
        let url = payload.url || '';
        if (url && !url.startsWith('http')) url = 'https://' + url;
        if (url) doNavigate(url);
      } else if (actionName === 'youtube-play') {
        const query = payload.query || '';
        if (!query) return;
        // Busca o ID do vídeo via yt-dlp em background, navega direto pro vídeo
        window.electronAPI.executeCommand(
          `yt-dlp --quiet --no-warnings --get-id "ytsearch1:${query.replace(/"/g, '')}"`,
          undefined
        ).then(result => {
          const videoId = (result.output || '').trim().split('\n')[0].trim();
          const url = (videoId && videoId.length === 11)
            ? `https://www.youtube.com/watch?v=${videoId}&autoplay=1`
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          doNavigate(url);
        }).catch(() => {
          doNavigate(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
        });
      } else if (actionName === 'google-search') {
        const query = payload.query || '';
        if (query) doNavigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      } else if (actionName === 'research') {
        // Pesquisa completamente em background via HTTP â€” sem mexer no navegador
        const query = payload.query || '';
        if (!query) return;
        
        const engineToUse = settingsRef.current.searchEngine || 'google';
        const noFilterToUse = settingsRef.current.noFilter || false;
        const engineLabel = engineToUse === 'google' ? 'Google' : engineToUse === 'duckduckgo' ? 'DuckDuckGo' : engineToUse === 'brave' ? 'Brave' : 'Bing';
        const filterLabel = noFilterToUse ? ' (sem filtros)' : '';
        addToTerminal(`[Web] Pesquisando via ${engineLabel}${filterLabel}: "${query}"...`);

        (window as any).electronAPI.webResearch(query, engineToUse, noFilterToUse)
          .then(async (res: any) => {
            console.log('[DEBUG] webResearch result:', res);
            addToTerminal(`[DEBUG] webResearch success=${res?.success}, hasContent=${!!res?.content}`);
            
            if (!res.success || !res.content) {
              addToTerminal(`[Web] Sem resultado para: "${query}"`);
              // Atualiza o chat com mensagem de erro
              const errUpdater = (prev: Message[]) => {
                const msgs = [...prev];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { role: 'assistant', content: `Não consegui encontrar informações sobre "${query}". Tente reformular a pergunta.` };
                }
                return msgs;
              };
              if (chatIdOverride && chatBuffersRef.current) {
                const cur = chatBuffersRef.current.get(chatIdOverride) || [];
                const upd = errUpdater(cur);
                chatBuffersRef.current.set(chatIdOverride, upd.slice(-20)); // Limita a 20 mensagens
                localStorage.setItem('bill-chat-' + chatIdOverride, JSON.stringify(upd.slice(-20)));
                window.dispatchEvent(new StorageEvent('storage', { key: 'bill-chat-' + chatIdOverride, newValue: JSON.stringify(upd.slice(-20)) }));
              } else {
                setWebChatMessages(errUpdater);
              }
              return;
            }
            addToTerminal(`[Web] Conteúdo extraído de: ${res.url}`);

            // Detecta se o usuário está querendo a declaração/fala/comentário exato
            const msgLower = (query || '').toLowerCase();
            const wantsExactQuote = msgLower.includes('comentário') || 
                                    msgLower.includes('comentario') || 
                                    msgLower.includes('fala') || 
                                    msgLower.includes('disse') || 
                                    msgLower.includes('declarou') || 
                                    msgLower.includes('cit') || 
                                    msgLower.includes('aspas') || 
                                    msgLower.includes('palavra');

            const quoteInstruction = wantsExactQuote 
              ? `\nVocÃª DEVE transcrever a frase/citação exata do comentário feito, exatamente com as aspas e palavras literais encontradas no texto. Não faça apenas um resumo genérico. Transcreva a fala real.\n`
              : '';

            const contextPrompt = `Para a pergunta do usuário sobre "${query}", aqui está o conteúdo pesquisado na internet (fonte: ${res.url}):\n\n${res.content}\n\n${quoteInstruction}\nCom base nesses fatos reais, responda diretamente à pergunta de forma curta e natural em portuguÃªs. Não diga que pesquisou e não mencione os bastidores da busca. Apenas responda como se já soubesse o assunto.`;

            // Setter generico: funciona para chat de contato (chatIdOverride) e para a aba ativa
            const _setChatMsgs = (updater: (prev: Message[]) => Message[]) => {
              if (chatIdOverride && chatBuffersRef.current) {
                const cur = chatBuffersRef.current.get(chatIdOverride) || [];
                const upd = updater(cur);
                chatBuffersRef.current.set(chatIdOverride, upd.slice(-20)); // Limita a 20 mensagens
                localStorage.setItem('bill-chat-' + chatIdOverride, JSON.stringify(upd.slice(-20)));
                window.dispatchEvent(new StorageEvent('storage', { key: 'bill-chat-' + chatIdOverride, newValue: JSON.stringify(upd.slice(-20)) }));
                
                // Usa o setter fornecido para atualizar o estado do Chat
                if (setMessagesOverride) {
                  setMessagesOverride(upd);
                }
              } else {
                // Sem chatIdOverride: usa o setter da aba ativa
                if (setMessagesOverride) {
                  setMessagesOverride(updater);
                } else {
                  // Fallback: detecta qual aba está ativa
                  const currentView = activeMainViewRef.current;
                  if (currentView === 'web') setWebChatMessages(updater);
                  else if (currentView === 'home') setHomeChatMessages(updater);
                  else if (currentView === 'video') setVideoChatMessages(updater);
                  else if (currentView === 'photo') setPhotoChatMessages(updater);
                  else if (currentView === 'paint') setPaintChatMessages(updater);
                  else setChatMessages(updater);
                }
              }
            };
            // Filtra as mensagens para o streaming, removendo a última mensagem do assistente que disparou a ação JSON
            const rawMsgsResearch: any[] = chatIdOverride && chatBuffersRef.current ? (chatBuffersRef.current.get(chatIdOverride) || []) : 
              (activeMainViewRef.current === 'web' ? webChatMessages :
               activeMainViewRef.current === 'home' ? homeChatMessages :
               activeMainViewRef.current === 'video' ? videoChatMessages :
               activeMainViewRef.current === 'photo' ? photoChatMessages :
               activeMainViewRef.current === 'paint' ? paintChatMessages :
               chatMessages);
            const activeMessages = rawMsgsResearch.filter(m => m.content && !m.content.includes('web-action:research'));
            const s = settingsRef.current;
            
            // System prompt adequado para a aba ativa
            const currentView = activeMainViewRef.current;
            const researchSystemPrompt = currentView === 'home' 
              ? 'Você é um assistente de IA geral. Responda de forma natural, direta e útil com base nas informações fornecidas.'
              : buildWebSystemPrompt();
            
            // IMPORTANTE: Usa apenas as últimas 2 mensagens do histórico para evitar contexto contaminado de conversas antigas
            const processMessages = [
              { role: 'system' as const, content: researchSystemPrompt },
              ...activeMessages.filter(m => m.role !== 'assistant' || m.content).slice(-2),
              { role: 'user' as const, content: contextPrompt },
            ];

            // Remove a mensagem de ação/aviso do assistente do chat visual e cria uma única mensagem limpa
            _setChatMsgs(prev => {
              const msgs = prev.filter(m => !m.content.includes('web-action:research'));
              if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                // Se a mensagem anterior continha um texto de aviso como "Pesquisando...", removemos também
                msgs.pop();
              }
              return [...msgs, { role: 'assistant', content: '' }];
            });

            setIsStreaming(true);
            let fullResponse = '';

            const updateAssistantMessage = (text: string) => {
              _setChatMsgs(prev => {
                const msgs = [...prev];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = { role: 'assistant', content: text };
                } else {
                  msgs.push({ role: 'assistant', content: text });
                }
                return msgs;
              });
            };

            try {
              console.log('[DEBUG Research] Iniciando streaming da resposta para:', currentView);
              console.log('[DEBUG Research] Provider:', s.apiProvider);
              addToTerminal(`[Web] Gerando resposta com o provedor: ${s.apiProvider}...`);
              let result: any = null;

              if (s.apiProvider === 'openrouter') {
                const unsub = window.electronAPI.onOpenRouterChunk((chunk) => { 
                  console.log('[DEBUG Research] Chunk recebido:', chunk.substring(0, 50));
                  fullResponse += chunk; 
                  updateAssistantMessage(fullResponse); 
                });
                result = await window.electronAPI.openrouterStream(processMessages as any, s.openrouterModel||'', s.openrouterApiKey||'', s.openrouterUrl);
                unsub();
              } else if (s.apiProvider === 'gemini') {
                const unsub = window.electronAPI.onGeminiChunk((chunk) => { 
                  console.log('[DEBUG Research] Chunk recebido:', chunk.substring(0, 50));
                  fullResponse += chunk; 
                  updateAssistantMessage(fullResponse); 
                });
                result = await window.electronAPI.geminiStream(processMessages as any, s.geminiModel||'gemini-2.0-flash', s.geminiApiKey||'');
                unsub();
              } else if (s.apiProvider === 'openai' || s.apiProvider === 'custom') {
                const unsub = window.electronAPI.onOpenAIChunk((chunk) => { 
                  console.log('[DEBUG Research] Chunk recebido:', chunk.substring(0, 50));
                  fullResponse += chunk; 
                  updateAssistantMessage(fullResponse); 
                });
                result = await window.electronAPI.openaiStream(processMessages as any, s.apiProvider==='custom'?(s.customModel||''):(s.openaiModel||'gpt-4o'), s.apiProvider==='custom'?(s.customApiKey||''):(s.openaiApiKey||''), s.apiProvider==='custom'?(s.customBaseUrl||''):undefined);
                unsub();
              } else if (s.apiProvider === 'ollama') {
                const unsub = window.electronAPI.onOllamaChunk((chunk) => { 
                  console.log('[DEBUG Research] Chunk recebido:', chunk.substring(0, 50));
                  fullResponse += chunk; 
                  updateAssistantMessage(fullResponse); 
                });
                result = await window.electronAPI.ollamaStream(processMessages as any, s.ollamaModel||'');
                unsub();
              } else if (s.apiProvider === 'anthropic') {
                const unsub = window.electronAPI.onAnthropicChunk((chunk) => { 
                  console.log('[DEBUG Research] Chunk recebido:', chunk.substring(0, 50));
                  fullResponse += chunk; 
                  updateAssistantMessage(fullResponse); 
                });
                result = await window.electronAPI.anthropicStream(processMessages as any, s.anthropicModel||'claude-sonnet-4-20250514', s.anthropicApiKey||'');
                unsub();
              }

              // Fallback caso o provedor não tenha enviado por chunks mas tenha resolvido a promise com conteúdo completo
              const finalContent = result?.response?.message?.content || result?.content || fullResponse;
              if (finalContent && finalContent !== fullResponse) {
                fullResponse = finalContent;
                updateAssistantMessage(fullResponse);
              }

              if (!fullResponse.trim()) {
                updateAssistantMessage("Não consegui formular uma resposta com os resultados encontrados.");
              }
              addToTerminal(`[Web] Resposta gerada com sucesso (${fullResponse.length} caracteres).`);
              
              // ── TTS: fala a resposta se voiceVolume > 0 ──────────────────────────────
              const vol = settingsRef.current.voiceVolume ?? 100;
              if (vol > 0 && fullResponse.trim()) {
                // Remove blocos de código, ações e markdown antes de falar
                const textoFala = fullResponse
                  .replace(/```[\s\S]*?```/g, '')
                  .replace(/\[.*?\]/g, '')
                  .replace(/[*_#~`>|]/g, '')
                  .replace(/https?:\/\/\S+/g, '')
                  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
                  .replace(/[\u{2600}-\u{27BF}]/gu, '')
                  .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                  .replace(/[\u{2300}-\u{23FF}]/gu, '')
                  .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim()
                  .slice(0, 400);

                if (textoFala.length > 3) {
                  const voiceToUse = settingsRef.current.providerVoice || 'faber';
                  
                  console.log('[TTS Research] Gerando áudio para resposta da pesquisa');
                  console.log('[TTS Research] VOZ:', voiceToUse);
                  console.log('[TTS Research] Texto:', textoFala.substring(0, 50) + '...');
                  
                  window.electronAPI.generateTTS({ text: textoFala, voice: voiceToUse })
                    .then(result => {
                      if (result.success && result.path) {
                        const audio = new Audio(`file:///${result.path.replace(/\\/g, '/')}`);
                        audio.volume = vol / 100;
                        audio.play().catch(() => {});
                      }
                    })
                    .catch(() => {});
                }
              }
              
              // Ecoa a resposta no terminal quando chamado via terminal agent
              if (terminalAgentRef.current) {
                const clean = fullResponse
                  .replace(/```[\s\S]*?```/g, '[ação executada]')
                  .replace(/[*_#~`>|]/g, '')
                  .trim();
                const lines = clean.split('\n').filter(l => l.trim().length > 0);
                if (lines.length > 0) {
                  addTerminal(`[WEB IA] ${lines[0]}`);
                  lines.slice(1).forEach(l => addTerminal(`  ${l}`));
                }
              }
            } catch (err: any) {
              addToTerminal(`[Web] Erro ao gerar resposta do research: ${err.message}`);
              updateAssistantMessage(`Desculpe, tive um problema ao tentar processar a pesquisa: ${err.message}`);
            }
            setIsStreaming(false);
          })
          .catch(() => addToTerminal(`[Web] Erro na pesquisa em background`));
      } else if (actionName === 'new-tab') {
        let url = payload.url || 'https://www.google.com';
        if (!url.startsWith('http')) url = 'https://' + url;
        doNavigate(url, true);
      } else if (actionName === 'go-back') {
        const webview = document.getElementById(`webview-${tabId}`) as any;
        if (webview) webview.goBack();
      } else if (actionName === 'go-forward') {
        const webview = document.getElementById(`webview-${tabId}`) as any;
        if (webview) webview.goForward();
      } else if (actionName === 'download-image') {
        // Baixa uma imagem pela URL
        const url = payload.url || '';
        const name = payload.name || '';
        if (!url) return;
        (window as any).electronAPI.downloadImage(url, name || undefined)
          .then((res: any) => {
            if (res.success) addToTerminal(`[Web] Imagem salva em: ${res.path}`);
            else addToTerminal(`[Web] Erro ao baixar: ${res.error}`);
          });
      } else if (actionName === 'search-and-download-image') {
        const query = payload.query || '';
        const skip = typeof payload.skip === 'number' ? payload.skip : 0;
        if (!query) return;

        addToTerminal(`[Web] Buscando imagem: "${query}" (skip=${skip})...`);

        // Navega para o Bing Imagens no webview (tem JS completo, sem bloqueio)
        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
        doNavigate(searchUrl);

        // Aguarda o JS do Bing renderizar as imagens, depois extrai as URLs via executeJavaScript
        const tryExtract = (attempt: number) => {
          if (attempt > 8) {
            addToTerminal(`[Web] Não consegui encontrar imagens para: "${query}"`);
            return;
          }
          setTimeout(() => {
            const webview = document.getElementById(`webview-${tabId}`) as any;
            if (!webview) return;

            const bingExtractScript = [
              '(function() {',
              '  var items = document.querySelectorAll("a.iusc[m]");',
              '  var urls = [];',
              '  items.forEach(function(el) {',
              '    try {',
              '      var data = JSON.parse(el.getAttribute("m"));',
              '      if (data.murl) urls.push(data.murl);',
              '    } catch(e) {}',
              '  });',
              '  if (urls.length === 0) {',
              '    document.querySelectorAll("img.mimg[src]").forEach(function(img) {',
              '      var s = img.src;',
              '      if (s && s.startsWith("http") && !s.includes("bing.com")) urls.push(s);',
              '    });',
              '  }',
              '  return urls;',
              '})()',
            ].join('\n');

            webview.executeJavaScript(bingExtractScript)
            .then((urls: string[]) => {
              if (!urls || urls.length === 0) {
                tryExtract(attempt + 1); // Ainda carregando, tenta de novo
                return;
              }

              // Aplica skip para variar
              const start = skip % urls.length;
              const ordered = [...urls.slice(start), ...urls.slice(0, start)];
              const url = ordered[0];

              if (!url) { tryExtract(attempt + 1); return; }

              addToTerminal(`[Web] Baixando: ${url.slice(0, 60)}...`);

              const ext = (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|$)/i) || [])[1] || 'jpg';
              const safeName = query.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
              const fileName = `${safeName}_${Date.now()}.${ext}`;

              (window as any).electronAPI.downloadImage(url, fileName)
                .then((res: any) => {
                  if (res.success) addToTerminal(`[Bill Web] Salvo!`);
                  else {
                    // Se falhou, tenta a próxima da lista
                    const next = ordered[1];
                    if (next) {
                      (window as any).electronAPI.downloadImage(next, fileName).catch(() => {});
                    }
                    addToTerminal(`[Bill Web] Erro: ${res.error}`);
                  }
                });
            }).catch(() => tryExtract(attempt + 1));
          }, attempt === 0 ? 2500 : 1500);
        };

        tryExtract(0);
      } else if (actionName === 'send-to-photo-editor') {
        // Pega a imagem atual do webview e manda pro canvas do Photo Editor
        const webview = document.getElementById(`webview-${tabId}`) as any;

        // LÃª a última imagem clicada direto do webview (ignora o que a IA passou)
        const getFreshClickedImg = (): Promise<string> => {
          if (!webview) return Promise.resolve(lastClickedImageRef.current || '');

          // Tenta ler a última clicada; se não tiver, pega a maior imagem visível na página
          const script = `(function() {
            // Primeiro tenta a última clicada
            if (window.__billLastClickedImg) return window.__billLastClickedImg;
            // Fallback: maior imagem visível na página
            var imgs = Array.from(document.querySelectorAll('img[src]'));
            imgs = imgs.filter(function(i) {
              return i.src && i.src.startsWith('http') && i.naturalWidth > 100 && i.naturalHeight > 100;
            });
            imgs.sort(function(a, b) { return (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight); });
            return imgs.length > 0 ? imgs[0].src : null;
          })()`;

          return Promise.race<string | null>([
            webview.executeJavaScript(script),
            new Promise<null>(r => setTimeout(() => r(null), 1000))
          ]).then((fresh) => {
            if (typeof fresh === 'string' && fresh) return fresh;
            return lastClickedImageRef.current || '';
          }).catch(() => lastClickedImageRef.current || '');
        };
        const sendToPhoto = (imgUrl: string) => {
          addToTerminal('[Webâ†’Photo] Carregando imagem...');

          const applyToPhoto = (src: string) => {
            photoEditorRef.current?.applyAIAction('add-image', { imageSrc: src });
            setActiveMainView('photo');
            addToTerminal('[Webâ†’Photo] âœ… Imagem adicionada ao canvas!');
            lastClickedImageRef.current = '';
            if (webview) webview.executeJavaScript('window.__billLastClickedImg = null;').catch(() => {});
          };

          // Captura via canvas â€” tenta pela URL clicada, fallback pra maior imagem da página
          const captureScript = `(function() {
            try {
              var targetUrl = window.__billLastClickedImg || ${imgUrl ? JSON.stringify(imgUrl) : 'null'};
              var imgs = Array.from(document.querySelectorAll('img'));
              var target = null;

              // Tenta achar por URL
              if (targetUrl) {
                target = imgs.find(function(i) { return i.src === targetUrl || i.currentSrc === targetUrl; });
              }
              // Fallback: maior imagem visível
              if (!target) {
                var visible = imgs.filter(function(i) { return i.src && i.src.startsWith('http') && i.naturalWidth > 100 && i.naturalHeight > 100; });
                visible.sort(function(a,b) { return (b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight); });
                target = visible[0] || null;
              }

              if (!target || !target.complete || target.naturalWidth === 0) return null;
              var cvs = document.createElement('canvas');
              cvs.width = target.naturalWidth;
              cvs.height = target.naturalHeight;
              var ctx = cvs.getContext('2d');
              ctx.drawImage(target, 0, 0);
              var data = cvs.toDataURL('image/png');
              return data.length > 100 ? data : null;
            } catch(e) { return null; }
          })()`;

          const urlToFetch = imgUrl || lastClickedImageRef.current;

          Promise.race([
            webview ? webview.executeJavaScript(captureScript).catch(() => null) : Promise.resolve(null),
            new Promise<null>(r => setTimeout(() => r(null), 3000))
          ]).then((dataUrl: any) => {
            if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
              applyToPhoto(dataUrl);
            } else if (urlToFetch) {
              // Fallback: fetch via Electron com Referer do site atual
              const referer = (() => { try { return new URL(urlToFetch).origin; } catch { return 'https://www.google.com'; } })();
              return (window as any).electronAPI.fetchImageAsDataUrl(urlToFetch, referer)
                .then((res: any) => {
                  if (res.success && res.dataUrl) {
                    applyToPhoto(res.dataUrl);
                  } else {
                    addToTerminal(`[Webâ†’Photo] âŒ Não foi possível carregar: ${res.error || 'bloqueada pelo site'}`);
                  }
                });
            } else {
              addToTerminal('[Webâ†’Photo] âŒ Nenhuma imagem encontrada. Clique em uma imagem primeiro.');
            }
          }).catch(() => addToTerminal('[Webâ†’Photo] âŒ Erro ao carregar imagem.'));
        };

        // Ignora URL do payload â€” sempre usa a última imagem clicada pelo usuário
        // (a IA frequentemente passa a URL da página em vez da imagem)
        getFreshClickedImg().then(url => sendToPhoto(url));
      } else if (actionName === 'send-to-video-editor') {
        const mode: 'video' | 'audio' | 'image' = 
          payload.mode === 'audio' ? 'audio' : 
          payload.mode === 'image' ? 'image' : 'video';

        if (mode === 'image') {
          // Imagem: usa última imagem clicada (igual ao photo editor)
          const webviewForImg = document.getElementById(`webview-${tabId}`) as any;
          const getImgUrl = (): Promise<string> => {
            if (!webviewForImg) return Promise.resolve(lastClickedImageRef.current || '');
            const script = `(function() {
              if (window.__billLastClickedImg) return window.__billLastClickedImg;
              var imgs = Array.from(document.querySelectorAll('img[src]'));
              imgs = imgs.filter(function(i) { return i.src && i.src.startsWith('http') && i.naturalWidth > 100 && i.naturalHeight > 100; });
              imgs.sort(function(a,b) { return (b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight); });
              return imgs.length > 0 ? imgs[0].src : null;
            })()`;
            return Promise.race<string | null>([
              webviewForImg.executeJavaScript(script),
              new Promise<null>(r => setTimeout(() => r(null), 1000))
            ]).then(v => (typeof v === 'string' && v) ? v : lastClickedImageRef.current || '')
              .catch(() => lastClickedImageRef.current || '');
          };

          getImgUrl().then(imgUrl => {
            if (!imgUrl) { addToTerminal('[Webâ†’Video] âŒ Nenhuma imagem encontrada. Clique em uma imagem primeiro.'); return; }
            addToTerminal(`[Webâ†’Video] Salvando imagem para o editor de vídeo...`);
            setActiveMainView('video');
            (window as any).electronAPI.saveImageToTemp(imgUrl)
              .then((res: any) => {
                if (res.success && res.path) {
                  videoEditorRef.current?.applyAIAction('add-clip', { path: res.path, type: 'image' });
                  addToTerminal('[Webâ†’Video] Imagem adicionada à timeline!');
                  lastClickedImageRef.current = '';
                  if (webviewForImg) webviewForImg.executeJavaScript('window.__billLastClickedImg = null;').catch(() => {});
                } else {
                  addToTerminal(`[Webâ†’Video] Erro: ${res.error}`);
                }
              });
          });
          return;
        }

        // Vídeo ou áudio: pega URL real do webview
        const getActiveUrl = (): Promise<string> => {
          const wv = document.getElementById(`webview-${tabId}`) as any;
          if (wv && wv.getURL) {
            try { return Promise.resolve(wv.getURL()); } catch {}
          }
          return Promise.resolve(payload.url || browserTabs.find(t => t.id === tabId)?.url || '');
        };

        getActiveUrl().then((currentTabUrl) => {
          if (!currentTabUrl) { addToTerminal('[Webâ†’Video] Nenhuma URL ativa.'); return; }

          const unsupportedHosts = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'about:blank'];
          if (unsupportedHosts.some(h => currentTabUrl.includes(h))) {
            addToTerminal('[Webâ†’Video] Navegue até o YouTube (ou outro site de vídeo) e tente novamente.');
            return;
          }

          addToTerminal(`[Webâ†’Video] Baixando ${mode === 'audio' ? 'áudio' : 'vídeo'} de: ${currentTabUrl.slice(0, 70)}...`);
          setActiveMainView('video');

          (window as any).electronAPI.downloadFromWeb(currentTabUrl, mode)
            .then((res: any) => {
              if (res.success && res.path) {
                videoEditorRef.current?.applyAIAction('add-clip', { path: res.path, type: mode });
                addToTerminal(`[Webâ†’Video] ${mode === 'audio' ? 'Ã udio' : 'Vídeo'} adicionado à timeline!`);
              } else {
                addToTerminal(`[Webâ†’Video] Erro: ${res.error}`);
              }
            });
        });
      }

      addToTerminal(`[Bill Web] ${actionName}: ${JSON.stringify(payload)}`);
    }
  };
  // ── Modo Grupo: chama cada IA em sequência ──────────────────────────────────
  // ── FUNÇÃO AUXILIAR: Chama o LLM para decisão rápida (SIM/NÃO) ──
  const callLLMForDecision = async (model: SavedModel, prompt: string): Promise<'SIM' | 'NÃO'> => {
    try {
      // Monta as configurações do modelo
      const modelSettings: SettingsType = {
        ...settingsRef.current,
        apiProvider: model.provider,
        ollamaModel: model.provider === 'ollama' ? model.model : settingsRef.current.ollamaModel,
        geminiModel: model.provider === 'gemini' ? model.model : settingsRef.current.geminiModel,
        openrouterModel: model.provider === 'openrouter' ? model.model : settingsRef.current.openrouterModel,
        anthropicModel: model.provider === 'anthropic' ? model.model : settingsRef.current.anthropicModel,
        openaiModel: model.provider === 'openai' ? model.model : settingsRef.current.openaiModel,
        customModel: model.provider === 'custom' ? model.model : settingsRef.current.customModel,
        customName: model.provider === 'custom' ? model.customName : settingsRef.current.customName,
        geminiApiKey: model.provider === 'gemini' && model.apiKey ? model.apiKey : settingsRef.current.geminiApiKey,
        openrouterApiKey: model.provider === 'openrouter' && model.apiKey ? model.apiKey : settingsRef.current.openrouterApiKey,
        anthropicApiKey: model.provider === 'anthropic' && model.apiKey ? model.apiKey : settingsRef.current.anthropicApiKey,
        openaiApiKey: model.provider === 'openai' && model.apiKey ? model.apiKey : settingsRef.current.openaiApiKey,
        customApiKey: model.provider === 'custom' && model.apiKey ? model.apiKey : settingsRef.current.customApiKey,
        customBaseUrl: model.provider === 'custom' && model.baseUrl ? model.baseUrl : settingsRef.current.customBaseUrl,
      };
      
      const messages: Message[] = [
        { role: 'system', content: 'Você é um assistente que responde apenas SIM ou NÃO.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await callAINonStreaming(messages, modelSettings);
      
      if (!response) return 'NÃO';
      
      const normalized = response.trim().toUpperCase();
      
      // Aceita variações de "sim"
      if (normalized.includes('SIM') || normalized.includes('YES') || normalized === 'S') {
        return 'SIM';
      }
      
      return 'NÃO';
    } catch (error) {
      console.error('[callLLMForDecision] Erro:', error);
      return 'NÃO'; // Em caso de erro, não complementa
    }
  };

  const handleSendGroupMessage = async (message: string, group: SavedModel[], groupChatId?: string, attachedFile?: File) => {
    console.log('🔥🔥🔥 [GRUPO] handleSendGroupMessage CHAMADO! groupChatId:', groupChatId, 'group.length:', group.length);
    if (isStreaming || group.length === 0) return;

    // Se tem groupChatId, usa o sistema de chat individual (salva no localStorage)
    if (groupChatId) {
      console.log('[Group] Enviando para grupo:', groupChatId, 'modelos:', group.length);
      
      // Converte imagem para base64 se houver
      let imageBase64: string | undefined;
      let imageFileName: string | undefined;
      
      if (attachedFile && attachedFile.type.startsWith('image/')) {
        try {
          // Se for WebP, converte para PNG primeiro
          if (attachedFile.type === 'image/webp' || attachedFile.name.toLowerCase().endsWith('.webp')) {
            console.log('[Group] Convertendo WebP para PNG...');
            
            const img = new Image();
            const objectUrl = URL.createObjectURL(attachedFile);
            
            imageBase64 = await new Promise<string>((resolve, reject) => {
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Não conseguiu criar contexto do canvas'));
                  return;
                }
                
                ctx.drawImage(img, 0, 0);
                const pngBase64 = canvas.toDataURL('image/png');
                URL.revokeObjectURL(objectUrl);
                
                console.log('[Group] WebP convertido para PNG');
                resolve(pngBase64);
              };
              
              img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Erro ao carregar imagem WebP'));
              };
              
              img.src = objectUrl;
            });
            
            imageFileName = attachedFile.name.replace(/\.webp$/i, '.png');
          } else {
            // Outros formatos: lê diretamente
            const reader = new FileReader();
            imageBase64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(attachedFile);
            });
            imageFileName = attachedFile.name;
          }
          
          console.log('[Group] Imagem convertida para base64:', imageFileName);
        } catch (error) {
          console.error('[Group] Erro ao converter imagem:', error);
        }
      }
      
      // ── ADICIONA MENSAGEM DO USUÁRIO UMA ÚNICA VEZ ──
      const saved = localStorage.getItem(`bill-chat-${groupChatId}`);
      let groupMessages: Message[] = [];
      if (saved) {
        try {
          groupMessages = JSON.parse(saved);
        } catch {
          groupMessages = [];
        }
      }
      
      // Adiciona mensagem do usuário (apenas uma vez, não importa quantos modelos)
      const userMessage: Message = { 
        role: 'user', 
        content: imageBase64 
          ? [
              { type: 'text', text: message || 'O que você vê nesta imagem?' },
              { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } }
            ] as any
          : message,
        modelColor: '#9b59b6', // Cor roxa padrão para grupos
        modelName: 'Grupo',
        modelAvatar: '👥',
        image: imageBase64,
        imageFile: imageFileName || (attachedFile ? attachedFile.name : undefined) // Nome do arquivo (imagem ou texto)
      };
      groupMessages.push(userMessage);
      
      // Salva a mensagem do usuário (remove base64 antes de salvar, mas mantém imageFile)
      const messagesToSave = groupMessages.map(msg => {
        const cleaned = { ...msg };
        if (cleaned.image) delete cleaned.image; // Remove base64
        // NÃO remove imageFile - mantém o nome
        if (Array.isArray(cleaned.content)) {
          const textPart = cleaned.content.find((part: any) => part?.type === 'text');
          cleaned.content = textPart?.text || '[imagem enviada]';
        }
        return cleaned;
      });
      
      const limited = messagesToSave.slice(-20); // Limita a 20 mensagens
      localStorage.setItem(`bill-chat-${groupChatId}`, JSON.stringify(limited));
      
      // Atualiza o buffer do chat se existir (mantém base64 em memória)
      if (chatBuffersRef.current && chatBuffersRef.current.has(groupChatId)) {
        chatBuffersRef.current.set(groupChatId, groupMessages.slice(-50));
      }
      
      console.log('[Group] Mensagem do usuário adicionada, total:', limited.length);
      
      // ── RODADA 1: TODOS RESPONDEM À MENSAGEM DO USUÁRIO ──
      console.log('[Group] === RODADA 1: Respostas iniciais ===');
      console.log('🟢 [GRUPO] Iniciando loop dos modelos, total:', group.length);
      
      // Respostas coletadas (para passar como contexto para os próximos)
      const round1Responses: Array<{ name: string; content: string }> = [];
      
      // Se tem arquivo, cria um objeto File fake para passar pro handleSendMessage
      // Marca com propriedade especial pra indicar que é do grupo (não duplicar userMessage)
      let fileToPass: File | boolean = true; // true = skipUserMessage
      
      if (imageBase64 && imageFileName) {
        // Imagem
        const base64Data = imageBase64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        const fakeFile: any = new File([blob], imageFileName, { type: 'image/png' });
        fakeFile._skipUserMessage = true;
        fileToPass = fakeFile;
        console.log('[Group] Criou File fake da imagem');
      } else if (attachedFile && !imageBase64) {
        // Arquivo de texto (não processado como imagem)
        const fakeFile: any = attachedFile;
        fakeFile._skipUserMessage = true;
        fileToPass = fakeFile;
        console.log('[Group] Usando arquivo de texto:', attachedFile.name);
      }
      
      for (let i = 0; i < group.length; i++) {
        const model = group[i];
        console.log(`🔵 [GRUPO] Modelo ${i+1}/${group.length}: ${model.name}`);
        console.log(`🔵 [GRUPO] round1Responses.length: ${round1Responses.length}`);
        
        // Monta o prevResponses para esse modelo
        const prevResponses = round1Responses.length > 0
          ? '\n\n[RESPOSTAS ANTERIORES NESTE TURNO]:\n' + round1Responses.map(r => `${r.name}: ${r.content}`).join('\n\n') + '\n\n'
          : '';
        
        console.log(`🔵 [GRUPO] prevResponses length: ${prevResponses.length}`);
        
        // Injeta o prompt de grupo na mensagem
        const groupInstructions = `[MODO GRUPO ATIVO - Você é: ${model.name}]

REGRAS CRÍTICAS:
1. **MÁXIMO 3-4 LINHAS** - Seja extremamente direto e conciso
2. **NÃO REPITA** o que outros já disseram
3. **AGREGUE VALOR** ou diga apenas "Concordo com [Nome], nada a adicionar"${prevResponses}

[MENSAGEM DO USUÁRIO]:
`;
        
        const messageWithGroupContext = groupInstructions + message;
        
        console.log('[Group] Enviando para modelo', i + 1, '/', group.length, ':', model.name);
        
        await handleSendMessage(messageWithGroupContext, model, groupChatId, fileToPass);
        
        // Aguarda um pouco para garantir que a resposta foi salva
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Coleta a resposta que foi adicionada
        const savedAfterModel = localStorage.getItem(`bill-chat-${groupChatId}`);
        if (savedAfterModel) {
          try {
            const msgs = JSON.parse(savedAfterModel);
            // Procura a última mensagem assistant deste modelo
            for (let j = msgs.length - 1; j >= 0; j--) {
              const msg = msgs[j];
              if (msg.role === 'assistant' && msg.modelName === model.name) {
                round1Responses.push({ name: model.name, content: msg.content });
                console.log(`📊 [GRUPO DEBUG] Mensagem coletada:`, {
                  role: msg.role,
                  modelName: msg.modelName,
                  contentLength: msg.content?.length || 0,
                  timestamp: msg.timestamp
                });
                console.log(`✅ [GRUPO] Coletou resposta de ${model.name}: "${msg.content.substring(0, 80)}..."`);
                break;
              }
            }
          } catch (e) {
            console.error(`❌ [GRUPO] Erro ao coletar resposta de ${model.name}:`, e);
          }
        }
        
        // Aguarda um pouco entre modelos para evitar sobrecarga
        if (i < group.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // ── RODADA 2: MODELOS DECIDEM SE QUEREM COMPLEMENTAR ──
      console.log('[Group] === RODADA 2: Checando complementos ===');
      
      // Recarrega mensagens atualizadas
      const savedAfterRound1 = localStorage.getItem(`bill-chat-${groupChatId}`);
      let messagesAfterRound1: Message[] = [];
      if (savedAfterRound1) {
        try {
          messagesAfterRound1 = JSON.parse(savedAfterRound1);
        } catch {
          messagesAfterRound1 = [];
        }
      }
      
      // Para cada modelo, pergunta se quer complementar
      for (let i = 0; i < group.length; i++) {
        const model = group[i];
        
        // Pega as últimas 5 mensagens como contexto
        const recentContext = messagesAfterRound1.slice(-5)
          .map(m => `[${m.modelName || m.role}]: ${m.content}`)
          .join('\n\n');
        
        const checkPrompt = `Você está em uma conversa em grupo. Analise o contexto abaixo e decida se vale a pena adicionar um comentário, complemento, correção ou perspectiva diferente.

CONTEXTO RECENTE:
${recentContext}

INSTRUÇÕES:
- Responda APENAS "SIM" se você tiver algo RELEVANTE e ÚTIL para adicionar
- Responda "NÃO" se:
  * Os outros modelos já responderam adequadamente
  * Você não tem nada novo/diferente para contribuir
  * Sua resposta seria redundante ou apenas concordar
  * A conversa está completa

Responda apenas uma palavra: SIM ou NÃO`;

        console.log('[Group] Perguntando ao modelo', model.name, 'se quer complementar...');
        
        // Faz uma chamada rápida ao modelo para decidir
        try {
          const decision = await callLLMForDecision(model, checkPrompt);
          console.log('[Group] Decisão de', model.name, ':', decision);
          
          if (decision === 'SIM') {
            console.log('[Group] ✓', model.name, 'vai complementar');
            
            // Modelo decidiu complementar - deixa ele responder naturalmente
            const complementPrompt = 'Baseado no contexto da conversa, adicione seu comentário, complemento ou perspectiva.';
            await handleSendMessage(complementPrompt, model, groupChatId, true);
            
            // Aguarda entre modelos
            if (i < group.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            console.log('[Group] ✗', model.name, 'não vai complementar');
          }
        } catch (error) {
          console.log('[Group] Erro ao perguntar a', model.name, '- pulando:', error);
        }
      }
      
      console.log('[Group] === Conversa finalizada ===');
      return;
    }
    
    // Código antigo para compatibilidade (sem salvar no localStorage)
    const effectiveView = activeMainView;
    const isVideoMode = effectiveView === 'video';
    const isPhotoMode = effectiveView === 'photo';
    const isPaintMode = effectiveView === 'paint';
    const isWebMode = effectiveView === 'web';
    const isHomeMode = effectiveView === 'home';
    const setCurrentMessagesOriginal = isVideoMode ? setVideoChatMessages : (isPhotoMode ? setPhotoChatMessages : (isPaintMode ? setPaintChatMessages : (isWebMode ? setWebChatMessages : (isHomeMode ? setHomeChatMessages : setChatMessages))));
    
    // Wrapper que TAMBÉM atualiza chatMessages[activeChatId] quando tem chat ativo
    const setCurrentMessages = (updater: any) => {
      console.log('[setCurrentMessages] Chamado. activeChatId:', activeChatId);
      setCurrentMessagesOriginal(updater);
      if (activeChatId) {
        console.log('[setCurrentMessages] Atualizando chatMessages[', activeChatId, ']');
        setChatMessages(prev => {
          const result = typeof updater === 'function' ? updater(prev[activeChatId] || []) : updater;
          console.log('[setCurrentMessages] Resultado:', result?.length, 'mensagens');
          return {
            ...prev,
            [activeChatId]: result
          };
        });
      }
    };
    
    const getCurrentMessages = (): Message[] => {
      if (isVideoMode) return videoChatMessages;
      if (isPhotoMode) return photoChatMessages;
      if (isPaintMode) return paintChatMessages;
      if (isWebMode) return webChatMessages;
      if (isHomeMode) return homeChatMessages;
      return chatMessages;
    };

    const viewLabels: Record<string, string> = {
      code: 'editor de código',
      video: 'editor de vídeo',
      photo: 'editor de fotos',
      paint: 'editor de pintura/canvas',
      web: 'navegador web integrado',
      home: 'tela principal (home)',
    };
    const viewLabel = viewLabels[effectiveView || 'code'] || effectiveView || 'app';
    const groupNames = group.map((m, i) => `${i + 1}. ${m.name} (${m.model || m.provider})`).join(', ');

    let webContextPrompt = '';
    if (isWebMode) {
      const tabId = activeBrowserTabIdRef.current;
      const webview = document.getElementById(`webview-${tabId}`) as any;
      
      // REMOVIDO: detecção automática de perguntas sobre fatos
      // Agora só pesquisa quando o usuário mandar explicitamente
      
      if (webview) {
        try {
          const extractPageScript = `(function() {
            try {
              var el = document.body || document.documentElement;
              if (!el) return "";
              var clone = el.cloneNode(true);
              ["script","style","nav","header","footer","aside","iframe","noscript"].forEach(function(tag) {
                clone.querySelectorAll(tag).forEach(function(e) { e.remove(); });
              });
              var text = (clone.innerText || clone.textContent || "").replace(/\\s{3,}/g, "\\n\\n").trim();
              return text.slice(0, 8000);
            } catch(e) { return ""; }
          })()`;
          const extractClickedImg = `(function() { try { return window.__billLastClickedImg || null; } catch(e) { return null; } })()`;
          
          const [content, clickedImg] = await Promise.all([
            Promise.race([
              webview.executeJavaScript(extractPageScript),
              new Promise(r => setTimeout(() => r(''), 3000))
            ]).catch(() => ''),
            Promise.race([
              webview.executeJavaScript(extractClickedImg),
              new Promise(r => setTimeout(() => r(null), 1000))
            ]).catch(() => null),
          ]);
          webPageContentRef.current = typeof content === 'string' ? content : '';
          if (typeof clickedImg === 'string' && clickedImg) {
            lastClickedImageRef.current = clickedImg;
          }
        } catch {
          webPageContentRef.current = '';
        }
      }
      webContextPrompt = `\n\n=== CONTEXTO DA ABA WEB ===\n${buildWebSystemPrompt(message)}`;
    }
    
    // Adiciona contexto do criativo se estiver aberto
    let creativeContextPrompt = '';
    if (showCustomPanel && selectedResearch) {
      creativeContextPrompt = buildCreativeSystemPrompt();
    }

    // Adiciona mensagem do usuário
    const userMessage: Message = { 
      role: 'user', 
      content: message,
      ...(({} as any).timestamp = Date.now(), {})
    };
    (userMessage as any).timestamp = Date.now();
    setCurrentMessages(prev => [...prev, userMessage]);

    // Para cada IA do grupo, responde sequencialmente
    const groupResponses: Array<{ name: string; content: string }> = [];

    for (let i = 0; i < group.length; i++) {
      const model = group[i];

      // Monta targetSettings para esse modelo
      const targetSettings: typeof settingsRef.current = {
        ...settingsRef.current,
        apiProvider: model.provider,
        ollamaModel: model.provider === 'ollama' ? model.model : settingsRef.current.ollamaModel,
        geminiModel: model.provider === 'gemini' ? model.model : settingsRef.current.geminiModel,
        geminiApiKey: model.provider === 'gemini' && model.apiKey ? model.apiKey : settingsRef.current.geminiApiKey,
        openrouterModel: model.provider === 'openrouter' ? model.model : settingsRef.current.openrouterModel,
        openrouterApiKey: model.provider === 'openrouter' && model.apiKey ? model.apiKey : settingsRef.current.openrouterApiKey,
        anthropicModel: model.provider === 'anthropic' ? model.model : settingsRef.current.anthropicModel,
        anthropicApiKey: model.provider === 'anthropic' && model.apiKey ? model.apiKey : settingsRef.current.anthropicApiKey,
        openaiModel: model.provider === 'openai' ? model.model : settingsRef.current.openaiModel,
        openaiApiKey: model.provider === 'openai' && model.apiKey ? model.apiKey : settingsRef.current.openaiApiKey,
        openaiUrl: model.provider === 'openai' && model.baseUrl ? model.baseUrl : settingsRef.current.openaiUrl,
        customModel: model.provider === 'custom' ? model.model : settingsRef.current.customModel,
        customApiKey: model.provider === 'custom' && model.apiKey ? model.apiKey : settingsRef.current.customApiKey,
        customBaseUrl: model.provider === 'custom' && model.baseUrl ? model.baseUrl : settingsRef.current.customBaseUrl,
        customName: model.provider === 'custom' ? (model.customName || model.name) : settingsRef.current.customName,
      };

      // System prompt de grupo
      const prevResponses = groupResponses.length > 0
        ? '\n\nRespostas anteriores neste turno:\n' + groupResponses.map(r => `[${r.name}]: ${r.content}`).join('\n\n')
        : '';
      
      console.log(`[GRUPO DEBUG] Modelo: ${model.name}, prevResponses length: ${prevResponses.length}, groupResponses count: ${groupResponses.length}`);

      const webSearchInstruction = isWebMode ? `

PESQUISA WEB (OBRIGATÓRIO NESTA ABA):
- Você está na aba WEB. Pesquisa está HABILITADA e DISPONÍVEL neste ambiente.
- NUNCA diga que a pesquisa está desabilitada ou que precisa de um botão "Online". Isso é FALSO neste contexto.
- Quando o usuário pedir informações atuais (notícias, jogos, eventos, preços, resultados), você DEVE usar o bloco de pesquisa:
\`\`\`web-action:research
{"query": "sua query de pesquisa aqui"}
\`\`\`
- Responda APENAS com esse bloco, sem texto antes ou depois. O sistema irá executar a busca automaticamente e te chamar novamente com os resultados.
- Se não tiver certeza se precisa pesquisar, pesquise. É melhor pesquisar do que inventar dados desatualizados.` : '';

      const groupSystemPrompt = `Você está em MODO GRUPO com outros modelos de IA.

CONTEXTO:
- Aba ativa: ${viewLabel}
- Você é: ${model.name}
- Membros do grupo (em ordem de resposta): ${groupNames}
- O usuário é o líder — a decisão final é sempre dele.

REGRAS DO MODO GRUPO:
1. Você tem direito a responder UMA ÚNICA VEZ por mensagem do usuário.
2. **SEJA DIRETO E CONCISO** - máximo 3-4 linhas. O usuário vai ler todas as respostas em sequência.
3. **NÃO REPITA** o que outro membro já disse. Se concordar, diga apenas "Concordo com [Nome]" + adicione algo novo.
4. **AGREGUE VALOR**: Dê uma perspectiva diferente, informação adicional, ou discorde com fundamento.
5. Se outro membro já respondeu completamente, você pode:
   - Adicionar um detalhe importante que faltou
   - Dar uma perspectiva alternativa
   - Discordar educadamente se achar que está errado
   - OU simplesmente dizer "Concordo com [Nome], nada a adicionar"${webSearchInstruction}${prevResponses}${webContextPrompt}${creativeContextPrompt}`;

      // Monta histórico + mensagem atual (filtra system anterior igual ao chat normal)
      const currentMsgs = getCurrentMessages();
      
      // CRÍTICO: Remove as mensagens do turno atual (que são os placeholders dos outros modelos do grupo)
      // Apenas o prevResponses no system prompt deve conter as respostas deste turno
      const lastUserMsgIndex = [...currentMsgs].reverse().findIndex(m => m.role === 'user');
      const cutoffIndex = lastUserMsgIndex >= 0 ? currentMsgs.length - lastUserMsgIndex - 1 : currentMsgs.length;
      
      const historyMessages = currentMsgs
        .slice(0, cutoffIndex) // Pega apenas até a última mensagem do usuário (exclui respostas deste turno)
        .filter(m => m.role !== 'system' && (m.role !== 'assistant' || m.content))
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      
      console.log(`[GRUPO DEBUG HISTORY] ${model.name}:`, {
        totalMessages: currentMsgs.length,
        cutoffIndex,
        historyLength: historyMessages.length,
        lastUserMsgIndex,
        prevResponsesLength: prevResponses.length
      });

      const messagesForAI = [
        { role: 'system' as const, content: groupSystemPrompt },
        ...historyMessages,
        { role: 'user' as const, content: message }
      ];
      
      console.log(`[GRUPO DEBUG] ${model.name} - System prompt length: ${groupSystemPrompt.length}`);

      // Adiciona placeholder de resposta no chat
      setCurrentMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        modelColor: model.color,
        modelName: model.name,
        modelAvatar: model.avatar,
      }]);

      setIsStreaming(true);
      setStreamingMode(effectiveView || '');

      // Chama a API com streaming
      let fullContent = '';
      try {
        const myCancelVersion = ++streamIdRef.current;

        await new Promise<void>((resolve) => {
          let settled = false;
          const chunkHandlers: Array<() => void> = [];
          const finish = () => { if (!settled) { settled = true; chunkHandlers.forEach(h => h()); resolve(); } };

          let timeoutId = setTimeout(finish, 60000);

          const handleChunk = (chunk: string) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(finish, 60000); // Reseta o timeout de ociosidade

            if (streamIdRef.current !== myCancelVersion) { finish(); return; }
            fullContent += chunk;
            setCurrentMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
              }
              return updated;
            });
          };

          // Registra listener correto pelo provider
          switch (model.provider) {
            case 'ollama':
              chunkHandlers.push(window.electronAPI.onOllamaChunk(handleChunk));
              window.electronAPI.ollamaStream(messagesForAI, targetSettings.ollamaModel || '').then(finish).catch(finish);
              break;
            case 'gemini':
              chunkHandlers.push(window.electronAPI.onGeminiChunk(handleChunk));
              window.electronAPI.geminiStream(messagesForAI, targetSettings.geminiModel || 'gemini-2.0-flash', targetSettings.geminiApiKey || '').then(finish).catch(finish);
              break;
            case 'openrouter':
              chunkHandlers.push(window.electronAPI.onOpenRouterChunk(handleChunk));
              window.electronAPI.openrouterStream(messagesForAI, targetSettings.openrouterModel || '', targetSettings.openrouterApiKey || '', targetSettings.openrouterUrl).then(finish).catch(finish);
              break;
            case 'anthropic':
              chunkHandlers.push(window.electronAPI.onAnthropicChunk(handleChunk));
              window.electronAPI.anthropicStream(messagesForAI, targetSettings.anthropicModel || '', targetSettings.anthropicApiKey || '').then(finish).catch(finish);
              break;
            case 'openai':
            case 'custom': {
              const key = model.provider === 'openai' ? targetSettings.openaiApiKey : targetSettings.customApiKey;
              const url = model.provider === 'openai' ? targetSettings.openaiUrl : targetSettings.customBaseUrl;
              const mod = model.provider === 'openai' ? targetSettings.openaiModel : targetSettings.customModel;
              chunkHandlers.push(window.electronAPI.onOpenAIChunk(handleChunk));
              window.electronAPI.openaiStream(messagesForAI, mod || '', key || '', url).then(finish).catch(finish);
              break;
            }
            default:
              finish();
          }
        });

        if (!fullContent.trim()) {
          fullContent = '[Sem resposta do provedor]';
          setCurrentMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
            }
            return updated;
          });
        }

        // Captura a resposta ANTES de qualquer processamento adicional
        const rawContent = fullContent;
        
        // PESQUISA WEB UNIVERSAL - Funciona em grupo também
        fullContent = await processResearchIfNeeded(fullContent, {
          messages: getCurrentMessages(),
          setMessages: setCurrentMessages,
          chatId: null,
          systemPrompt: messagesForAI[0].content,
          settings: targetSettings,
          effectiveView: effectiveView || ''
        });

        // Adiciona a resposta ao array (usa rawContent se fullContent foi modificado demais)
        groupResponses.push({ name: model.name, content: fullContent });
        console.log(`[GRUPO] Adicionou resposta de ${model.name} ao groupResponses (${groupResponses.length} total)`);

      } catch (err) {
        console.error(`[Grupo] Erro na IA ${model.name}:`, err);
        setCurrentMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant' && !updated[lastIdx].content) {
            updated[lastIdx] = { ...updated[lastIdx], content: `[Erro ao chamar ${model.name}]` };
          }
          return updated;
        });
      }
    }

    setIsStreaming(false);
  };

  const handleSendMessage = async (message: string, fromTerminalAgentOrModel?: string | SavedModel, activeChatId?: string, attachedFile?: File | boolean, isSystemMessage?: boolean) => {
    console.log('[handleSendMessage] ==================== INÍCIO ====================');
    console.log('[handleSendMessage] message:', message.substring(0, 50));
    console.log('[handleSendMessage] activeChatId:', activeChatId);
    console.log('[handleSendMessage] isStreaming atual:', isStreaming);
    
    if (isStreaming) {
      console.log('[handleSendMessage] JÁ ESTÁ STREAMING, ABORTANDO');
      return;
    }
    
    console.log('[handleSendMessage] ==================== CHAMADA ====================');
    console.log('[handleSendMessage] message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    console.log('[handleSendMessage] attachedFile:', attachedFile);
    
    // Backward compatibility: se attachedFile for boolean, é o antigo skipUserMessage
    // Também checa se File tem propriedade _skipUserMessage (usado em grupos)
    const skipUserMessage = typeof attachedFile === 'boolean' ? attachedFile : ((attachedFile as any)?._skipUserMessage || false);
    const file = attachedFile instanceof File ? attachedFile : undefined;
    console.log('[handleSendMessage] activeChatId:', activeChatId);
    console.log('[handleSendMessage] skipUserMessage:', skipUserMessage, 'hasFile:', !!file);
    
    // Detecta se o segundo parâmetro é um modelo ou terminal agent
    let fromTerminalAgent: string | undefined = undefined;
    let forcedModel: SavedModel | undefined = undefined;
    
    if (typeof fromTerminalAgentOrModel === 'string') {
      fromTerminalAgent = fromTerminalAgentOrModel;
      terminalAgentRef.current = fromTerminalAgent as any;
    } else if (fromTerminalAgentOrModel && typeof fromTerminalAgentOrModel === 'object') {
      forcedModel = fromTerminalAgentOrModel;
      terminalAgentRef.current = null;
    } else if (!fromTerminalAgentOrModel) {
      terminalAgentRef.current = null;
    }

    // MUDANÇA: Remove verificação que bloqueia - deixa múltiplos streams acontecerem
    // Apenas loga se o modelo já está ocupado (mas não bloqueia mais)
    if (activeChatId && isModelStreaming(activeChatId)) {
      console.log('[handleSendMessage] AVISO: Modelo já está respondendo:', activeChatId);
      // NÃO retorna - permite múltiplos streams
    }

    // Se não tem chat ativo, verifica streaming global (compatibilidade)
    // if (!activeChatId && isStreaming) return; // COMENTADO - permite múltiplos
    
    cancelStreamRef.current = false;
    const myCancelVersion = ++streamIdRef.current; // versão deste stream

    // finalize só processa se ainda é o stream mais recente
    const isMyCurrent = () => streamIdRef.current === myCancelVersion;
    
    console.log('[handleSendMessage] message:', message, 'fromTerminalAgent:', fromTerminalAgent, 'forcedModel:', forcedModel?.name, 'activeChatId:', activeChatId, 'skipUserMessage:', skipUserMessage);

    // --- MENTION ROUTING ---
    let targetSettings = settingsRef.current;
    let modelColor: string | undefined = undefined;
    let modelName: string | undefined = undefined;
    let modelAvatar: string | undefined = undefined;
    let modelVoice: string | undefined = undefined; // VOZ DO MODELO
    let finalMessage = message;

    try {
      const models = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
      
      // PRIORIDADE 0: Se um modelo foi forçado (chamada de grupo), usa ele
      if (forcedModel) {
        console.log('[handleSendMessage] Modelo forçado:', forcedModel.name, forcedModel.provider, forcedModel.model);
        targetSettings = {
          ...settingsRef.current,
          apiProvider: forcedModel.provider,
          ollamaModel: forcedModel.provider === 'ollama' ? forcedModel.model : settingsRef.current.ollamaModel,
          geminiModel: forcedModel.provider === 'gemini' ? forcedModel.model : settingsRef.current.geminiModel,
          openrouterModel: forcedModel.provider === 'openrouter' ? forcedModel.model : settingsRef.current.openrouterModel,
          anthropicModel: forcedModel.provider === 'anthropic' ? forcedModel.model : settingsRef.current.anthropicModel,
          openaiModel: forcedModel.provider === 'openai' ? forcedModel.model : settingsRef.current.openaiModel,
          customModel: forcedModel.provider === 'custom' ? forcedModel.model : settingsRef.current.customModel,
          customName: forcedModel.provider === 'custom' ? forcedModel.customName : settingsRef.current.customName,
          geminiApiKey: forcedModel.provider === 'gemini' && forcedModel.apiKey ? forcedModel.apiKey : settingsRef.current.geminiApiKey,
          openrouterApiKey: forcedModel.provider === 'openrouter' && forcedModel.apiKey ? forcedModel.apiKey : settingsRef.current.openrouterApiKey,
          anthropicApiKey: forcedModel.provider === 'anthropic' && forcedModel.apiKey ? forcedModel.apiKey : settingsRef.current.anthropicApiKey,
          openaiApiKey: forcedModel.provider === 'openai' && forcedModel.apiKey ? forcedModel.apiKey : settingsRef.current.openaiApiKey,
          customApiKey: forcedModel.provider === 'custom' && forcedModel.apiKey ? forcedModel.apiKey : settingsRef.current.customApiKey,
          customBaseUrl: forcedModel.provider === 'custom' && forcedModel.baseUrl ? forcedModel.baseUrl : settingsRef.current.customBaseUrl,
        };
        modelColor = forcedModel.color;
        modelName = forcedModel.name;
        modelAvatar = forcedModel.avatar;
        modelVoice = forcedModel.voice; // CAPTURA VOZ
        console.log('[handleSendMessage] *** FORCED MODEL - Nome:', modelName, 'Voz:', modelVoice);
      }
      // PRIORIDADE 1: Se tem activeChatId (mensagem de um chat específico), usa o modelo desse contato
      else if (activeChatId) {
        console.log('[handleSendMessage] Procurando modelo com ID:', activeChatId);
        console.log('[handleSendMessage] Modelos disponíveis:', models.map((m: any) => ({ id: m.id, name: m.name, provider: m.provider })));
        const chatModel = models.find((m: any) => m.id === activeChatId);
        if (chatModel) {
          console.log('[handleSendMessage] Chat ativo:', chatModel.name, chatModel.provider, chatModel.model);
          targetSettings = {
            ...settingsRef.current,
            apiProvider: chatModel.provider,
            ollamaModel: chatModel.provider === 'ollama' ? chatModel.model : settingsRef.current.ollamaModel,
            geminiModel: chatModel.provider === 'gemini' ? chatModel.model : settingsRef.current.geminiModel,
            openrouterModel: chatModel.provider === 'openrouter' ? chatModel.model : settingsRef.current.openrouterModel,
            anthropicModel: chatModel.provider === 'anthropic' ? chatModel.model : settingsRef.current.anthropicModel,
            openaiModel: chatModel.provider === 'openai' ? chatModel.model : settingsRef.current.openaiModel,
            customModel: chatModel.provider === 'custom' ? chatModel.model : settingsRef.current.customModel,
            customName: chatModel.provider === 'custom' ? chatModel.customName : settingsRef.current.customName,
            geminiApiKey: chatModel.provider === 'gemini' && chatModel.apiKey ? chatModel.apiKey : settingsRef.current.geminiApiKey,
            openrouterApiKey: chatModel.provider === 'openrouter' && chatModel.apiKey ? chatModel.apiKey : settingsRef.current.openrouterApiKey,
            anthropicApiKey: chatModel.provider === 'anthropic' && chatModel.apiKey ? chatModel.apiKey : settingsRef.current.anthropicApiKey,
            openaiApiKey: chatModel.provider === 'openai' && chatModel.apiKey ? chatModel.apiKey : settingsRef.current.openaiApiKey,
            customApiKey: chatModel.provider === 'custom' && chatModel.apiKey ? chatModel.apiKey : settingsRef.current.customApiKey,
            customBaseUrl: chatModel.provider === 'custom' && chatModel.baseUrl ? chatModel.baseUrl : settingsRef.current.customBaseUrl,
          };
          modelColor = chatModel.color;
          modelName = chatModel.name;
          modelAvatar = chatModel.avatar;
          modelVoice = chatModel.voice; // CAPTURA VOZ
          console.log('[handleSendMessage] *** CHAT MODEL - Nome:', modelName, 'Voz:', modelVoice);
          console.log('[handleSendMessage] Usando modelo do chat:', chatModel.provider, chatModel.model);
        } else {
          console.error('[handleSendMessage] ❌ MODELO NÃO ENCONTRADO para activeChatId:', activeChatId);
          console.error('[handleSendMessage] ❌ Isso pode causar resposta vazia!');
        }
      }
      
      // PRIORIDADE 2: Procura por @mention explícito na mensagem (mas não sobrescreve forcedModel)
      if (!forcedModel) {
        const words = message.split(/\s+/);
        for (const word of words) {
          if (word.startsWith('@')) {
            const query = word.slice(1).toLowerCase();
            console.log('[handleSendMessage] Procurando @mention:', query);
            const matchedModel = models.find((m: any) => m.name.replace(/\s+/g, '').toLowerCase() === query);
            if (matchedModel) {
              console.log('[handleSendMessage] @mention encontrado!', matchedModel.name, matchedModel.provider, matchedModel.model);
              targetSettings = {
                ...settingsRef.current,
                apiProvider: matchedModel.provider,
                ollamaModel: matchedModel.provider === 'ollama' ? matchedModel.model : settingsRef.current.ollamaModel,
                geminiModel: matchedModel.provider === 'gemini' ? matchedModel.model : settingsRef.current.geminiModel,
                openrouterModel: matchedModel.provider === 'openrouter' ? matchedModel.model : settingsRef.current.openrouterModel,
                anthropicModel: matchedModel.provider === 'anthropic' ? matchedModel.model : settingsRef.current.anthropicModel,
                openaiModel: matchedModel.provider === 'openai' ? matchedModel.model : settingsRef.current.openaiModel,
                customModel: matchedModel.provider === 'custom' ? matchedModel.model : settingsRef.current.customModel,
                customName: matchedModel.provider === 'custom' ? matchedModel.customName : settingsRef.current.customName,
                geminiApiKey: matchedModel.provider === 'gemini' && matchedModel.apiKey ? matchedModel.apiKey : settingsRef.current.geminiApiKey,
                openrouterApiKey: matchedModel.provider === 'openrouter' && matchedModel.apiKey ? matchedModel.apiKey : settingsRef.current.openrouterApiKey,
                anthropicApiKey: matchedModel.provider === 'anthropic' && matchedModel.apiKey ? matchedModel.apiKey : settingsRef.current.anthropicApiKey,
                openaiApiKey: matchedModel.provider === 'openai' && matchedModel.apiKey ? matchedModel.apiKey : settingsRef.current.openaiApiKey,
                customApiKey: matchedModel.provider === 'custom' && matchedModel.apiKey ? matchedModel.apiKey : settingsRef.current.customApiKey,
                customBaseUrl: matchedModel.provider === 'custom' && matchedModel.baseUrl ? matchedModel.baseUrl : settingsRef.current.customBaseUrl,
              };
              modelColor = matchedModel.color;
              modelName = matchedModel.name;
              modelAvatar = matchedModel.avatar;
              modelVoice = matchedModel.voice; // CAPTURA VOZ
              console.log('[handleSendMessage] targetSettings configurado para:', matchedModel.provider, matchedModel.model);
              break;
            } else {
              console.log('[handleSendMessage] @mention NÃO encontrado para:', query);
            }
          }
        }
      }
    } catch (e) {}

    // Se nenhum @mention foi resolvido, busca a identidade do modelo ativo
    // direto no localStorage (mais confiável que settingsRef para campos novos)
    if (!modelColor || !modelName) {
      try {
        const s = settingsRef.current;
        // Tenta pelas fields novas primeiro
        if (!modelColor && s.activeModelColor) modelColor = s.activeModelColor;
        if (!modelName && s.activeModelName) modelName = s.activeModelName;
        if (!modelAvatar && s.activeModelAvatar) modelAvatar = s.activeModelAvatar;
        // Fallback: procura nos modelos salvos pelo provider+model atual
        if (!modelColor || !modelName) {
          const allModels = JSON.parse(localStorage.getItem('bill-saved-models') || '[]');
          const currentModelId = (() => {
            switch (s.apiProvider) {
              case 'ollama':     return s.ollamaModel || '';
              case 'gemini':     return s.geminiModel || '';
              case 'openrouter': return s.openrouterModel || '';
              case 'anthropic':  return s.anthropicModel || '';
              case 'openai':     return s.openaiModel || '';
              case 'custom':     return s.customModel || '';
              default: return '';
            }
          })();
          const activeModel = allModels.find((m: any) =>
            m.provider === s.apiProvider && m.model === currentModelId
          );
          if (activeModel) {
            if (!modelColor) modelColor = activeModel.color;
            if (!modelName) modelName = activeModel.name;
            if (!modelAvatar) modelAvatar = activeModel.avatar;
          }
        }
      } catch (e) {}
    }

    // Se chamado pelo terminal agent, sobrescreve o contexto de view
    const effectiveView = (terminalAgentRef.current as any) || activeMainViewRef.current;
    console.log('[handleSendMessage] effectiveView:', effectiveView, 'activeMainView:', activeMainView, 'activeMainViewRef.current:', activeMainViewRef.current);
    const isVideoMode = effectiveView === 'video';
    const isPhotoMode = effectiveView === 'photo';
    const isPaintMode = effectiveView === 'paint';
    const isWebMode = effectiveView === 'web';
    const isHomeMode = effectiveView === 'home';
    
    // ── SISTEMA DE CHATS SEPARADOS ──────────────────────────────────────────
    // Cada chat tem seu próprio buffer de mensagens independente
    // Isso permite múltiplos chats responderem simultaneamente sem interferir uns nos outros
    let currentMessages: Message[] = [];
    let setCurrentMessages: React.Dispatch<React.SetStateAction<Message[]>> | null = null;
    
    if (activeChatId) {
      // Chat específico: carrega do localStorage
      const saved = localStorage.getItem(`bill-chat-${activeChatId}`);
      console.log('[handleSendMessage] Carregando histórico do localStorage:', activeChatId);
      if (saved) {
        try {
          currentMessages = JSON.parse(saved);
          console.log('[handleSendMessage] Histórico carregado:', currentMessages.length, 'mensagens');
          console.log('[handleSendMessage] Últimas 3 mensagens:', currentMessages.slice(-3).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 50) : '[array]' })));
          
          // LIMPEZA: Converte mensagens antigas com content como array de volta para string
          let needsCleanup = false;
          currentMessages = currentMessages.map(msg => {
            if (Array.isArray(msg.content)) {
              needsCleanup = true;
              const textPart = msg.content.find((c: any) => c.type === 'text');
              return { ...msg, content: textPart?.text || '[mensagem corrompida]' };
            }
            return msg;
          });
          
          // Se limpou, salva de volta
          if (needsCleanup) {
            localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(currentMessages));
            console.log('[handleSendMessage] Limpou mensagens corrompidas no histórico:', activeChatId);
          }
        } catch {
          currentMessages = [];
        }
      }
      
      // MUDANÇA: Usa um Map de buffers por chatId em vez de array global compartilhado
      // Isso evita que trocar de chat interfira em respostas em andamento
      if (!chatBuffersRef.current) {
        chatBuffersRef.current = new Map();
      }
      
      if (!chatBuffersRef.current.has(activeChatId)) {
        console.log('[handleSendMessage] Buffer não existe, criando com', currentMessages.length, 'mensagens do localStorage');
        chatBuffersRef.current.set(activeChatId, currentMessages);
      } else {
        console.log('[handleSendMessage] Buffer já existe com', chatBuffersRef.current.get(activeChatId)?.length, 'mensagens - USANDO BUFFER EM MEMÓRIA (não localStorage)');
        // IMPORTANTE: Usa o buffer existente, NÃO sobrescreve com localStorage
        // Isso evita perder mensagens que estão apenas em memória
        currentMessages = chatBuffersRef.current.get(activeChatId) || [];
      }
      
      // Cria setter que atualiza o Map
      setCurrentMessages = (updater: any) => {
        const current = chatBuffersRef.current!.get(activeChatId) || [];
        const newMessages = typeof updater === 'function' ? updater(current) : updater;
        const limited = newMessages.slice(-20); // Limita a 20 mensagens
        chatBuffersRef.current!.set(activeChatId, limited);
        
        // Atualiza AMBOS os estados: o array global E o contactChatMessages
        const globalArray = isVideoMode ? setVideoChatMessages : (isPhotoMode ? setPhotoChatMessages : (isPaintMode ? setPaintChatMessages : (isWebMode ? setWebChatMessages : (isHomeMode ? setHomeChatMessages : setChatMessages))));
        globalArray([...limited]); // Cria cópia para garantir re-render
        
        // IMPORTANTE: Atualiza contactChatMessages também (usado pelo Chat para renderizar)
        const limitedCopy = [...limited];
        setContactChatMessages(prev => ({
          ...prev,
          [activeChatId]: limitedCopy // Cópia para garantir re-render
        }));
        setContactChatVersion(v => v + 1); // Força re-render
        
        // CRITICAL FIX: Dispara evento para forçar o Chat.tsx a re-renderizar
        // Sem isso, o React pode batchear os state updates e não re-renderizar a UI
        window.dispatchEvent(new CustomEvent('bill-chat-updated', {
          detail: { chatId: activeChatId, messages: limitedCopy }
        }));
      };
    } else {
      // Modo normal (sem chat específico): usa arrays globais
      console.log('[handleSendMessage] SEM activeChatId - isHomeMode:', isHomeMode, 'homeChatMessages.length:', homeChatMessages.length);
      currentMessages = isVideoMode ? videoChatMessages : (isPhotoMode ? photoChatMessages : (isPaintMode ? paintChatMessages : (isWebMode ? webChatMessages : (isHomeMode ? homeChatMessages : chatMessages))));
      setCurrentMessages = isVideoMode ? setVideoChatMessages : (isPhotoMode ? setPhotoChatMessages : (isPaintMode ? setPaintChatMessages : (isWebMode ? setWebChatMessages : (isHomeMode ? setHomeChatMessages : setChatMessages))));
    }

    // Processa arquivo anexado
    let imageBase64: string | undefined;
    let imageFileName: string | undefined;
    let fileTextContent: string | undefined;
    
    if (file) {
      // Se for imagem
      if (file.type.startsWith('image/')) {
        try {
          // Se for WebP, converte para PNG primeiro (melhor compatibilidade com modelos de visão)
          if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
            console.log('[handleSendMessage] Convertendo WebP para PNG...');
            
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            imageBase64 = await new Promise<string>((resolve, reject) => {
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Não conseguiu criar contexto do canvas'));
                  return;
                }
                
                ctx.drawImage(img, 0, 0);
                const pngBase64 = canvas.toDataURL('image/png');
                URL.revokeObjectURL(objectUrl);
                
                console.log('[handleSendMessage] WebP convertido para PNG');
                resolve(pngBase64);
              };
              
              img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Erro ao carregar imagem WebP'));
              };
              
              img.src = objectUrl;
            });
            
            imageFileName = file.name.replace(/\.webp$/i, '.png');
          } else {
            // Outros formatos: lê diretamente
            const reader = new FileReader();
            imageBase64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            imageFileName = file.name;
          }
          
          console.log('[handleSendMessage] Imagem convertida para base64:', imageFileName);
        } catch (error) {
          console.error('[handleSendMessage] Erro ao converter imagem:', error);
        }
      }
      // Se for arquivo de texto
      else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json') || 
               file.name.endsWith('.csv') || file.name.endsWith('.md') || file.name.endsWith('.log')) {
        try {
          const reader = new FileReader();
          fileTextContent = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          imageFileName = file.name; // Reutiliza a variável pro nome
          console.log('[handleSendMessage] Arquivo de texto lido:', file.name, 'tamanho:', fileTextContent.length, 'chars');
        } catch (error) {
          console.error('[handleSendMessage] Erro ao ler arquivo de texto:', error);
        }
      }
    }

    // Cria mensagem do usuário com formato correto
    let userMessageContent: any;
    let apiMessageContent: any; // Conteúdo que vai pra API (pode ser diferente do que mostra na UI)
    
    if (imageBase64) {
      // Imagem: formato vision
      userMessageContent = [
        { type: 'text', text: finalMessage || 'O que você vê nesta imagem?' },
        { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } }
      ];
      apiMessageContent = userMessageContent; // Mesmo conteúdo
    } else if (fileTextContent) {
      // Arquivo de texto: UI mostra só a mensagem, API recebe arquivo completo
      userMessageContent = finalMessage || 'Analise este arquivo:';
      apiMessageContent = `${finalMessage || 'Analise este arquivo:'}\n\n[Arquivo: ${imageFileName}]\n\`\`\`\n${fileTextContent}\n\`\`\``;
      console.log('[handleSendMessage] Arquivo de texto: UI esconde código, API recebe completo');
    } else {
      // Apenas texto
      userMessageContent = finalMessage;
      apiMessageContent = finalMessage;
    }
    
    const userMessage: Message = { 
      role: 'user', 
      content: userMessageContent, 
      modelColor, 
      modelName, 
      modelAvatar,
      image: imageBase64,
      imageFile: imageFileName,
      isSystem: isSystemMessage // Marca mensagens de sistema (como lembretes) para não renderizar
    };
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║ [ENVIANDO MENSAGEM]                                       ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║ Mensagem:', finalMessage);
    console.log('║ Chat ID:', activeChatId || 'CHAT GLOBAL (sem ID)');
    console.log('║ Modelo:', modelName || 'padrão');
    console.log('║ Tem imagem?', imageBase64 ? 'SIM' : 'NÃO');
    console.log('║ Tem arquivo texto?', fileTextContent ? `SIM (${fileTextContent.length} chars)` : 'NÃO');
    console.log('║ Provider:', targetSettings.apiProvider);
    console.log('║ apiMessageContent:', apiMessageContent ? (typeof apiMessageContent === 'string' ? apiMessageContent.substring(0, 100) + '...' : '[array com imagem]') : 'vazio');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    // Moondream descreve a imagem para QUALQUER provider — fallback universal de visão
    let moondreamDescription: string | null = null;
    if (imageBase64) {
      console.log('[VISION] Usando Moondream para descrever imagem (provider:', targetSettings.apiProvider, ')...');
      try {
        const moondreamModel = settingsRef.current.moondreamModel || 'moondream';
        const result = await Promise.race([
          (window as any).electronAPI.describeImage(imageBase64, moondreamModel),
          new Promise<null>(r => setTimeout(() => r(null), 10000))
        ]);
        
        // Extrai a descrição (pode ser string ou objeto)
        const description = typeof result === 'string' ? result : (result?.description || result?.text || null);
        
        if (description && description.trim()) {
          console.log('[VISION] Moondream descreveu:', description.substring(0, 100));
          moondreamDescription = description;
          
          // IMPORTANTE: Adiciona a descrição do Moondream na mensagem
          if (Array.isArray(apiMessageContent)) {
            const textPart = apiMessageContent.find((p: any) => p.type === 'text');
            const originalText = textPart?.text || finalMessage;
            // Substitui o conteúdo de texto com a descrição da imagem
            apiMessageContent = `${originalText}\n\n[Descrição da imagem anexada: ${description}]`;
            userMessageContent = apiMessageContent;
          } else {
            // Se não for array (modelo sem visão), adiciona como texto
            apiMessageContent = `${finalMessage}\n\n[Descrição da imagem anexada: ${description}]`;
            userMessageContent = apiMessageContent;
          }
        } else {
          console.log('[VISION] Moondream falhou ou não disponível, enviando só texto');
          // Moondream falhou: converte conteúdo de volta pra texto puro
          // Assim o modelo responde ao texto em vez de dar "sem resposta"
          if (Array.isArray(apiMessageContent)) {
            const textPart = apiMessageContent.find((p: any) => p.type === 'text');
            apiMessageContent = (textPart?.text || finalMessage) + '\n\n[O usuário anexou uma imagem, mas não foi possível processá-la. Responda ao texto normalmente.]';
            userMessageContent = textPart?.text || finalMessage;
          }
        }
      } catch (error) {
        console.error('[VISION] Erro ao descrever imagem:', error);
        // Mesmo tratamento: converte pra texto puro pra não quebrar
        if (Array.isArray(apiMessageContent)) {
          const textPart = apiMessageContent.find((p: any) => p.type === 'text');
          apiMessageContent = (textPart?.text || finalMessage) + '\n\n[O usuário anexou uma imagem, mas não foi possível processá-la. Responda ao texto normalmente.]';
          userMessageContent = textPart?.text || finalMessage;
        }
      }
    }
    
    // Streaming por modelo - marca ANTES de adicionar mensagens
    if (activeChatId && modelName) {
      console.log('[Streaming] Marcando modelo como ocupado:', modelName, 'chatId:', activeChatId);
      setStreamingModels(prev => ({
        ...prev,
        [activeChatId]: { isStreaming: true, modelName }
      }));
    } else {
      console.log('[Streaming] AVISO: Sem activeChatId ou modelName', { activeChatId, modelName });
    }
    
    // Aguarda para garantir que a UI renderize o estado de streaming antes de adicionar mensagens
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[handleSendMessage] 🟢 PONTO 1: Antes de adicionar mensagens');
    
    // Agora adiciona as mensagens (ou apenas a do assistente se skipUserMessage = true)
    if (setCurrentMessages) {
      // Se skipUserMessage = true, não adiciona a mensagem do usuário (já foi adicionada antes)
      if (!skipUserMessage) {
        setCurrentMessages((prev) => [...prev, userMessage]);
      } else {
        console.log('[handleSendMessage] Pulando adição de userMessage (já existe no grupo)');
      }
      const assistantMessage: any = { role: 'assistant', content: '', modelColor, modelName, modelAvatar, timestamp: Date.now() };
      setCurrentMessages((prev) => [...prev, assistantMessage]);
    }
    
    console.log('[handleSendMessage] 🟢 PONTO 2: Depois de adicionar mensagens');
    
    setIsStreaming(true);
    
    console.log('[handleSendMessage] 🟢 PONTO 3: Depois de setIsStreaming(true)');

    // Aguarda mais um pouco para garantir que a UI renderize os 3 pontos
    await new Promise(resolve => setTimeout(resolve, 300));

    // â”€â”€ Notificação de início no terminal para os cards do Home â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (effectiveView === 'code') addTerminal(`[Bill Code] Pensando...`);
    else if (effectiveView === 'video') addTerminal(`[Bill Video] Pensando...`);
    else if (effectiveView === 'photo') addTerminal(`[Bill Photo] Pensando...`);
    else if (effectiveView === 'paint') addTerminal(`[Bill Paint] Pensando...`);
    else if (effectiveView === 'web') addTerminal(`[Bill Web] Pensando...`);

    console.log('[handleSendMessage] 🟢 PONTO 5: Depois de addTerminal, effectiveView:', effectiveView);

    // Reset token counter global
    setStreamingTokens(0);
    lastStreamingTokensRef.current = 0;
    setStreamingMode(effectiveView);
    // Cria nova barra de tokens
    setTokenBars(prev => [...prev, { id: Date.now(), tokens: 0, growing: true }].slice(-5));

    // â”€â”€ MODO CODE, VIDEO, PHOTO, PAINT ou WEB: Chama o LLM diretamente (sem Python) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Inclui terminal agent: se effectiveView for um agente, trata como o modo daquele agente
    if (effectiveView === 'code' || effectiveView === 'video' || effectiveView === 'photo' || effectiveView === 'paint' || effectiveView === 'web' || effectiveView === 'home') {
      console.log('[handleSendMessage] ?? PONTO 7: Dentro do if');
      // isWebMode já declarado acima via effectiveView â€” não redeclarar aqui

      // Se for modo web, extrai o conteúdo da página antes de construir o prompt
      if (isWebMode) {
        console.log('[handleSendMessage] 🟢 PONTO 8: Entrou no if isWebMode');
        const tabId = activeBrowserTabIdRef.current;
        const webview = document.getElementById(`webview-${tabId}`) as any;
        
        // Detecta se o usuário está PEDINDO EXPLICITAMENTE para pesquisar
        const msgLower = message.toLowerCase();
        const isExplicitSearchCommand = /\b(pesquisa|pesquise|busca|busque|procura|procure|search)\b/.test(msgLower);
        
        // Se for comando explícito de pesquisa, LIMPA o conteúdo da página para forçar research
        if (isExplicitSearchCommand) {
          webPageContentRef.current = '';
          console.log('[WEB] Comando de pesquisa detectado, limpando pageContent para forçar research');
        } else if (webview) {
          try {
            // Extrai texto da página e última imagem clicada em paralelo
            const extractPageScript = `(function() {
              try {
                var el = document.body || document.documentElement;
                if (!el) return "";
                var clone = el.cloneNode(true);
                ["script","style","nav","header","footer","aside","iframe","noscript"].forEach(function(tag) {
                  clone.querySelectorAll(tag).forEach(function(e) { e.remove(); });
                });
                var text = (clone.innerText || clone.textContent || "").replace(/\\s{3,}/g, "\\n\\n").trim();
                return text.slice(0, 8000);
              } catch(e) { return ""; }
            })()`;

            // LÃª e limpa a última imagem clicada atomicamente
            const extractClickedImg = `(function() {
              try {
                var v = window.__billLastClickedImg || null;
                return v;
              } catch(e) { return null; }
            })()`;

            const [content, clickedImg] = await Promise.all([
              Promise.race([
                webview.executeJavaScript(extractPageScript),
                new Promise(r => setTimeout(() => r(''), 3000))
              ]).catch(() => ''),
              Promise.race([
                webview.executeJavaScript(extractClickedImg),
                new Promise(r => setTimeout(() => r(null), 1000))
              ]).catch(() => null),
            ]);

            webPageContentRef.current = typeof content === 'string' ? content : '';
            if (typeof clickedImg === 'string' && clickedImg) {
              lastClickedImageRef.current = clickedImg;
            }
          } catch {
            webPageContentRef.current = '';
          }
        }
      }

      console.log('[handleSendMessage] 🟢 PONTO 9: Depois do if isWebMode, vai construir systemPrompt');

      // Adiciona contexto do criativo se estiver aberto
      const creativeContext = (showCustomPanel && selectedResearch) ? buildCreativeSystemPrompt() : '';

      const systemPrompt = isVideoMode ? buildVideoSystemPrompt() : (isPhotoMode ? buildPhotoSystemPrompt() : (isPaintMode ? buildPaintSystemPrompt() : (isWebMode ? buildWebSystemPrompt(message) : (isHomeMode ? `Você é um assistente de IA geral. Responda de forma natural, direta e útil.

🌐 PESQUISA WEB DISPONÍVEL
Você tem acesso à internet via \`web-action:research\`. A pesquisa está SEMPRE habilitada e disponível.

REGRAS CRÍTICAS:

1. QUANDO USAR PESQUISA:
   - APENAS quando o usuário MANDAR EXPLICITAMENTE: "pesquisa", "busca", "procura", "search"
   - NUNCA pesquise automaticamente só porque é uma pergunta sobre fatos
   - Se o usuário NÃO pedir para pesquisar, responda com seu conhecimento interno

2. COMO EXECUTAR PESQUISA:
   - Quando o usuário pedir para pesquisar: GERE APENAS o bloco de código abaixo
   - SEM NENHUM TEXTO antes ou depois
   - NENHUMA saudação, NENHUM aviso, NENHUM emoji
   - APENAS o bloco de ação:

\`\`\`web-action:research
{"query": "termo de busca"}
\`\`\`

3. DEPOIS QUE A PESQUISA RETORNAR:
   - Responda à pergunta diretamente e de forma natural
   - Finja que já sabia a resposta desde o início
   - NÃO diga que pesquisou
   - NÃO mencione fontes ou links
   - Apenas responda de forma natural

EXEMPLOS CORRETOS:

Usuário: "pesquisa quando lança GTA 6"
Você: \`\`\`web-action:research
{"query": "GTA 6 data lançamento"}
\`\`\`

Usuário: "busca preço iPhone"
Você: \`\`\`web-action:research
{"query": "iPhone preço Brasil"}
\`\`\`

EXEMPLOS INCORRETOS (NÃO pesquisar):

Usuário: "quando lança GTA 6?"
Você: O GTA 6 ainda não tem data oficial confirmada.

Usuário: "quanto custa iPhone?"
Você: O preço varia conforme modelo e região.` : await buildCodeSystemPrompt(message)))));
      
      // DEBUG: Log do system prompt para Home
      if (isHomeMode) {
        console.log('[DEBUG Home] System prompt configurado:');
        console.log(systemPrompt.substring(0, 300));
        
        // Salva prompt e histórico em arquivo para debug
        const debugData = {
          timestamp: new Date().toISOString(),
          chatId: activeChatId || 'global',
          systemPrompt: systemPrompt,
          historyLength: currentMessages.length,
          history: currentMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.substring(0, 200) : '[não-string]'
          }))
        };
        
        // Salva via IPC
        if ((window as any).electronAPI?.writeFile) {
          (window as any).electronAPI.writeFile(
            'debug-home-prompt.json',
            JSON.stringify(debugData, null, 2)
          ).catch((e: any) => console.error('[DEBUG] Erro ao salvar:', e));
        }
      }
      
      // Adiciona contexto de atividade ao system prompt
      let systemPromptWithActivity = currentActivity 
        ? `${systemPrompt}\n\n## ATIVIDADE ATUAL DO USUÁRIO:\nO usuário está usando/jogando: ${currentActivity.app}${currentActivity.title !== currentActivity.app ? ` (${currentActivity.title})` : ''}\nConsidere que perguntas podem estar relacionadas a esta atividade.`
        : systemPrompt;
      
      // Adiciona contexto de projeto ativo
      if (activeProject) {
        console.log('[App] Projeto ativo detectado ao enviar mensagem:', activeProject);
        console.log('[App] Nome:', activeProject.name);
        console.log('[App] Descrição:', activeProject.description);
        console.log('[App] Tipo:', activeProject.blockType);
        
        // Verifica se o projeto está atrasado
        let delayWarning = '';
        console.log('[App] Checando atraso - deadline:', activeProject.deadline, 'deadlineTime:', activeProject.deadlineTime);
        if (activeProject.deadline && activeProject.deadlineTime) {
          const deadlineDate = new Date(`${activeProject.deadline}T${activeProject.deadlineTime}`);
          const now = new Date();
          console.log('[App] Deadline:', deadlineDate.toISOString());
          console.log('[App] Agora:', now.toISOString());
          console.log('[App] Está atrasado?', now > deadlineDate);
          if (now > deadlineDate) {
            const hoursLate = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60));
            delayWarning = `\n\n🚨 **ALERTA DE ATRASO CRÍTICO!** 🚨\nEste projeto está ATRASADO há ${hoursLate}h! O prazo era ${activeProject.deadline} às ${activeProject.deadlineTime}.\nVocê DEVE:\n- Tratar com URGÊNCIA MÁXIMA\n- Ser direto e objetivo\n- Priorizar eficiência sobre perfeição\n- Sugerir soluções rápidas\n- Lembrar o usuário do atraso se ele perder tempo`;
            console.log('[App] 🚨 ALERTA DE ATRASO ADICIONADO AO PROMPT!', hoursLate, 'horas');
          }
        } else {
          console.log('[App] Projeto sem deadline definido');
        }
        
        systemPromptWithActivity += `\n\n## PROJETO ATIVO:\nVocê está trabalhando no projeto "${activeProject.name}".${activeProject.description ? `\nDescrição: ${activeProject.description}` : ''}\nTipo: ${activeProject.blockType}${delayWarning}\n\n**INSTRUÇÃO CRÍTICA - SISTEMA DE NOTAS INTELIGENTE:**\n\nVocê DEVE analisar CADA mensagem do usuário e identificar ações/progresso relevante.\n\n**QUANDO ADICIONAR NOTAS:**\n1. Usuário relata o que fez: "adicionei", "coloquei", "desenhei", "mudei", "editei"\n2. Usuário descreve mudanças visuais: "ficou melhor", "agora tem", "criei um"\n3. Você sugeriu algo e o usuário aplicou: "fiz o que você disse", "apliquei", "segui sua dica"\n4. Você executou ação via paint-action/photo-action e foi bem-sucedida\n5. Usuário pede feedback - após responder, adicione nota resumindo\n\n**COMO ADICIONAR:**\nUse este bloco IMEDIATAMENTE após sua resposta conversacional:\n\`\`\`add-note\nDescrição concisa e específica do que foi feito (máximo 60 caracteres)\n\`\`\`\n\n**EXEMPLOS DE BOAS NOTAS:**\n- "Desenhou personagem com cabelo azul"\n- "Aplicou filtro sepia e ajustou brilho"\n- "IA sugeriu adicionar sombras"\n- "Adicionou texto em fonte grande"\n- "Mudou fundo para gradiente roxo"\n\n**EXEMPLOS DE NOTAS RUINS (NÃO FAÇA):**\n- "Nova camada adicionada" (muito genérica)\n- "Projeto salvo" (irrelevante)\n- "Usuário fez mudanças" (vaga)\n\n**REGRA DE OURO:** Seja específico e útil. As notas devem contar a história do projeto.`;
      } else {
        console.log('[App] Nenhum projeto ativo ao enviar mensagem');
      }
      
      // Adiciona contexto dos metadados do projeto (plataforma, referência, etc)
      if (projectMetadata) {
        console.log('[App] Metadados do projeto detectados:', projectMetadata);
        
        const platformNames: Record<string, string> = {
          'web-universal': 'Web Universal (responsivo)',
          'desktop-web': 'Desktop Web (fixo)',
          'desktop-app': 'Desktop App (Electron)',
          'android': 'Android App',
          'ios': 'iOS App'
        };
        
        const platformName = platformNames[projectMetadata.platform] || projectMetadata.platform;
        
        systemPromptWithActivity += `\n\n## CONFIGURAÇÃO DO PROJETO:\n**Plataforma alvo:** ${platformName}\n`;
        
        if (projectMetadata.referenceUrl) {
          systemPromptWithActivity += `**Site de referência:** ${projectMetadata.referenceUrl}\n`;
          
          const fidelity = projectMetadata.referenceFidelity || 'inspiration';
          const scraped = projectMetadata.scrapedData;
          
          if (scraped && !scraped.error) {
            systemPromptWithActivity += `\n**DADOS EXTRAÍDOS DO SITE:**\n`;
            
            if (scraped.title) {
              systemPromptWithActivity += `Título: ${scraped.title}\n`;
            }
            
            if (scraped.colors && scraped.colors.length > 0) {
              systemPromptWithActivity += `Cores do site: ${scraped.colors.slice(0, 10).join(', ')}\n`;
            }
            
            if (scraped.fonts && scraped.fonts.length > 0) {
              systemPromptWithActivity += `Fontes do site: ${scraped.fonts.slice(0, 5).join(', ')}\n`;
            }
            
            if (scraped.html) {
              const htmlPreview = scraped.html.slice(0, 15000); // 15k - sweet spot
              systemPromptWithActivity += `\nEstrutura HTML (seções principais):\n\`\`\`html\n${htmlPreview}\n\`\`\`\n`;
            }
            
            if (scraped.css) {
              const cssPreview = scraped.css.slice(0, 10000); // 10k - estilos principais
              systemPromptWithActivity += `\nCSS (estilos principais):\n\`\`\`css\n${cssPreview}\n\`\`\`\n`;
            }
          }
          
          if (fidelity === 'exact') {
            systemPromptWithActivity += `\n**MODO: CÓPIA FIEL - SCRAPING ATIVO**\n`;
            if (scraped && !scraped.error) {
              systemPromptWithActivity += `\n**VOCÊ TEM ACESSO AO CÓDIGO FONTE REAL DO SITE!**\n\n`;
              systemPromptWithActivity += `**INSTRUÇÃO CRÍTICA - COPIE EXATAMENTE:**\n`;
              systemPromptWithActivity += `1. ANALISE o HTML fornecido acima - essa é a estrutura REAL do site\n`;
              systemPromptWithActivity += `2. REPLIQUE a hierarquia de elementos exatamente como está\n`;
              systemPromptWithActivity += `3. USE as cores RGB EXATAS listadas acima - não invente outras\n`;
              systemPromptWithActivity += `4. MANTENHA os mesmos textos e conteúdos (traduza se necessário)\n`;
              systemPromptWithActivity += `5. COPIE os estilos CSS fornecidos - não crie novos do zero\n`;
              systemPromptWithActivity += `6. PRESERVE o layout, espaçamentos e posicionamento idênticos\n`;
              systemPromptWithActivity += `7. USE as fontes especificadas ou fallbacks muito similares\n\n`;
              systemPromptWithActivity += `**META:** O usuário deve olhar e dizer "é igualzinho ao original". Não seja criativo - COPIE.\n`;
            } else {
              systemPromptWithActivity += `**INSTRUÇÃO:** Faça o melhor para replicar exatamente o site. Use cores, layout e estrutura idênticos.\n`;
            }
          } else {
            systemPromptWithActivity += `\n**MODO: INSPIRAÇÃO**\n`;
            if (scraped && !scraped.error) {
              systemPromptWithActivity += `**INSTRUÇÃO:** Use os dados extraídos como INSPIRAÇÃO:\n`;
              systemPromptWithActivity += `- Use a paleta de cores como referência (pode variar tons)\n`;
              systemPromptWithActivity += `- Inspire-se na estrutura HTML (mas pode reorganizar)\n`;
              systemPromptWithActivity += `- Use estilos similares aos CSS fornecidos\n`;
              systemPromptWithActivity += `- Capture o estilo visual geral\n`;
              systemPromptWithActivity += `Crie algo SIMILAR mas ÚNICO, não uma cópia exata.\n`;
            } else {
              systemPromptWithActivity += `**INSTRUÇÃO:** Use o site como inspiração. Capture o estilo geral, cores e atmosfera.\n`;
            }
          }
        }
        
        if (projectMetadata.referenceImage) {
          systemPromptWithActivity += `**Imagem de referência:** O usuário forneceu uma imagem de design/mockup como referência.\n`;
          systemPromptWithActivity += `**INSTRUÇÃO:** Baseie-se na estrutura visual, cores, tipografia e layout da imagem fornecida para criar o código.\n`;
          // TODO: Implementar análise da imagem com Moondream/Vision API
        }
        
        console.log('[App] Contexto de metadados adicionado ao prompt');
      }

      let finalMessage = message;
      if (isVideoMode && (message.toLowerCase().includes('shorts') || message.toLowerCase().includes('tiktok') || message.toLowerCase().includes('reels'))) {
        finalMessage += "\n\n[INSTRUÇÃƒO RIGOROSA DO SISTEMA: O usuário quer o formato Shorts/TikTok. VocÃª DEVE responder APENAS E EXCLUSIVAMENTE gerando o bloco ```video-action:make-shorts\n{}\n```. NÃƒO dÃª explicaçÃµes, NÃƒO mostre o passo a passo, NÃƒO use set-scale, APENAS gere a ação make-shorts!]";
      }
      if (isPaintMode) {
        const msgL = message.toLowerCase().trim();
        const isConfirm = ['sim', 'pode', 'faz', 'vai lá', 'vamos', 'ok', 'isso', 'claro', 'bora', 'manda'].some(w => msgL === w || msgL.startsWith(w + ' ') || msgL.endsWith(' ' + w));
        const isActionRequest = msgL.includes('busca') || msgL.includes('gera') || msgL.includes('coloca') || msgL.includes('adiciona') || msgL.includes('edge') || msgL.includes('traçado') || msgL.includes('referÃªncia');
        const isArtQuestion = msgL.includes('melhorar') || msgL.includes('melhor fazer') || msgL.includes('dica') || msgL.includes('o que posso') || msgL.includes('como posso') || msgL.includes('o que acha') || msgL.includes('feedback');

        if (isConfirm) {
          finalMessage += '\n\n[INSTRUÇÃƒO DO SISTEMA: O usuário confirmou. EXECUTE IMEDIATAMENTE a ação mais lógica com base no histórico da conversa. Gere o bloco paint-action SEM perguntar nada.]';
        } else if (isActionRequest) {
          finalMessage += '\n\n[INSTRUÇÃƒO DO SISTEMA: O usuário pediu uma ação. EXECUTE agora com o bloco paint-action. NÃƒO pergunte se quer aplicar.]';
        } else if (isArtQuestion) {
          finalMessage += '\n\n[INSTRUÇÃƒO DO SISTEMA: O usuário quer dicas artísticas. USE O HISTÃ“RICO da conversa â€” vocÃª já descreveu o canvas antes. DÃª 2-3 dicas concretas e específicas sobre o que foi desenhado, baseado no que vocÃª já viu. NÃƒO peça para ver o canvas de novo. NÃƒO se apresente.]';
        }
      }

      // Monta contexto com as últimas mensagens (sem o placeholder vazio que acabamos de adicionar)
      // Normaliza content: se for array (formato de visão), extrai o texto
      const history = currentMessages
          .filter(m => {
            if (m.role === 'system') return false;
            const textContent = typeof m.content === 'string' ? m.content : 
                               Array.isArray(m.content) ? (m.content.find((c: any) => c.type === 'text')?.text || '') : '';
            return textContent.trim() !== '';
          })
          .map(m => {
            // Se content é array (mensagem com imagem), converte de volta para string para o contexto
            if (Array.isArray(m.content)) {
              const textPart = m.content.find((c: any) => c.type === 'text');
              return { ...m, content: textPart?.text || '[imagem]' };
            }
            // Remove campos de metadados que não devem ir pra API (image, imageFile)
            const { image, imageFile, ...cleanMsg } = m as any;
            return cleanMsg;
          })
          .slice(-10);

      const draftVision = isPhotoMode ? photoEditorRef.current?.getDraftVisionContent?.() : null;
      // Combina texto do rascunho + mensagem do usuário para detectar pedidos de remoção de fundo
      const draftVisionTextForParse = [draftVision?.text || '', message].join(' ');

      // Visão do canvas â€” só se não for 'disabled'
      let canvasSnapshot: string | null = null;
      let canvasDescription: string | null = null;

      // Paint mode: mesma lógica de visão do Photo
      if (isPaintMode) {
        const msgLower = message.toLowerCase();
        const needsVision = msgLower.includes('ver') ||
                            msgLower.includes('vÃª') ||
                            msgLower.includes('veja') ||
                            msgLower.includes('olha') ||
                            msgLower.includes('descreve') ||
                            msgLower.includes('analis') ||
                            msgLower.includes('como ficou') ||
                            msgLower.includes('desenho') ||
                            msgLower.includes('esboço') ||
                            msgLower.includes('pintei') ||
                            msgLower.includes('fiz') ||
                            msgLower.includes('canvas') ||
                            msgLower.includes('fazer aqui') ||
                            msgLower.includes('fazer agora') ||
                            msgLower.includes('o que acha') ||
                            msgLower.includes('dica') ||
                            msgLower.includes('melhorar');
        // Perguntas de melhoria só não precisam de snapshot se já tem descrição visual no histórico recente
        const hasRecentVision = history.slice(-4).some(m => 
          typeof m.content === 'string' && (m.content.includes('Vejo') || m.content.includes('Vi ') || m.content.includes('canvas') || m.content.includes('desenho'))
        );
        const isImprovementQuestion = (msgLower.includes('melhor') || msgLower.includes('dica') ||
                            msgLower.includes('o que acha') || msgLower.includes('feedback') ||
                            msgLower.includes('corrig') || msgLower.includes('ajud') ||
                            msgLower.includes('fazer aqui') || msgLower.includes('fazer agora')) && hasRecentVision;

        const visionMode = (needsVision && !isImprovementQuestion) ? (settingsRef.current.visionMode ?? 'disabled') : 'disabled';
        const moondreamModel = settingsRef.current.moondreamModel || 'moondream';

        if (visionMode !== 'disabled') {
          try {
            canvasSnapshot = await Promise.race([
              paintRef.current?.getCanvasSnapshot?.() ?? Promise.resolve(null),
              new Promise<null>(r => setTimeout(() => r(null), 4000))
            ]);
            addToTerminal(`[Paint Visão] Snapshot: ${canvasSnapshot ? Math.round(canvasSnapshot.length/1024) + 'KB' : 'FALHOU'}`);
          } catch { canvasSnapshot = null; }
        }

        const tryMoondreamPaint = async (): Promise<boolean> => {
          if (!canvasSnapshot) return false;
          let compressedSnap = canvasSnapshot;
          try {
            const img = new Image();
            await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = canvasSnapshot!; });
            const cvs = document.createElement('canvas');
            const maxDim = 512;
            const scale = Math.min(1, maxDim / Math.max(img.width || 512, img.height || 512));
            cvs.width = Math.round((img.width || 512) * scale);
            cvs.height = Math.round((img.height || 512) * scale);
            cvs.getContext('2d')!.drawImage(img, 0, 0, cvs.width, cvs.height);
            compressedSnap = cvs.toDataURL('image/jpeg', 0.6);
          } catch {}
          addToTerminal(`[Paint Visão] Enviando para Moondream (${Math.round(compressedSnap.length/1024)}KB)...`);
          try {
            const res = await Promise.race([
              (window as any).electronAPI.describeImage(compressedSnap, moondreamModel),
              new Promise<null>(r => setTimeout(() => r(null), 10000))
            ]);
            if (res?.success && res.description) {
              canvasDescription = res.description;
              canvasSnapshot = null;
              addToTerminal(`[Paint Visão] Moondream: ${res.description.slice(0, 120)}...`);
              return true;
            }
            addToTerminal(`[Paint Visão] Moondream falhou (${res?.error || 'sem descrição'}) â€” usando API com visão`);
          } catch (e: any) { addToTerminal(`[Paint Visão] Moondream erro: ${e.message} â€” usando API com visão`); }
          return false;
        };

        if (visionMode === 'moondream') {
          const ok = await tryMoondreamPaint();
          if (ok) canvasSnapshot = null;
          // se Moondream falhou, mantém snapshot para API com visão
        } else if (visionMode === 'moondream-then-api') {
          const ok = await tryMoondreamPaint();
          if (ok) canvasSnapshot = null;
        } else if (visionMode === 'api') {
          // mantém snapshot para API diretamente
        }
      }

      if (isPhotoMode) {
        const msgLower = message.toLowerCase();
        // Só executa o Moondream/visão se o usuário pedir explicitamente para olhar/ver/descrever/analisar a tela, ou se houver rascunho.
        // Evita rodar Moondream para comandos diretos de criação e edição (gerar imagens, remover fundo, filtros, etc.).
        const needsVision = msgLower.includes('ver') ||
                            msgLower.includes('vÃª') ||
                            msgLower.includes('veja') ||
                            msgLower.includes('olha') ||
                            msgLower.includes('descreve') ||
                            msgLower.includes('analis') ||
                            msgLower.includes('como ficou') ||
                            msgLower.includes('rascunho') ||
                            msgLower.includes('esboço') ||
                            msgLower.includes('desenho') ||
                            (draftVision && draftVision.text);

        const visionMode = needsVision ? (settingsRef.current.visionMode ?? 'disabled') : 'disabled';
        const moondreamModel = settingsRef.current.moondreamModel || 'moondream';

        if (visionMode !== 'disabled') {
          try {
            canvasSnapshot = await Promise.race([
              photoEditorRef.current?.getCanvasSnapshot?.() ?? Promise.resolve(null),
              new Promise<null>(r => setTimeout(() => r(null), 4000))
            ]);
            addToTerminal(`[Visao] Snapshot gerado: ${canvasSnapshot ? canvasSnapshot.length + ' bytes' : 'FALHOU'}`);
          } catch { canvasSnapshot = null; addToTerminal('[Visao] Snapshot erro'); }
        }

        const tryMoondream = async (): Promise<boolean> => {
          const snapToUse = canvasSnapshot;
          if (!snapToUse) { addToTerminal('[Visao] Moondream: sem snapshot, pulando'); return false; }

          // Reduz a imagem para JPEG pequeno antes de enviar ao Moondream (limite ~200KB)
          let compressedSnap = snapToUse;
          try {
            const img = new Image();
            await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = snapToUse; });
            const cvs = document.createElement('canvas');
            const maxDim = 512;
            const scale = Math.min(1, maxDim / Math.max(img.width || 512, img.height || 512));
            cvs.width = Math.round((img.width || 512) * scale);
            cvs.height = Math.round((img.height || 512) * scale);
            const ctx = cvs.getContext('2d')!;
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
            compressedSnap = cvs.toDataURL('image/jpeg', 0.6);
          } catch { compressedSnap = snapToUse; }

          addToTerminal(`[Visao] Enviando para Moondream (${moondreamModel}, ${Math.round(compressedSnap.length/1024)}KB)...`);
          try {
            const res = await Promise.race([
              (window as any).electronAPI.describeImage(compressedSnap, moondreamModel),
              new Promise<null>(r => setTimeout(() => r(null), 10000))
            ]);
            if (res?.success && res.description) {
              canvasDescription = res.description;
              canvasSnapshot = null;
              addToTerminal(`[Visao] Moondream: ${res.description.slice(0, 120)}...`);
              return true;
            }
            addToTerminal(`[Visao] Moondream falhou: ${res?.error || 'sem descricao'}`);
          } catch (e: any) { addToTerminal(`[Visao] Moondream erro: ${e.message}`); }
          return false;
        };

        if (visionMode === 'moondream') {
          await tryMoondream();
          canvasSnapshot = null;
        } else if (visionMode === 'api') {
          // mantém snapshot para API
        } else if (visionMode === 'moondream-then-api') {
          const ok = await tryMoondream();
          if (ok) canvasSnapshot = null;
          // se falhou, snapshot vai para API
        } else if (visionMode === 'api-then-moondream') {
          // API primeiro, snapshot mantido
        }
      }

      const contextMessages: Message[] = [
        { role: 'system' as const, content: systemPromptWithActivity + creativeContext },
        // Exemplo few-shot adaptado ao modo ativo
        ...(isVideoMode ? [
          { role: 'user' as const, content: 'remover todo o áudio do vídeo' },
          { role: 'assistant' as const, content: 'Removendo o áudio de todos os clipes (mutando tudo)!\n```video-action:mute\n{"clipId": "all"}\n```\nPronto! Ãudio de todo o vídeo removido.' },
          { role: 'user' as const, content: 'coloca saturação no terceiro clipe' },
          { role: 'assistant' as const, content: 'Ajustando a saturação especificamente no terceiro clipe!\n```video-action:set-saturation\n{"clipId": 3, "value": 150}\n```\nPronto! Saturação aumentada no terceiro clipe.' },
          { role: 'user' as const, content: 'Crie uma imagem de um cachorro' },
          { role: 'assistant' as const, content: 'Gerando a imagem!\n```video-action:generate-image\n{"prompt": "um cachorro"}\n```\nPronto!' },
          { role: 'user' as const, content: 'edita esse video no estilo shorts' },
          { role: 'assistant' as const, content: 'Iniciando fluxo completo de edição para Shorts!\n```video-action:make-shorts\n{}\n```\nTudo pronto! A IA já ajustou a tela e está cortando e legendando.' }
        ] : isPhotoMode ? [
          { role: 'user' as const, content: 'adiciona um texto escrito Olá Mundo' },
          { role: 'assistant' as const, content: 'Adicionando o texto "Olá Mundo" no centro do canvas!\n```photo-action:add-text\n{"text": "Olá Mundo"}\n```\nPronto! Texto adicionado.' },
          { role: 'user' as const, content: 'mude a cor de fundo para preto' },
          { role: 'assistant' as const, content: 'Alterando a cor de fundo do canvas para preto!\n```photo-action:set-background\n{"color": "#000000"}\n```\nFundo atualizado para preto.' },
          { role: 'user' as const, content: 'aplica o rascunho' },
          { role: 'assistant' as const, content: 'Analisando o esboço e aplicando no canvas principal!\n```photo-action:apply-from-draft\n{}\n```\n```photo-action:set-background\n{"color": "#1a1a2e"}\n```\n```photo-action:update-element\n{"elementId": "el-123", "x": 100, "y": 200, "w": 400, "h": 300}\n```\nPronto! Layout aplicado conforme o rascunho.' },
          { role: 'user' as const, content: 'aplica o rascunho (rascunho mostra: tirar fundo da imagem)' },
          { role: 'assistant' as const, content: 'Aplicando o rascunho â€” removendo fundo da imagem!\n```photo-action:remove-background\n{"elementId": "ID_DA_IMAGEM_DO_CANVAS"}\n```\nFundo sendo removido!' }
        ] : isWebMode ? [
          { role: 'user' as const, content: 'toca bohemian rhapsody' },
          { role: 'assistant' as const, content: '```web-action:youtube-play\n{"query": "bohemian rhapsody queen"}\n```' },
          { role: 'user' as const, content: 'valeu!' },
          { role: 'assistant' as const, content: 'De nada! 😊' },
          { role: 'user' as const, content: 'quando é o jogo da frança?' },
          { role: 'assistant' as const, content: '```web-action:research\n{"query": "França próximo jogo Copa do Mundo 2026 horário data"}\n```' },
          { role: 'user' as const, content: 'muito obrigado' },
          { role: 'assistant' as const, content: 'Por nada! 🚀' },
        ] : isPaintMode ? [
          { role: 'user' as const, content: 'busca referÃªncia de mão segurando espada' },
          { role: 'assistant' as const, content: 'Buscando agora!\n```paint-action:search-and-add-reference\n{"query": "hand holding sword anime", "opacity": 50}\n```\nReferÃªncia adicionada com 50% de opacidade â€” pinte por cima.' },
          { role: 'user' as const, content: 'ver meu desenho' },
          { role: 'assistant' as const, content: 'Vi um esboço de personagem com chamas ao redor. A intensidade das chamas está boa â€” quer que eu busque referÃªncia de fogo para refinar?' },
          { role: 'user' as const, content: 'o que acha melhor eu desenhar pra melhorar?' },
          { role: 'assistant' as const, content: 'Com base no que vi: as proporçÃµes do tronco poderiam ser mais alongadas, e as chamas precisam de mais variação de tamanho. Quer que eu gere uma referÃªncia de anatomia de personagem jovem para comparar?' },
        ] : [
          { role: 'user' as const, content: 'Crie um arquivo ola.py que imprime olá' },
          { role: 'assistant' as const, content: 'Criando agora.\n```file:ola.py\nprint("Olá, Mateus!")\n```\n```command\npython ola.py\n```' }
        ]),
        ...history,
        // Injeta descrição visual do canvas (Moondream) ou screenshot (API com visão)
        ...(canvasDescription ? [{
          role: 'user' as const,
          content: isPaintMode
            ? `O QUE ESTÃ DESENHADO NO CANVAS AGORA (análise visual real por IA de visão): ${canvasDescription}\n\nUse essa descrição para comentar sobre o desenho, dar feedback, sugerir melhorias ou responder perguntas sobre o que foi desenhado.`
            : `O QUE ESTA NO CANVAS AGORA (analise visual real feita por IA de visao): ${canvasDescription}\n\nUse isso em conjunto com as coordenadas dos elementos para editar com precisao. Se o usuario perguntar "o que tem no canvas" ou "o que voce ve", responda com base nessa descricao visual, nao com dados tecnicos.`,
        }] : []),
        // Se tem descrição do Moondream (imagem anexada), injeta como contexto
        ...(moondreamDescription ? [{
          role: 'system' as const,
          content: `[CONTEXTO DA IMAGEM ANEXADA PELO USUÁRIO]\n${moondreamDescription}\n\nO usuário anexou uma imagem. A descrição acima foi gerada automaticamente para você entender o conteúdo visual. Use essa informação para responder à pergunta do usuário sobre a imagem.`
        }] : []),
        ...(draftVision ? [({
          role: 'user' as const,
          content: draftVision.imageDataUrl
            ? [
                { type: 'text', text: draftVision.text },
                { type: 'image_url', image_url: { url: draftVision.imageDataUrl, detail: 'high' } },
                ...(canvasSnapshot ? [{ type: 'image_url', image_url: { url: canvasSnapshot, detail: 'low' } }] : []),
              ]
            : draftVision.text, // sem imagem â€” só texto (evita erro em APIs sem visão)
        } as Message)] : canvasSnapshot ? [({
          role: 'user' as const,
          content: [
            { type: 'text', text: 'Estado visual atual do canvas:' },
            { type: 'image_url', image_url: { url: canvasSnapshot, detail: 'low' } },
          ],
        } as Message)] : []),
        { role: 'user' as const, content: apiMessageContent || finalMessage },
      ];

      const contentToLog = apiMessageContent || finalMessage;
      console.log('[contextMessages] Última mensagem user content:', typeof contentToLog === 'string' ? contentToLog.substring(0, 200) : '[array com imagem]');
      
      // Se tem arquivo de texto, a última mensagem do history tem só o texto da UI
      // Precisamos garantir que apiMessages use o conteúdo completo (com arquivo)
      const apiMessages = contextMessages.map((msg, idx) => {
        if (idx === contextMessages.length - 1 && msg.role === 'user' && fileTextContent) {
          // Última mensagem user e tem arquivo - usa apiMessageContent
          return { ...msg, content: apiMessageContent };
        }
        return msg;
      }) as any[];

      // A mensagem do usuário já está correta no userMessage acima (com imagem se houver)
      // Para modo custom com Moondream, substitui array por texto simples
      if (moondreamDescription && Array.isArray((userMessage as any).content)) {
        contextMessages[contextMessages.length - 1] = {
          role: 'user' as const,
          content: finalMessage
        } as Message;
      } else {
        contextMessages[contextMessages.length - 1] = userMessage as any;
      }
      
      console.log('[handleSendMessage] 🟢 PONTO 10: Contexto de mensagens construído, total:', contextMessages.length);

      // DEBUG: Log das últimas 2 mensagens para ver formato
      if (imageBase64 || moondreamDescription) {
        console.log('[handleSendMessage] DEBUG - Últimas 5 mensagens do contexto:');
        console.log('[handleSendMessage]', JSON.stringify(contextMessages.slice(-5), null, 2));
        console.log('[handleSendMessage] DEBUG - Total de mensagens:', contextMessages.length);
      }

      // DEBUG: Log o system prompt para web
      if (isWebMode) {
        console.log('=== SYSTEM PROMPT WEB ===');
        console.log(systemPromptWithActivity.substring(0, 500));
        console.log('=== FIM SYSTEM PROMPT ===');
        addToTerminal(`[DEBUG] System prompt tem ${systemPromptWithActivity.length} caracteres`);
      }

      // apiMessages já foi definido após contextMessages (com tratamento de arquivo)
      // const apiMessages = contextMessages as any[]; // REMOVIDO - já definido acima

      // DEBUG: Ver a última mensagem do usuário
      const lastUserMsg = apiMessages.filter(m => m.role === 'user').pop();
      if (isWebMode) {
        const contentPreview = typeof lastUserMsg?.content === 'string' 
          ? lastUserMsg.content.substring(0, 100)
          : Array.isArray(lastUserMsg?.content)
            ? (lastUserMsg.content.find((c: any) => c.type === 'text')?.text?.substring(0, 100) || '[imagem]')
            : '[vazio]';
        addToTerminal(`[DEBUG] Última mensagem do usuário: "${contentPreview}"`);
      }

      let fullResponse = '';

      const finalize = async (response: string) => {
        if (!isMyCurrent()) { return; } // stream antigo ou cancelado
        if (!response.trim()) {
          if (setCurrentMessages) {
            setCurrentMessages(prev => { const msgs = [...prev]; msgs[msgs.length-1] = { ...msgs[msgs.length-1], content: '(sem resposta)' }; return msgs; });
          }
          setIsStreaming(false); 
          
          // Limpa streaming do modelo
          if (activeChatId) {
            setStreamingModels(prev => {
              const updated = { ...prev };
              delete updated[activeChatId];
              return updated;
            });
          }
          
          // Se tem chat ativo, salva no localStorage
          // IMPORTANTE: Salva diretamente do Map de buffers
          // NÃO salva se skipHistorySave estiver ativo (durante chamadas de voz)
          if (activeChatId && !(window as any).skipHistorySave) {
            setTimeout(() => {
              let buffer = chatBuffersRef.current?.get(activeChatId) || [];
              if (buffer.length > 0) {
                // LIMPA TODO O BUFFER (mensagens antigas também)
                buffer = buffer.map(msg => {
                  const cleaned = { ...msg };
                  delete cleaned.image;
                  
                  // Remove avatares base64 (>500 chars = imagem)
                  if ((cleaned as any).modelAvatar && typeof (cleaned as any).modelAvatar === 'string') {
                    if ((cleaned as any).modelAvatar.length > 500 || (cleaned as any).modelAvatar.includes('data:image')) {
                      delete (cleaned as any).modelAvatar;
                    }
                  }
                  
                  if (Array.isArray(cleaned.content)) {
                    const textPart = cleaned.content.find((part: any) => part?.type === 'text');
                    cleaned.content = textPart?.text || '[imagem enviada]';
                  }
                  if (typeof cleaned.content === 'string' && cleaned.content.includes('data:image')) {
                    cleaned.content = '[imagem]';
                  }
                  return cleaned;
                });
                
                // Atualiza buffer
                chatBuffersRef.current?.set(activeChatId, buffer);
                
                const messagesToSave = buffer.slice(-50);
                const removedCount = buffer.length - messagesToSave.length;
                
                const jsonSize = JSON.stringify(messagesToSave).length;
                console.log('[Save sem resposta] Tamanho:', Math.round(jsonSize / 1024), 'KB');
                
                // Se muito grande (>3MB), salva menos
                if (jsonSize > 3 * 1024 * 1024) {
                  console.warn('[Save sem resposta] Muito grande, salvando 20');
                  try {
                    localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(messagesToSave.slice(-20)));
                    console.log('[Save sem resposta] Salvou 20 mensagens');
                    return;
                  } catch (e) {
                    console.error('[Save sem resposta] Falhou com 20:', e);
                  }
                }
                
                try {
                  localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(messagesToSave));
                  console.log('[handleSendMessage] Salvou mensagens (sem resposta) no localStorage:', activeChatId, 'total:', messagesToSave.length, 'removidas:', removedCount);
                  
                  // Se removeu mensagens antigas, precisa ajustar o lastSeenMessageIndex
                  if (removedCount > 0) {
                    localStorage.setItem('bill-chat-shift-' + activeChatId, String(removedCount));
                  }
                } catch (e: any) {
                  if (e.name === 'QuotaExceededError' || e.code === 22) {
                    console.error('[handleSendMessage] Quota excedida (sem resposta)! Salvando apenas últimas 20 mensagens:', activeChatId);
                    try {
                      const reducedMessages = messagesToSave.slice(-20);
                      localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(reducedMessages));
                      console.log('[handleSendMessage] Salvou versão reduzida:', reducedMessages.length, 'mensagens');
                    } catch (e2) {
                      console.error('[handleSendMessage] ERRO: Ainda quota, salvando 5:', e2);
                      try {
                        const miniMessages = messagesToSave.slice(-5);
                        localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(miniMessages));
                      } catch (e3) {
                        console.error('[handleSendMessage] CRÍTICO: limpando chat:', e3);
                        localStorage.removeItem(`bill-chat-${activeChatId}`);
                      }
                    }
                  } else {
                    console.error('[handleSendMessage] Erro ao salvar no localStorage:', e);
                  }
                }
              }
            }, 100);
          } else if (activeChatId && (window as any).skipHistorySave) {
            console.log('[handleSendMessage] Pulando salvamento (sem resposta) no localStorage (chamada de voz ativa)');
          }
          return;
        }
        if (setCurrentMessages) {
          setCurrentMessages(prev => { const msgs = [...prev]; msgs[msgs.length-1] = { ...msgs[msgs.length-1], content: response }; return msgs; });
        }
        
        // ── SALVA NO LOCALSTORAGE DO CHAT ESPECÍFICO ──────────────────────────
        // IMPORTANTE: Salva do Map de buffers
        // NÃO salva se skipHistorySave estiver ativo (durante chamadas de voz)
        if (activeChatId && !(window as any).skipHistorySave) {
          setTimeout(() => {
            let buffer = chatBuffersRef.current?.get(activeChatId) || [];
            if (buffer.length > 0) {
              // LIMPA TODO O BUFFER ANTES (remove base64 de mensagens antigas também)
              buffer = buffer.map(msg => {
                const cleaned = { ...msg };
                delete cleaned.image;
                
                // Remove avatares base64 (>500 chars = imagem)
                if ((cleaned as any).modelAvatar && typeof (cleaned as any).modelAvatar === 'string') {
                  if ((cleaned as any).modelAvatar.length > 500 || (cleaned as any).modelAvatar.includes('data:image')) {
                    delete (cleaned as any).modelAvatar;
                  }
                }
                
                if (Array.isArray(cleaned.content)) {
                  const textPart = cleaned.content.find((part: any) => part?.type === 'text');
                  cleaned.content = textPart?.text || '[imagem enviada]';
                }
                if (typeof cleaned.content === 'string' && cleaned.content.includes('data:image')) {
                  cleaned.content = '[imagem]';
                }
                return cleaned;
              });
              
              // Atualiza o buffer limpo E LIMITA A 20
              const limitedBuffer = buffer.slice(-20);
              chatBuffersRef.current?.set(activeChatId, limitedBuffer);
              
              const messagesToSave = limitedBuffer; // Já está limitado a 20
              const removedCount = buffer.length - messagesToSave.length;
              
              // DEBUG: Verifica tamanho
              const jsonSize = JSON.stringify(messagesToSave).length;
              console.log('[Save] Tentando salvar', messagesToSave.length, 'mensagens (máx 20), tamanho JSON:', Math.round(jsonSize / 1024), 'KB');
              
              try {
                localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(messagesToSave));
                console.log('[handleSendMessage] Salvou mensagens no localStorage:', activeChatId, 'total:', messagesToSave.length, 'removidas:', removedCount);
                
                // Se removeu mensagens antigas, precisa ajustar o lastSeenMessageIndex
                if (removedCount > 0) {
                  localStorage.setItem('bill-chat-shift-' + activeChatId, String(removedCount));
                }
              } catch (e: any) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                  console.error('[handleSendMessage] Quota excedida! Salvando apenas últimas 20 mensagens:', activeChatId);
                  try {
                    const reducedMessages = messagesToSave.slice(-20);
                    localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(reducedMessages));
                    console.log('[handleSendMessage] Salvou versão reduzida:', reducedMessages.length, 'mensagens');
                  } catch (e2) {
                    console.error('[handleSendMessage] ERRO: Ainda quota excedida, salvando últimas 5:', e2);
                    try {
                      const miniMessages = messagesToSave.slice(-5);
                      localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(miniMessages));
                      console.log('[handleSendMessage] Salvou apenas 5 mensagens');
                    } catch (e3) {
                      console.error('[handleSendMessage] CRÍTICO: localStorage completamente cheio, limpando chat:', e3);
                      localStorage.removeItem(`bill-chat-${activeChatId}`);
                    }
                  }
                } else {
                  console.error('[handleSendMessage] Erro ao salvar no localStorage:', e);
                }
              }
            } else {
              console.log('[handleSendMessage] AVISO: Buffer está vazio, não salvando');
            }
          }, 100);
        } else if (activeChatId && (window as any).skipHistorySave) {
          console.log('[handleSendMessage] Pulando salvamento no localStorage (chamada de voz ativa)');
        }
        
        setIsStreaming(false);
        
        // Limpa streaming do modelo
        if (activeChatId) {
          console.log('[Streaming] Limpando modelo:', activeChatId);
          setStreamingModels(prev => {
            const updated = { ...prev };
            delete updated[activeChatId];
            console.log('[Streaming] Estado após limpar:', updated);
            return updated;
          });
        }
        
        // Marca como não lida se estiver minimizado
        if (gamingMiniRef.current) {
          setHasUnreadMessages(true);
          console.log('[Notification] Marcando mensagem como não lida - app minimizado');
        }
        
        // Notifica conclusão nos cards do Home e finaliza barra de tokens
        const charCount = response.length;
        const estTokens = Math.round(charCount / 4);
        lastStreamingTokensRef.current = estTokens;
        // Finaliza a barra de tokens com o valor real
        setTokenBars(prev => {
          const updated = [...prev];
          let lastIdx = -1;
          for (let i = updated.length - 1; i >= 0; i--) { if (updated[i].growing) { lastIdx = i; break; } }
          if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], tokens: estTokens, growing: false };
          return updated;
        });
        if (effectiveView === 'code') addTerminal(`âœ… Resposta pronta (~${estTokens > 999 ? (estTokens/1000).toFixed(1)+'k' : estTokens} tokens)`);
        else if (effectiveView === 'video') addTerminal(`[Bill Video] âœ… Resposta pronta`);
        else if (effectiveView === 'photo') addTerminal(`[Bill Photo] âœ… Resposta pronta`);
        else if (effectiveView === 'paint') addTerminal(`[Bill Paint] âœ… Resposta pronta`);
        else if (effectiveView === 'web') addTerminal(`[Bill Web] âœ… Resposta pronta`);
        // Ecoa resposta da IA de volta no terminal quando chamado via terminal agent
        // Não ecoa se for um research (o research vai ecoar a resposta real depois)
        if (terminalAgentRef.current && !response.includes('web-action:research')) {
          const agentLabel = terminalAgentRef.current.toUpperCase();
          // Remove blocos de código e markdown, mantém o texto completo
          const clean = response
            .replace(/```[\s\S]*?```/g, '[ação executada]')
            .replace(/[*_#~`>|]/g, '')
            .trim();
          // Adiciona cada linha separadamente para o terminal exibir corretamente
          const lines = clean.split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 0) {
            addTerminal(`[${agentLabel} IA] ${lines[0]}`);
            lines.slice(1).forEach(l => addTerminal(`  ${l}`));
          }
        }
        if (isVideoMode) parseAndExecuteVideoActions(response);
        if (isPaintMode) parseAndExecutePaintActions(response);
        if (isPhotoMode) {
          parseAndExecutePhotoActions(response, draftVisionTextForParse);

          // Loop de verificação: após aplicar, tira snapshot e usa Moondream pra verificar
          if (draftVision && photoEditorRef.current) {
            const visionMode = settingsRef.current.visionMode ?? 'disabled';
            const moondreamModel = settingsRef.current.moondreamModel || 'moondream';
            const useMoondream = visionMode === 'moondream' || visionMode === 'moondream-then-api';

            if (useMoondream) {
              setTimeout(async () => {
                try {
                  // 1. Tira snapshot do canvas após a IA aplicar
                  const verifySnapshot = await Promise.race([
                    photoEditorRef.current?.getCanvasSnapshot?.() ?? Promise.resolve(null),
                    new Promise<null>(r => setTimeout(() => r(null), 4000))
                  ]);
                  if (!verifySnapshot) return;

                  // 2. Manda pro Moondream descrever o resultado
                  const verifyResult = await Promise.race([
                    (window as any).electronAPI.describeImage(verifySnapshot, moondreamModel),
                    new Promise<null>(r => setTimeout(() => r(null), 8000))
                  ]);
                  if (!verifyResult?.success || !verifyResult.description) return;

                  const verifyDesc = verifyResult.description;
                  addToTerminal(`[Bill Photo] Verificação visual: ${verifyDesc}`);

                  // 3. Manda pra API corrigir se necessário
                  const originalNotes = draftVision.text;
                  const correctionPrompt = `VocÃª acabou de aplicar açÃµes no canvas. Aqui está o que a IA de visão vÃª AGORA no canvas:\n"${verifyDesc}"\n\nAqui estavam as instruçÃµes originais:\n${originalNotes}\n\nCompare o resultado com as instruçÃµes. Se algum elemento está na posição ERRADA (ex: deveria estar na esquerda mas está na direita), corrija agora usando photo-action:update-element. Se está correto, responda apenas "OK".`;

                  // Chama a API para verificar e corrigir
                  setIsStreaming(true);
                  const correctionMessages = [
                    { role: 'system' as const, content: buildPhotoSystemPrompt() },
                    { role: 'user' as const, content: correctionPrompt },
                  ];

                  // Usa a mesma API configurada
                  let correctionResponse = '';
                  // Reutiliza a lógica de streaming já existente â€” simplificado via fetch direto
                  const apiProvider = settingsRef.current.apiProvider;
                  try {
                    if (apiProvider === 'openrouter') {
                      const res = await (window as any).electronAPI.openrouterStream(
                        correctionMessages,
                        settingsRef.current.openrouterModel || '',
                        settingsRef.current.openrouterApiKey || '',
                        settingsRef.current.openrouterUrl
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    } else if (apiProvider === 'gemini') {
                      const res = await (window as any).electronAPI.geminiStream(
                        correctionMessages,
                        settingsRef.current.geminiModel || 'gemini-2.0-flash',
                        settingsRef.current.geminiApiKey || ''
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    } else if (apiProvider === 'openai') {
                      const res = await (window as any).electronAPI.openaiStream(
                        correctionMessages,
                        settingsRef.current.openaiModel || 'gpt-4o',
                        settingsRef.current.openaiApiKey || '',
                        settingsRef.current.openaiUrl
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    } else if (apiProvider === 'anthropic') {
                      const res = await (window as any).electronAPI.anthropicStream(
                        correctionMessages,
                        settingsRef.current.anthropicModel || '',
                        settingsRef.current.anthropicApiKey || ''
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    } else if (apiProvider === 'ollama') {
                      const res = await (window as any).electronAPI.ollamaStream(
                        correctionMessages,
                        settingsRef.current.ollamaModel || ''
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    } else if (apiProvider === 'custom') {
                      const res = await (window as any).electronAPI.openaiStream(
                        correctionMessages,
                        settingsRef.current.customModel || '',
                        settingsRef.current.customApiKey || '',
                        settingsRef.current.customBaseUrl
                      );
                      correctionResponse = res?.response?.message?.content || '';
                    }
                  } catch {}

                  if (correctionResponse && correctionResponse.trim() !== 'OK') {
                    addToTerminal(`[Bill Photo] Corrigindo posicionamento...`);
                    parseAndExecutePhotoActions(correctionResponse, '');
                  }
                } catch (e) {
                  // Falha silenciosa â€” não bloqueia
                } finally {
                  setIsStreaming(false);
                }
              }, 500);
            }
          }
        }
        // Pesquisa funciona em qualquer aba
        // PESQUISA WEB UNIVERSAL - Funciona em todas as abas/chats
        const currentMessagesBase = isVideoMode ? videoChatMessages : (isPhotoMode ? photoChatMessages : (isPaintMode ? paintChatMessages : (isWebMode ? webChatMessages : (isHomeMode ? homeChatMessages : chatMessages))));
        
        // Busca mensagens do chat ativo (do BUFFER em memória, não do localStorage)
        let messagesForResearch = currentMessagesBase;
        if (activeChatId && chatBuffersRef.current?.has(activeChatId)) {
          messagesForResearch = chatBuffersRef.current.get(activeChatId) || [];
          console.log('[Research] Usando buffer em memória:', messagesForResearch.length, 'mensagens');
        } else if (activeChatId) {
          const saved = localStorage.getItem(`bill-chat-${activeChatId}`);
          console.log('[Research] Buffer não existe, tentando localStorage:', saved ? 'encontrado' : 'não encontrado');
          if (saved) {
            try {
              messagesForResearch = JSON.parse(saved);
              console.log('[Research] Mensagens carregadas do localStorage:', messagesForResearch.length);
            } catch {}
          }
        }
        
        console.log('[Research] messagesForResearch length:', messagesForResearch.length);
        
        response = await processResearchIfNeeded(response, {
          messages: messagesForResearch,
          setMessages: (updater: any) => {
            console.log('[Research] setMessages chamado, activeChatId:', activeChatId);
            if (activeChatId && chatBuffersRef.current) {
              // Atualiza o buffer em memória E LIMITA A 20
              const current = chatBuffersRef.current.get(activeChatId) || [];
              const newMsgs = typeof updater === 'function' ? updater(current) : updater;
              const limited = newMsgs.slice(-20); // Limita a 20 mensagens
              console.log('[Research] Atualizando buffer:', limited.length, 'mensagens (máx 20), última:', limited[limited.length - 1]?.content?.substring(0, 50));
              chatBuffersRef.current.set(activeChatId, limited);
              
              // Salva no localStorage (já limitado a 20)
              try {
                localStorage.setItem(`bill-chat-${activeChatId}`, JSON.stringify(limited));
                
                // Dispara evento customizado para Chat recarregar
                window.dispatchEvent(new CustomEvent('bill-chat-updated', { 
                  detail: { chatId: activeChatId, messages: limited }
                }));
                console.log('[Research] Evento bill-chat-updated disparado');
              } catch (e) {
                console.error('[Research] Erro ao salvar no localStorage:', e);
              }
              
              // Atualiza estado React (FORÇANDO novo objeto)
              setContactChatMessages(prev => {
                const updated = { ...prev, [activeChatId]: [...limited] };
                console.log('[Research] contactChatMessages atualizado, chaves:', Object.keys(updated));
                console.log('[Research] Mensagens no chat', activeChatId, ':', updated[activeChatId]?.length);
                return updated;
              });
              
              setContactChatVersion(v => {
                const newVersion = v + 1;
                console.log('[Research] Incrementando chatMessagesVersion de', v, 'para', newVersion);
                return newVersion;
              }); // Incrementa versão para forçar re-render
            } else {
              // Atualiza currentMessages quando NÃO tem chat ativo
              setCurrentMessages(updater);
            }
          },
          chatId: activeChatId || null,
          systemPrompt,
          settings: settingsRef.current,
          effectiveView
        });
        
        // Atualiza a última mensagem com a resposta final da pesquisa
        if (setCurrentMessages) {
          setCurrentMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], content: response };
            }
            return updated;
          });
        }
        
        // OUTRAS WEB ACTIONS (navigate, youtube, etc)
        if (isWebMode) {
          parseAndExecuteWebActions(response, activeChatId || null, setCurrentMessages);
          webPageContentRef.current = '';
        }
        await parseAndExecuteAIActions(response);

        // â”€â”€ TTS: fala a resposta se voiceVolume > 0 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Se estiver em chamada, usa o volume da chamada; senão usa das configurações
        const vol = callVolumeRef.current !== null ? callVolumeRef.current : (settingsRef.current.voiceVolume ?? 100);

        if (vol > 0) {
          // Remove blocos de código, açÃµes e markdown antes de falar
          const textoFala = response
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/[*_#~`>|]/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
            .replace(/[\u{2300}-\u{23FF}]/gu, '')
            .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, 400);

          if (textoFala.length > 3) {
            // Usa a voz específica do modelo, ou fallback para voz das configurações, ou 'faber'
            const voiceToUse = modelVoice || settingsRef.current.providerVoice || 'faber';
            
            console.log('[TTS] =====================================');
            console.log('[TTS] Modelo:', modelName || 'desconhecido');
            console.log('[TTS] activeChatId:', activeChatId || 'nenhum');
            console.log('[TTS] modelVoice capturado:', modelVoice);
            console.log('[TTS] settingsRef.providerVoice:', settingsRef.current.providerVoice);
            console.log('[TTS] VOZ FINAL:', voiceToUse);
            console.log('[TTS] Texto:', textoFala.substring(0, 50) + '...');
            console.log('[TTS] =====================================');
            
            window.electronAPI.generateTTS({ text: textoFala, voice: voiceToUse })
              .then(result => {
                if (result.success && result.path) {
                  const audio = new Audio(`file:///${result.path.replace(/\\/g, '/')}`);
                  audio.volume = vol / 100;
                  audio.play().catch(() => {});
                }
              })
              .catch(() => {});
          }
        }
      };

      try {
        console.log('[handleSendMessage] 🟢 PONTO 11: Entrando no try/switch, provider:', targetSettings.apiProvider);
        const s = targetSettings;
        switch (s.apiProvider) {
          case 'ollama': {
            if (!s.ollamaModel) {
              await finalize('Nenhum modelo Ollama selecionado. Abra as configuraçÃµes e escolha um modelo, ou clique no botão de atualizar modelos.');
              break;
            }
            const unsubChunk = window.electronAPI.onOllamaChunk((chunk) => {
              if (!isMyCurrent()) return;
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            const result = await window.electronAPI.ollamaStream(apiMessages, targetSettings.ollamaModel);
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          case 'gemini': {
            const unsubChunk = window.electronAPI.onGeminiChunk((chunk) => {
              if (!isMyCurrent()) return;
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            const result = await window.electronAPI.geminiStream(apiMessages, targetSettings.geminiModel || 'gemini-2.0-flash', targetSettings.geminiApiKey || '');
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          case 'openrouter': {
            console.log('[handleSendMessage] 🟢 PONTO 12: Dentro do case openrouter');
            const unsubChunk = window.electronAPI.onOpenRouterChunk((chunk) => {
              if (!isMyCurrent()) return;
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            console.log('[handleSendMessage] 🟢 PONTO 13: Registrou onOpenRouterChunk, vai chamar openrouterStream');
            console.log('[handleSendMessage] apiMessages length:', apiMessages.length);
            console.log('[handleSendMessage] model:', targetSettings.openrouterModel);
            console.log('[handleSendMessage] hasApiKey:', !!targetSettings.openrouterApiKey);
            const result = await window.electronAPI.openrouterStream(apiMessages, targetSettings.openrouterModel || '', targetSettings.openrouterApiKey || '', targetSettings.openrouterUrl);
            console.log('[handleSendMessage] 🟢 PONTO 14: openrouterStream retornou, result:', result);
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          case 'anthropic': {
            const unsubChunk = window.electronAPI.onAnthropicChunk((chunk) => {
              if (!isMyCurrent()) return;
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            const result = await window.electronAPI.anthropicStream(apiMessages, targetSettings.anthropicModel || 'claude-sonnet-4-20250514', targetSettings.anthropicApiKey || '');
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          case 'openai': {
            const unsubChunk = window.electronAPI.onOpenAIChunk((chunk) => {
              if (!isMyCurrent()) return;
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            const result = await window.electronAPI.openaiStream(apiMessages, targetSettings.openaiModel || 'gpt-4o', targetSettings.openaiApiKey || '');
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          case 'custom': {
            console.log('[STREAM] Iniciando custom stream - model:', targetSettings.customModel, 'baseUrl:', targetSettings.customBaseUrl);
            console.log('[STREAM] streamIdRef.current:', streamIdRef.current, 'myCancelVersion:', myCancelVersion);
            const unsubChunk = window.electronAPI.onOpenAIChunk((chunk) => {
              console.log('[STREAM] Chunk recebido, isMyCurrent():', isMyCurrent(), 'chunk:', chunk.substring(0, 50));
              if (!isMyCurrent()) {
                console.log('[STREAM] IGNORADO - não é o stream atual');
                return;
              }
              console.log('[STREAM] PROCESSANDO chunk:', chunk.length, 'chars');
              fullResponse += chunk;
              const toks = Math.round(fullResponse.length / 4); setStreamingTokens(toks); lastStreamingTokensRef.current = toks; setTokenBars(prev => { const u = [...prev]; let li = -1; for (let i = u.length-1; i>=0; i--) { if (u[i].growing) { li=i; break; } } if (li>=0) u[li]={...u[li],tokens:toks}; return u; });
              setCurrentMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length-1], content: fullResponse }]);
            });
            unsubStreamRef.current = unsubChunk;
            const result = await window.electronAPI.openaiStream(apiMessages, targetSettings.customModel || '', targetSettings.customApiKey || '', targetSettings.customBaseUrl || '');
            console.log('[STREAM] Stream finalizado, fullResponse length:', fullResponse.length);
            unsubChunk(); unsubStreamRef.current = null;
            await finalize((result as any)?.response?.message?.content || fullResponse);
            break;
          }
          default:
            await finalize('Provider não suportado.');
        }
      } catch (err: any) {
        await finalize(`Erro ao conectar com o modelo: ${err.message}`);
      }
      return;
    }

    // â”€â”€ MODO BILL (home/web/etc): Vai pelo Python como sempre â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DESABILITADO: window.electronAPI.processWithBill(message);
  };

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  // â”€â”€ Terminal manual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExecuteCommand = async (command: string) => {
    addTerminal(`$ ${command}`);
    const result = await window.electronAPI.executeCommand(command, settings.workFolder);
    if (result.output) addTerminal(result.output);
    if (result.error) addTerminal(`Erro: ${result.error}`);
  };

  // â”€â”€ Envio de mensagem via Terminal Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSendAgentMessage = (agent: string, message: string) => {
    // Ecoa a mensagem do usuário no terminal
    addTerminal(`[${agent.toUpperCase()}] você: ${message}`);
    // Chama handleSendMessage com o terminalAgentRef já setado
    terminalAgentRef.current = agent;
    handleSendMessage(message, agent);
  };

  const handleClearTerminal = () => setTerminalOutput([]);

  useEffect(() => {
    if (gamingMode) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    } else {
      document.documentElement.style.background = 'var(--bg-primary)';
      document.body.style.background = 'var(--bg-primary)';
    }
  }, [gamingMode]);

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className={gamingMini ? `theme-${settings.theme} gaming-mini-mode` : `app-container theme-${settings.theme}`} style={gamingMini ? { width: '100vw', height: '100vh' } : {}}>
      {/* Transition Overlay */}
      {isTransitioning && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 15, 15, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h2 style={{ letterSpacing: '2px', fontWeight: 'normal', fontSize: '16px' }}>
            {transitionMessage}
          </h2>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      )}

      {/* Screenshot Editor Modal */}
      {screenshotEditorData && (
        <ScreenshotEditor
          base64={screenshotEditorData.base64}
          onClose={() => setScreenshotEditorData(null)}
        />
      )}

      {/* Menu Bar */}
      <div className={`menu-bar${gamingMode ? ' gaming-hidden' : ''}`}>
        {/* Logo */}
        <img
          src="./logo oficial.png"
          alt="logo"
          style={{ height: '22px', width: '22px', objectFit: 'contain', marginRight: '8px', flexShrink: 0, WebkitAppRegion: 'no-drag' } as any}
        />
        <div className="menu-items">
          {[
            { id: 'home', label: 'HOME' },
            { id: 'code', label: 'CODE' },
            { id: 'video', label: 'VIDEO' },
            { id: 'photo', label: 'DESIGN' },
            { id: 'web', label: 'WEB' },
            ...(installedPlugins.has('paint') ? [{ id: 'paint', label: 'PAINT' }] : []),
            { id: 'stories', label: 'STORE' },
          ].map(item => (
            <span 
              key={item.id}
              className={`menu-item ${activeMainView === item.id ? 'active' : ''}`}
              onClick={() => {
                if (item.id === activeMainView) return;
                setActiveMainView(item.id as any);
              }}
              style={{ 
                fontWeight: activeMainView === item.id ? 'bold' : 'normal',
                color: activeMainView === item.id ? 'var(--accent)' : 'var(--text-primary)',
                cursor: 'pointer',
                borderBottom: activeMainView === item.id
                  ? '2px solid var(--accent)'
                  : 'none',
                marginRight: '15px',
                fontSize: '11px',
                letterSpacing: '1px',
              }}
            >
              {item.label}
            </span>
          ))}
          {/* Botão Concluir Instalação ao lado da Store */}
          <button
            onClick={() => setShowDependencyInstaller(true)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#a855f7',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
              WebkitAppRegion: 'no-drag',
            } as any}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#c084fc';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#a855f7';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Concluir Instalação"
          >
            <Download size={14} />
          </button>
        </div>
        {/* Badge Versão Beta */}
        <div 
          onClick={() => setShowBetaModal(true)}
          style={{ 
            marginRight: '12px',
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid #d4af37',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#d4af37',
            letterSpacing: '0.3px',
            WebkitAppRegion: 'no-drag',
            cursor: 'pointer'
          } as any}>
          Versão Beta
        </div>
        {/* Botões de controle da janela */}
        <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}>
          {[
            { icon: <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.2"/></svg>, action: 'windowMinimize', hover: 'rgba(255,255,255,0.1)', hoverColor: '#888899' },
            { icon: <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>, action: 'windowMaximize', hover: 'rgba(255,255,255,0.1)', hoverColor: '#888899' },
            { icon: <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2"/></svg>, action: 'windowClose', hover: '#e81123', hoverColor: '#fff' },
          ].map((btn, i) => (
            <button key={i} onClick={() => (window as any).electronAPI?.[btn.action]?.()}
              style={{ width: 46, height: 30, background: 'transparent', border: 'none', color: '#888899', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = btn.hover; e.currentTarget.style.color = btn.hoverColor; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888899'; }}>
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
      {gamingMode ? (
        /* ── Gaming Mode ── */
        <div style={{ display: 'flex', flex: 1 }}>
          {gamingMini ? (
            <div
              onClick={() => {
                setGamingMini(false);
                document.documentElement.style.removeProperty('background');
                document.body.style.removeProperty('background');
                (window as any).electronAPI.setIgnoreMouseEvents(false);
                (window as any).electronAPI.gamingModeExpand({ 
                  screenW: window.screen.width, 
                  screenH: window.screen.height,
                  chatW: 380
                });
              }}
              style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as any}
            >
              <MouseAvatar size={48} noBorder={true} />
            </div>
          ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Notificação de Lembrete */}
            {reminderNotification && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 153, 0.95), rgba(16, 185, 129, 0.95))',
                border: '2px solid rgba(34, 197, 153, 0.6)',
                borderRadius: '12px',
                padding: '16px 20px',
                margin: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 32px rgba(34, 197, 153, 0.4)',
                animation: 'slideIn 0.3s ease-out',
                position: 'relative',
                zIndex: 1000,
              }}>
                <Bell size={24} color="white" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    🔔 Lembrete
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>
                    {reminderNotification.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
                    {reminderNotification.time}
                  </div>
                </div>
                <button
                  onClick={() => setReminderNotification(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            
            <Chat
              messages={activeMainView === 'video' ? videoChatMessages : (activeMainView === 'photo' ? photoChatMessages : (activeMainView === 'paint' ? paintChatMessages : (activeMainView === 'web' ? webChatMessages : (activeMainView === 'home' ? homeChatMessages : chatMessages))))}
              chatMessages={contactChatMessages}
              chatMessagesVersion={contactChatVersion}
              onSendMessage={handleSendMessage}
              onSendGroupMessage={handleSendGroupMessage}
              isStreaming={isStreaming}
              onCancelStream={cancelStream}
              settings={settings}
              onRefreshModels={loadOllamaModels}
              activeMainView={activeMainView}
              streamingTokens={streamingTokens}
              streamingMode={streamingMode}
              lastStreamingTokens={lastStreamingTokensRef.current}
              tokenBars={tokenBars}
              gamingMode={gamingMode}
              currentActivity={currentActivity}
              activeProject={activeProject}
              onSetActiveProject={setActiveProject}
              onSetActiveMainView={setActiveMainView}
              onActiveChatChange={(chatId) => {
                console.log('[App/NormalMode] activeChat mudou para:', chatId);
                activeChatRef.current = chatId;
              }}
              onLoadProjectById={loadProjectById}
              streamingModels={streamingModels}
              isModelStreaming={isModelStreaming}
              getStreamingModelName={getStreamingModelName}
              onUpdateSettings={setSettings}
              onGamingToggle={() => { setGamingMode(false); setGamingMini(false); (window as any).electronAPI.gamingModeExit(); }}
              onGamingMini={() => { 
                setGamingMini(true); 
                document.documentElement.style.setProperty('background', 'transparent', 'important');
                document.body.style.setProperty('background', 'transparent', 'important');
                (window as any).electronAPI.gamingModeMini({ screenW: window.screen.width, screenH: window.screen.height }); 
              }}
              pendingChanges={pendingChanges}
              onAcceptChange={acceptChange}
              onRejectChange={rejectChange}
              onClearMessages={() => {
                // Se tem chat ativo, limpa o localStorage também
                const currentActiveChat = activeChatRef.current;
                if (currentActiveChat) {
                  console.log('[App] Limpando mensagens do chat:', currentActiveChat);
                  localStorage.setItem(`bill-chat-${currentActiveChat}`, JSON.stringify([]));
                  // Limpa o buffer também
                  if (chatBuffersRef.current) {
                    chatBuffersRef.current.set(currentActiveChat, []);
                  }
                }
                
                // Limpa o estado React
                if (activeMainView === 'video') setVideoChatMessages([]);
                else if (activeMainView === 'photo') setPhotoChatMessages([]);
                else if (activeMainView === 'paint') setPaintChatMessages([]);
                else if (activeMainView === 'web') setWebChatMessages([]);
                else if (activeMainView === 'home') setHomeChatMessages([]);
                else setChatMessages([]);
              }}
            />
          </div>
          )}
        </div>
      ) : (
      <div className="main-content" style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar Container */}
        <div style={{
          width: (gamingMode || sidebarCollapsed) ? '0' : '260px',
          minWidth: (gamingMode || sidebarCollapsed) ? '0' : '260px',
          maxWidth: (gamingMode || sidebarCollapsed) ? '0' : '260px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: (!gamingMode && !sidebarCollapsed) ? '1px solid var(--border-light)' : 'none',
          position: 'relative',
          flexShrink: 0,
          zIndex: showCustomPanel ? 1 : 100, // Fica abaixo do CustomPanel quando ele está aberto
        }}>
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            files={files}
            workFolder={settings.workFolder}
            onSelectFolder={handleSelectFolder}
            onFileClick={handleFileClick}
            settings={settings}
            onSettingsChange={setSettings}
            activeMainView={activeMainView}
            onNeedRestart={() => setNeedsRestart(true)}
            onToggleDesignPreview={() => setShowDesignPreview(v => !v)}
            disableViewChange={showCustomPanel}
          />
        </div>

        {/* Toggle Sidebar Handle */}
        {!gamingMode && (
        <div 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            width: '12px',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRight: '1px solid var(--border-light)',
            zIndex: showCustomPanel ? 1 : 100, // Fica abaixo do CustomPanel quando ele está aberto
            transition: 'background 0.2s'
          }}
          className="panel-toggle-handle"
          title={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <div style={{ 
            width: '2px', 
            height: '30px', 
            background: 'var(--text-secondary)', 
            borderRadius: '2px',
            opacity: 0.5
          }} />
        </div>
        )}
        
        {/* CodeSidebar (apenas no Code editor) */}
        {activeMainView === 'code' && (
          <div style={{
            width: codeSidebarCollapsed ? '0' : '298px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <CodeSidebar
              files={files}
              workFolder={settings.workFolder}
              onFileClick={handleFileClick}
              settings={settings}
              onSettingsChange={setSettings}
              onToggleDesignPreview={() => setShowDesignPreview(v => !v)}
              showDesignPreview={showDesignPreview}
              selectedFile={selectedFile}
              fileContent={fileContent}
              selectedHtmlElement={selectedHtmlElement}
            />
          </div>
        )}
        
        {/* Toggle CodeSidebar Handle */}
        {activeMainView === 'code' && !gamingMode && (
          <div 
            onClick={() => setCodeSidebarCollapsed(!codeSidebarCollapsed)}
            style={{
              width: '12px',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRight: '1px solid var(--border-light)',
              zIndex: 100,
              transition: 'background 0.2s'
            }}
            className="panel-toggle-handle"
            title={codeSidebarCollapsed ? "Expandir Explorador" : "Recolher Explorador"}
          >
            <div style={{ 
              width: '2px', 
              height: '30px', 
              background: 'var(--text-secondary)', 
              borderRadius: '2px',
              opacity: 0.5
            }} />
          </div>
        )}
        
        {/* View Container */}
        <div className="view-container" style={{ flex: gamingMode ? 0 : 1, position: 'relative', background: 'var(--bg-primary)', overflow: 'hidden', display: gamingMode ? 'none' : 'block' }}>
          {/* Editor View - Sempre no DOM */}
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: activeMainView === 'code' ? 20 : 1,
            visibility: activeMainView === 'code' ? 'visible' : 'hidden',
            pointerEvents: activeMainView === 'code' ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            <Editor
              filePath={selectedFile}
              content={fileContent}
              onChange={handleFileChange}
              showDesignPreview={showDesignPreview}
              onToggleDesignPreview={setShowDesignPreview}
              onHtmlElementSelect={setSelectedHtmlElement}
              onReloadFile={async () => {
                // Recarrega o arquivo do disco para garantir que o preview veja o conteúdo atualizado
                console.log('[App] 🔵 onReloadFile chamado, arquivo:', selectedFile);
                if (selectedFile) {
                  const res = await window.electronAPI.readFile(selectedFile);
                  console.log('[App] 🔵 Resultado do readFile:', res.success, 'tamanho:', res.content?.length);
                  if (res.success && res.content !== undefined) {
                    setFileContent(res.content);
                    console.log('[App] ✅ Arquivo recarregado do disco');
                  } else {
                    console.error('[App] ❌ Erro ao recarregar:', res.error);
                  }
                } else {
                  console.warn('[App] ⚠️ selectedFile é null no reload');
                }
              }}
              onSendToAI={(msg) => {
                // Patches diretos via string replace
                if (msg.startsWith('__DIRECT_PATCHES__')) {
                  const jsonEnd = msg.indexOf('\n\n');
                  const jsonStr = msg.slice('__DIRECT_PATCHES__'.length, jsonEnd > 0 ? jsonEnd : undefined);
                  try {
                    const patches: Array<{ before: string; after: string }> = JSON.parse(jsonStr);
                    let newContent = fileContent;
                    let applied = 0;
                    patches.forEach(({ before, after }) => {
                      if (newContent.includes(before)) { newContent = newContent.replace(before, after); applied++; }
                    });
                    if (applied > 0) {
                      setFileContent(newContent);
                      if (selectedFile) window.electronAPI.writeFile(selectedFile, newContent);
                      addToTerminal(`âœ… ${applied} mudança(s) aplicada(s) diretamente no HTML`);
                    } else {
                      addToTerminal(`âš ï¸ Não foi possível encontrar os trechos`);
                    }
                  } catch { addToTerminal(`âŒ Erro ao processar patches`); }
                  return;
                }

                // Patches via DOMParser â€” usa seletor+índice, mais confiável
                if (msg.startsWith('__DOM_PATCHES__')) {
                  const jsonEnd = msg.indexOf('\n\n');
                  const jsonStr = msg.slice('__DOM_PATCHES__'.length, jsonEnd > 0 ? jsonEnd : undefined);
                  try {
                    const patches: Array<any> = JSON.parse(jsonStr);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(fileContent, 'text/html');
                    let applied = 0;
                    patches.forEach((p: any) => {
                      if (!p) return;
                      try {
                        const els = doc.querySelectorAll(p.selector);
                        const target = els[p.idx ?? 0] as HTMLElement | null;
                        if (!target) return;
                        if (p.type === 'style') {
                          // Aplica como style inline
                          let existing = target.getAttribute('style') || '';
                          // Remove propriedade existente se houver
                          existing = existing.replace(new RegExp(`${p.prop}\\s*:[^;]+;?`, 'g'), '').trim();
                          const newStyle = existing ? `${existing}; ${p.prop}: ${p.value}` : `${p.prop}: ${p.value}`;
                          target.setAttribute('style', newStyle);
                          applied++;
                        } else if (p.type === 'text') {
                          target.textContent = p.text;
                          applied++;
                        }
                      } catch {}
                    });
                    if (applied > 0) {
                      // Serializa o HTML de volta preservando o doctype
                      const ser = new XMLSerializer();
                      let newContent = '<!DOCTYPE html>\n' + ser.serializeToString(doc.documentElement);
                      // Fallback se XMLSerializer quebrar â€” usa innerHTML
                      if (!newContent.includes('<html')) {
                        newContent = `<!DOCTYPE html>\n<html>${doc.documentElement.innerHTML}</html>`;
                      }
                      setFileContent(newContent);
                      if (selectedFile) window.electronAPI.writeFile(selectedFile, newContent);
                      addToTerminal(`âœ… ${applied} mudança(s) aplicada(s) no HTML`);
                    } else {
                      addToTerminal(`âš ï¸ Nenhum elemento encontrado com os seletores fornecidos`);
                    }
                  } catch (e: any) { addToTerminal(`âŒ Erro ao processar patches DOM: ${e.message}`); }
                  return;
                }

                // Edição via IA com contexto do elemento selecionado
                if (msg.startsWith('__AI_EDIT__')) {
                  try {
                    const data = JSON.parse(msg.slice('__AI_EDIT__'.length));
                    const { fileName, selector, tag, elHtml, instruction } = data;
                    // Manda para a IA com o HTML do arquivo + elemento como contexto
                    const prompt =
                      `Arquivo: "${fileName}"\n` +
                      `Elemento selecionado: "${selector}" (${tag})\n` +
                      `Instrução: ${instruction}\n\n` +
                      `HTML atual do elemento:\n\`\`\`html\n${elHtml}\n\`\`\`\n\n` +
                      `Use file-patch com SEARCH/REPLACE para aplicar a mudança. Use o HTML do elemento acima como SEARCH exato. NÃƒO reescreva o arquivo inteiro.`;
                    activeMainViewRef.current = 'code';
                    setActiveMainView('code');
                    setTimeout(() => handleSendMessage(prompt), 0);
                  } catch { addToTerminal('âŒ Erro ao processar edição via IA'); }
                  return;
                }
                setActiveMainView('code');
                setTimeout(() => handleSendMessage(msg), 0);
              }}
            />
          </div>

          {/* Notícias View - Tela cheia */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: activeMainView === 'news' ? 25 : 1,
            visibility: activeMainView === 'news' ? 'visible' : 'hidden',
            pointerEvents: activeMainView === 'news' ? 'auto' : 'none',
            overflow: 'hidden',
            background: 'var(--bg-primary)'
          }}>
            <HomeNewsPanel 
              isFullScreen={true}
              onBack={() => {
                setActiveMainView('web');
                setShowWebMenu(true);
              }}
              onOpenUrl={(url) => {
                setActiveMainView('web');
                const newTabId = Date.now().toString();
                webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
                forceWebviewRender(n => n + 1);
                setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
                setActiveBrowserTabId(newTabId);
                activeBrowserTabIdRef.current = newTabId;
                setTimeout(() => {
                  const webview = document.getElementById(`webview-${newTabId}`) as any;
                  if (webview) { webview.focus(); webview.loadURL(url); }
                }, 300);
              }} 
            />
          </div>

          {/* Video Editor View */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: activeMainView === 'video' ? 25 : 1,
            visibility: activeMainView === 'video' ? 'visible' : 'hidden',
            pointerEvents: activeMainView === 'video' ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            <VideoEditor
              ref={videoEditorRef}
              onAddToTerminal={addToTerminal}
              onExecuteCommand={async (cmd) => {
                const res = await window.electronAPI.executeCommand(cmd, settings.workFolder);
                if (res.output) addToTerminal(res.output);
                return res;
              }}
              workFolder={settings.workFolder || 'C:\\Users\\Administrator\\Desktop\\testes'}
              leftOpen={!sidebarCollapsed}
              chatHistory={videoChatMessages}
              onUpdateChatHistory={setVideoChatMessages}
              onProjectAction={addProjectNote}
              activeProject={activeProject}
              onUpdatePreview={updateProjectPreview}
            />
          </div>

          {/* Photo Editor View */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: activeMainView === 'photo' ? 24 : 1,
            visibility: activeMainView === 'photo' ? 'visible' : 'hidden',
            pointerEvents: activeMainView === 'photo' ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            <PhotoEditor 
              ref={photoEditorRef} 
              activeProject={activeProject}
              onAddToTerminal={addToTerminal} 
              onProjectAction={addProjectNote}
              onUpdatePreview={updateProjectPreview}
            />
          </div>

          {/* Stories / Store View */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: activeMainView === 'stories' ? 24 : 1,
            visibility: activeMainView === 'stories' ? 'visible' : 'hidden',
          }}>
            <Store />
          </div>

          {/* Paint View */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: activeMainView === 'paint' ? 24 : 1,
            visibility: activeMainView === 'paint' ? 'visible' : 'hidden',
            pointerEvents: activeMainView === 'paint' ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            {installedPlugins.has('paint') ? (
              <PluginLoader pluginId="paint" pluginRef={paintRef} />
            ) : (
              <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                <div>
                  <h2>Paint desinstalado</h2>
                  <p>Baixe o plugin do Paint na Store para usar esta ferramenta.</p>
                </div>
              </div>
            )}
          </div>

          {/* Home View - com Feed de Notícias */}
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: activeMainView === 'home' ? 'flex' : 'none',
            flexDirection: 'row',
            background: 'var(--bg-primary)',
            zIndex: 30,
            pointerEvents: activeMainView === 'home' ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            {/* Painel de notícias - lateral esquerda com toggle */}
            <div style={{
              width: showNewsPanel ? (newsFullScreen ? '100%' : '320px') : '0px',
              minWidth: showNewsPanel ? (newsFullScreen ? '100%' : '320px') : '0px',
              maxWidth: showNewsPanel ? (newsFullScreen ? '100%' : '320px') : '0px',
              height: showNewsPanel ? '100%' : '0px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRight: showNewsPanel ? '1px solid var(--border-light)' : 'none',
              position: 'relative',
              flexShrink: 0,
              zIndex: newsFullScreen ? 40 : 1,
            }}>
              <HomeNewsPanel 
                isFullScreen={newsFullScreen}
                onToggleFullScreen={() => setNewsFullScreen(!newsFullScreen)}
                onOpenUrl={(url) => {
                  setActiveMainView('web');
                  const newTabId = Date.now().toString();
                  webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
                  forceWebviewRender(n => n + 1);
                setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
                setActiveBrowserTabId(newTabId);
                activeBrowserTabIdRef.current = newTabId;
                setTimeout(() => {
                  const webview = document.getElementById(`webview-${newTabId}`) as any;
                  if (webview) { webview.focus(); webview.loadURL(url); }
                }, 300);
              }} />
            </div>

            {/* Toggle News Handle */}
            <div 
              onClick={() => setShowNewsPanel(!showNewsPanel)}
              style={{
                width: '12px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRight: '1px solid var(--border-light)',
                zIndex: 100,
                transition: 'background 0.2s'
              }}
              className="panel-toggle-handle"
              title={showNewsPanel ? "Ocultar Notícias" : "Mostrar Notícias"}
            >
              <div style={{ 
                width: '2px', 
                height: '30px', 
                background: 'var(--text-secondary)', 
                borderRadius: '2px',
                opacity: 0.5
              }} />
            </div>

            {/* Dashboard de atividade */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <HomeActivityDashboard
                terminalOutput={terminalOutput}
                activeMainView={activeMainView}
                isStreaming={isStreaming}
                onNavigate={(view) => setActiveMainView(view)}
                onExecuteCommand={handleExecuteCommand}
                onClearTerminal={handleClearTerminal}
                terminalAgent={terminalAgent}
                onSetTerminalAgent={setTerminalAgent}
                onSendAgentMessage={handleSendAgentMessage}
                terminalMode={terminalMode}
                onSetTerminalMode={setTerminalMode}
                photoEditorRef={photoEditorRef}
                videoEditorRef={videoEditorRef}
                paintRef={paintRef}
                userName={settings.userName}
              />
            </div>
          </div>

          {/* Browser / Apps View - Sempre no DOM e Ativo */}
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: (activeMainView !== 'code' && activeMainView !== 'home') ? 20 : 1,
            visibility: (activeMainView !== 'code' && activeMainView !== 'home') ? 'visible' : 'hidden',
            pointerEvents: (activeMainView !== 'code' && activeMainView !== 'home') ? 'auto' : 'none',
            overflow: 'hidden'
          }}>
            {activeMainView === 'web' && (
              <>
                {/* Tab Bar */}
                <div className="browser-tabs" style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px 8px 0', gap: '4px', borderBottom: '1px solid var(--border-light)', alignItems: 'flex-end', position: 'relative' }}>
                  {/* Botão Menu */}
                  <button
                    onClick={() => setShowWebMenu(!showWebMenu)}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: showWebMenu ? 'var(--accent)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: showWebMenu ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!showWebMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!showWebMenu) e.currentTarget.style.background = 'transparent';
                    }}
                    title="Menu Web"
                  >
                    <Menu size={18} />
                  </button>
                  
                  {browserTabs.map((tab, index) => {
                    const isTabActive = activeBrowserTabId === tab.id;
                    const isTabSelected = selectedBrowserTabIds.includes(tab.id);
                    const isPinned = tab.pinned || false;
                    const isAnonymous = tab.isAnonymous || false;
                    const tabAccentColor = isAnonymous ? '#6b7280' : 'var(--accent)'; // Cinza para anônimas, roxo para normais
                    return (
                      <div
                        key={tab.id}
                        data-tab-id={tab.id}
                        onClick={(e) => {
                          if (dragMovedRef.current) return;
                          
                          // Ctrl+Click para multi-select (máximo 4 abas)
                          if (e.ctrlKey) {
                            setSelectedBrowserTabIds(prev => {
                              if (prev.includes(tab.id)) {
                                // Remove da seleção
                                const newSelection = prev.filter(id => id !== tab.id);
                                // Se ficar vazia, volta ao modo single
                                if (newSelection.length === 0) {
                                  setActiveBrowserTabId(tab.id);
                                }
                                return newSelection;
                              } else {
                                // Adiciona na seleção (máximo 4)
                                if (prev.length >= 4) return prev;
                                return [...prev, tab.id];
                              }
                            });
                          } else {
                            // Click normal - limpa seleção e ativa a aba
                            setSelectedBrowserTabIds([]);
                            setActiveBrowserTabId(tab.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                        }}
                        style={{
                          padding: isPinned ? '6px 8px' : '6px 12px',
                          background: isTabSelected ? 'var(--bg-primary)' : (isTabActive ? 'var(--bg-primary)' : 'transparent'),
                          color: isTabActive || isTabSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          borderRadius: '6px 6px 0 0',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isPinned ? 'default' : 'pointer',
                          minWidth: isPinned ? 'auto' : '100px',
                          maxWidth: isPinned ? 'auto' : '180px',
                          border: (isTabSelected || isTabActive) ? '1px solid var(--border-light)' : '1px solid transparent',
                          borderBottom: (isTabSelected || isTabActive) ? '1px solid var(--bg-primary)' : '1px solid transparent',
                          borderTop: isPinned ? '2px solid #ef4444' : (isTabSelected ? '2px solid #f59e0b' : (isTabActive ? `2px solid ${tabAccentColor}` : '2px solid transparent')),
                          transition: 'all 0.15s ease',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { if (!isTabActive && !isTabSelected) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                        onMouseLeave={e => { 
                          if (!isTabActive && !isTabSelected) { 
                            e.currentTarget.style.background = 'transparent'; 
                            e.currentTarget.style.color = 'var(--text-secondary)'; 
                          }
                          // Restaura a borda correta
                          if (isPinned) {
                            e.currentTarget.style.borderTop = '2px solid #ef4444';
                          } else if (isTabSelected) {
                            e.currentTarget.style.borderTop = '2px solid #f59e0b';
                          } else if (isTabActive) {
                            e.currentTarget.style.borderTop = `2px solid ${tabAccentColor}`;
                          } else {
                            e.currentTarget.style.borderTop = '2px solid transparent';
                          }
                        }}
                      >
                        {(() => {
                          const faviconSrc = tab.favicon || getFaviconFallback(tab.url);
                          // Extrair número de notificações do título (formato: (21) Título ou 21 · Título)
                          const notificationMatch = tab.title.match(/^\((\d+)\)|^(\d+)\s*·/);
                          const notificationCount = notificationMatch ? parseInt(notificationMatch[1] || notificationMatch[2]) : 0;
                          // Remover a notificação do título para exibição
                          const cleanTitle = tab.title.replace(/^\(\d+\)\s*/, '').replace(/^\d+\s*·\s*/, '');
                          
                          return (
                            <div style={{ position: 'relative', flexShrink: 0, width: '14px', height: '14px' }}>
                              {faviconSrc ? (
                                <img
                                  key={faviconSrc}
                                  src={faviconSrc}
                                  width={14}
                                  height={14}
                                  alt=""
                                  style={{ borderRadius: 2, objectFit: 'contain' }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : null}
                              {notificationCount > 0 && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-6px',
                                    background: '#8b5cf6',
                                    color: 'white',
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    padding: '1px 3px',
                                    borderRadius: '6px',
                                    minWidth: '12px',
                                    height: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                  }}
                                >
                                  {notificationCount > 99 ? '99+' : notificationCount}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {!isPinned && (
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(() => {
                              // Remover notificação do título exibido
                              const cleanTitle = tab.title.replace(/^\(\d+\)\s*/, '').replace(/^\d+\s*·\s*/, '');
                              return cleanTitle || tab.url.replace('https://', '');
                            })()}
                          </span>
                        )}
                        {!isPinned && (
                          <span
                            onClick={(e) => handleCloseBrowserTab(tab.id, e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ fontSize: '13px', opacity: 0.5, cursor: 'pointer', lineHeight: 1, padding: '1px 2px', borderRadius: '3px', transition: 'opacity 0.15s, background 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            ×
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={handleAddBrowserTab}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', padding: '0 8px', cursor: 'pointer', borderRadius: '4px', transition: 'color 0.15s, background 0.15s', lineHeight: 1, height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    title="Nova aba"
                  >
                    +
                  </button>
                </div>
                {/* Toolbar */}
                <div className="browser-toolbar" style={{ display: 'flex', gap: '6px', padding: '6px 8px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[
                      { title: 'Voltar', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>, action: () => { const wv = document.getElementById(`webview-${activeBrowserTabId}`) as any; if (wv) wv.goBack(); } },
                      { title: 'Avançar', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>, action: () => { const wv = document.getElementById(`webview-${activeBrowserTabId}`) as any; if (wv) wv.goForward(); } },
                      { title: 'Recarregar', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>, action: () => { const wv = document.getElementById(`webview-${activeBrowserTabId}`) as any; if (wv) wv.reload(); } },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        onClick={btn.action}
                        title={btn.title}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
                        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={urlBarValue}
                    onChange={(e) => setUrlBarValue(e.target.value)}
                    ref={urlInputRef}
                    onBlur={(e) => {
                      // Restaura o URL da aba ao tirar o foco, caso o usuário não tenha navegado
                      if (activeTabObj) {
                        setUrlBarValue(activeTabObj.url);
                      }
                      e.currentTarget.style.borderColor = 'var(--border-color)'; 
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = urlBarValue.trim();
                        if (!input) return;
                        // Se já começa com http:// ou https://, navega diretamente
                        if (input.startsWith('http://') || input.startsWith('https://')) {
                          handleUpdateTabUrl(activeBrowserTabId, input);
                          return;
                        }
                        // Se tem ponto e não tem espaço, trata como domínio (ex: google.com, exemplo.com.br/teste)
                        if ((input.includes('.') || /^localhost|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(input)) && !input.includes(' ')) {
                          handleUpdateTabUrl(activeBrowserTabId, `https://${input}`);
                          return;
                        }
                        // Caso contrário, faz pesquisa no Google
                        handleUpdateTabUrl(activeBrowserTabId, `https://www.google.com/search?q=${encodeURIComponent(input)}`);
                      }
                    }}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', transition: 'border-color 0.15s, box-shadow 0.15s', outline: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)22'; e.target.select(); }}
                  />
                  {/* Botão de Downloads */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowDownloadsPanel(p => !p)}
                      title="Downloads"
                      style={{ 
                        background: showDownloadsPanel ? 'var(--bg-input)' : 'transparent', 
                        color: showDownloadsPanel ? 'var(--text-primary)' : 'var(--text-secondary)', 
                        border: 'none', 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        transition: 'background 0.15s, color 0.15s', 
                        flexShrink: 0,
                        position: 'relative'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { if (!showDownloadsPanel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <Download size={16} />
                      {downloadsList.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 4px',
                          borderRadius: '10px',
                          minWidth: '14px',
                          textAlign: 'center'
                        }}>
                          {downloadsList.length}
                        </div>
                      )}
                    </button>
                    
                    {/* Dropdown de Downloads */}
                    {showDownloadsPanel && (
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '38px', 
                          right: 0, 
                          width: '360px', 
                          maxHeight: '480px',
                          background: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '10px', 
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
                          zIndex: 9999, 
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        onMouseLeave={() => setShowDownloadsPanel(false)}
                      >
                        {/* Header */}
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Downloads</span>
                          {downloadsList.length > 0 && (
                            <button
                              onClick={() => setDownloadsList([])}
                              style={{ 
                                background: 'var(--bg-tertiary)', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                borderRadius: '4px', 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                cursor: 'pointer', 
                                fontWeight: 600 
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        
                        {/* Lista de Downloads */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                          {downloadsList.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              Nenhum download no momento
                            </div>
                          ) : (
                            downloadsList.map(download => {
                              const progress = download.totalBytes > 0 ? (download.receivedBytes / download.totalBytes) * 100 : 0;
                              const isCompleted = download.state === 'completed';
                              const isError = download.state === 'interrupted';
                              const isDownloading = download.state === 'progressing';
                              
                              return (
                                <div 
                                  key={download.id} 
                                  style={{ 
                                    padding: '10px 14px', 
                                    borderBottom: '1px solid var(--border-light)',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    {/* Ícone de status */}
                                    <div style={{ 
                                      width: '32px', 
                                      height: '32px', 
                                      borderRadius: '6px', 
                                      background: isCompleted ? '#10b98144' : isError ? '#ef444444' : 'var(--bg-input)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}>
                                      {isCompleted ? '✓' : isError ? '✕' : '↓'}
                                    </div>
                                    
                                    {/* Info */}
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                      <div style={{ 
                                        fontSize: '12px', 
                                        fontWeight: 500, 
                                        color: 'var(--text-primary)', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis', 
                                        whiteSpace: 'nowrap',
                                        marginBottom: '2px'
                                      }}>
                                        {download.filename}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                        {isCompleted && 'Concluído'}
                                        {isError && 'Erro no download'}
                                        {isDownloading && `${Math.round(progress)}%`}
                                      </div>
                                    </div>
                                    
                                    {/* Botão remover */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDownloadsList(prev => prev.filter(d => d.id !== download.id));
                                      }}
                                      style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: 'var(--text-secondary)', 
                                        cursor: 'pointer', 
                                        fontSize: '16px', 
                                        padding: '4px',
                                        lineHeight: 1,
                                        borderRadius: '4px'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.color = '#ef4444';
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                        e.currentTarget.style.background = 'none';
                                      }}
                                      title="Remover"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  
                                  {/* Barra de progresso */}
                                  {isDownloading && (
                                    <div style={{ 
                                      width: '100%', 
                                      height: '4px', 
                                      background: 'var(--bg-input)', 
                                      borderRadius: '2px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{ 
                                        width: `${progress}%`, 
                                        height: '100%', 
                                        background: 'var(--accent)',
                                        transition: 'width 0.3s'
                                      }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div style={{ flex: 1, position: 'relative' }}>
              {/* Webviews em ordem ESTÁVEL de criação — reordenar abas nunca muda esta lista. */}
              {webviewInsertionOrder.current
                .filter(id => browserTabs.some(t => t.id === id))
                .map(id => {
                  const tab = browserTabs.find(t => t.id === id)!;
                  const isSplitMode = selectedBrowserTabIds.length > 0;
                  const isVisibleInSplit = isSplitMode && selectedBrowserTabIds.includes(tab.id);
                  const isActive = !isSplitMode && activeBrowserTabId === tab.id && activeMainView === 'web';
                  const isVisible = isActive || isVisibleInSplit;
                  
                  // Layout split com tamanhos fixos 50/50
                  let splitStyle = {};
                  if (isSplitMode && isVisibleInSplit) {
                    const splitCount = selectedBrowserTabIds.length;
                    const splitIndex = selectedBrowserTabIds.indexOf(tab.id);
                    
                    if (splitCount === 2) {
                      // 2 abas: lado a lado 50/50
                      splitStyle = {
                        left: splitIndex === 0 ? '0%' : '50%',
                        width: '50%',
                        top: 0,
                        height: '100%',
                      };
                    } else if (splitCount === 3) {
                      // 3 abas: primeira metade esquerda, outras duas dividem direita
                      if (splitIndex === 0) {
                        splitStyle = { left: '0%', width: '50%', top: 0, height: '100%' };
                      } else if (splitIndex === 1) {
                        splitStyle = { left: '50%', width: '50%', top: 0, height: '50%' };
                      } else {
                        splitStyle = { left: '50%', width: '50%', top: '50%', height: '50%' };
                      }
                    } else if (splitCount === 4) {
                      // 4 abas: grid 2x2
                      const row = Math.floor(splitIndex / 2);
                      const col = splitIndex % 2;
                      splitStyle = {
                        left: `${col * 50}%`,
                        width: '50%',
                        top: `${row * 50}%`,
                        height: '50%',
                      };
                    }
                  }
                  
                  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
                  
                  // Armazena URL inicial na primeira renderização desta aba
                  if (!initialTabUrlsRef.current.has(tab.id)) {
                    initialTabUrlsRef.current.set(tab.id, tab.url);
                  }
                  const webviewSrc = initialTabUrlsRef.current.get(tab.id) || tab.url;
                  
                  return (
                    <webview
                      key={tab.id}
                      id={`webview-${tab.id}`}
                      src={webviewSrc}
                      style={{
                        position: 'absolute',
                        ...(isSplitMode && isVisibleInSplit ? splitStyle : {
                          top: 0, left: 0, right: 0, bottom: 0,
                          width: '100%',
                          height: '100%',
                        }),
                        transform: (isVisible && !showWebMenu) ? 'translateX(0)' : 'translateX(-9999px)',
                        pointerEvents: (isVisible && !showWebMenu) ? 'auto' : 'none',
                        zIndex: isVisible ? 100 : 1,
                      }}
                      partition="persist:bill-browser"
                      useragent={userAgent}
                      {...({ autoplayPolicy: "no-user-gesture-required" } as any)}
                      webpreferences="backgroundThrottling=false, contextIsolation=true"
                    />
                  );
                })
              }

        </div>
        
        {/* Painel do Menu Web */}
        {showWebMenu && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-primary)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header Fixo do Menu - Sempre visível */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderBottom: '2px solid var(--border-light)',
              padding: '20px 40px',
              flexShrink: 0
            }}>
              {/* Linha 1: Perfil + Pesquisa + Notificação */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: isSearching ? '15px' : '0' }}>
                {/* Perfil */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: settings.userAvatar ? `url(${settings.userAvatar}) center/cover` : 'linear-gradient(135deg, var(--accent), #9b7cfc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    color: '#fff',
                    fontWeight: '600',
                    border: '2px solid var(--accent)',
                    flexShrink: 0
                  }}>
                    {!settings.userAvatar && (settings.userName?.[0]?.toUpperCase() || 'U')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {settings.userName || 'Usuário'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Menu Web
                    </div>
                  </div>
                </div>
                
                {/* Barra de Pesquisa */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={webMenuSearch}
                    onChange={(e) => setWebMenuSearch(e.target.value)}
                    placeholder="Pesquisar no menu..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'var(--bg-primary)',
                      border: '2px solid var(--border-light)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                  />
                  <Search size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                </div>
                
                {/* Notificações */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: showNotifications ? 'var(--accent)' : 'var(--bg-primary)',
                      border: '2px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Bell size={20} color={showNotifications ? '#fff' : 'var(--text-secondary)'} />
                    {webNotifications.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {webNotifications.length > 9 ? '9+' : webNotifications.length}
                      </div>
                    )}
                  </button>
                  
                  {/* Dropdown de Notificações */}
                  {showNotifications && (
                    <div style={{
                      position: 'absolute',
                      top: '60px',
                      right: '0',
                      width: '320px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      background: 'var(--bg-primary)',
                      border: '2px solid var(--border-light)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 1000
                    }}>
                      <div style={{ padding: '15px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          Notificações
                        </h3>
                        {webNotifications.length > 0 && (
                          <button
                            onClick={() => setWebNotifications([])}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      {webNotifications.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Nenhuma notificação
                        </div>
                      ) : (
                        <div>
                          {webNotifications.slice().reverse().map(notif => (
                            <div key={notif.id} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-light)' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {notif.message}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {new Date(notif.timestamp).toLocaleTimeString('pt-BR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Linha 2: Indicador de Pesquisa em Background */}
              {isSearching && (
                <div style={{
                  marginTop: '15px',
                  padding: '12px 16px',
                  background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    borderTopColor: '#3b82f6',
                    animation: 'spin 1s linear infinite',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Pesquisa em andamento
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {searchProgress}
                    </div>
                  </div>
                  <button
                    onClick={() => setWebMenuView('advanced-search')}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Ver Detalhes
                  </button>
                </div>
              )}
            </div>
            
            {/* Barra de Atalhos Personalizados */}
            {webMenuView === 'main' && (
              <div style={{
                borderTop: '1px solid var(--border-light)',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-secondary)',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {/* Botão adicionar */}
                <button
                  onClick={() => setShowAddShortcut(true)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px dashed var(--border-light)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.15s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Adicionar Atalho"
                >
                  +
                </button>
                
                {/* Atalhos */}
                {customShortcuts.map(shortcut => (
                  <div
                    key={shortcut.id}
                    style={{
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <button
                      onClick={() => {
                        setActiveMainView('web');
                        setShowWebMenu(false);
                        const newTabId = Date.now().toString();
                        webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
                        forceWebviewRender(n => n + 1);
                        setBrowserTabs(prev => [...prev, { id: newTabId, url: shortcut.url, title: shortcut.name }]);
                        setActiveBrowserTabId(newTabId);
                        activeBrowserTabIdRef.current = newTabId;
                        setTimeout(() => {
                          const webview = document.getElementById(`webview-${newTabId}`) as any;
                          if (webview) { webview.focus(); webview.loadURL(shortcut.url); }
                        }, 300);
                      }}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        padding: '8px',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      title={shortcut.name}
                    >
                      <img 
                        src={shortcut.favicon} 
                        alt={shortcut.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          // Se favicon falhar, mostra primeira letra
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const letter = document.createElement('span');
                            letter.textContent = shortcut.name.charAt(0).toUpperCase();
                            letter.style.fontSize = '20px';
                            letter.style.fontWeight = '700';
                            letter.style.color = 'var(--accent)';
                            parent.appendChild(letter);
                          }
                        }}
                      />
                    </button>
                    
                    {/* Botão remover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomShortcut(shortcut.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '700',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#dc2626';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title="Remover"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {customShortcuts.length === 0 && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    padding: '0 12px'
                  }}>
                    Adicione seus sites favoritos aqui
                  </div>
                )}
              </div>
            )}
            
            {/* Conteúdo do Menu - Scroll */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px'
            }}>
              {/* Menu Principal */}
              {webMenuView === 'main' && (() => {
                const filteredMenus = ['navegador', 'notícias', 'pesquisa', 'criativos'].filter(name => 
                  !webMenuSearch || name.toLowerCase().includes(webMenuSearch.toLowerCase())
                );
                
                const useFlex = filteredMenus.length <= 3;
                
                return (
                  <div style={{
                    maxWidth: '900px',
                    width: '100%',
                    display: useFlex ? 'flex' : 'grid',
                    gridTemplateColumns: useFlex ? undefined : 'repeat(3, 1fr)',
                    flexDirection: useFlex ? 'row' : undefined,
                    justifyContent: useFlex ? 'center' : undefined,
                    flexWrap: useFlex ? 'wrap' : undefined,
                    gap: '20px',
                    paddingTop: '200px'
                  }}>
                    {filteredMenus.map(filteredName => {
                    if (filteredName === 'navegador') return (
                      <button
                        key="navegador"
                        onClick={() => setShowWebMenu(false)}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '2px solid var(--accent)',
                          borderRadius: '12px',
                          padding: '30px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          color: 'var(--text-primary)',
                          minWidth: '280px',
                          maxWidth: '280px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--accent)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <div style={{
                          width: '64px',
                          height: '64px',
                          background: 'linear-gradient(135deg, var(--accent), #9b7cfc)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(124, 92, 252, 0.3)'
                        }}>
                          <Monitor size={32} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          Navegador
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          Voltar para navegação web
                        </div>
                      </button>
                    );
                    
                    if (filteredName === 'notícias') return (
                      <button
                        key="noticias"
                        onClick={() => {
                          setActiveMainView('news');
                          setShowWebMenu(false);
                        }}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '2px solid #ef4444',
                          borderRadius: '12px',
                          padding: '30px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          color: 'var(--text-primary)',
                          minWidth: '280px',
                          maxWidth: '280px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <div style={{
                          width: '64px',
                          height: '64px',
                          background: 'linear-gradient(135deg, #ef4444, #f87171)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                        }}>
                          <Newspaper size={32} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          Notícias
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          Feed de notícias em tempo real
                        </div>
                      </button>
                    );
                    
                    if (filteredName === 'pesquisa') return (
                      <button
                        key="pesquisa"
                        onClick={() => setWebMenuView('advanced-search')}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '2px solid #3b82f6',
                          borderRadius: '12px',
                          padding: '30px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          color: 'var(--text-primary)',
                          minWidth: '280px',
                          maxWidth: '280px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#3b82f6';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <div style={{
                          width: '64px',
                          height: '64px',
                          background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}>
                          <Search size={32} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          Pesquisa Avançada
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          Busca aprofundada na web
                        </div>
                      </button>
                    );
                    
                    if (filteredName === 'criativos') return (
                      <button
                        key="criativos"
                        onClick={() => {
                          console.log('[WebMenu] Criativos - Resultados:', searchResults);
                          setWebMenuView('panel');
                        }}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '2px solid #10b981',
                          borderRadius: '12px',
                          padding: '30px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          color: 'var(--text-primary)',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#10b981';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        {searchResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#fff'
                          }}>
                            {searchResults.length}
                          </div>
                        )}
                        <div style={{
                          width: '64px',
                          height: '64px',
                          background: 'linear-gradient(135deg, #10b981, #34d399)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}>
                          <LayoutGrid size={32} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          Criativos
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          {searchResults.length > 0 ? `${searchResults.length} pesquisa(s)` : 'Gerenciar recursos web'}
                        </div>
                      </button>
                    );
                    
                    return null;
                  })}

                  {/* Histórico - Bloco adicional fora do filtro */}
                  {(!webMenuSearch || 'histórico'.includes(webMenuSearch.toLowerCase())) && (
                    <button
                      key="historico"
                      onClick={() => {
                        setShowBrowserHistory(true);
                        console.log('[Histórico] Abrindo histórico de navegação');
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px solid #8b5cf6',
                        borderRadius: '12px',
                        padding: '30px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-primary)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#8b5cf6';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {browserHistory.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#8b5cf6',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#fff'
                        }}>
                          {browserHistory.length}
                        </div>
                      )}
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                      }}>
                        <History size={32} color="#fff" strokeWidth={2} />
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Histórico
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        {browserHistory.length > 0 ? `${browserHistory.length} site(s)` : 'Últimos sites visitados'}
                      </div>
                    </button>
                  )}

                  {/* Baixar Vídeo - Bloco adicional fora do filtro */}
                  {(!webMenuSearch || 'baixar'.includes(webMenuSearch.toLowerCase()) || 'video'.includes(webMenuSearch.toLowerCase()) || 'download'.includes(webMenuSearch.toLowerCase())) && (
                    <button
                      key="baixar-video"
                      onClick={() => {
                        setShowVideoDownloader(true);
                        console.log('[Video Downloader] Abrindo downloader de vídeos');
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px solid #10b981',
                        borderRadius: '12px',
                        padding: '30px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#10b981';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #10b981, #34d399)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}>
                        <Download size={32} color="#fff" strokeWidth={2} />
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Baixar Vídeo
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        YouTube, Instagram, TikTok...
                      </div>
                    </button>
                  )}

                  {/* Downloads Manager - Bloco adicional */}
                  {(!webMenuSearch || 'downloads'.includes(webMenuSearch.toLowerCase())) && (
                    <button
                      key="downloads"
                      onClick={() => {
                        setShowDownloadsManager(true);
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px solid #f59e0b',
                        borderRadius: '12px',
                        padding: '30px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-primary)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f59e0b';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {downloadsList.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#f59e0b',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#fff'
                        }}>
                          {downloadsList.length}
                        </div>
                      )}
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                      }}>
                        <Download size={32} color="#fff" strokeWidth={2} />
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Downloads
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        {downloadsList.length > 0 ? `${downloadsList.length} arquivo(s)` : 'Nenhum download'}
                      </div>
                    </button>
                  )}

                  {/* Tradutor - Bloco adicional */}
                  {(!webMenuSearch || 'tradutor'.includes(webMenuSearch.toLowerCase()) || 'translate'.includes(webMenuSearch.toLowerCase())) && (
                    <button
                      key="tradutor"
                      onClick={() => {
                        setShowTranslator(true);
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px solid #06b6d4',
                        borderRadius: '12px',
                        padding: '30px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#06b6d4';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
                      }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 8h14M5 8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8Z"/>
                          <path d="M7 12h10M7 16h6"/>
                        </svg>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Tradutor
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        Traduzir textos
                      </div>
                    </button>
                  )}

                  {/* Aba Anônima - Bloco adicional fora do filtro */}
                  {(!webMenuSearch || 'anônima'.includes(webMenuSearch.toLowerCase()) || 'anonima'.includes(webMenuSearch.toLowerCase())) && (
                    <button
                      key="anonima"
                      onClick={() => {
                        setActiveMainView('web');
                        setShowWebMenu(false);
                        const newTabId = Date.now().toString();
                        webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
                        forceWebviewRender(n => n + 1);
                        setBrowserTabs(prev => [...prev, { 
                          id: newTabId, 
                          url: 'https://www.google.com', 
                          title: 'Aba Anônima',
                          isAnonymous: true
                        }]);
                        setActiveBrowserTabId(newTabId);
                        activeBrowserTabIdRef.current = newTabId;
                        setTimeout(() => {
                          const webview = document.getElementById(`webview-${newTabId}`) as any;
                          if (webview) { webview.focus(); webview.loadURL('https://www.google.com'); }
                        }, 300);
                        console.log('[Anônima] Nova aba anônima criada');
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '2px solid #6b7280',
                        borderRadius: '12px',
                        padding: '30px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-primary)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#6b7280';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #6b7280, #9ca3af)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)'
                      }}>
                        <Monitor size={32} color="#fff" strokeWidth={2} />
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Aba Anônima
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        Navegue sem salvar histórico
                      </div>
                    </button>
                  )}
                </div>
              );
              })()}
              
              {/* Menu Pesquisa Avançada */}
              {webMenuView === 'advanced-search' && (
              <div style={{
                maxWidth: '700px',
                width: '100%',
                background: 'var(--bg-secondary)',
                borderRadius: '16px',
                padding: '30px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Pesquisa Avançada
                  </h2>
                  <button
                    onClick={() => {
                      if (isSearching) {
                        // Permite voltar mesmo durante pesquisa
                        setWebMenuView('main');
                      } else {
                        setWebMenuView('main');
                        setSearchType(null);
                        setSelectedSearchModel(null);
                        setSelectedSearchProvider(null);
                        setSearchQuery('');
                        setCustomSearchUrls('');
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                  >
                    <X size={24} />
                  </button>
                </div>
                
                {/* Indicador de Progresso */}
                {isSearching && (
                  <div style={{
                    marginBottom: '25px',
                    padding: '20px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                    borderRadius: '12px',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '3px solid rgba(59, 130, 246, 0.3)',
                        borderTopColor: '#3b82f6',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          Pesquisando...
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {searchProgress}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)'
                    }}>
                      A pesquisa continua em segundo plano. Você pode voltar ao menu principal.
                    </div>
                  </div>
                )}
                
                {/* Etapa 1: Tipo de Pesquisa */}
                {!searchType && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '15px', textTransform: 'uppercase' }}>
                      Escolha o Tipo
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                      <button
                        onClick={() => setSearchType('auto')}
                        disabled={isSearching}
                        style={{
                          padding: '20px',
                          background: 'var(--bg-primary)',
                          border: '2px solid #3b82f6',
                          borderRadius: '10px',
                          cursor: isSearching ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                          opacity: isSearching ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isSearching) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                          Automática
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Pesquisa em toda a web automaticamente
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSearchType('custom')}
                        disabled={isSearching}
                        style={{
                          padding: '20px',
                          background: 'var(--bg-primary)',
                          border: '2px solid #8b5cf6',
                          borderRadius: '10px',
                          cursor: isSearching ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left',
                          opacity: isSearching ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isSearching) {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                          Personalizada
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Pesquisa apenas em sites específicos
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowMyResearch(true);
                          console.log('[Pesquisas] Abrindo minhas pesquisas');
                        }}
                        style={{
                          padding: '20px',
                          background: 'var(--bg-primary)',
                          border: '2px solid #10b981',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                          Minhas Pesquisas
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Ver e gerenciar artigos salvos
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Etapa 2: Selecionar Modelo IA */}
                {searchType && !selectedSearchModel && (
                  <div>
                    <button
                      onClick={() => setSearchType(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        marginBottom: '15px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ← Voltar
                    </button>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '15px', textTransform: 'uppercase' }}>
                      Selecione o Modelo de IA
                    </h3>
                    <div style={{ display: 'grid', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                      {loadSavedModels().length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Nenhum modelo salvo. Configure na sidebar de settings.
                        </div>
                      ) : (
                        loadSavedModels().map(model => (
                          <button
                            key={model.id}
                            onClick={() => setSelectedSearchModel(model)}
                            style={{
                              padding: '15px',
                              background: 'var(--bg-primary)',
                              border: '2px solid var(--border-light)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent)';
                              e.currentTarget.style.transform = 'translateX(5px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-light)';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }}
                          >
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              background: model.color || 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              flexShrink: 0
                            }}>
                              {model.avatar || '🤖'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {model.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {model.provider} • {model.model}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {/* Etapa 3: Selecionar Provedor de Pesquisa */}
                {selectedSearchModel && !selectedSearchProvider && (
                  <div>
                    <button
                      onClick={() => setSelectedSearchModel(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        marginBottom: '15px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ← Voltar
                    </button>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '15px', textTransform: 'uppercase' }}>
                      Selecione o Provedor de Busca
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {(['tavily', 'google', 'brave', 'duckduckgo'] as const).map(provider => (
                        <button
                          key={provider}
                          onClick={() => setSelectedSearchProvider(provider)}
                          style={{
                            padding: '15px',
                            background: 'var(--bg-primary)',
                            border: '2px solid var(--border-light)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-light)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          {provider.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Etapa 4: Query e Executar */}
                {selectedSearchProvider && (
                  <div>
                    <button
                      onClick={() => setSelectedSearchProvider(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        marginBottom: '15px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ← Voltar
                    </button>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        O QUE DESEJA PESQUISAR?
                      </label>
                      <textarea
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ex: Explique como funcionam os transformers em IA..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '12px',
                          background: 'var(--bg-primary)',
                          border: '2px solid var(--border-light)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    
                    {searchType === 'custom' && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          SITES ESPECÍFICOS (um por linha)
                        </label>
                        <textarea
                          value={customSearchUrls}
                          onChange={(e) => setCustomSearchUrls(e.target.value)}
                          placeholder={'https://example.com\nhttps://another-site.com'}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '12px',
                            background: 'var(--bg-primary)',
                            border: '2px solid var(--border-light)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    )}
                    
                    <button
                      onClick={performDeepResearch}
                      disabled={isSearching || !searchQuery.trim()}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: isSearching ? '#666' : 'linear-gradient(135deg, var(--accent), #9b7cfc)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: isSearching ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSearching) e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {isSearching ? 'Pesquisando...' : 'Iniciar Pesquisa Profunda'}
                    </button>
                    
                    <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: '#3b82f6' }}>Deep Research:</strong> Fará 3 iterações de pesquisa, refinando automaticamente as buscas para obter informações mais profundas.
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Menu Painel - Criativos (somente tela inicial) */}
            {webMenuView === 'panel' && (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 30px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-light)'
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Criativos
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Visualize e gerencie seus criativos
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setWebMenuView('main');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                  >
                    <X size={24} />
                  </button>
                </div>
                
                {/* Conteúdo - Estado vazio */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px'
                }}>
                  <div style={{
                    maxWidth: '600px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <div style={{
                      textAlign: 'center',
                      marginBottom: '20px'
                    }}>
                      <LayoutGrid size={64} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        margin: '20px 0 10px 0'
                      }}>
                        Nenhum criativo ativo
                      </h3>
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        margin: 0
                      }}>
                        Escolha uma opção abaixo para começar
                      </p>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '15px'
                    }}>
                      {/* Botão Criar Criativo */}
                      <button
                        onClick={() => {
                          setShowCustomPanel(true);
                          setWebMenuView('main');
                          console.log('[Painel] Abrindo criativo customizado');
                        }}
                        style={{
                          padding: '30px 20px',
                          background: 'var(--bg-secondary)',
                          border: '2px solid #10b981',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#10b981';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{
                          width: '48px',
                          height: '48px',
                          background: 'linear-gradient(135deg, #10b981, #34d399)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          textAlign: 'center'
                        }}>
                          Criar Criativo
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          Criar um novo criativo personalizado
                        </div>
                      </button>
                      
                      {/* Botão Histórico */}
                      <button
                        onClick={() => {
                          setWebMenuView('panel-history');
                        }}
                        style={{
                          padding: '30px 20px',
                          background: 'var(--bg-secondary)',
                          border: '2px solid #3b82f6',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#3b82f6';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {searchResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            minWidth: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#fff'
                          }}>
                            {searchResults.length}
                          </div>
                        )}
                        <div style={{
                          width: '48px',
                          height: '48px',
                          background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v5h5"/>
                            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                            <path d="M12 7v5l4 2"/>
                          </svg>
                        </div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          textAlign: 'center'
                        }}>
                          Criativos Salvos
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center'
                        }}>
                          {searchResults.length > 0 
                            ? `${searchResults.length} criativo(s) salvo(s)`
                            : 'Ver criativos anteriores'}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Menu Histórico de Pesquisas */}
            {webMenuView === 'panel-history' && (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 30px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-light)'
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Criativos Salvos
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {searchResults.length} criativo(s) salvo(s)
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setWebMenuView('main');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                  >
                    <X size={24} />
                  </button>
                </div>
                
                {/* Lista de pesquisas */}
                <div style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '30px'
                }}>
                  {searchResults.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      gap: '15px'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Nenhum criativo ainda
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        maxWidth: '400px'
                      }}>
                        Crie um criativo no mind-map para começar
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                      gap: '20px'
                    }}>
                      {searchResults.map((result, index) => (
                        <div
                          key={result.id}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '2px solid var(--border-light)',
                            borderRadius: '12px',
                            padding: '20px',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-light)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                          onClick={() => {
                            setSelectedResearch(result);
                            setShowCustomPanel(true);
                            setWebMenuView('main');
                          }}
                        >
                          {/* Badge de número */}
                          <div style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            background: 'var(--accent)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#fff'
                          }}>
                            #{searchResults.length - index}
                          </div>
                          
                          {/* Query/Nome */}
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            marginBottom: '12px',
                            paddingRight: '50px',
                            lineHeight: '1.4',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {result.name || result.query || 'Criativo sem título'}
                          </div>
                          
                          {/* Metadata */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '15px'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11px',
                              color: 'var(--text-secondary)'
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              {new Date(result.timestamp).toLocaleString('pt-BR')}
                            </div>
                            {result.blocks && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '11px',
                                color: 'var(--text-secondary)'
                              }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="7" height="7"/>
                                  <rect x="14" y="3" width="7" height="7"/>
                                  <rect x="14" y="14" width="7" height="7"/>
                                  <rect x="3" y="14" width="7" height="7"/>
                                </svg>
                                {result.blocks.length} bloco(s)
                              </div>
                            )}
                            {result.model && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '11px',
                                color: 'var(--text-secondary)'
                              }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <path d="M20.4 14.5L16 10 4 20"/>
                                </svg>
                                {result.model}
                              </div>
                            )}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11px',
                              color: 'var(--text-secondary)'
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                              </svg>
                              {result.provider}
                            </div>
                          </div>
                          
                          {/* Preview do conteúdo */}
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.5',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            marginBottom: '15px',
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '12px'
                          }}>
                            {result.content ? `${result.content.substring(0, 150)}...` : `Criativo com ${result.blocks?.length || 0} blocos`}
                          </div>
                          
                          {/* Botões de ação */}
                          <div style={{
                            display: 'flex',
                            gap: '8px'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResearch(result);
                                setShowCustomPanel(true);
                                setWebMenuView('main');
                              }}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: 'var(--accent)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Abrir Criativo
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Remove do localStorage e IndexedDB
                                try {
                                  // 1. Remove do localStorage
                                  const saved = localStorage.getItem('billcode_custom_panels');
                                  const panels = saved ? JSON.parse(saved) : [];
                                  const updated = panels.filter((p: any) => p.id !== result.id);
                                  localStorage.setItem('billcode_custom_panels', JSON.stringify(updated));
                                  
                                  // 2. Remove do IndexedDB (se existir)
                                  const usesIndexedDB = localStorage.getItem('billcode_uses_indexeddb');
                                  if (usesIndexedDB === 'true') {
                                    try {
                                      const request = indexedDB.open('billcode_db', 1);
                                      request.onsuccess = (event: any) => {
                                        const db = event.target.result;
                                        if (db.objectStoreNames.contains('panels')) {
                                          const transaction = db.transaction(['panels'], 'readwrite');
                                          const store = transaction.objectStore('panels');
                                          store.delete(result.id);
                                          console.log('[Criativos] Excluído do IndexedDB:', result.id);
                                        }
                                      };
                                    } catch (dbError) {
                                      console.error('[Criativos] Erro ao excluir do IndexedDB:', dbError);
                                    }
                                  }
                                  
                                  // 3. Atualiza estado (remove apenas este item)
                                  setSearchResults(prev => prev.filter(p => p.id !== result.id));
                                  
                                  setWebNotifications(prev => [...prev, {
                                    id: `notif-${Date.now()}`,
                                    message: 'Criativo excluído com sucesso',
                                    timestamp: Date.now()
                                  }]);
                                  
                                  console.log('[Criativos] Criativo excluído:', result.name || result.id);
                                } catch (e) {
                                  console.error('[Criativos] Erro ao excluir:', e);
                                }
                              }}
                              style={{
                                padding: '8px 12px',
                                background: 'transparent',
                                border: '1px solid #ef4444',
                                borderRadius: '6px',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Excluir criativo"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
        {/* Menu de contexto das abas */}
        {tabContextMenu && (() => {
          const tab = browserTabs.find(t => t.id === tabContextMenu.tabId);
          if (!tab) return null;
          const isPinned = tab.pinned || false;
          
          return (
            <div
              id="tab-context-menu"
              style={{
                position: 'fixed',
                top: tabContextMenu.y,
                left: tabContextMenu.x,
                zIndex: 9999,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                padding: '4px 0',
                minWidth: '180px',
                fontSize: '13px',
              }}
            >
              <div
                style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => togglePinTab(tabContextMenu.tabId)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5"/>
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                </svg>
                {isPinned ? 'Desfixar aba' : 'Fixar aba'}
              </div>
              
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
              
              <div
                style={{ padding: '9px 14px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={(e) => {
                  e.stopPropagation();
                  setBrowserTabs(prev => {
                    const filtered = prev.filter(t => t.id !== tabContextMenu.tabId);
                    if (filtered.length === 0) return [{ id: Date.now().toString(), url: 'https://www.google.com', title: 'Google' }];
                    return filtered;
                  });
                  if (activeBrowserTabId === tabContextMenu.tabId) {
                    const remainingTabs = browserTabs.filter(t => t.id !== tabContextMenu.tabId);
                    if (remainingTabs.length > 0) {
                      setActiveBrowserTabId(remainingTabs[0].id);
                    }
                  }
                  setTabContextMenu(null);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Fechar aba
              </div>
            </div>
          );
        })()}
        
        {/* Menu de contexto de imagem no webview */}
        {imgContextMenu && (
          <div
            id="img-context-menu"
            style={{
              position: 'fixed',
              top: imgContextMenu.y,
              left: imgContextMenu.x,
              zIndex: 9999,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              padding: '4px 0',
              minWidth: '210px',
              fontSize: '13px',
            }}
          >
            {imgContextMenu.isLink && (
              <>
                <div
                  style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '4px 4px 0 0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    const url = imgContextMenu.linkUrl!;
                    setImgContextMenu(null);
                    openNewTab(url);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  Abrir em outra aba
                </div>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
              </>
            )}

            {imgContextMenu.imgUrl && (
              <>
            <div
              style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: !imgContextMenu.isLink ? '4px 4px 0 0' : '0' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                const url = imgContextMenu.imgUrl || imgContextMenu.url;
                const ext = (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif|svg)(\?|$)/i) || [])[1] || 'jpg';
                const filename = `imagem_${Date.now()}.${ext}`;
                setImgContextMenu(null);
                
                // Adiciona à lista de downloads imediatamente
                const downloadId = Date.now().toString() + Math.random();
                setDownloadsList(prev => [{
                  id: downloadId,
                  filename: filename,
                  url: url,
                  path: '',
                  totalBytes: 0,
                  receivedBytes: 0,
                  state: 'progressing',
                  startTime: Date.now()
                }, ...prev]);
                
                (window as any).electronAPI.downloadImage(url, filename)
                  .then((res: any) => {
                    if (res.success) {
                      // Atualiza como concluído
                      setDownloadsList(prev => prev.map(d => 
                        d.id === downloadId ? { ...d, state: 'completed' as const, path: res.path, receivedBytes: d.totalBytes || 1000000 } : d
                      ));
                    } else if (res.error !== 'Cancelado pelo usuário') {
                      // Marca como erro
                      setDownloadsList(prev => prev.map(d => 
                        d.id === downloadId ? { ...d, state: 'interrupted' as const } : d
                      ));
                      console.error('Erro ao baixar imagem:', res.error);
                    } else {
                      // Remove se cancelado
                      setDownloadsList(prev => prev.filter(d => d.id !== downloadId));
                    }
                  });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Salvar imagem
            </div>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
            <div
              style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                const url = imgContextMenu.imgUrl || imgContextMenu.url;
                setImgContextMenu(null);
                addToTerminal('[Webâ†’Photo] Capturando imagem...');

                // Estratégia 1: captura direto do webview (já tem a imagem na memória â€” sem CORS)
                const tabId = activeBrowserTabIdRef.current;
                const webview = document.getElementById(`webview-${tabId}`) as any;

                const captureFromWebview = (): Promise<string | null> => {
                  if (!webview) return Promise.resolve(null);
                  const safeUrl = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                  const script = `(function() {
                    try {
                      var imgs = Array.from(document.querySelectorAll('img'));
                      var target = imgs.find(function(i) { return i.src === '${safeUrl}' || i.currentSrc === '${safeUrl}'; });
                      if (!target || !target.complete || target.naturalWidth === 0) return null;
                      var cvs = document.createElement('canvas');
                      cvs.width = target.naturalWidth;
                      cvs.height = target.naturalHeight;
                      var ctx = cvs.getContext('2d');
                      ctx.drawImage(target, 0, 0);
                      return cvs.toDataURL('image/png');
                    } catch(e) { return null; }
                  })()`;
                  return webview.executeJavaScript(script).catch(() => null);
                };

                const applyImage = (src: string) => {
                  console.log('[Context Menu] Enviando imagem para PhotoEditor:', src.substring(0, 50));
                  const result = photoEditorRef.current?.applyAIAction('add-image', { imageSrc: src });
                  console.log('[Context Menu] Resultado:', result);
                  setActiveMainView('photo');
                  addToTerminal('[Web→Photo] ✅ Imagem adicionada ao canvas!');
                  lastClickedImageRef.current = '';
                  const wv = document.getElementById(`webview-${activeBrowserTabIdRef.current}`) as any;
                  if (wv) wv.executeJavaScript('window.__billLastClickedImg = null;').catch(() => {});
                };

                captureFromWebview()
                  .then((dataUrl) => {
                    console.log('[DEBUG captureFromWebview] retornou:', dataUrl ? dataUrl.substring(0, 80) : 'null');
                    if (dataUrl && dataUrl.startsWith('data:image')) {
                      console.log('[DEBUG] É uma imagem válida, aplicando...');
                      applyImage(dataUrl);
                    } else {
                      // Estratégia 2: fetch via Electron (Node.js, sem CORS)
                      return (window as any).electronAPI.fetchImageAsDataUrl(url)
                        .then((res: any) => {
                          if (res.success && res.dataUrl) {
                            applyImage(res.dataUrl);
                          } else {
                            addToTerminal(`[Webâ†’Photo] âŒ Não foi possível carregar a imagem: ${res.error || 'bloqueada pelo site'}`);
                          }
                        });
                    }
                  })
                  .catch(() => {
                    addToTerminal('[Webâ†’Photo] âŒ Erro ao capturar imagem.');
                  });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Editar no Photo Editor
            </div>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
            <div
              style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                const url = imgContextMenu.imgUrl || imgContextMenu.url;
                setImgContextMenu(null);
                addToTerminal('[Webâ†’Video] Salvando imagem para o editor de vídeo...');
                (window as any).electronAPI.saveImageToTemp(url)
                  .then((res: any) => {
                    if (res.success && res.path) {
                      videoEditorRef.current?.applyAIAction('add-clip', { path: res.path, type: 'image' });
                      setActiveMainView('video');
                      addToTerminal('[Webâ†’Video] Imagem adicionada à timeline!');
                    } else {
                      alert(`Erro: ${res.error}`);
                    }
                  });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Enviar ao Editor de Vídeo
            </div>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
            <div
              style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                const url = imgContextMenu.imgUrl || imgContextMenu.url;
                setImgContextMenu(null);
                addToTerminal('[Webâ†’Paint] Capturando imagem...');

                const tabId = activeBrowserTabIdRef.current;
                const webview = document.getElementById(`webview-${tabId}`) as any;

                const captureFromWebview = (): Promise<string | null> => {
                  if (!webview) return Promise.resolve(null);
                  const safeUrl = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                  const script = `(function() {
                    try {
                      var imgs = Array.from(document.querySelectorAll('img'));
                      var target = imgs.find(function(i) { return i.src === '${safeUrl}' || i.currentSrc === '${safeUrl}'; });
                      if (!target || !target.complete || target.naturalWidth === 0) return null;
                      var cvs = document.createElement('canvas');
                      cvs.width = target.naturalWidth; cvs.height = target.naturalHeight;
                      cvs.getContext('2d').drawImage(target, 0, 0);
                      return cvs.toDataURL('image/png');
                    } catch(e) { return null; }
                  })()`;
                  return webview.executeJavaScript(script).catch(() => null);
                };

                const applyToPaint = (src: string) => {
                  paintRef.current?.applyPaintAction('add-reference', { src, opacity: 100 });
                  setActiveMainView('paint');
                  addToTerminal('[Webâ†’Paint] âœ… Imagem adicionada ao Paint!');
                  lastClickedImageRef.current = '';
                  const wv = document.getElementById(`webview-${activeBrowserTabIdRef.current}`) as any;
                  if (wv) wv.executeJavaScript('window.__billLastClickedImg = null;').catch(() => {});
                };

                captureFromWebview()
                  .then((dataUrl) => {
                    if (dataUrl && dataUrl.startsWith('data:')) {
                      applyToPaint(dataUrl);
                    } else {
                      return (window as any).electronAPI.fetchImageAsDataUrl(url)
                        .then((res: any) => {
                          if (res.success && res.dataUrl) {
                            applyToPaint(res.dataUrl);
                          } else {
                            addToTerminal(`[Webâ†’Paint] âŒ Não foi possível carregar: ${res.error || 'bloqueada'}`);
                          }
                        });
                    }
                  })
                  .catch(() => addToTerminal('[Webâ†’Paint] âŒ Erro ao capturar imagem.'));
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-4 4 4"/><path d="M7 13V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v10a4 4 0 0 1-8 0"/></svg>
              Enviar ao Paint
            </div>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
            <div
              style={{ padding: '9px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '0 0 4px 4px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                navigator.clipboard.writeText(imgContextMenu.url).catch(() => {});
                setImgContextMenu(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copiar URL da imagem
            </div>
            </>
            )}
          </div>
        )}

        {/* Toggle Chat Handle */}
        {!gamingMode && (
        <div 
          onClick={() => setChatCollapsed(!chatCollapsed)}
          style={{
            width: '12px',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderLeft: '1px solid var(--border-light)',
            zIndex: 10001, // Acima do CustomPanel e do chat
            transition: 'background 0.2s'
          }}
          className="panel-toggle-handle"
          title={chatCollapsed ? "Expandir Chat" : "Recolher Chat"}
        >
          <div style={{ 
            width: '2px', 
            height: '30px', 
            background: 'var(--text-secondary)', 
            borderRadius: '2px',
            opacity: 0.5
          }} />
        </div>
        )}

        {/* Chat Container */}
        <div style={gamingMode ? {
          width: '100%',
          height: '100%',
          display: gamingMini ? 'none' : 'flex',
          flexDirection: 'column' as const,
          zIndex: 10000, // Acima do CustomPanel
        } : {
          width: chatCollapsed ? '0' : '380px',
          minWidth: chatCollapsed ? '0' : '380px',
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderLeft: chatCollapsed ? 'none' : '1px solid var(--border-light)',
          zIndex: 10000, // Acima do CustomPanel (9999)
        }}>
          <Chat
            reminderNotification={reminderNotification}
            onDismissReminder={() => setReminderNotification(null)}
            incomingReminderCall={incomingReminderCall}
            onAnswerReminderCall={() => {
              console.log('[App] 🎯 Botão ATENDER clicado!');
              // Quando aceita a chamada, passa os dados para o Chat iniciar automaticamente
              if (incomingReminderCall && settings.bossModelId) {
                console.log('[App] ✓ Condições atendidas');
                console.log('[App] incomingReminderCall:', incomingReminderCall);
                console.log('[App] bossModelId:', settings.bossModelId);
                console.log('[App] Preparando dados para IA Chefe...');
                
                // Monta a mensagem do lembrete de forma CLARA que é um aviso
                const now = new Date();
                const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const reminderMessage = `[SISTEMA: LEMBRETE AGENDADO]

ATENÇÃO: Um lembrete agendado está sendo disparado neste momento (${currentTime}).

📌 ${incomingReminderCall.title}
🕐 Horário: ${incomingReminderCall.time}${incomingReminderCall.notes ? `\n📝 ${incomingReminderCall.notes}` : ''}

INSTRUÇÃO: Você está em uma ligação para avisar sobre este lembrete agendado. Comunique de forma direta e séria que o horário chegou. Este é um recado importante que o usuário programou.`;
                
                console.log('[App] Mensagem montada:', reminderMessage);
                
                // Passa os dados para o Chat via variável global temporária
                (window as any).pendingReminderCall = {
                  bossModelId: settings.bossModelId,
                  reminderMessage
                };
                console.log('[App] ✓ Dados salvos em window.pendingReminderCall');
                console.log('[App] Conteúdo:', (window as any).pendingReminderCall);
                
                // IMPORTANTE: Garante que o chat está visível
                setChatCollapsed(false);
                console.log('[App] Chat expandido');
                
                // Fecha o overlay IMEDIATAMENTE para forçar re-render do Chat
                console.log('[App] Fechando overlay...');
                setIncomingReminderCall(null);
                console.log('[App] ✓ Overlay fechado - Chat vai re-renderizar e detectar');
              } else {
                console.log('[App] ✗ Condições NÃO atendidas:', {
                  hasIncomingCall: !!incomingReminderCall,
                  hasBossModelId: !!settings.bossModelId
                });
              }
            }}
            onDeclineReminderCall={() => {
              console.log('[App] Chamada de lembrete recusada');
              setIncomingReminderCall(null);
            }}
            bossModelId={settings.bossModelId}
            messages={activeMainView === 'video' ? videoChatMessages : (activeMainView === 'photo' ? photoChatMessages : (activeMainView === 'paint' ? paintChatMessages : (activeMainView === 'web' ? webChatMessages : (activeMainView === 'home' ? homeChatMessages : chatMessages))))}
            onSendMessage={handleSendMessage}
            onSendGroupMessage={handleSendGroupMessage}
            isStreaming={isStreaming}
            isModelStreaming={(chatId: string) => streamingModels[chatId]?.isStreaming || false}
            onCancelStream={cancelStream}
            settings={settings}
            onRefreshModels={loadOllamaModels}
            activeMainView={activeMainView}
            activeProject={activeProject}
            onSetActiveProject={setActiveProject}
            onSetActiveMainView={setActiveMainView}
            onLoadProjectById={loadProjectById}
            streamingTokens={streamingTokens}
            streamingMode={streamingMode}
            lastStreamingTokens={lastStreamingTokensRef.current}
            tokenBars={tokenBars}
            gamingMode={gamingMode}
            currentActivity={currentActivity}
            onGamingToggle={() => {
              if (!gamingMode) {
                setGamingMode(true);
                setGamingMini(false);
                // Manda screenWidth e screenHeight reais do renderer
                (window as any).electronAPI.gamingModeEnter({ 
                  screenW: window.screen.width,
                  screenH: window.screen.height,
                  chatW: 380
                });
              } else {
                setGamingMode(false);
                setGamingMini(false);
                (window as any).electronAPI.gamingModeExit();
              }
            }}
            onGamingMini={() => {
              setGamingMini(true);
              (window as any).electronAPI.gamingModeMini({ screenW: window.screen.width, screenH: window.screen.height });
            }}
            pendingChanges={pendingChanges}
            onAcceptChange={acceptChange}
            onRejectChange={rejectChange}
            onClearMessages={() => {
              // Se tem chat ativo, limpa o localStorage também
              const currentActiveChat = activeChatRef.current;
              if (currentActiveChat) {
                console.log('[App] Limpando mensagens do chat:', currentActiveChat);
                localStorage.setItem(`bill-chat-${currentActiveChat}`, JSON.stringify([]));
                // Limpa o buffer também
                if (chatBuffersRef.current) {
                  chatBuffersRef.current.set(currentActiveChat, []);
                }
              }
              
              // Limpa o estado React
              if (activeMainView === 'video') setVideoChatMessages([]);
              else if (activeMainView === 'photo') setPhotoChatMessages([]);
              else if (activeMainView === 'paint') setPaintChatMessages([]);
              else if (activeMainView === 'web') setWebChatMessages([]);
              else if (activeMainView === 'home') setHomeChatMessages([]);
              else setChatMessages([]);
            }}
          />
        </div>
      </div>
      )}


      {gamingMini && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.screenX;
            const startY = e.screenY;
            let moved = false;
            let lastUpdate = Date.now();
            
            // Pausa o polling circular para capturar todos os eventos
            (window as any).electronAPI.pauseMiniPolling?.();
            (window as any).electronAPI.setIgnoreMouseEvents?.(false);
            setMiniIconDragging(true);
            
            const handleMove = (moveEvent: MouseEvent) => {
              const dx = Math.abs(moveEvent.screenX - startX);
              const dy = Math.abs(moveEvent.screenY - startY);
              if (dx > 5 || dy > 5) {
                moved = true;
                // Throttle para 16ms (60fps) ao invés de esperar muito
                const now = Date.now();
                if (now - lastUpdate > 16) {
                  const newX = moveEvent.screenX - 24;
                  const newY = moveEvent.screenY - 24;
                  (window as any).electronAPI.setMiniIconPosition?.({ x: newX, y: newY });
                  lastUpdate = now;
                }
              }
            };
            
            const handleUp = (upEvent: MouseEvent) => {
              setMiniIconDragging(false);
              window.removeEventListener('mousemove', handleMove);
              window.removeEventListener('mouseup', handleUp);
              
              // Atualiza posição final
              if (moved) {
                const finalX = upEvent.screenX - 24;
                const finalY = upEvent.screenY - 24;
                (window as any).electronAPI.setMiniIconPosition?.({ x: finalX, y: finalY });
              }
              
              if (!moved) {
                // É um clique - expande o chat
                setGamingMini(false);
                setHasUnreadMessages(false);
                (window as any).electronAPI.gamingModeExpand({ 
                  screenW: window.screen.width, 
                  screenH: window.screen.height,
                  chatW: 380
                });
              } else {
                // É um drag - resume o polling
                (window as any).electronAPI.resumeMiniPolling?.();
              }
            };
            
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
          }}
          title="Arraste para mover, clique para expandir"
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: miniIconDragging ? 'grabbing' : 'grab',
            background: '#1a1a1a',
            userSelect: 'none',
            borderRadius: '30%',
          }}
        >
          <div style={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'visible',
          }}>
            <img 
              src={miniIconBlink ? mouseBlinkImg : mouseOpenImg}
              alt="Gabiru"
              style={{
                width: '200%',
                height: '200%',
                objectFit: 'contain',
              }}
            />
            {hasUnreadMessages && (
              <div style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid white',
              }} />
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Terminal Flutuante â€” drag + resize â”€â”€ */}
      {terminalMode === 'floating' && (
        <div style={{
          position: 'fixed',
          left: floatPos.x,
          top: floatPos.y,
          width: floatSize.w,
          height: floatSize.h,
          zIndex: 9990,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.75), 0 4px 16px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* â”€â”€ Barra de arrastar â”€â”€ */}
          <div
            onMouseDown={startFloatDrag}
            style={{
              height: 22,
              background: '#111111',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              gap: 3,
            }}
          >
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 22, height: 2, borderRadius: 1, background: '#3a3a3a' }} />
            ))}
          </div>

          {/* â”€â”€ Terminal Card â”€â”€ */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TerminalCard
              output={terminalOutput}
              onExecuteCommand={handleExecuteCommand}
              onClear={handleClearTerminal}
              terminalAgent={terminalAgent}
              onSetAgent={setTerminalAgent}
              onSendAgentMessage={handleSendAgentMessage}
              isStreaming={isStreaming}
              terminalMode={terminalMode}
              onSetTerminalMode={setTerminalMode}
              fillHeight
            />
          </div>

          {/* â”€â”€ Handles de resize â€” 8 direçÃµes â”€â”€ */}
          {/* Cantos */}
          <div onMouseDown={e => startFloatResize(e, 'nw')} style={{ position: 'absolute', top: 0, left: 0,     width: 14, height: 14, cursor: 'nw-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 'ne')} style={{ position: 'absolute', top: 0, right: 0,    width: 14, height: 14, cursor: 'ne-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 'sw')} style={{ position: 'absolute', bottom: 0, left: 0,  width: 14, height: 14, cursor: 'sw-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 'se')} style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, cursor: 'se-resize', zIndex: 10 }} />
          {/* Bordas */}
          <div onMouseDown={e => startFloatResize(e, 'n')} style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 5, cursor: 'n-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 's')} style={{ position: 'absolute', bottom: 0, left: 14, right: 14, height: 5, cursor: 's-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 'w')} style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 5, cursor: 'w-resize', zIndex: 10 }} />
          <div onMouseDown={e => startFloatResize(e, 'e')} style={{ position: 'absolute', right: 0, top: 14, bottom: 14, width: 5, cursor: 'e-resize', zIndex: 10 }} />
        </div>
      )}

      {needsRestart && (
        <div className="restart-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="restart-card" style={{
            background: 'var(--bg-secondary)',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 30px rgba(0,0,0,0.5)',
            maxWidth: '400px'
          }}>
            <h2 style={{ color: 'var(--accent)', marginBottom: '15px', letterSpacing: '2px' }}>ALMA SINCRONIZADA!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '14px', lineHeight: '1.5' }}>
              As mudanças na personalidade do Bill foram gravadas com sucesso. <br/>
              Para que ele assuma a nova identidade, o app precisa ser reiniciado.
            </p>
            <button 
              onClick={() => (window as any).electronAPI.relaunchApp()}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s'
              }}
            >
              REINICIAR AGORA
            </button>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SISTEMA DE APROVAÇÃO DE MUDANÇAS (Supervised Mode) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* Toggle removido - use settings para ativar Supervised Mode se necessário */}
      
      {/* Preview de Mudanças - REMOVIDO, botões agora estão no chat */}

      {/* Modal de Instalação de Dependências */}
      {showDependencyInstaller && (
        <DependencyInstaller 
          onClose={() => {
            if (dependenciesInstalled) {
              setShowDependencyInstaller(false);
            }
          }} 
          blockClose={!dependenciesInstalled}
          onInstallComplete={() => {
            setDependenciesInstalled(true);
          }}
        />
      )}

      {/* Custom Panel - Painel Customizado */}
      {showCustomPanel && (
        <CustomPanel 
          initialPanel={selectedResearch}
          chatCollapsed={chatCollapsed}
          onClose={() => {
            setShowCustomPanel(false);
            setSelectedResearch(null);
            // Recarrega lista de criativos após fechar
            try {
              const saved = localStorage.getItem('billcode_custom_panels');
              const panels = saved ? JSON.parse(saved) : [];
              setSearchResults(panels);
              console.log('[Criativos] Lista recarregada:', panels.length);
            } catch (e) {
              console.error('[Criativos] Erro ao recarregar:', e);
            }
          }}
          onOpenUrl={(url) => {
            setActiveMainView('web');
            setShowWebMenu(false);
            const newTabId = Date.now().toString();
            webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
            forceWebviewRender(n => n + 1);
            setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
            setActiveBrowserTabId(newTabId);
            activeBrowserTabIdRef.current = newTabId;
            setTimeout(() => {
              const webview = document.getElementById(`webview-${newTabId}`) as any;
              if (webview) { webview.focus(); webview.loadURL(url); }
            }, 300);
          }}
        />
      )}

      {/* Minhas Pesquisas */}
      {showMyResearch && (
        <MyResearch 
          onClose={() => setShowMyResearch(false)}
          onOpenUrl={(url) => {
            setActiveMainView('web');
            setShowWebMenu(false); // Fecha o menu web para mostrar a página
            const newTabId = Date.now().toString();
            webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
            forceWebviewRender(n => n + 1);
            setBrowserTabs(prev => [...prev, { id: newTabId, url, title: 'Carregando...' }]);
            setActiveBrowserTabId(newTabId);
            activeBrowserTabIdRef.current = newTabId;
            setTimeout(() => {
              const webview = document.getElementById(`webview-${newTabId}`) as any;
              if (webview) { webview.focus(); webview.loadURL(url); }
            }, 300);
          }}
        />
      )}

      {/* Histórico de Navegação */}
      {showBrowserHistory && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowBrowserHistory(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Histórico de Navegação
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Últimos {browserHistory.length} sites visitados
                </p>
              </div>
              <button
                onClick={() => setShowBrowserHistory(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de histórico */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {browserHistory.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'var(--text-secondary)'
                }}>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Nenhum site visitado ainda.
                  </p>
                </div>
              ) : (
                browserHistory.map((entry, idx) => {
                  const date = new Date(entry.timestamp);
                  const now = new Date();
                  const isToday = date.toDateString() === now.toDateString();
                  const yesterday = new Date(now);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const isYesterday = date.toDateString() === yesterday.toDateString();
                  
                  let timeStr = '';
                  if (isToday) {
                    timeStr = `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                  } else if (isYesterday) {
                    timeStr = `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                  } else {
                    timeStr = date.toLocaleString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  }
                  
                  return (
                    <div
                      key={`${entry.url}-${idx}`}
                      style={{
                        padding: '16px',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#8b5cf6';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div
                        onClick={() => {
                          setActiveMainView('web');
                          setShowWebMenu(false);
                          setShowBrowserHistory(false);
                          const newTabId = Date.now().toString();
                          webviewInsertionOrder.current = [...webviewInsertionOrder.current, newTabId];
                          forceWebviewRender(n => n + 1);
                          setBrowserTabs(prev => [...prev, { id: newTabId, url: entry.url, title: entry.title }]);
                          setActiveBrowserTabId(newTabId);
                          activeBrowserTabIdRef.current = newTabId;
                          setTimeout(() => {
                            const webview = document.getElementById(`webview-${newTabId}`) as any;
                            if (webview) { webview.focus(); webview.loadURL(entry.url); }
                          }, 300);
                        }}
                      >
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: '6px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: '40px'
                        }}>
                          {entry.title || 'Sem título'}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--accent)',
                          marginBottom: '8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {entry.url}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--text-secondary)'
                        }}>
                          {timeStr}
                        </div>
                      </div>
                      
                      {/* Botão de excluir */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = browserHistory.filter((_, i) => i !== idx);
                          setBrowserHistory(updated);
                          localStorage.setItem('billcode_browser_history', JSON.stringify(updated));
                        }}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          padding: '6px',
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#fff',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dc2626';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        title="Excluir do histórico"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Atalho */}
      {showAddShortcut && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowAddShortcut(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '100%',
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Adicionar Atalho
              </h3>
              <button
                onClick={() => setShowAddShortcut(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Nome do Site
              </label>
              <input
                type="text"
                value={shortcutName}
                onChange={(e) => setShortcutName(e.target.value)}
                placeholder="Ex: Facebook, YouTube, etc."
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border-light)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomShortcut();
                }}
                autoFocus
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                URL do Site
              </label>
              <input
                type="text"
                value={shortcutUrl}
                onChange={(e) => setShortcutUrl(e.target.value)}
                placeholder="Ex: facebook.com, youtube.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border-light)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomShortcut();
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddShortcut(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border-light)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              >
                Cancelar
              </button>
              <button
                onClick={addCustomShortcut}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Video Downloader */}
      {showVideoDownloader && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            setShowVideoDownloader(false);
            setVideoDownloadUrl('');
            setVideoFormats([]);
            setVideoInfo(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Baixar Vídeo
              </h3>
              <button
                onClick={() => {
                  setShowVideoDownloader(false);
                  setVideoDownloadUrl('');
                  setVideoFormats([]);
                  setVideoInfo(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Cole o link do vídeo (YouTube, Instagram, TikTok, etc.)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={videoDownloadUrl}
                  onChange={(e) => setVideoDownloadUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (!videoDownloadUrl.trim()) return;
                    setIsLoadingFormats(true);
                    setVideoFormats([]);
                    setVideoInfo(null);
                    
                    try {
                      const result = await window.electronAPI.getVideoInfo(videoDownloadUrl);
                      if (result.success) {
                        setVideoInfo(result.info);
                        setVideoFormats(result.formats || []);
                        setVideoDownloadStatus('');
                      } else {
                        setVideoDownloadStatus('❌ ' + (result.error || 'Erro ao obter informações'));
                      }
                    } catch (error) {
                      console.error('[VideoDownloader] Erro:', error);
                      setVideoDownloadStatus('❌ Erro ao processar o vídeo');
                    } finally {
                      setIsLoadingFormats(false);
                    }
                  }}
                  disabled={isLoadingFormats || !videoDownloadUrl.trim()}
                  style={{
                    padding: '12px 24px',
                    background: isLoadingFormats ? 'var(--bg-tertiary)' : 'var(--accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isLoadingFormats ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isLoadingFormats ? 'Carregando...' : 'Buscar'}
                </button>
              </div>
            </div>
            
            {videoDownloadStatus && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                background: videoDownloadStatus.startsWith('✅') ? 'rgba(16, 185, 129, 0.1)' : videoDownloadStatus.startsWith('⏳') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `2px solid ${videoDownloadStatus.startsWith('✅') ? 'rgb(16, 185, 129)' : videoDownloadStatus.startsWith('⏳') ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)'}`,
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {videoDownloadStatus}
              </div>
            )}

            {videoInfo && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '12px', border: '2px solid var(--border-light)' }}>
                {videoInfo.thumbnail && (
                  <img src={videoInfo.thumbnail} alt="Thumbnail" style={{ width: '100%', borderRadius: '8px', marginBottom: '12px' }} />
                )}
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {videoInfo.title}
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {videoInfo.duration ? `Duração: ${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')}` : ''}
                </p>
                {videoInfo.thumbnail && (
                  <button
                    onClick={async () => {
                      try {
                        await window.electronAPI.downloadFile(videoInfo.thumbnail, `${videoInfo.title || 'thumbnail'}.jpg`);
                        setVideoDownloadStatus('✅ Thumbnail baixada com sucesso!');
                      } catch (error) {
                        setVideoDownloadStatus('❌ Erro ao baixar thumbnail');
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--bg-secondary)',
                      border: '2px solid var(--accent)',
                      borderRadius: '6px',
                      color: 'var(--accent)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--accent)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                  >
                    Baixar Thumbnail
                  </button>
                )}
              </div>
            )}

            {videoFormats.length > 0 && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Pasta de destino:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      flex: 1,
                      padding: '12px',
                      background: 'var(--bg-primary)',
                      border: '2px solid var(--border-light)',
                      borderRadius: '8px',
                      color: videoDownloadPath ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {videoDownloadPath || 'Nenhuma pasta selecionada'}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const result = await window.electronAPI.selectFolder();
                          if (result.success && result.path) {
                            setVideoDownloadPath(result.path);
                          }
                        } catch (error) {
                          console.error('[SelectFolder] Erro:', error);
                        }
                      }}
                      style={{
                        padding: '12px 20px',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Escolher Pasta
                    </button>
                  </div>
                </div>
                
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Escolha a qualidade:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {videoFormats.map((format, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        if (!videoDownloadPath) {
                          setVideoDownloadStatus('⚠️ Por favor, escolha uma pasta de destino primeiro!');
                          return;
                        }
                        setIsDownloading(true);
                        setVideoDownloadStatus('⏳ Iniciando download...');
                        try {
                          const result = await window.electronAPI.downloadVideo(videoDownloadUrl, format.format_id, videoDownloadPath);
                          if (result.success) {
                            setVideoDownloadStatus('✅ Download em andamento! Salvando em: ' + videoDownloadPath);
                          } else {
                            setVideoDownloadStatus('❌ Erro: ' + (result.error || 'Falha no download'));
                          }
                        } catch (error) {
                          setVideoDownloadStatus('❌ Erro ao iniciar download');
                        } finally {
                          setIsDownloading(false);
                        }
                      }}
                      disabled={isDownloading}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        opacity: isDownloading ? 0.5 : 1
                      }}
                      onMouseEnter={e => {
                        if (!isDownloading) {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span>
                        {format.type === 'audio' ? '🎵 ' : '🎬 '}
                        {format.quality || format.resolution || 'Qualidade desconhecida'}
                        {format.hasAudio && format.type !== 'audio' ? ' (com áudio)' : ''}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {format.ext || 'mp4'} {format.filesize ? `• ${(format.filesize / (1024 * 1024)).toFixed(1)}MB` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Downloads Manager */}
      {showDownloadsManager && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setShowDownloadsManager(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              border: '2px solid var(--border-light)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Download size={24} />
                Downloads ({downloadsList.length})
              </h3>
              <button
                onClick={() => setShowDownloadsManager(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Lista de Downloads */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {downloadsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <Download size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>Nenhum download registrado ainda</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {downloadsList.map((download) => {
                    const progress = download.totalBytes > 0 ? (download.receivedBytes / download.totalBytes) * 100 : 0;
                    const sizeMB = (download.receivedBytes / (1024 * 1024)).toFixed(2);
                    const totalMB = (download.totalBytes / (1024 * 1024)).toFixed(2);
                    
                    return (
                      <div
                        key={download.id}
                        style={{
                          background: 'var(--bg-primary)',
                          borderRadius: '12px',
                          padding: '16px',
                          border: '2px solid var(--border-light)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            background: download.state === 'completed' ? '#10b981' : download.state === 'progressing' ? '#3b82f6' : '#ef4444',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {download.state === 'completed' ? '✓' : download.state === 'progressing' ? '↓' : '✗'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {download.filename}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {download.state === 'completed' ? `${totalMB} MB • Concluído` : 
                               download.state === 'progressing' ? `${sizeMB} MB / ${totalMB} MB • ${progress.toFixed(0)}%` :
                               download.state === 'cancelled' ? 'Cancelado' : 'Erro'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {download.state === 'completed' && (
                              <button
                                onClick={() => {
                                  (window as any).electronAPI?.openPath(download.path);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  background: 'var(--accent)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Abrir
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setDownloadsList(prev => prev.filter(d => d.id !== download.id));
                              }}
                              style={{
                                padding: '8px',
                                background: 'var(--bg-secondary)',
                                border: '2px solid var(--border-light)',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remover da lista"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        {download.state === 'progressing' && (
                          <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${progress}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                              transition: 'width 0.3s'
                            }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu de contexto para texto selecionado */}
      {contextMenu && (
        <div
          id="text-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-light)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 99998,
            minWidth: '150px',
            overflow: 'hidden'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(contextMenu.text);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Copiar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTranslateText(contextMenu.text);
              setTranslatedText('');
              setShowTranslator(true);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid var(--border-light)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Traduzir
          </button>
        </div>
      )}

      {/* Modal: Tradutor */}
      {showTranslator && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setShowTranslator(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              border: '2px solid var(--border-light)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Tradutor
              </h3>
              <button
                onClick={() => setShowTranslator(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Seletores de idioma */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={translateFrom}
                  onChange={(e) => setTranslateFrom(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                  <option value="de">Alemão</option>
                  <option value="it">Italiano</option>
                  <option value="pt-br">Português</option>
                  <option value="ja">Japonês</option>
                  <option value="zh">Chinês</option>
                  <option value="ko">Coreano</option>
                  <option value="ru">Russo</option>
                </select>
                <button
                  onClick={() => {
                    const temp = translateFrom;
                    setTranslateFrom(translateTo);
                    setTranslateTo(temp);
                  }}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                  title="Inverter idiomas"
                >
                  ⇄
                </button>
                <select
                  value={translateTo}
                  onChange={(e) => setTranslateTo(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="pt-br">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                  <option value="de">Alemão</option>
                  <option value="it">Italiano</option>
                  <option value="ja">Japonês</option>
                  <option value="zh">Chinês</option>
                  <option value="ko">Coreano</option>
                  <option value="ru">Russo</option>
                </select>
              </div>

              {/* Área de texto original */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Texto original
                </label>
                <textarea
                  value={translateText}
                  onChange={(e) => setTranslateText(e.target.value)}
                  placeholder="Digite ou cole o texto aqui..."
                  style={{
                    flex: 1,
                    minHeight: '150px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                />
              </div>

              {/* Botão Traduzir */}
              <button
                onClick={async () => {
                  if (!translateText.trim()) return;
                  setIsTranslating(true);
                  try {
                    const result = await (window as any).electronAPI.translateText(translateText, translateFrom, translateTo);
                    if (result.success) {
                      setTranslatedText(result.translatedText);
                    } else {
                      setTranslatedText('Erro ao traduzir. Tente novamente.');
                    }
                  } catch (error) {
                    setTranslatedText('Erro de conexão. Verifique sua internet.');
                  } finally {
                    setIsTranslating(false);
                  }
                }}
                disabled={isTranslating || !translateText.trim()}
                style={{
                  padding: '14px',
                  background: isTranslating ? 'var(--bg-tertiary)' : '#06b6d4',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isTranslating || !translateText.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTranslating || !translateText.trim() ? 0.5 : 1
                }}
              >
                {isTranslating ? 'Traduzindo...' : 'Traduzir'}
              </button>

              {/* Área de tradução */}
              {translatedText && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Tradução
                    </label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(translatedText);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <div style={{
                    flex: 1,
                    minHeight: '150px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    overflowY: 'auto'
                  }}>
                    {translatedText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Versão Beta */}
      {showBetaModal && (
        <div 
          onClick={() => setShowBetaModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            backdropFilter: 'blur(4px)'
          }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '28px 32px',
              maxWidth: '560px',
              width: '90%',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}>
            {/* Botão fechar */}
            <button
              onClick={() => setShowBetaModal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '20px',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              ×
            </button>

            {/* Badge Versão Beta */}
            <div style={{
              display: 'inline-block',
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#d4af37',
              letterSpacing: '0.5px',
              marginBottom: '20px'
            }}>
              Versão Beta - v0.1.0
            </div>

            {/* Mensagem */}
            <div style={{
              color: 'var(--text-primary)',
              fontSize: '14.5px',
              lineHeight: '1.7',
              marginBottom: '24px'
            }}>
              <p style={{ marginBottom: '14px' }}>
                Olá! O Ratinho ficou muito feliz que você tenha baixado o app. Este aplicativo foi feito sem nenhuma intenção financeira, tentei focar ao máximo em fazer todas as funcionalidades rodarem no seu próprio computador. O objetivo é criar um workspace com várias ferramentas úteis em um só lugar, integrando IA em todas essas etapas. O resultado ainda não é o planejado, e pretendo melhorar com o tempo cada funcionalidade.
              </p>
              <p style={{ marginBottom: '14px' }}>
                O aplicativo foi feito no meu tempo livre e não foi gasto um único centavo nele, e essa foi uma grande limitação, pois fiz tudo sozinho e o uso de IA é bastante limitado por conta dos tokens serem 100% gratuitos. Enfim, me desculpe pela enrolação para dizer que é apenas uma versão beta, então tenham misericórdia!
              </p>
              <p style={{ marginBottom: '0' }}>
                Sobre o desenvolvimento do app: pretendo continuar e analisar cada sugestão, mas ele não é um ganha-pão, então não posso focar 100% nele. Mas garanto que o app não será abandonado de jeito nenhum. Em breve, mais atualizações!
              </p>
            </div>

            {/* Botão Entendi */}
            <button
              onClick={() => setShowBetaModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #d4af37 0%, #f9d770 100%)',
                border: '1px solid #b8941f',
                borderRadius: '8px',
                color: '#1a1a2e',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(212, 175, 55, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 175, 55, 0.3)';
              }}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
