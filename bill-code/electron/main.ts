import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { injectPreviewBridge } from './previewBridge';

let mainWindow: BrowserWindow | null = null;
let pythonWorker: any = null;
const pendingRequests = new Map();
let requestId = 0;
let savedBoundsBeforeGaming: { x: number; y: number; width: number; height: number } | null = null;
let lastMiniIconPosition: { x: number; y: number } | null = null;
let currentActivity: { app: string; title: string } | null = null;
let activityCheckInterval: NodeJS.Timeout | null = null;
 
// ── Proteção global contra crashes não capturados no processo principal ───────
process.on('uncaughtException', (err: any) => {
  console.error('[Main Process] ⚠️ Uncaught Exception intercepted:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[Main Process] ⚠️ Unhandled Rejection intercepted:', reason?.message || reason);
});

// ── Resolução dinâmica de dependências externas ─────────────────────────────

export function getPiperPathBase(): string {
  const candidates = [
    // Runtime na AppData (quando usuário instala dependências)
    path.join(app.getPath('appData'), 'bill-code', 'runtime', 'piper-tts'),
    path.join(process.env.APPDATA || '', 'bill-code', 'runtime', 'piper-tts'),
    // Resources do Electron (fallback - vem com o instalador)
    path.join(process.resourcesPath || '', 'piper-voices'),
    // Pasta de instalação do programa
    path.join(path.dirname(process.execPath), 'piper-tts'),
    path.join(path.dirname(process.execPath), 'runtime', 'piper-tts'),
    // Dev
    path.join(__dirname, '..', 'piper-tts'),
    'C:\\Users\\Administrator\\Desktop\\piper',
  ];
  
  console.log('[Piper] Procurando piper.exe nos seguintes caminhos:');
  for (const c of candidates) {
    const piperExePath = path.join(c, 'piper.exe');
    console.log(`  [Piper] Testando: ${piperExePath}`);
    try { 
      if (fs.existsSync(piperExePath)) {
        console.log(`  [Piper] ✓ ENCONTRADO em: ${c}`);
        return c;
      } else {
        console.log(`  [Piper] ✗ Não encontrado`);
      }
    } catch (e) {
      console.log(`  [Piper] ✗ Erro ao verificar: ${e}`);
    }
  }
  
  console.log(`[Piper] ⚠ piper.exe não encontrado em nenhum candidato!`);
  console.log(`[Piper] Usando fallback: ${candidates[2]} (extraResources)`);
  return candidates[2]; // Retorna o extraResources como fallback
}

export function getPiperExe(): string {
  return path.join(getPiperPathBase(), 'piper.exe');
}

export function getPythonExe(): string {
  const candidates = [
    path.join(path.dirname(process.execPath), 'runtime', 'python', 'python.exe'),
    path.join(app.getPath('userData'), 'runtime', 'python', 'python.exe'),
    path.join(process.env.APPDATA || '', 'bill-code', 'runtime', 'python', 'python.exe'),
    path.join(process.env.APPDATA || '', 'Gabiru', 'runtime', 'python', 'python.exe'),
    path.join(app.getPath('appData'), 'bill-code', 'runtime', 'python', 'python.exe'),
    path.join(app.getPath('appData'), 'Gabiru', 'runtime', 'python', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'bill-code', 'runtime', 'python', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Gabiru', 'runtime', 'python', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return 'python';
}

export function getFfmpegPath(): string {
  const candidates = [
    // Runtime do instalador (ao lado do .exe)
    path.join(path.dirname(process.execPath), 'runtime', 'ffmpeg'),
    // Runtime baixado pelo app (AppData / userData)
    path.join(app.getPath('userData'), 'runtime', 'ffmpeg'),
    path.join(process.env.APPDATA || '', 'bill-code', 'runtime', 'ffmpeg'),
    path.join(process.env.APPDATA || '', 'Gabiru', 'runtime', 'ffmpeg'),
    path.join(app.getPath('appData'), 'bill-code', 'runtime', 'ffmpeg'),
    path.join(app.getPath('appData'), 'Gabiru', 'runtime', 'ffmpeg'),
    path.join(process.env.LOCALAPPDATA || '', 'bill-code', 'runtime', 'ffmpeg'),
    path.join(process.env.LOCALAPPDATA || '', 'Gabiru', 'runtime', 'ffmpeg'),
    path.join(process.resourcesPath || '', 'ffmpeg'),
  ];
  
  const findExe = (dir: string, depth = 0): string | null => {
    if (depth > 3) return null;
    try {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe') return full;
        if (e.isDirectory()) {
          const f = findExe(full, depth + 1);
          if (f) return f;
        }
      }
    } catch {}
    return null;
  };
  
  for (const candidate of candidates) {
    const found = findExe(candidate);
    if (found) {
      const ffmpegDir = path.dirname(found);
      if (!process.env.PATH?.includes(ffmpegDir)) {
        process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
      }
      return found;
    }
  }
  
  // Fallback: caminhos manuais do dev
  const manualCandidates = [
    'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  ];
  
  for (const c of manualCandidates) {
    try { 
      if (fs.existsSync(c)) {
        const ffmpegDir = path.dirname(c);
        if (!process.env.PATH?.includes(ffmpegDir)) {
          process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
        }
        return c;
      }
    } catch {}
  }
  
  return 'ffmpeg';
}

export function getFfprobePath(): string {
  const ffmpeg = getFfmpegPath();
  if (ffmpeg !== 'ffmpeg') {
    const probe = path.join(path.dirname(ffmpeg), 'ffprobe.exe');
    try { if (fs.existsSync(probe)) return probe; } catch {}
  }
  return 'ffprobe';
}

let PIPER_PATH_BASE = getPiperPathBase();
let PIPER_EXE = getPiperExe();
let PYTHON_EXE = getPythonExe();
let FFMPEG_PATH = getFfmpegPath();

export function refreshRuntimePaths() {
  PIPER_PATH_BASE = getPiperPathBase();
  PIPER_EXE = getPiperExe();
  PYTHON_EXE = getPythonExe();
  FFMPEG_PATH = getFfmpegPath();

  if (FFMPEG_PATH !== 'ffmpeg') {
    const ffmpegDir = path.dirname(FFMPEG_PATH);
    if (!process.env.PATH?.includes(ffmpegDir)) {
      process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
    }
  }
  if (PYTHON_EXE !== 'python') {
    const pythonDir = path.dirname(PYTHON_EXE);
    const scriptsDir = path.join(pythonDir, 'Scripts');
    if (!process.env.PATH?.includes(pythonDir)) {
      process.env.PATH = `${pythonDir};${scriptsDir};${process.env.PATH}`;
    }
  }
  console.log(`[Runtime] Paths atualizados: FFmpeg="${FFMPEG_PATH}", Python="${PYTHON_EXE}", Piper="${PIPER_EXE}"`);
}

// Inicializa PATH do processo
refreshRuntimePaths();

// Helper: retorna env consistente para todos os spawns de Python
function getPythonEnv(): NodeJS.ProcessEnv {
  const currentFfmpeg = getFfmpegPath();
  const currentPython = getPythonExe();
  const ffmpegDir = path.dirname(currentFfmpeg);
  const pythonDir = path.dirname(currentPython);
  
  // Monta PYTHONPATH com todos os possíveis diretórios de pacotes
  const pythonPaths: string[] = [];
  if (pythonDir && pythonDir !== '.') {
    const sitePackages = path.join(pythonDir, 'Lib', 'site-packages');
    try { if (fs.existsSync(sitePackages)) pythonPaths.push(sitePackages); } catch {}
  }
  const runtimePkgs1 = path.join(path.dirname(process.execPath), 'runtime', 'python-packages');
  try { if (fs.existsSync(runtimePkgs1)) pythonPaths.push(runtimePkgs1); } catch {}
  const runtimePkgs2 = path.join(process.env.APPDATA || '', 'bill-code', 'runtime', 'python-packages');
  try { if (fs.existsSync(runtimePkgs2) && runtimePkgs2 !== runtimePkgs1) pythonPaths.push(runtimePkgs2); } catch {}
  const runtimePkgs3 = path.join(app.getPath('appData'), 'bill-code', 'runtime', 'python-packages');
  try { if (fs.existsSync(runtimePkgs3) && !pythonPaths.includes(runtimePkgs3)) pythonPaths.push(runtimePkgs3); } catch {}
  if (process.env.PYTHONPATH) pythonPaths.push(process.env.PYTHONPATH);
  
  // Monta PATH com diretório do FFmpeg e do Python
  let newPath = process.env.PATH || '';
  if (ffmpegDir && ffmpegDir !== '.') {
    newPath = `${ffmpegDir};${newPath}`;
  }
  if (pythonDir && pythonDir !== '.') {
    const scriptsDir = path.join(pythonDir, 'Scripts');
    newPath = `${pythonDir};${scriptsDir};${newPath}`;
  }
  
  return {
    ...process.env,
    PATH: newPath,
    PYTHONPATH: pythonPaths.join(';'),
    PYTHONIOENCODING: 'utf-8',
    FFMPEG_PATH: currentFfmpeg,
  };
}

// Scripts Python: busca nas diversas pastas possíveis (produção e dev)
function resolveScript(name: string): string {
  const candidates: string[] = [
    // 1. Extra resources (pasta real desempacotada em resources/scripts)
    path.join(process.resourcesPath || '', 'scripts', name),
    // 2. Unpacked asar (padrão electron-builder com asarUnpack)
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'scripts', name),
    // 3. Ao lado do executável da aplicação
    path.join(path.dirname(process.execPath), 'resources', 'scripts', name),
    path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'scripts', name),
    path.join(path.dirname(process.execPath), 'scripts', name),
    // 4. app.getAppPath() desempacotado
    path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'scripts', name),
    path.join(app.getAppPath(), 'scripts', name),
    // 5. Relativo ao __dirname (desenvolvimento)
    path.join(__dirname, '..', 'scripts', name),
    path.join(__dirname, 'scripts', name),
  ];
  
  for (const candidate of candidates) {
    const unpacked = candidate.replace('app.asar', 'app.asar.unpacked');
    if (unpacked !== candidate) {
      try {
        if (fs.existsSync(unpacked)) {
          console.log(`[resolveScript] ✅ Found "${name}" at: ${unpacked}`);
          return unpacked;
        }
      } catch {}
    }
    try {
      if (fs.existsSync(candidate)) {
        console.log(`[resolveScript] ✅ Found "${name}" at: ${candidate}`);
        return candidate;
      }
    } catch {}
  }
  
  console.warn(`[resolveScript] ⚠️ Script "${name}" not found in candidates, fallback: ${candidates[0]}`);
  return candidates[0];
}


// Detecta o aplicativo/jogo ativo no Windows
async function detectActiveWindow(): Promise<{ app: string; title: string } | null> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const os = require('os');
    const tempScript = path.join(os.tmpdir(), 'bill-activity.ps1');
    
    const script = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class User32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
"@

$hwnd = [User32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[void][User32]::GetWindowText($hwnd, $title, 256)
$processId = 0
[void][User32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
  Write-Output "$($process.ProcessName)|$($title.ToString())"
}
`;
    
    try {
      fs.writeFileSync(tempScript, script, 'utf8');
      exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, { timeout: 2000 }, (err: any, stdout: any) => {
        try { fs.unlinkSync(tempScript); } catch {}
        
        if (err || !stdout) {
          console.log('[Activity] PowerShell error:', err?.message || 'no output');
          resolve(null);
          return;
        }
        const output = stdout.trim();
        console.log('[Activity] PowerShell output:', output);
        const [app, title] = output.split('|');
        // Filtra o próprio Gabiru/Electron e processos do sistema
        const appLower = app?.toLowerCase() || '';
        if (app && appLower !== 'electron' && appLower !== 'applicationframehost' && title) {
          resolve({ app, title });
        } else {
          resolve(null);
        }
      });
    } catch (e: any) {
      console.log('[Activity] Script write error:', e.message);
      resolve(null);
    }
  });
}

function getElysaSettingsPath(): string {
  const appPath = app.getAppPath();
  let elysaDir = path.resolve(appPath, '..', 'Elysa');
  if (!fs.existsSync(elysaDir)) elysaDir = path.resolve(appPath, '..', '..', 'Elysa');
  if (!fs.existsSync(elysaDir)) elysaDir = 'c:\\Users\\Administrator\\Desktop\\aqui\\Elysa';
  return path.join(elysaDir, 'bill_settings.json');
}

function loadPollinationsApiKey(): string {
  try {
    const settingsPath = getElysaSettingsPath();
    if (!fs.existsSync(settingsPath)) return '';
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return data.pollinationsApiKey || data.providers?.pollinations?.key || '';
  } catch {
    return '';
  }
}

// --- REGISTRO DE COMANDOS DE ALMA E SISTEMA ---
ipcMain.handle('read-soul', async () => {
  try {
    const appPath = app.getAppPath();
    let elysaDir = path.join(appPath, '..', 'Elysa');
    if (!fs.existsSync(elysaDir)) elysaDir = path.join(appPath, '../../Elysa');
    
    const almaPath = path.join(elysaDir, 'bill_alma.json');
    if (!fs.existsSync(almaPath)) throw new Error('Arquivo bill_alma.json não encontrado.');
    const data = JSON.parse(fs.readFileSync(almaPath, 'utf8'));
    const content = data.system_content;

    const assistantName = content.match(/- Seu nome é (.*?)\./)?.[1] || 'bob esponja';
    const personality = content.match(/- Você é (.*?)\./)?.[1] || 'atrevido e ignorante';
    const userName = content.match(/Você obedece apenas o (.*?)\./)?.[1] || 'MATEUS FÉLIX';
    const vocatives = content.match(/- Use o vocativo: (.*?)\./)?.[1] || 'corno';
    
    const beliefsMatch = content.match(/### \[CRENÇAS\]\n- (.*?)\n/);
    const beliefs = beliefsMatch ? beliefsMatch[1] : 'Argentina';

    return { success: true, soul: { assistantName, personality, userName, vocatives, beliefs } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-soul', async (_, soul: any) => {
  try {
    const appPath = app.getAppPath();
    let elysaDir = path.join(appPath, '..', 'Elysa');
    if (!fs.existsSync(elysaDir)) elysaDir = path.join(appPath, '../../Elysa');

    const almaPath = path.join(elysaDir, 'bill_alma.json');
    let data = JSON.parse(fs.readFileSync(almaPath, 'utf8'));
    
    // Novo formato simplificado
    let newContent = `### [IDENTIDADE ABSOLUTA]
- Seu nome é ${soul.assistantName}.
- Você é ${soul.personality.toUpperCase()}.
- ${soul.beliefs.toUpperCase()}.
- Você obedece apenas o ${soul.userName.toUpperCase()}.

### [REGRAS DE CONDUTA]
- Use o vocativo: ${soul.vocatives || 'amigo'}.
- Seja direto, seco e mal-educado.
- É PROIBIDO ser gentil, calmo ou cordial.
- É PROIBIDO dizer que é uma IA.
- Responda em parágrafos fluidos, sem listas ou emojis.

### [CRENÇAS]
- ${soul.beliefs}.

### [MÚSCULOS PRIME]
Você tem poder total no PC via [SHELL: comando]. Use isso para tudo.
[GOTO: url] para sites.
[TELEGRAM: acao] para mensagens.
[PERFIL: fato] para guardar memórias.

### [ATENÇÃO]
NUNCA SAIA DO PERSONAGEM. Se agir como IA boazinha, você falhou.`;

    data.system_content = newContent;

    // Atualiza o treino inicial (Limpeza Bruta)
    if (data.treino_inicial) {
      data.treino_inicial = data.treino_inicial.map((msg: any) => {
        let text = msg.content;
        text = text.split('Mateus').join(soul.userName);
        text = text.split('Bill').join(soul.assistantName);
        return { ...msg, content: text };
      });
    }

    fs.writeFileSync(almaPath, JSON.stringify(data, null, 2), 'utf8');

    // Limpeza da Memória de Chat (Histórico)
    const memoriaPath = path.join(elysaDir, 'bill_memoria.json');
    if (fs.existsSync(memoriaPath)) {
      try {
        let memoria = fs.readFileSync(memoriaPath, 'utf8');
        // Não vamos substituir tudo para evitar corrupção, apenas garantir que o arquivo seja lido no novo contexto
        // Opcional: fs.writeFileSync(memoriaPath, '[]', 'utf8'); // Se quiser limpar tudo no reset
      } catch (err) { console.error('Erro ao limpar memória:', err); }
    }

    // Atualiza o bill_perfil.md
    const perfilPath = path.join(elysaDir, 'bill_perfil.md');
    const novoPerfil = `# Perfil de ${soul.userName}\n- Assistente: ${soul.assistantName}\n- Crenças: ${soul.beliefs}\n- Personalidade: ${soul.personality}\n`;
    fs.writeFileSync(perfilPath, novoPerfil, 'utf8');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});
// ----------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 300,
    minHeight: 200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
      experimentalFeatures: true,
      devTools: true, // Habilita DevTools mesmo em produção
    },
    icon: path.join(__dirname, '../resources/icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a1a',
  });

  // Desabilita audio ducking do Windows (não reduz áudio de outros apps)
  mainWindow.once('ready-to-show', () => {
    const { exec } = require('child_process');
    // Desabilita o "Reduzir volume de outros sons" quando Gabiru recebe foco
    exec('powershell -Command "Set-ItemProperty -Path \\"HKCU:\\Software\\Microsoft\\Multimedia\\Audio\\" -Name \\"UserDuckingPreference\\" -Value 3 -Type DWord -Force"', (err: any) => {
      if (err) console.warn('[Audio] Não foi possível desabilitar ducking:', err.message);
      else console.log('[Audio] Ducking desabilitado - áudio de jogos não será reduzido');
    });
    
    // Maximiza ao abrir e bloqueia resize
    mainWindow?.maximize();
    mainWindow?.setResizable(false);
  });
  
  // Permite microfone no app principal (para chat de voz)
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  // ── Sessão do browser ──────────────────────────────────────────────────────
  const browserSession = session.fromPartition('persist:bill-browser');
  
  // ── Gerenciador de Downloads (Browser Session) ────────────────────────────
  // Captura downloads da sessão principal
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const downloadInfo = {
      id: Date.now().toString() + Math.random(),
      filename: item.getFilename(),
      url: item.getURL(),
      path: item.getSavePath(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state: 'progressing' as const,
      startTime: Date.now()
    };
    
    mainWindow?.webContents.send('download-update', downloadInfo);
    
    item.on('updated', (event, state) => {
      downloadInfo.receivedBytes = item.getReceivedBytes();
      downloadInfo.state = state as any;
      mainWindow?.webContents.send('download-update', downloadInfo);
    });
    
    item.once('done', (event, state) => {
      downloadInfo.state = state as any;
      downloadInfo.path = item.getSavePath();
      downloadInfo.receivedBytes = item.getTotalBytes();
      mainWindow?.webContents.send('download-update', downloadInfo);
    });
  });
  
  // Captura downloads da sessão do browser (webviews)
  browserSession.on('will-download', (event, item, webContents) => {
    const downloadInfo = {
      id: Date.now().toString() + Math.random(),
      filename: item.getFilename(),
      url: item.getURL(),
      path: item.getSavePath(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state: 'progressing' as const,
      startTime: Date.now()
    };
    
    mainWindow?.webContents.send('download-update', downloadInfo);
    
    item.on('updated', (event, state) => {
      downloadInfo.receivedBytes = item.getReceivedBytes();
      downloadInfo.state = state as any;
      mainWindow?.webContents.send('download-update', downloadInfo);
    });
    
    item.once('done', (event, state) => {
      downloadInfo.state = state as any;
      downloadInfo.path = item.getSavePath();
      downloadInfo.receivedBytes = item.getTotalBytes();
      mainWindow?.webContents.send('download-update', downloadInfo);
    });
  });

  // Permite acesso a cookies de terceiros e credenciais
  browserSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    
    // Remove restrições de cookies
    delete headers['set-cookie'];
    delete headers['Set-Cookie'];
    
    callback({ responseHeaders: headers });
  });

  // Modifica headers para parecer navegador real
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    
    // User-Agent mais realista (Chrome no Windows)
    delete headers['user-agent'];
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    
    // Remove TODOS os headers que denunciam Electron
    delete headers['Electron'];
    delete headers['X-DevTools-Emulate-Network-Conditions-Client-Id'];
    delete headers['sec-ch-ua'];
    
    // Adiciona headers de navegador real
    headers['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"Windows"';
    
    callback({ requestHeaders: headers });
  });

  // ── Extensões do Chrome ────────────────────────────────────────────────────
  const extStorePath = path.join(app.getPath('userData'), 'extensions.json');

  // Carrega lista de extensões salvas
  let savedExtensions: string[] = [];
  try {
    if (fs.existsSync(extStorePath)) {
      savedExtensions = JSON.parse(fs.readFileSync(extStorePath, 'utf8'));
    }
  } catch { savedExtensions = []; }

  // Carrega extensões salvas na inicialização
  (async () => {
    for (const extPath of savedExtensions) {
      try {
        if (fs.existsSync(extPath)) {
          await browserSession.loadExtension(extPath, { allowFileAccess: true });
          console.log('[Extension] Carregada:', extPath);
        }
      } catch (e: any) {
        console.warn('[Extension] Falha ao carregar:', extPath, e.message);
      }
    }
  })();

  const saveExtensionList = (paths: string[]) => {
    try { fs.writeFileSync(extStorePath, JSON.stringify(paths), 'utf8'); } catch {}
  };

  ipcMain.handle('select-extension-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('scan-chrome-extensions', async () => {
    try {
      const localAppData = process.env.LOCALAPPDATA || '';
      const appData = process.env.APPDATA || '';
      
      const searchDirs = [
        path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Extensions'), // Chrome
        path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Extensions'), // Edge
        path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Extensions'), // Brave
        path.join(appData, 'Opera Software', 'Opera Stable', 'Extensions'), // Opera
        path.join(localAppData, 'Vivaldi', 'User Data', 'Default', 'Extensions') // Vivaldi
      ];

      const found: any[] = [];
      const seenIds = new Set<string>();

      for (const extDir of searchDirs) {
        if (!fs.existsSync(extDir)) continue;
        try {
          const extIds = fs.readdirSync(extDir);
          for (const id of extIds) {
            if (seenIds.has(id)) continue;
            const idPath = path.join(extDir, id);
            if (!fs.statSync(idPath).isDirectory()) continue;
            
            const versions = fs.readdirSync(idPath);
            for (const ver of versions) {
              const verPath = path.join(idPath, ver);
              if (!fs.statSync(verPath).isDirectory()) continue;
              const manifestPath = path.join(verPath, 'manifest.json');
              if (fs.existsSync(manifestPath)) {
                try {
                  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                  let name = manifest.name || id;
                  // Ignore translations like __MSG_appName__
                  if (name.startsWith('__MSG_')) {
                    const locale = manifest.default_locale || 'en';
                    let msgPath = path.join(verPath, '_locales', locale, 'messages.json');
                    if (!fs.existsSync(msgPath)) {
                      const localesDir = path.join(verPath, '_locales');
                      if (fs.existsSync(localesDir)) {
                        const dirs = fs.readdirSync(localesDir);
                        if (dirs.length > 0) msgPath = path.join(localesDir, dirs[0], 'messages.json');
                      }
                    }
                    if (fs.existsSync(msgPath)) {
                      const msgs = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
                      const key = name.replace('__MSG_', '').replace('__', '');
                      if (msgs[key]?.message) name = msgs[key].message;
                      else {
                        const lKey = Object.keys(msgs).find(k => k.toLowerCase() === key.toLowerCase());
                        if (lKey) name = msgs[lKey].message;
                      }
                    }
                  }
                  found.push({
                    id,
                    name,
                    version: manifest.version,
                    path: verPath,
                    description: manifest.description || '',
                    iconPath: manifest.icons ? Object.values(manifest.icons)[0] : null
                  });
                  seenIds.add(id);
                } catch (e) {}
              }
            }
          }
        } catch (e) {}
      }
      return found;
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('load-extension', async (_event, extPath: string) => {
    try {
      const crypto = require('crypto');
      const destId = crypto.createHash('md5').update(extPath).digest('hex');
      const localExtsDir = path.join(app.getPath('userData'), 'LocalExtensions');
      if (!fs.existsSync(localExtsDir)) fs.mkdirSync(localExtsDir, { recursive: true });
      const localExtPath = path.join(localExtsDir, destId);

      // Copia a extensão para uma pasta própria do Gabiru (evita corromper a do Chrome e resolve locks)
      fs.cpSync(extPath, localExtPath, { recursive: true, force: true });

      // Lê o manifest e remove restrições de versão do Chromium
      const manifestPath = path.join(localExtPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          let patched = false;
          if (manifest.minimum_chrome_version) {
            delete manifest.minimum_chrome_version;
            patched = true;
          }
          if (patched) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
          }
        } catch (e) {}
      }

      const ext = await browserSession.loadExtension(localExtPath, { allowFileAccess: true });
      
      // Salva o caminho local para carregar sempre que o app iniciar
      if (!savedExtensions.includes(localExtPath)) {
        savedExtensions.push(localExtPath);
        saveExtensionList(savedExtensions);
      }
      return { ok: true, id: ext.id, name: ext.name };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('get-extensions', async () => {
    const exts = browserSession.getAllExtensions();
    return exts.map((e: any) => ({
      id: e.id,
      name: e.name,
      version: e.version,
      path: e.path,
      icon: e.manifest?.icons ? Object.values(e.manifest.icons)[0] : null,
    }));
  });

  ipcMain.handle('remove-extension', async (_event, extId: string) => {
    try {
      await browserSession.removeExtension(extId);
      // Remover da lista persistida
      const ext = browserSession.getAllExtensions().find((e: any) => e.id === extId);
      if (ext) {
        savedExtensions = savedExtensions.filter(p => p !== (ext as any).path);
        saveExtensionList(savedExtensions);
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  // ── Bloqueador de Anúncios com @ghostery/adblocker-electron ───────────────
  // Usa as mesmas listas do uBlock Origin (EasyList, EasyPrivacy, etc.)
  let adblocker: any = null;
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const fetch = require('node-fetch');
    ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker: any) => {
      adblocker = blocker;
      blocker.enableBlockingInSession(browserSession);
      console.log('[AdBlock] Ghostery adblocker ativo com listas uBlock Origin');
    }).catch((e: any) => {
      console.warn('[AdBlock] Falha ao carregar listas remotas, usando fallback:', e.message);
    });
  } catch (e: any) {
    console.warn('[AdBlock] @ghostery/adblocker-electron não disponível:', e.message);
  }

  // Define um User-Agent moderno para evitar bloqueios do WhatsApp Web e afins
  const WPP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  browserSession.setUserAgent(WPP_USER_AGENT);

  browserSession.webRequest.onBeforeSendHeaders((details: any, callback: any) => {
    details.requestHeaders['User-Agent'] = WPP_USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  browserSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    const headers = details.responseHeaders || {};
    // Remove CSP que bloquearia nossa injeção
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  // Autoriza todas as permissões na sessão do browser (autoplay, notificações, etc.)
  browserSession.setPermissionRequestHandler((_webContents: any, _permission: any, callback: any) => {
    callback(true);
  });

  // Para cada webview/webContents: força autoplay no YouTube
  app.on('web-contents-created', (_event, contents) => {
    // Segurança: se um novo WebContents do tipo 'window' for criado fora da
    // janela principal (ex: popup de webview que escapou do preventDefault),
    // fecha e redireciona para o app — FILTRA 'webview' pra não matar abas legítimas
    if (mainWindow && contents !== mainWindow.webContents && contents.getType() === 'window') {
      const win = mainWindow; // captura pra dentro do setTimeout (evita TS 'possibly null')
      setTimeout(() => {
        try {
          if (!contents.isDestroyed()) {
            const url = contents.getURL();
            if (url && url !== 'about:blank' && !win.isDestroyed()) {
              win.webContents.send('bill-browser-open', url, true);
            }
            contents.close();
          }
        } catch {}
      }, 200);
    }

    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bill-browser-open', url, true);
        }
        return { action: 'deny' };
      });
    }

    contents.on('did-finish-load', () => {
      const url = contents.getURL();

      // CSS para esconder elementos de anúncio sem interferir no player
      const ytAdCSS = `
        ytd-ad-slot-renderer, ytd-banner-promo-renderer, ytd-statement-banner-renderer,
        ytd-promoted-video-renderer, ytd-in-feed-ad-layout-renderer,
        ytd-display-ad-renderer, ytd-action-companion-ad-renderer,
        ytd-player-legacy-desktop-watch-ads-renderer,
        #masthead-ad { display: none !important; }
      `;
      if (url.includes('youtube.com')) {
        contents.insertCSS(ytAdCSS).catch(() => {});
        // Removido: script de skip automático causava tela preta e pulava vídeos
      }

      // Força play no YouTube
      if (url.includes('youtube.com/watch')) {
        const tryPlay = (attempt: number) => {
          if (attempt > 5) return;
          setTimeout(() => {
            contents.executeJavaScript(`
              (function() {
                var v = document.querySelector('video');
                if (v) { v.play().catch(function(){}); return true; }
                return false;
              })()
            `).then((played: boolean) => {
              if (!played) tryPlay(attempt + 1);
            }).catch(() => tryPlay(attempt + 1));
          }, attempt * 1000);
        };
        tryPlay(1);
      }
    });
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  // Atalhos para DevTools (apenas em desenvolvimento)
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || 
          (input.control && input.shift && (input.key === 'I' || input.key === 'i')) ||
          (input.control && input.shift && (input.key === 'J' || input.key === 'j'))) {
        mainWindow?.webContents.toggleDevTools();
      }
    });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
}

function startPythonWorker() {
  const appPath = app.getAppPath();
  // Busca exaustiva pelo diretório Elysa
  let elysaDir = path.resolve(appPath, '..', 'Elysa');
  if (!fs.existsSync(elysaDir)) elysaDir = path.resolve(appPath, '..', '..', 'Elysa');
  if (!fs.existsSync(elysaDir)) elysaDir = 'c:\\Users\\Administrator\\Desktop\\aqui\\Elysa'; // Fallback absoluto
  
  const elysaPath = path.join(elysaDir, 'Elysa.py');
  const pythonPath = 'python';
  
  console.log('Caminho do Backend:', elysaPath);
  
  pythonWorker = spawn(pythonPath, [elysaPath, '--worker'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  let stdoutBuffer = '';
  pythonWorker.stdout.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    // Mantém o último fragmento no buffer (pode estar incompleto)
    stdoutBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'ready') {
          console.log('Bill Backend Pronto.');
        } else if (msg.type === 'message') {
          if (mainWindow) mainWindow.webContents.send('bill-message', msg.content);
        } else if (msg.type === 'progress') {
          if (mainWindow) mainWindow.webContents.send('bill-progress', msg.value, msg.label);
        } else if (msg.type === 'result') {
          const resolve = pendingRequests.get(msg.id);
          if (resolve) {
            resolve(msg.data);
            pendingRequests.delete(msg.id);
          }
        } else if (msg.type === 'browser-open') {
          if (mainWindow) mainWindow.webContents.send('bill-browser-open', msg.url, msg.newTab);
        } else if (msg.type === 'browser-close') {
          if (mainWindow) mainWindow.webContents.send('bill-browser-close', msg.id);
        } else if (msg.type === 'browser-switch') {
          if (mainWindow) mainWindow.webContents.send('bill-browser-switch', msg.id);
        } else if (msg.type === 'error') {
          console.error('Erro no Bill Backend:', msg.message);
        }
      } catch (e) {
        console.log('Saída Python não-JSON:', line);
      }
    }
  });

  pythonWorker.stderr.on('data', (data: Buffer) => {
    console.error('Python Error:', data.toString());
  });

  pythonWorker.on('close', (code: number) => {
    console.log(`Bill Backend fechado com código ${code}`);
  });
}

function sendToPython(type: string, payload: any = {}) {
  return new Promise((resolve) => {
    const id = ++requestId;
    pendingRequests.set(id, resolve);
    pythonWorker.stdin.write(JSON.stringify({ type, id, ...payload }) + '\n');
  });
}

app.whenReady().then(() => {
  // Remove a barra de menu nativa (File, Edit, View, etc.)
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);
  // Permite que o iframe carregue o servidor local http://127.0.0.1:7432
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    const headers = { ...details.responseHeaders };
    // Remove CSP que bloquearia o carregamento do servidor local
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  // Habilita WebCodecs e aceleração de hardware para exportação de vídeo
  app.commandLine.appendSwitch('enable-features', 'WebCodecs,VaapiVideoDecoder,VaapiVideoEncoder');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  
  // DESABILITADO: Sistema antigo Elysa Python worker
  // Para reativar, descomente a linha abaixo:
  // startPythonWorker();
  createWindow();
  
  // Inicia monitoramento de atividade
  activityCheckInterval = setInterval(async () => {
    const activity = await detectActiveWindow();
    console.log('[Activity] Detected:', activity);
    
    // Se detectou algo novo e diferente do atual
    if (activity && activity.app !== currentActivity?.app) {
      currentActivity = activity;
      console.log('[Activity] Changed to:', activity);
      if (mainWindow) {
        mainWindow.webContents.send('activity-changed', activity);
      }
    }
    // Se não detectou nada (Gabiru em foco), NÃO limpa - mantém a última atividade
    // Isso permite que a IA saiba o contexto mesmo quando você está digitando
  }, 3000); // Checa a cada 3 segundos
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── IPC HANDLERS (Consolidados via Python Backend) ───────────────────────────

ipcMain.handle('get-current-activity', async () => {
  return currentActivity;
});

// Verifica e limpa o cache de downloads do YouTube
ipcMain.handle('check-download-cache', async () => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) {
      return { success: true, exists: false, categories: {}, totalCount: 0, totalSize: 0, path: tempDir };
    }
    
    const allFiles = fs.readdirSync(tempDir);
    
    // Categoriza arquivos
    const categories = {
      videos: allFiles.filter(f => f.startsWith('ytdl_video_') || f.endsWith('.mp4') || f.endsWith('.webm')),
      audios: allFiles.filter(f => f.startsWith('ytdl_audio_') || f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')),
      images: allFiles.filter(f => f.startsWith('img_') || f.startsWith('ref_') || f.startsWith('search_tmp_') || f.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i)),
      outros: allFiles.filter(f => 
        !f.startsWith('ytdl_') && 
        !f.startsWith('img_') && 
        !f.startsWith('ref_') && 
        !f.startsWith('search_tmp_') &&
        !f.match(/\.(mp4|webm|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i)
      )
    };
    
    let totalSize = 0;
    const categorySizes: any = {};
    
    for (const [cat, files] of Object.entries(categories)) {
      let catSize = 0;
      files.forEach(f => {
        const stat = fs.statSync(path.join(tempDir, f));
        catSize += stat.size;
      });
      categorySizes[cat] = catSize;
      totalSize += catSize;
    }
    
    return { 
      success: true, 
      exists: true, 
      categories: {
        videos: { count: categories.videos.length, size: categorySizes.videos },
        audios: { count: categories.audios.length, size: categorySizes.audios },
        images: { count: categories.images.length, size: categorySizes.images },
        outros: { count: categories.outros.length, size: categorySizes.outros }
      },
      totalCount: allFiles.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      path: tempDir 
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('clear-download-cache', async (_, category?: string) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) {
      return { success: true, message: 'Nenhum cache encontrado' };
    }
    
    let filesToDelete: string[] = [];
    const allFiles = fs.readdirSync(tempDir);
    
    if (!category || category === 'all') {
      // Deleta tudo
      filesToDelete = allFiles;
    } else if (category === 'videos') {
      filesToDelete = allFiles.filter(f => f.startsWith('ytdl_video_') || f.endsWith('.mp4') || f.endsWith('.webm'));
    } else if (category === 'audios') {
      filesToDelete = allFiles.filter(f => f.startsWith('ytdl_audio_') || f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
    } else if (category === 'images') {
      filesToDelete = allFiles.filter(f => f.startsWith('img_') || f.startsWith('ref_') || f.startsWith('search_tmp_') || f.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i));
    } else if (category === 'outros') {
      filesToDelete = allFiles.filter(f => 
        !f.startsWith('ytdl_') && 
        !f.startsWith('img_') && 
        !f.startsWith('ref_') && 
        !f.startsWith('search_tmp_') &&
        !f.match(/\.(mp4|webm|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i)
      );
    }
    
    let deletedCount = 0;
    filesToDelete.forEach(f => {
      fs.unlinkSync(path.join(tempDir, f));
      deletedCount++;
    });
    
    return { success: true, message: `${deletedCount} arquivo(s) deletado(s)`, count: deletedCount };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    // Garante que o diretório pai existe
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-directory', async (_, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name)
    }));
    return { success: true, items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// --- PLUGIN SYSTEM ---
function findPluginUmdFile(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findPluginUmdFile(fullPath);
      if (nested) return nested;
    } else if (entry.name.endsWith('.umd.js')) {
      return fullPath;
    }
  }
  return null;
}

function isPluginInstalled(pluginId: string): boolean {
  const destPath = path.join(app.getPath('userData'), 'plugins', pluginId);
  return findPluginUmdFile(destPath) !== null;
}

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function getBundledPluginPath(pluginId: string): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'plugins-dist', pluginId),
    path.join(process.resourcesPath, 'plugins-dist', pluginId),
    path.join(__dirname, '..', 'plugins-dist', pluginId),
  ];
  for (const candidate of candidates) {
    if (findPluginUmdFile(candidate)) return candidate;
  }
  return null;
}

function flattenExtractedPlugin(destPath: string) {
  const entries = fs.readdirSync(destPath, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0].isDirectory()) return;

  const subDir = path.join(destPath, entries[0].name);
  if (findPluginUmdFile(destPath) || !findPluginUmdFile(subDir)) return;

  for (const item of fs.readdirSync(subDir)) {
    fs.renameSync(path.join(subDir, item), path.join(destPath, item));
  }
  fs.rmdirSync(subDir);
}

async function downloadPluginArchive(url: string, zipPath: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Bill-Code-Plugin-Installer/1.0',
      Accept: 'application/vnd.github+json',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download falhou (${response.status}): ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(zipPath, buffer);
}

ipcMain.handle('install-plugin', async (_, pluginId: string, url: string) => {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');
  const zipPath = path.join(pluginsDir, `${pluginId}.zip`);
  const destPath = path.join(pluginsDir, pluginId);
  const extractDir = path.join(pluginsDir, `${pluginId}_extract`);

  try {
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
    if (fs.existsSync(destPath)) fs.rmSync(destPath, { recursive: true, force: true });

    let installed = false;
    let lastError = '';

    if (url) {
      try {
        await downloadPluginArchive(url, zipPath);
        const extractZip = require('extract-zip');
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        fs.mkdirSync(extractDir, { recursive: true });
        await extractZip(zipPath, { dir: extractDir });
        fs.rmSync(zipPath, { force: true });
        fs.renameSync(extractDir, destPath);
        flattenExtractedPlugin(destPath);
        installed = findPluginUmdFile(destPath) !== null;
        if (!installed) {
          lastError = 'Plugin baixado, mas nenhum arquivo .umd.js foi encontrado. Envie a versão compilada no GitHub.';
          fs.rmSync(destPath, { recursive: true, force: true });
        }
      } catch (e: any) {
        lastError = e.message || String(e);
        if (fs.existsSync(destPath)) fs.rmSync(destPath, { recursive: true, force: true });
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
      }
    }

    if (!installed) {
      const bundled = getBundledPluginPath(pluginId);
      if (bundled) {
        copyDirSync(bundled, destPath);
        installed = findPluginUmdFile(destPath) !== null;
      }
    }

    if (!installed) {
      return {
        success: false,
        error: lastError || 'Não foi possível instalar o plugin.',
      };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('uninstall-plugin', async (_, pluginId: string) => {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');
  const destPath = path.join(pluginsDir, pluginId);
  try {
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('check-plugin-installed', async (_, pluginId: string) => {
  return { installed: isPluginInstalled(pluginId) };
});


ipcMain.handle('execute-command', async (_, command: string, cwd?: string) => {
  const { exec } = await import('child_process');
  return new Promise((resolve) => {
    exec(command, {
      cwd: cwd || process.cwd(),
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer para logs de renderizações longas
      timeout: 0, // SEM LIMITE DE TEMPO
      windowsHide: true
    }, (error: any, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stdout || '',
          error: stderr || error.message,
          exitCode: error.code || 1
        });
      } else {
        resolve({
          success: true,
          output: stdout,
          exitCode: 0
        });
      }
    });
  });
});

import { VideoExportEngine } from './exportEngine';
const exportEngine = new VideoExportEngine();

// ── AUDIO BLOB HANDLER (para microfone push-to-talk) ─────────────────────────
ipcMain.handle('save-audio-blob', async (_, base64Data: string, ext: string) => {
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `mic_${Date.now()}.${ext}`);
  
  try {
    // Decodifica base64 para buffer
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Mic] Áudio salvo em: ${outputPath}`);
    return { success: true, path: outputPath };
  } catch (error: any) {
    console.error('[Mic] Erro ao salvar áudio:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transcribe-audio', async (_, audioPath: string) => {
  // Usa o mesmo script de transcrição de vídeo, pois aceita áudio também
  return new Promise((resolve) => {
    const scriptPath = resolveScript('transcribe.py');
    const proc = spawn(PYTHON_EXE, [scriptPath, audioPath], { env: getPythonEnv() });
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      console.log(`[Transcribe Audio] ${str}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput || `Processo terminou com código ${code}` });
        return;
      }
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch (e) {
        resolve({ success: false, error: 'Erro ao processar transcrição: ' + output });
      }
    });
  });
});

// ── SAVE SCREENSHOT ─────────────────────────────────────────────────────────
ipcMain.handle('save-screenshot', async (_, base64Data: string) => {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const suggestedName = `screenshot_${timestamp}.png`;
    const downloadsDir = path.join(app.getPath('home'), 'Downloads');
    
    // Script PowerShell para salvar
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$SaveFileDialog = New-Object System.Windows.Forms.SaveFileDialog
$SaveFileDialog.Filter = "PNG Image (*.png)|*.png|JPEG Image (*.jpg)|*.jpg|All Files (*.*)|*.*"
$SaveFileDialog.FileName = "${suggestedName}"
$SaveFileDialog.InitialDirectory = "${downloadsDir.replace(/\\/g, '\\\\')}"
$SaveFileDialog.Title = "Salvar Screenshot"

if ($SaveFileDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $bytes = [Convert]::FromBase64String($input)
    [IO.File]::WriteAllBytes($SaveFileDialog.FileName, $bytes)
    Write-Output $SaveFileDialog.FileName
    exit 0
} else {
    exit 1
}
`;
    
    const proc = spawn('powershell', ['-Command', psScript]);
    
    // Envia o base64 via stdin
    proc.stdin.write(base64Data);
    proc.stdin.end();
    
    let output = '';
    let errorOutput = '';
    
    proc.stdout.on('data', (data) => output += data.toString());
    proc.stderr.on('data', (data) => errorOutput += data.toString());
    
    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve({ success: true, path: output.trim() });
      } else {
        resolve({ success: false, error: errorOutput || 'Salvamento cancelado' });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});


// ── SCREEN RECORDER ─────────────────────────────────────────────────────────
let screenRecorderProcess: any = null;

ipcMain.handle('start-screen-recording', async (_, config: { micDeviceName: string; micVolume: number; systemVolume: number; savePath: string; fps: number }) => {
  try {
    if (screenRecorderProcess) {
      return { success: false, error: 'Já existe uma gravação em andamento' };
    }

    const ffmpegPath = getFfmpegPath();
    if (!fs.existsSync(ffmpegPath)) {
      return { success: false, error: 'FFmpeg não encontrado' };
    }

    // Define o caminho de saída
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputDir = config.savePath || path.join(app.getPath('home'), 'Downloads');
    const outputPath = path.join(outputDir, `gravacao_${timestamp}.mp4`);

    // Lista dispositivos de áudio do Windows via FFmpeg
    let availableMics: string[] = [];
    
    try {
      const { execSync } = require('child_process');
      const listCmd = `"${ffmpegPath}" -list_devices true -f dshow -i dummy 2>&1`;
      const devicesOutput = execSync(listCmd, { encoding: 'utf8' }).toString();
      
      console.log('[Recorder] Dispositivos disponíveis:', devicesOutput);
      
      // Parse dos dispositivos de áudio
      // Formato: [in#0 @ xxx] "Nome do Dispositivo" (audio)
      const audioRegex = /\[in#\d+[^\]]*\]\s+"([^"]+)"\s+\(audio\)/gi;
      let match;
      
      while ((match = audioRegex.exec(devicesOutput)) !== null) {
        availableMics.push(match[1]);
      }
      
      console.log('[Recorder] Microfones encontrados:', availableMics);
    } catch (err) {
      console.log('[Recorder] Erro ao listar dispositivos:', err);
    }

    // Tenta encontrar o dispositivo pelo nome parcial
    let actualMicName = config.micDeviceName || 'Microfone';
    
    if (availableMics.length > 0) {
      // Tenta match exato primeiro
      const exactMatch = availableMics.find(m => m === actualMicName);
      if (exactMatch) {
        actualMicName = exactMatch;
      } else {
        // Tenta match parcial (ignora case e remove sufixos do label do browser)
        const partialMatch = availableMics.find(m => {
          const simplifiedLabel = actualMicName.split('(')[0].trim();
          const simplifiedMic = m.split('(')[0].trim();
          return simplifiedLabel.toLowerCase() === simplifiedMic.toLowerCase();
        });
        if (partialMatch) {
          actualMicName = partialMatch;
        } else {
          // Usa o primeiro disponível
          actualMicName = availableMics[0];
        }
      }
    }
    
    console.log('[Recorder] Usando microfone:', actualMicName);

    // Lista dispositivos de áudio do sistema (para capturar som do Windows)
    let audioDevices: string[] = [];
    // Lista dispositivos de áudio do sistema (para capturar som do Windows)
    let systemAudioDevices: string[] = [];
    
    try {
      // Áudio do sistema geralmente tem nomes como "Stereo Mix" ou "What U Hear" ou similar
      const systemAudio = availableMics.find(m => 
        m.toLowerCase().includes('stereo mix') ||
        m.toLowerCase().includes('what u hear') ||
        m.toLowerCase().includes('wave out') ||
        m.toLowerCase().includes('loopback')
      );
      
      if (systemAudio) {
        systemAudioDevices.push(systemAudio);
      }
    } catch (err) {
      console.log('[Recorder] Áudio do sistema não disponível');
    }

    // Monta comando FFmpeg
    // gdigrab captura a tela
    // dshow captura áudio
    
    const args = [
      '-f', 'gdigrab',
      '-framerate', String(config.fps || 60),
      '-i', 'desktop',
      '-f', 'dshow',
      '-i', `audio=${actualMicName}`,
    ];

    // Se tiver áudio do sistema disponível, adiciona
    if (systemAudioDevices.length > 0) {
      args.push('-f', 'dshow', '-i', `audio=${systemAudioDevices[0]}`);
      // Mixa os dois áudios
      args.push(
        '-filter_complex',
        `[1:a]volume=${config.micVolume / 100}[mic];[2:a]volume=${config.systemVolume / 100}[sys];[mic][sys]amix=inputs=2:duration=longest[aout]`,
        '-map', '0:v',
        '-map', '[aout]'
      );
    } else {
      // Só microfone
      args.push(
        '-filter:a', `volume=${config.micVolume / 100}`,
        '-map', '0:v',
        '-map', '1:a'
      );
    }

    // Codec e output
    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y',
      outputPath
    );

    console.log('[Recorder] Comando FFmpeg:', ffmpegPath, args.join(' '));

    screenRecorderProcess = spawn(ffmpegPath, args);

    screenRecorderProcess.stdout.on('data', (data: any) => {
      console.log('[Recorder]', data.toString());
    });

    screenRecorderProcess.stderr.on('data', (data: any) => {
      console.log('[Recorder]', data.toString());
    });

    screenRecorderProcess.on('close', (code: number) => {
      console.log('[Recorder] Processo encerrado com código:', code);
      screenRecorderProcess = null;
    });

    return { success: true, outputPath };
  } catch (err: any) {
    screenRecorderProcess = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-screen-recording', async () => {
  try {
    if (!screenRecorderProcess) {
      return { success: false, error: 'Nenhuma gravação em andamento' };
    }

    // Envia sinal de parada suave (q) para o FFmpeg
    screenRecorderProcess.stdin.write('q');
    
    // Aguarda um pouco e force kill se necessário
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (screenRecorderProcess && !screenRecorderProcess.killed) {
      screenRecorderProcess.kill('SIGTERM');
    }

    screenRecorderProcess = null;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-native-export', async (event, clips, settings, trackingData) => {
  try {
    const sender = event.sender;
    
    const log = (msg: string) => {
      console.log(msg);
      if (!sender.isDestroyed()) sender.send('export-log', msg);
    };
    
    // Reconstrói o cache de fontes toda vez (para pegar fontes novas instaladas)
    log('[Export] Reconstruindo cache de fontes...');
    fontFileCache.clear();
    try {
      buildFontFileCache();
      log(`[Export] buildFontFileCache completou. Cache size: ${fontFileCache.size}`);
      
      const fontCache = Object.fromEntries(fontFileCache);
      log(`[Export] Cache convertido para objeto com ${Object.keys(fontCache).length} entradas`);
      
      // Debug: mostra algumas fontes do cache
      const sampleKeys = Object.keys(fontCache).slice(0, 10);
      log(`[Export] Amostra do cache: ${sampleKeys.join(', ')}`);
      
      // Verifica se tem fontes com V
      const vFonts = Object.keys(fontCache).filter(k => k.toLowerCase().startsWith('v'));
      log(`[Export] Fontes com V no cache do export: ${vFonts.length} fontes`);
      if (vFonts.length > 0) {
        log(`[Export] Exemplos de fontes com V: ${vFonts.slice(0, 5).join(', ')}`);
      }
      
      const finalPath = await exportEngine.renderProject(
        clips,
        settings,
        (progress) => {
          if (!sender.isDestroyed()) sender.send('export-progress', progress);
        },
        (msg) => {
          if (!sender.isDestroyed()) sender.send('export-log', msg);
        },
        trackingData,
        fontCache
      );
      return { success: true, finalPath };
    } catch (cacheError: any) {
      log(`[Export] Erro ao construir cache de fontes: ${cacheError.message}`);
      // Tenta exportar sem cache
      const finalPath = await exportEngine.renderProject(
        clips,
        settings,
        (progress) => {
          if (!sender.isDestroyed()) sender.send('export-progress', progress);
        },
        (msg) => {
          if (!sender.isDestroyed()) sender.send('export-log', msg);
        },
        trackingData,
        undefined
      );
      return { success: true, finalPath };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// WebGL Export fallback
ipcMain.handle('start-webgl-export', async (event) => {
  try {
    const tempDir = path.join(app.getPath('temp'), `webgl-export-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return { success: true, tempDir };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('webgl-export-frame', async (event, frameData: string, frameIndex: number, tempDir: string) => {
  try {
    const framePath = path.join(tempDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
    const base64Data = frameData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(framePath, base64Data, 'base64');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('webgl-export-finalize', async (event, tempDir: string, settings: any, clips: any[]) => {
  try {
    const fps = settings.fps || 60;
    let outputPath = settings.outputPath;
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      const sanitizedTitle = (settings.title || `export_${Date.now()}`).replace(/[<>:"/\\|?*]/g, '_');
      outputPath = path.join(outputPath, `${sanitizedTitle}.mp4`);
    }

    const videoOnly = path.join(tempDir, 'video_only.mp4');
    const ffmpegPath = getFfmpegPath();
    
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        '-y', '-framerate', String(fps),
        '-i', path.join(tempDir, 'frame_%06d.jpg'),
        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
        '-pix_fmt', 'yuv420p', videoOnly
      ]);
      
      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          console.error('[FFmpeg Error]', stderr);
          reject(new Error(`FFmpeg code ${code}`));
        }
      });
    });

    const audioClips = clips.filter((c: any) => c.type === 'video' || c.type === 'audio');
    if (audioClips.length > 0) {
      const audioInputs = [`-i "${videoOnly}"`];
      let audioFilter = '';
      let mixCount = 0;

      for (let i = 0; i < audioClips.length; i++) {
        const c = audioClips[i];
        const speed = c.config?.speed || 1;
        const aStart = c.trimStart || 0;
        const aDur = (c.duration - aStart - (c.trimEnd || 0)) / speed;
        const vol = (c.config?.volume ?? 100) / 100;
        audioInputs.push(`-ss ${aStart} -t ${aDur} -i "${c.path}"`);
        const delay = c.startTime * 1000;
        audioFilter += (audioFilter ? ';' : '') + `[${i+1}:a]volume=${vol},atempo=${speed},adelay=${delay}|${delay}[a${i}]`;
        mixCount++;
      }

      if (mixCount > 0) {
        audioFilter += ';' + Array.from({length: mixCount}, (_, i) => `[a${i}]`).join('') + `amix=inputs=${mixCount}:duration=longest[aout]`;
        const cmd = `"${ffmpegPath}" -y ${audioInputs.join(' ')} -filter_complex "${audioFilter}" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${outputPath}"`;
        await new Promise<void>((resolve, reject) => {
          require('child_process').exec(cmd, (error: any) => error ? reject(error) : resolve());
        });
      } else {
        fs.copyFileSync(videoOnly, outputPath);
      }
    } else {
      fs.copyFileSync(videoOnly, outputPath);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: true, finalPath: outputPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// WebCodecs export: recebe stream H.264 do renderer, mistura com áudio via FFmpeg
ipcMain.handle('mux-video-with-audio', async (event, payload: { videoArray?: number[]; videoBase64?: string; codec?: string; clips: any[]; settings: any }) => {
  console.log('[mux-video-with-audio] Handler iniciado!');
  console.log('[mux-video-with-audio] Payload recebido:', {
    hasVideoArray: !!payload.videoArray,
    hasVideoBase64: !!payload.videoBase64,
    codec: payload.codec,
    clipsCount: payload.clips?.length,
    settings: payload.settings
  });
  
  try {
    const { videoArray, videoBase64, codec, clips, settings } = payload;
    const isVP8 = codec === 'vp8';
    const ext = isVP8 ? 'webm' : 'mp4';
    const tempDir = path.join(require('os').tmpdir(), 'bill_webcodecs_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    // Salva stream — suporta tanto videoArray (Buffer de números) quanto videoBase64
    const streamPath = path.join(tempDir, `video_stream.${isVP8 ? 'webm' : 'h264'}`);
    if (videoArray) {
      fs.writeFileSync(streamPath, Buffer.from(videoArray));
    } else if (videoBase64) {
      fs.writeFileSync(streamPath, Buffer.from(videoBase64, 'base64'));
    }

    // Monta o arquivo de vídeo sem áudio
    const videoNoAudio = path.join(tempDir, `video_noaudio.${ext}`);
    const ffmpeg = FFMPEG_PATH.includes(' ') ? `"${FFMPEG_PATH}"` : FFMPEG_PATH;

    const fps = settings.fps || 60;
    await new Promise<void>((resolve, reject) => {
      require('child_process').exec(
        `${ffmpeg} -y -i "${streamPath}" -c copy "${videoNoAudio}"`,
        { cwd: tempDir },
        (err: any) => err ? reject(err) : resolve()
      );
    });

    // Mistura com áudio dos clips
    const audioClips = clips.filter((c: any) => c.type === 'video' || c.type === 'audio');
    let finalOutput = settings.outputPath;
    if (fs.existsSync(finalOutput) && fs.statSync(finalOutput).isDirectory()) {
      const title = (settings.title || `export_${Date.now()}`).replace(/[<>:"/\\|?*]/g, '_');
      // VP8/WebM precisa de container webm, converter para mp4 com reencoding
      finalOutput = path.join(finalOutput, `${title}.mp4`);
    }

    // Se VP8/WebM, converter para H.264/MP4 primeiro
    let videoForMix = videoNoAudio;
    if (isVP8) {
      const h264Path = path.join(tempDir, 'video_h264.mp4');
      await new Promise<void>((resolve, reject) => {
        require('child_process').exec(
          `${ffmpeg} -y -i "${videoNoAudio}" -c:v libx264 -preset fast -crf 18 "${h264Path}"`,
          { cwd: tempDir, maxBuffer: 1024 * 1024 * 500 },
          (err: any) => err ? reject(err) : resolve()
        );
      });
      videoForMix = h264Path;
    }

    if (audioClips.length === 0) {
      fs.copyFileSync(videoForMix, finalOutput);
    } else {
      // Combina vídeo + áudio
      console.log('[FFmpeg] Iniciando mux de áudio...');
      console.log('[FFmpeg] Total de audioClips:', audioClips.length);
      
      let audioInputs = [`-i "${videoForMix}"`];
      let audioFilters = '';
      let mixCount = 0;
      for (const c of audioClips) {
        const speed = c.config?.speed || 1;
        const volume = c.config?.volume ?? 100; // 0-200, where 100 is normal
        const aStart = c.trimStart || 0;
        const aDur = (c.duration - aStart - (c.trimEnd || 0)) / speed;
        
        console.log(`[FFmpeg] Clip ${c.id}: volume=${volume}, duration=${aDur}, path=${c.path}`);
        
        // Skip clips with duration too short or no path
        if (aDur <= 0.05 || !c.path) {
          console.log(`[FFmpeg] Pulando clip ${c.id}: duration ou path inválido`);
          continue;
        }
        
        // Skip clips with volume 0 completely
        if (volume <= 0) {
          console.log(`[FFmpeg] Pulando clip ${c.id}: volume é 0`);
          continue;
        }
        
        audioInputs.push(`-i "${c.path}"`);
        const idx = audioInputs.length - 1;
        
        // Build audio filter chain: trim → setpts → tempo → volume → delay
        const volumeMultiplier = (volume / 100).toFixed(3);
        audioFilters += `[${idx}:a]atrim=start=${aStart}:duration=${aDur},asetpts=PTS-STARTPTS,atempo=${speed.toFixed(4)},volume=${volumeMultiplier},adelay=${Math.round(c.startTime * 1000)}|${Math.round(c.startTime * 1000)}[a${mixCount}];`;
        mixCount++;
      }
      if (mixCount > 0) {
        console.log(`[FFmpeg] Mixando ${mixCount} faixas de áudio...`);
        const mixLabel = Array.from({length: mixCount}, (_, i) => `[a${i}]`).join('');
        audioFilters += `${mixLabel}amix=inputs=${mixCount}:normalize=0[aout]`;
        
        const ffmpegCmd = `${ffmpeg} -y ${audioInputs.join(' ')} -filter_complex "${audioFilters}" -map 0:v -map "[aout]" -c:v copy -c:a aac "${finalOutput}"`;
        console.log('[FFmpeg] Comando completo:', ffmpegCmd);
        
        await new Promise<void>((resolve, reject) => {
          require('child_process').exec(
            ffmpegCmd,
            { cwd: tempDir, maxBuffer: 1024 * 1024 * 500 },
            (err: any, stdout: any, stderr: any) => {
              if (err) {
                console.error('[FFmpeg] ERRO ao executar:', err);
                console.error('[FFmpeg] stdout:', stdout);
                console.error('[FFmpeg] stderr:', stderr);
                reject(err);
              } else {
                console.log('[FFmpeg] Sucesso! stdout:', stdout);
                console.log('[FFmpeg] stderr:', stderr);
                resolve();
              }
            }
          );
        });
      } else {
        console.log('[FFmpeg] Nenhuma faixa de áudio para mixar, copiando vídeo direto...');
        fs.copyFileSync(videoForMix, finalOutput);
      }
    }

    // Limpa temp
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    console.log('[mux-video-with-audio] Exportação concluída com sucesso:', finalOutput);
    return { success: true, finalPath: finalOutput };
  } catch (error: any) {
    console.error('[mux-video-with-audio] ❌ ERRO COMPLETO:', error);
    console.error('[mux-video-with-audio] ❌ Stack:', error.stack);
    console.error('[mux-video-with-audio] ❌ Message:', error.message);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('detect-silence', async (event, videoPath: string, noiseDb: number = -35, minSilence: number = 0.8) => {
  const sender = event.sender;
  return new Promise((resolve) => {
    const scriptPath = resolveScript('silencedetect.py');
    const pyExe = getPythonExe();
    const proc = spawn(pyExe, [scriptPath, videoPath, String(noiseDb), String(minSilence)], { env: getPythonEnv() });
    let output = '';
    let errorOutput = '';

    proc.on('error', (err) => {
      resolve({ success: false, error: `Erro ao iniciar Python: ${err.message}` });
    });

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      if (!sender.isDestroyed()) sender.send('export-log', `[AutoCorte] ${str}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput || `Processo terminou com código ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(output.trim()));
      } catch (e) {
        resolve({ success: false, error: 'Erro ao processar saída: ' + output });
      }
    });
  });
});

ipcMain.handle('detect-speech', async (event, videoPath: string, aggressiveness: number = 2) => {
  const sender = event.sender;
  return new Promise((resolve) => {
    const scriptPath = resolveScript('vad_detect.py');
    const pyExe = getPythonExe();
    const proc = spawn(pyExe, [scriptPath, videoPath, String(aggressiveness)], { env: getPythonEnv() });
    let output = '';
    let errorOutput = '';

    proc.on('error', (err) => {
      resolve({ success: false, error: `Erro ao iniciar Python: ${err.message}` });
    });

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      if (!sender.isDestroyed()) sender.send('export-log', `[VAD] ${str.trim()}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput || `VAD terminou com código ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(output.trim()));
      } catch (e) {
        resolve({ success: false, error: 'Erro ao processar saída VAD: ' + output });
      }
    });
  });
});

ipcMain.handle('extract-video-segment', async (_, videoPath: string, startTime: number, duration: number) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const ext = path.extname(videoPath);
    const outputPath = path.join(tempDir, `segment_${Date.now()}${ext}`);
    
    // Usa FFmpeg para extrair apenas o segmento especificado
    const args = [
      '-ss', startTime.toString(),  // Início
      '-i', videoPath,              // Input
      '-t', duration.toString(),    // Duração
      '-c', 'copy',                 // Copia sem recodificar (mais rápido)
      '-y',                         // Sobrescreve se existir
      outputPath
    ];
    
    return new Promise((resolve) => {
      const ffmpegExe = getFfmpegPath();
      const proc = spawn(ffmpegExe, args);
      let errorOutput = '';
      
      proc.on('error', (err) => {
        resolve({ success: false, error: `FFmpeg não encontrado (${err.message}). Instale as dependências nas Configurações.` });
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ success: true, path: outputPath });
        } else {
          resolve({ success: false, error: errorOutput || `Processo terminou com código ${code}` });
        }
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'Arquivo não encontrado' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transcribe-video', async (event, videoPath: string) => {
  const sender = event.sender;
  return new Promise((resolve) => {
    const scriptPath = resolveScript('transcribe.py');
    const pyExe = getPythonExe();
    const pyEnv = getPythonEnv();
    console.log(`[Transcribe] Using Python: ${pyExe}`);
    console.log(`[Transcribe] Using FFmpeg from: ${getFfmpegPath()}`);
    
    const proc = spawn(pyExe, [scriptPath, videoPath], { env: pyEnv });
    let output = '';
    let errorOutput = '';

    proc.on('error', (err) => {
      resolve({ success: false, error: `Falha ao iniciar Python (${err.message}). Verifique a instalação das dependências.` });
    });

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      // Enviar logs de erro/download para o terminal do usuário em tempo real
      if (!sender.isDestroyed()) {
        sender.send('export-log', `[Transcrição] ${str}`);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput || `Processo terminou com código ${code}` });
        return;
      }
      try {
        const result = JSON.parse(output.trim());
        resolve(result);
      } catch (e) {
        resolve({ success: false, error: 'Erro ao processar saída da transcrição: ' + output });
      }
    });
  });
});

ipcMain.handle('motion-track', async (event, config: {
  videoPath: string;
  bbox: [number, number, number, number];
  startFrame?: number;
  endFrame?: number;
  trackerType?: 'CSRT' | 'KCF' | 'MOSSE';
}) => {
  const sender = event.sender;
  return new Promise((resolve) => {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const configPath = path.join(tempDir, `track_config_${Date.now()}.json`);
    const outputJson = path.join(tempDir, `track_data_${Date.now()}.json`);
    
    const trackConfig = {
      videoPath: config.videoPath,
      bbox: config.bbox,
      startFrame: config.startFrame || 0,
      endFrame: config.endFrame,
      trackerType: config.trackerType || 'CSRT',
      outputJson: outputJson
    };
    
    fs.writeFileSync(configPath, JSON.stringify(trackConfig, null, 2), 'utf8');
    
    const scriptPath = resolveScript('motion_tracker.py');
    console.log('[Motion Track] Script path:', scriptPath);
    const pyExe = getPythonExe();
    const proc = spawn(pyExe, [scriptPath, configPath], { env: getPythonEnv() });
    
    proc.on('error', (err) => {
      try { fs.unlinkSync(configPath); } catch {}
      resolve({ success: false, error: `Erro ao iniciar Python: ${err.message}` });
    });

    let trackingData: any = null;
    let errorOutput = '';
    
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line: string) => {
        if (!line.trim()) return;
        console.log('[Motion Track stdout]', line);
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'progress' && !sender.isDestroyed()) {
            sender.send('motion-track-progress', msg);
            sender.send('export-log', `[Motion Tracker] Progresso: ${msg.current}/${msg.total} frames`);
          } else if (msg.type === 'complete') {
            try { trackingData = fs.readFileSync(msg.output, 'utf8'); } catch {}
          } else if (msg.error && !sender.isDestroyed()) {
            sender.send('export-log', `[Motion Tracker] Erro: ${msg.error}`);
          }
        } catch (e) {
          if (!sender.isDestroyed()) {
            sender.send('export-log', `[Motion Tracker] ${line}`);
          }
        }
      });
    });
    
    proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      console.log('[Motion Track stderr]', str);
      if (!sender.isDestroyed()) {
        sender.send('export-log', `[Motion Tracker ERR] ${str}`);
      }
    });
    
    proc.on('close', (code) => {
      console.log('[Motion Track] Process closed with code:', code);
      console.log('[Motion Track] Error output:', errorOutput);
      
      // Limpa config temporário
      try { fs.unlinkSync(configPath); } catch {}
      
      // Fallback: se trackingData ainda não foi lido mas o arquivo de saída existe
      if (!trackingData && fs.existsSync(outputJson)) {
        try {
          trackingData = fs.readFileSync(outputJson, 'utf8');
        } catch {}
      }
      
      // Limpa arquivo de saída temporário após ler
      try { fs.unlinkSync(outputJson); } catch {}
      
      if (code !== 0 && !trackingData) {
        const errorMsg = errorOutput || `Tracking falhou com código ${code}`;
        console.log('[Motion Track] Resolving with error:', errorMsg);
        resolve({ success: false, error: errorMsg });
        return;
      }
      
      if (trackingData) {
        try {
          const result = JSON.parse(trackingData);
          console.log('[Motion Track] Success! Frames tracked:', result.tracking_data?.length);
          resolve({ success: true, ...result });
        } catch (e) {
          console.log('[Motion Track] JSON parse error:', e);
          resolve({ success: false, error: 'Erro ao processar dados de tracking' });
        }
      } else {
        console.log('[Motion Track] No tracking data generated');
        resolve({ success: false, error: 'Nenhum dado de tracking gerado' });
      }
    });
  });
});

ipcMain.handle('save-bill-project', async (_, clips: any) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Salvar Projeto Gabiru',
    defaultPath: 'projeto.gab',
    filters: [{ name: 'Projeto Gabiru', extensions: ['gab'] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(clips, null, 2), 'utf8');
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('load-bill-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Abrir Projeto Gabiru',
    filters: [{ name: 'Projeto Gabiru', extensions: ['gab'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    return { success: true, clips: JSON.parse(content) };
  }
  return { success: false };
});

// FFMPEG_PATH definido no topo do arquivo

ipcMain.handle('isolate-voice', async (_, inputPath: string) => {
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const ext = path.extname(inputPath).toLowerCase();
  const isVideo = ['.mp4', '.mov', '.mkv', '.avi'].includes(ext);
  const outputPath = path.join(tempDir, `cleaned_${Date.now()}${ext}`);
  
  return new Promise((resolve) => {
    // Pipeline Equilibrada: Redução Espectral + AI Denoising (anlmdn) + Vocal Focus
    // Reduzimos o nr para 30 para evitar o efeito "embaixo d'água" e subimos o lowpass para 12k
    const filterChain = 'afftdn=nr=30:nf=-25,anlmdn=s=0.0002,highpass=f=150,lowpass=f=12000';
    
    console.log(`[AI Audio] Processando com foco em clareza: ${inputPath}`);
    
    const args = isVideo 
      ? ['-y', '-i', inputPath, '-af', filterChain, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', outputPath]
      : ['-y', '-i', inputPath, '-af', filterChain, '-c:a', 'pcm_s16le', outputPath];

    const ffmpeg = spawn(getFfmpegPath(), args);
    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => { 
      const str = data.toString();
      if (str.includes('Error')) errorOutput += str;
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[AI Audio] Sucesso! Arquivo gerado: ${outputPath}`);
        resolve({ success: true, path: outputPath });
      } else {
        console.error(`[AI Audio] Falha: ${errorOutput}`);
        resolve({ success: false, error: `FFmpeg Code ${code}` });
      }
    });

    ffmpeg.on('error', (err) => {
      resolve({ success: false, error: `Erro ao iniciar FFmpeg: ${err.message}` });
    });
  });
});

ipcMain.handle('get-waveform', async (_, filePath: string) => {
  let cleanPath = filePath;
  if (cleanPath.startsWith('file:///')) {
    cleanPath = cleanPath.slice(8);
  } else if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.slice(7);
  }
  cleanPath = decodeURIComponent(cleanPath).replace(/\//g, '\\');

  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const crypto = await import('crypto');
  const fileHash = crypto.createHash('md5').update(cleanPath).digest('hex');
  const outputPath = path.join(tempDir, `wave_${fileHash}_v2.json`);
  
  if (fs.existsSync(outputPath)) {
    try {
      const peaks = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      return { success: true, peaks };
    } catch (e) {}
  }
  
  return new Promise((resolve) => {
    const SAMPLE_RATE = 8000;
    const args = [
      '-y',
      '-vn',
      '-i', cleanPath,
      '-f', 's16le',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-'
    ];
    
    const ffmpeg = spawn(getFfmpegPath(), args);
    let pcmData = Buffer.alloc(0);
    
    ffmpeg.stdout.on('data', (chunk) => {
      pcmData = Buffer.concat([pcmData, chunk]);
    });
    
    ffmpeg.on('close', (code) => {
      if (pcmData.length > 0) {
        try {
          const peaks: number[] = [];
          const numSamples = pcmData.length / 2;
          let maxPeak = 0.01;
          for (let i = 0; i < numSamples; i++) {
            const sample = pcmData.readInt16LE(i * 2);
            const val = Math.abs(sample) / 32768;
            peaks.push(val);
            if (val > maxPeak) maxPeak = val;
          }
          
          const normalizedPeaks = peaks.map(p => p / maxPeak);
          
          const duration = numSamples / SAMPLE_RATE;
          const targetCount = Math.max(30, Math.round(duration * 10)); // 10 barras por segundo
          const step = Math.max(1, Math.floor(normalizedPeaks.length / targetCount));
          const compressedPeaks: number[] = [];
          
          for (let i = 0; i < normalizedPeaks.length; i += step) {
            let max = 0;
            for (let j = 0; j < step && (i + j) < normalizedPeaks.length; j++) {
              if (normalizedPeaks[i + j] > max) max = normalizedPeaks[i + j];
            }
            compressedPeaks.push(parseFloat(max.toFixed(3)));
          }
          
          fs.writeFileSync(outputPath, JSON.stringify(compressedPeaks), 'utf8');
          resolve({ success: true, peaks: compressedPeaks });
        } catch (err: any) {
          resolve({ success: false, error: err.message });
        }
      } else {
        resolve({ success: false, error: `FFmpeg exited with code ${code}` });
      }
    });
    
    ffmpeg.on('error', (err) => {
      resolve({ success: false, error: `Erro ao iniciar FFmpeg: ${err.message}` });
    });
  });
});

ipcMain.handle('generate-tts', async (_, { text, voice }) => {
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const outputPath = path.join(tempDir, `tts_${Date.now()}.wav`);
  
  // Detecta se é voz Edge-TTS (Microsoft Online)
  const isEdgeTTS = voice.includes('Neural') || voice.startsWith('pt-BR-');
  
  if (isEdgeTTS) {
    console.log(`[TTS] Usando Edge-TTS (Microsoft) - Voz: ${voice}`);
    
    // Edge-TTS via Python
    return new Promise((resolve) => {
      const edgeScript = `
import asyncio
import edge_tts
import sys

async def main():
    text = """${text.replace(/"/g, '\\"').replace(/\n/g, ' ')}"""
    voice = "${voice}"
    output = r"${outputPath}"
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output)
    print(f"OK:{output}")

if __name__ == "__main__":
    asyncio.run(main())
`;
      
      const scriptPath = path.join(tempDir, `edge_tts_${Date.now()}.py`);
      fs.writeFileSync(scriptPath, edgeScript, 'utf8');
      
      const pythonExe = getPythonExe();
      const edgeProcess = spawn(pythonExe, [scriptPath], { env: getPythonEnv() });
      
      let output = '';
      let errorOutput = '';
      
      edgeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      edgeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      edgeProcess.on('close', (code) => {
        try { fs.unlinkSync(scriptPath); } catch(e) {}
        
        if (code === 0 && output.includes('OK:')) {
          console.log(`[TTS] Edge-TTS gerado com sucesso`);
          
          // Medir duração do áudio
          const ffprobeExe = getFfprobePath();
          const ffprobe = spawn(ffprobeExe, [
            '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath
          ]);
          
          let durationStr = '';
          ffprobe.stdout.on('data', (data) => durationStr += data.toString());
          
          ffprobe.on('close', () => {
            const duration = parseFloat(durationStr.trim()) || 5;
            resolve({ success: true, path: outputPath, duration: duration });
          });

          ffprobe.on('error', () => {
            resolve({ success: true, path: outputPath, duration: 5 });
          });
        } else {
          console.error(`[TTS] Edge-TTS falhou: ${errorOutput}`);
          resolve({ success: false, error: `Edge-TTS error: ${errorOutput || 'Instale: pip install edge-tts'}` });
        }
      });
      
      edgeProcess.on('error', (err) => {
        console.error(`[TTS] Erro ao chamar Python:`, err);
        resolve({ success: false, error: `Python/edge-tts não disponível: ${err.message}` });
      });
    });
  }
  
  // Piper TTS (Offline)
  console.log(`[TTS] Usando Piper (Offline) - Voz: ${voice}`);
  console.log(`[TTS] Piper base path: ${getPiperPathBase()}`);
  console.log(`[TTS] Piper exe path: ${getPiperExe()}`);
  
  const cleanText = text.replace(/\r\n/g, '\n').trim() + '\n';
  const textInputPath = path.join(tempDir, `input_${Date.now()}.txt`);
  fs.writeFileSync(textInputPath, cleanText, 'utf8');

  // Mapeamento de vozes para arquivos .onnx
  const voiceMap: Record<string, string> = {
    'faber': 'pt_BR-faber-medium.onnx',
    'cadu': 'pt_BR-cadu-medium.onnx',
    'edresson': 'pt_BR-edresson-low.onnx',
    'jeff': 'pt_BR-jeff-high.onnx',
    'mulher': 'pt_BR-thais-medium.onnx',
    'homem': 'pt_BR-faber-medium.onnx',
  };
  
  const voiceFile = voiceMap[voice] || voiceMap['faber'];
  const piperBase = getPiperPathBase();
  const modelPath = path.join(piperBase, voiceFile);
  const finalModel = fs.existsSync(modelPath) ? modelPath : path.join(piperBase, 'pt_BR-faber-medium.onnx');
  
  console.log(`[TTS] Voz solicitada: ${voice}`);
  console.log(`[TTS] Arquivo de voz: ${voiceFile}`);
  console.log(`[TTS] Model path: ${modelPath}`);
  console.log(`[TTS] Model existe? ${fs.existsSync(modelPath)}`);
  console.log(`[TTS] Final model: ${finalModel}`);
  console.log(`[TTS] Final model existe? ${fs.existsSync(finalModel)}`);
  
  return new Promise((resolve) => {
    console.log(`[Piper] Gerando áudio para ${cleanText.length} caracteres...`);
    console.log(`[Piper] Comando: ${getPiperExe()} --model ${finalModel} --output_file ${outputPath}`);
    
    const piper = spawn(getPiperExe(), ['--model', finalModel, '--output_file', outputPath]);
    const readStream = fs.createReadStream(textInputPath);
    readStream.pipe(piper.stdin);

    let stderrData = '';
    piper.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log(`[Piper STDERR]: ${data.toString()}`);
    });

    piper.stdout.on('data', (data) => {
      console.log(`[Piper STDOUT]: ${data.toString()}`);
    });

    piper.on('close', async (code) => {
      console.log(`[Piper] Processo finalizado com código: ${code}`);
      if (stderrData) console.log(`[Piper] Erros capturados: ${stderrData}`);
      
      try { fs.unlinkSync(textInputPath); } catch(e) {}

      if (code === 0) {
        console.log(`[Piper] Verificando se arquivo foi gerado: ${outputPath}`);
        console.log(`[Piper] Arquivo existe? ${fs.existsSync(outputPath)}`);
        
        const ffprobeExe = getFfprobePath(); 
        const ffprobe = spawn(ffprobeExe, [
          '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath
        ]);

        let durationStr = '';
        ffprobe.stdout.on('data', (data) => durationStr += data.toString());
        
        ffprobe.on('close', (fCode) => {
          const duration = parseFloat(durationStr.trim()) || 5;
          console.log(`[Piper] Sucesso! Duração: ${duration}s`);
          resolve({ success: true, path: outputPath, duration: duration });
        });

        ffprobe.on('error', () => {
          resolve({ success: true, path: outputPath, duration: 5 });
        });
      } else {
        const errorMsg = `Piper falhou com código ${code}. ${stderrData ? 'Erro: ' + stderrData : ''}`;
        console.error(`[Piper] ${errorMsg}`);
        resolve({ success: false, error: errorMsg });
      }
    });

    piper.on('error', (err) => {
      console.error(`[Piper] Erro ao executar piper.exe: ${err.message}`);
      resolve({ success: false, error: `Erro ao executar Piper: ${err.message}` });
    });
  });
});

// Speak API - Gera TTS e toca imediatamente
ipcMain.handle('speak', async (_, text: string, volume?: number) => {
  try {
    console.log('[Speak] Gerando TTS para:', text);
    
    // Gera o áudio usando a voz padrão (homem)
    const ttsResult: any = await new Promise((resolve) => {
      const tempDir = path.join(app.getPath('userData'), 'bill_temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
      const cleanText = text.replace(/\r\n/g, '\n').trim() + '\n';
      const textInputPath = path.join(tempDir, `speak_input_${Date.now()}.txt`);
      fs.writeFileSync(textInputPath, cleanText, 'utf8');

      const modelPath = path.join(PIPER_PATH_BASE, 'pt_BR-faber-medium.onnx');
      const outputPath = path.join(tempDir, `speak_${Date.now()}.wav`);
      
      const piper = spawn(PIPER_EXE, ['--model', modelPath, '--output_file', outputPath]);
      const readStream = fs.createReadStream(textInputPath);
      readStream.pipe(piper.stdin);

      piper.on('close', async (code) => {
        try { fs.unlinkSync(textInputPath); } catch(e) {}
        if (code === 0) {
          console.log('[Speak] TTS gerado com sucesso:', outputPath);
          resolve({ success: true, path: outputPath });
        } else {
          resolve({ success: false, error: `Piper falhou com código ${code}` });
        }
      });

      piper.on('error', (err) => resolve({ success: false, error: err.message }));
    });
    
    if (!ttsResult.success) {
      return ttsResult;
    }
    
    // Toca o áudio usando o player padrão do Windows
    const audioPath = ttsResult.path;
    console.log('[Speak] Tocando áudio:', audioPath);
    
    // Usa powershell para tocar o áudio
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      // Script PowerShell para tocar o áudio
      const volumeArg = volume !== undefined ? volume : 100;
      const script = `
Add-Type -AssemblyName presentationCore
$mediaPlayer = New-Object system.windows.media.mediaplayer
$mediaPlayer.Volume = ${volumeArg / 100}
$mediaPlayer.open('${audioPath.replace(/\\/g, '\\\\')}')
$mediaPlayer.Play()
Start-Sleep -Seconds 0.5
while($mediaPlayer.NaturalDuration.HasTimeSpan -eq $false) {
  Start-Sleep -Milliseconds 100
}
$duration = $mediaPlayer.NaturalDuration.TimeSpan.TotalSeconds
Start-Sleep -Seconds $duration
$mediaPlayer.Close()
      `.trim();
      
      const os = require('os');
      const tempScript = path.join(os.tmpdir(), `speak_${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, script, 'utf8');
      
      exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (err: any) => {
        try { fs.unlinkSync(tempScript); } catch {}
        try { fs.unlinkSync(audioPath); } catch {}
        
        if (err) {
          console.error('[Speak] Erro ao tocar áudio:', err.message);
          resolve({ success: false, error: err.message });
        } else {
          console.log('[Speak] Áudio tocado com sucesso');
          resolve({ success: true });
        }
      });
    });
    
  } catch (err: any) {
    console.error('[Speak] Erro:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('generate-image', async (_, { prompt, apiKey }) => {
  const http = await import('http');
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  // Passo 1: Forçar descarregamento do Ollama (Tática 1)
  await new Promise<void>((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/ps', method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const models = JSON.parse(data).models || [];
          if (models.length > 0) {
            console.log(`[IA] Modelo ativo encontrado: ${models[0].name}. Descarregando...`);
            const unloadReq = http.request({ 
              hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }, (unloadRes) => {
              unloadRes.on('data', () => {}); // Consumir resposta
              unloadRes.on('end', () => {
                console.log(`[IA] Modelo descarregado com sucesso!`);
                setTimeout(resolve, 3000); // 3 segundos pra VRAM limpar totalmente
              });
            });
            unloadReq.on('error', () => resolve());
            unloadReq.write(JSON.stringify({ model: models[0].name, keep_alive: 0 }));
            unloadReq.end();
          } else {
            resolve();
          }
        } catch (e) { resolve(); }
      });
    });
    req.on('error', () => resolve());
    req.end();
  });

  const outputPath = path.join(tempDir, `img_${Date.now()}.png`);
  const scriptPath = resolveScript('generate_image.py');
  const pollinationsKey = (apiKey || loadPollinationsApiKey() || '').trim();
  
  return new Promise((resolve) => {
    console.log(`[Imagem IA] Gerando imagem: ${prompt}`);
    
    const proc = spawn(PYTHON_EXE, [scriptPath, prompt, outputPath, pollinationsKey]);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => output += data.toString());
    proc.stderr.on('data', (data) => errorOutput += data.toString());

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[Imagem IA] Sucesso! Arquivo: ${outputPath}`);
        resolve({ success: true, path: outputPath });
      } else {
        console.error(`[Imagem IA] Falha:`, errorOutput);
        resolve({ success: false, error: errorOutput || `Python Crash Code ${code}` });
      }
    });

    proc.on('error', (err) => resolve({ success: false, error: err.message }));
  });
});


ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Selecionar Pasta de Trabalho',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false, error: 'Cancelado' };
});

// ── INTERNAL PROJECT MANAGEMENT (Projects in %APPDATA%) ──────────────────────

function getProjectsDir(): string {
  const userDataPath = app.getPath('userData');
  const projectsDir = path.join(userDataPath, 'projects');
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
  return projectsDir;
}

function getCustomProjectsFile(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'custom-projects.json');
}

function loadCustomProjectPaths(): string[] {
  try {
    const filePath = getCustomProjectsFile();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Projects] Erro ao carregar projetos customizados:', err);
  }
  return [];
}

function saveCustomProjectPath(projectPath: string): void {
  try {
    const paths = loadCustomProjectPaths();
    if (!paths.includes(projectPath)) {
      paths.push(projectPath);
      const filePath = getCustomProjectsFile();
      fs.writeFileSync(filePath, JSON.stringify(paths, null, 2));
    }
  } catch (err) {
    console.error('[Projects] Erro ao salvar projeto customizado:', err);
  }
}

function removeCustomProjectPath(projectPath: string): void {
  try {
    const paths = loadCustomProjectPaths();
    const filtered = paths.filter(p => p !== projectPath);
    const filePath = getCustomProjectsFile();
    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
  } catch (err) {
    console.error('[Projects] Erro ao remover projeto customizado:', err);
  }
}

ipcMain.handle('list-projects', async () => {
  try {
    const projects: Array<{ name: string; path: string; lastModified: number }> = [];
    
    // 1. Projetos na pasta padrão
    const projectsDir = getProjectsDir();
    if (fs.existsSync(projectsDir)) {
      const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
      entries
        .filter(e => e.isDirectory())
        .forEach(e => {
          const projectPath = path.join(projectsDir, e.name);
          try {
            const stats = fs.statSync(projectPath);
            projects.push({
              name: e.name,
              path: projectPath,
              lastModified: stats.mtimeMs
            });
          } catch (err) {
            console.error('[Projects] Erro ao ler projeto:', projectPath, err);
          }
        });
    }
    
    // 2. Projetos customizados
    const customPaths = loadCustomProjectPaths();
    customPaths.forEach(projectPath => {
      if (fs.existsSync(projectPath)) {
        try {
          const stats = fs.statSync(projectPath);
          const name = path.basename(projectPath);
          projects.push({
            name,
            path: projectPath,
            lastModified: stats.mtimeMs
          });
        } catch (err) {
          console.error('[Projects] Erro ao ler projeto customizado:', projectPath, err);
        }
      } else {
        // Remove caminhos que não existem mais
        removeCustomProjectPath(projectPath);
      }
    });
    
    // Ordena por data de modificação
    projects.sort((a, b) => b.lastModified - a.lastModified);
    
    return { success: true, projects };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-project', async (_, projectName: string, customFolder?: string) => {
  try {
    // Se forneceu pasta customizada, usa ela; senão usa a pasta padrão
    const baseDir = customFolder || getProjectsDir();
    
    const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_').trim();
    if (!safeName) {
      return { success: false, error: 'Nome de projeto inválido' };
    }
    
    const projectPath = path.join(baseDir, safeName);
    
    if (fs.existsSync(projectPath)) {
      return { success: false, error: 'Já existe um projeto com este nome nesta pasta' };
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    
    const readmePath = path.join(projectPath, 'README.md');
    const readmeContent = `# ${safeName}\n\nProjeto criado em ${new Date().toLocaleDateString('pt-BR')}\n`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    
    // Se for pasta customizada, salva o caminho
    if (customFolder) {
      saveCustomProjectPath(projectPath);
    }
    
    console.log(`[Projects] Projeto criado: ${projectPath}`);
    return { success: true, path: projectPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-project-folder', async (_, projectPath: string) => {
  try {
    const projectsDir = getProjectsDir();
    
    // Verifica se é projeto da pasta padrão OU se está na lista de customizados
    const isDefaultProject = projectPath.startsWith(projectsDir);
    const customPaths = loadCustomProjectPaths();
    const isCustomProject = customPaths.includes(projectPath);
    
    if (!isDefaultProject && !isCustomProject) {
      return { success: false, error: 'Caminho de projeto inválido' };
    }
    
    if (!fs.existsSync(projectPath)) {
      // Remove da lista de customizados mesmo se não existir mais
      if (isCustomProject) {
        removeCustomProjectPath(projectPath);
      }
      return { success: false, error: 'Projeto não encontrado' };
    }
    
    console.log(`[Projects] Tentando deletar: ${projectPath}`);
    console.log(`[Projects] Pasta existe: ${fs.existsSync(projectPath)}`);
    
    // Tenta deletar com várias tentativas (node_modules pode ter arquivos travados)
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;
    
    while (attempts < maxAttempts) {
      try {
        fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        console.log(`[Projects] Projeto deletado com fs.rmSync na tentativa ${attempts + 1}`);
        console.log(`[Projects] Pasta ainda existe após rmSync: ${fs.existsSync(projectPath)}`);
        
        if (!fs.existsSync(projectPath)) {
          // Remove da lista de customizados se for o caso
          if (isCustomProject) {
            removeCustomProjectPath(projectPath);
          }
          return { success: true };
        }
      } catch (e: any) {
        lastError = e;
        console.log(`[Projects] Tentativa ${attempts + 1} falhou com fs.rmSync:`, e.message);
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Se ainda falhou, tenta com método alternativo no Windows
    if (process.platform === 'win32') {
      try {
        console.log(`[Projects] Tentando com PowerShell Remove-Item -Force -Recurse...`);
        const { execSync } = require('child_process');
        
        // PowerShell é mais poderoso que rmdir para arquivos travados
        const psCommand = `powershell -Command "Remove-Item -Path '${projectPath}' -Recurse -Force -ErrorAction SilentlyContinue"`;
        execSync(psCommand, { stdio: 'ignore', timeout: 30000 });
        
        console.log(`[Projects] Comando PowerShell executado`);
        
        // Aguarda um pouco para o Windows processar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`[Projects] Pasta ainda existe após PowerShell: ${fs.existsSync(projectPath)}`);
        
        if (!fs.existsSync(projectPath)) {
          console.log(`[Projects] Projeto deletado (via PowerShell): ${projectPath}`);
          return { success: true };
        } else {
          // Última tentativa: marca arquivos como não-readonly e tenta de novo
          console.log(`[Projects] Tentando remover atributo readonly e deletar novamente...`);
          try {
            execSync(`attrib -R "${projectPath}\\*.*" /S /D`, { stdio: 'ignore' });
            execSync(`powershell -Command "Remove-Item -Path '${projectPath}' -Recurse -Force"`, { stdio: 'ignore', timeout: 30000 });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!fs.existsSync(projectPath)) {
              console.log(`[Projects] Projeto deletado (após remover readonly): ${projectPath}`);
              return { success: true };
            }
          } catch {}
          
          console.error(`[Projects] ERRO: Pasta ainda existe após todas as tentativas!`);
          return { success: false, error: 'A pasta não pôde ser deletada completamente. Alguns arquivos podem estar sendo usados pelo próprio Gabiru. Tente fechar e reabrir o aplicativo.' };
        }
      } catch (cmdError: any) {
        console.error(`[Projects] Erro ao executar PowerShell:`, cmdError.message);
        return { success: false, error: `Não foi possível deletar o projeto. Tente fechar o VSCode ou outros programas que possam estar usando os arquivos. Erro: ${lastError?.message || cmdError.message}` };
      }
    }
    
    return { success: false, error: `Não foi possível deletar após ${maxAttempts} tentativas: ${lastError?.message}` };
  } catch (error: any) {
    console.error(`[Projects] Exceção geral:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-settings', async (_, settings: any) => {
  try {
    const settingsPath = getElysaSettingsPath();
    
    // Cria a estrutura unificada contendo as chaves do React e do Python
    const unifiedSettings = {
      ...settings,
      tema_ativo: settings.theme,
      provider_ativo: settings.apiProvider,
      modelo_ativo: settings.apiProvider === 'ollama' ? settings.ollamaModel : 
                    settings.apiProvider === 'gemini' ? settings.geminiModel :
                    settings.apiProvider === 'openai' ? settings.openaiModel :
                    settings.apiProvider === 'anthropic' ? settings.anthropicModel :
                    settings.apiProvider === 'custom' ? settings.customModel :
                    settings.openrouterModel,
      workFolder: settings.workFolder,
      activeMainView: settings.activeMainView,
      volume_voz: settings.voiceVolume,
      providers: {
        ollama: { model: settings.ollamaModel },
        gemini: { key: settings.geminiApiKey, modelo: settings.geminiModel },
        openai: { key: settings.openaiApiKey, modelo: settings.openaiModel, url: settings.openaiUrl },
        anthropic: { key: settings.anthropicApiKey, modelo: settings.anthropicModel },
        openrouter: { key: settings.openrouterApiKey, modelo: settings.openrouterModel, url: settings.openrouterUrl },
        custom: { key: settings.customApiKey, modelo: settings.customModel, url: settings.customBaseUrl },
        pollinations: { key: settings.pollinationsApiKey || '' }
      }
    };

    // Salva unificado (Electron + Python)
    fs.writeFileSync(settingsPath, JSON.stringify(unifiedSettings, null, 2), 'utf8');

    // Tenta avisar o Python (Backup) - Passamos as configurações unificadas para que o Python não as delete
    try { await sendToPython('save_settings', { settings: unifiedSettings }); } catch (e) {}
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-custom-models', async (_, baseUrl: string, apiKey?: string) => {
  try {
    let url = baseUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
    if (url.endsWith('/')) url = url.slice(0, -1);

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    let response;
    try {
      response = await fetch(`${url}/models`, { headers });
    } catch (e) {
      // First try failed completely
    }

    // Se falhar ou der 404 e a URL não tiver /v1, tenta com /v1/models
    if ((!response || !response.ok) && !url.endsWith('/v1')) {
      try {
        const fallbackRes = await fetch(`${url}/v1/models`, { headers });
        if (fallbackRes.ok) response = fallbackRes;
      } catch (e) {}
    }

    if (!response || !response.ok) {
      return { success: false, error: `Erro HTTP: ${response ? response.status : 'Falha na conexão'}` };
    }

    const data: any = await response.json();
    if (data && Array.isArray(data.data)) {
      const models = data.data.map((m: any) => m.id);
      return { success: true, models };
    } else {
      return { success: false, error: 'Formato de resposta inválido (esperado "data" como array)' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha desconhecida' };
  }
});

ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = getElysaSettingsPath();
    
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Se os dados vierem do Python (legado), converter para o formato do React
      if (data.tema_ativo && !data.theme) {
        return {
          success: true,
          settings: {
            theme: data.tema_ativo || 'dark',
            apiProvider: data.provider_ativo || 'ollama',
            ollamaModel: data.provider_ativo === 'ollama' ? data.modelo_ativo : '',
            geminiModel: data.provider_ativo === 'gemini' ? data.modelo_ativo : 'gemini-2.0-flash',
            openaiModel: data.provider_ativo === 'openai' ? data.modelo_ativo : 'gpt-4o',
            anthropicModel: data.provider_ativo === 'anthropic' ? data.modelo_ativo : 'claude-sonnet-4-20250514',
            customModel: data.provider_ativo === 'custom' ? data.modelo_ativo : '',
            openrouterModel: data.provider_ativo === 'openrouter' ? data.modelo_ativo : 'meta-llama/llama-3-70b-instruct',
            workFolder: data.workFolder || '',
            voiceVolume: data.volume_voz !== undefined ? data.volume_voz : 100,
            
            geminiApiKey: data.providers?.gemini?.key || '',
            openaiApiKey: data.providers?.openai?.key || '',
            openaiUrl: data.providers?.openai?.url || '',
            anthropicApiKey: data.providers?.anthropic?.key || '',
            openrouterApiKey: data.providers?.openrouter?.key || '',
            openrouterUrl: data.providers?.openrouter?.url || '',
            pollinationsApiKey: data.providers?.pollinations?.key || data.pollinationsApiKey || '',
            customName: data.providers?.custom?.name || '',
            customBaseUrl: data.providers?.custom?.url || '',
            customApiKey: data.providers?.custom?.key || '',
          }
        };
      }
      return { success: true, settings: data };
    }
    return { success: true, settings: {} };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process-with-bill', async (_, message: string) => {
  // Sistema Elysa desabilitado - retorna erro
  if (!pythonWorker) {
    return { success: false, error: 'Sistema Elysa Python desabilitado' };
  }
  pythonWorker.stdin.write(JSON.stringify({ type: 'process', message }) + '\n');
  return { success: true };
});

// Video Downloader Handlers
ipcMain.handle('get-video-info', async (_, url: string) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // Tenta múltiplos caminhos para yt-dlp
    const possiblePaths = [
      path.join(app.getPath('userData'), 'yt-dlp', 'yt-dlp.exe'),
      path.join(process.resourcesPath || __dirname, 'yt-dlp.exe'),
      'yt-dlp' // Tenta no PATH do sistema
    ];
    
    let ytDlpPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (p === 'yt-dlp' || fs.existsSync(p)) {
        ytDlpPath = p;
        break;
      }
    }
    
    const command = `"${ytDlpPath}" --dump-json --no-playlist "${url}"`;
    
    const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10, windowsHide: true });
    const info = JSON.parse(stdout);
    
    // Filtra e organiza os formatos
    const videoFormats: any[] = [];
    const audioFormats: any[] = [];
    
    (info.formats || []).forEach((f: any) => {
      // Formatos combinados (vídeo+áudio)
      if (f.vcodec !== 'none' && f.acodec !== 'none') {
        videoFormats.push({
          format_id: f.format_id,
          ext: f.ext,
          quality: f.format_note || f.quality,
          resolution: f.resolution || `${f.height}p`,
          filesize: f.filesize,
          type: 'video+audio',
          hasAudio: true
        });
      }
    });
    
    // Se não tem formatos combinados, cria opções que mesclam vídeo+áudio
    if (videoFormats.length === 0) {
      const videoOnly = (info.formats || []).filter((f: any) => f.vcodec !== 'none' && f.acodec === 'none');
      const bestResolutions = ['2160', '1440', '1080', '720', '480', '360'];
      
      bestResolutions.forEach(res => {
        const format = videoOnly.find((f: any) => f.height === parseInt(res));
        if (format) {
          videoFormats.push({
            format_id: `bestvideo[height=${res}]+bestaudio/best[height=${res}]`,
            ext: 'mp4',
            quality: `${res}p`,
            resolution: `${res}p`,
            filesize: format.filesize,
            type: 'merged',
            hasAudio: true
          });
        }
      });
      
      // Adiciona opção "melhor qualidade"
      videoFormats.unshift({
        format_id: 'bestvideo+bestaudio/best',
        ext: 'mp4',
        quality: 'Melhor qualidade',
        resolution: 'Max',
        type: 'merged',
        hasAudio: true
      });
    }
    
    // Adiciona opção de áudio
    videoFormats.push({
      format_id: 'bestaudio/best',
      ext: 'mp3',
      quality: 'Áudio MP3',
      resolution: 'Audio',
      type: 'audio',
      hasAudio: true
    });
    
    return {
      success: true,
      info: {
        title: info.title,
        duration: info.duration,
        thumbnail: info.thumbnail
      },
      formats: videoFormats
    };
  } catch (error: any) {
    console.error('[get-video-info] Erro:', error);
    return { success: false, error: 'yt-dlp não encontrado. Por favor, baixe de https://github.com/yt-dlp/yt-dlp/releases e coloque em: ' + app.getPath('userData') + '\\yt-dlp\\yt-dlp.exe' };
  }
});

ipcMain.handle('download-video', async (_, url: string, formatId: string, outputPath: string) => {
  const { exec } = await import('child_process');
  
  try {
    const possiblePaths = [
      path.join(app.getPath('userData'), 'yt-dlp', 'yt-dlp.exe'),
      path.join(process.resourcesPath || __dirname, 'yt-dlp.exe'),
      'yt-dlp'
    ];
    
    let ytDlpPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (p === 'yt-dlp' || fs.existsSync(p)) {
        ytDlpPath = p;
        break;
      }
    }
    
    // Se for áudio (bestaudio), adiciona flags para converter para MP3
    // Caso contrário, só mescla em MP4
    const isAudio = formatId.includes('bestaudio') && !formatId.includes('bestvideo');
    const extraFlags = isAudio ? '-x --audio-format mp3' : '--merge-output-format mp4';
    
    // Sanitiza caracteres especiais no nome do arquivo
    const sanitizedOutput = outputPath.replace(/\//g, '\\');
    
    // IMPORTANTE: --no-playlist, formatId pode ser uma expressão (bestvideo+bestaudio)
    // --restrict-filenames remove caracteres problemáticos do nome do arquivo
    const command = `"${ytDlpPath}" --no-playlist --restrict-filenames ${extraFlags} -f "${formatId}" -o "${sanitizedOutput}\\%%(title)s.%%(ext)s" "${url}"`;
    
    console.log('[download-video] Comando:', command);
    
    // Executa em background
    exec(command, { maxBuffer: 1024 * 1024 * 100, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        console.error('[download-video] Erro:', error);
        console.error('[download-video] stderr:', stderr);
      } else {
        console.log('[download-video] Download concluído:', stdout);
      }
    });
    
    return { success: true, path: outputPath };
  } catch (error: any) {
    console.error('[download-video] Erro:', error);
    return { success: false, error: error.message || 'Erro ao baixar vídeo' };
  }
});

ipcMain.handle('download-file', async (_, url: string, filename: string) => {
  const https = await import('https');
  
  try {
    // Abre dialog para escolher onde salvar
    const result = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Download cancelado' };
    }
    
    const filePath = result.filePath;
    
    return new Promise((resolve) => {
      const file = fs.createWriteStream(filePath);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ success: true, path: filePath });
        });
      }).on('error', (error) => {
        fs.unlink(filePath, () => {});
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-directory', async (_, dirPath: string) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (_, filePath: string) => {
  try {
    const { shell } = await import('electron');
    await shell.openPath(filePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('translate-text', async (_, text: string, from: string, to: string) => {
  try {
    const https = await import('https');
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.responseData && parsed.responseData.translatedText) {
              resolve({ success: true, translatedText: parsed.responseData.translatedText });
            } else {
              resolve({ success: false, error: 'Erro ao traduzir' });
            }
          } catch {
            resolve({ success: false, error: 'Erro ao processar resposta' });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-background', async (_, base64DataUrl: string) => {
  const { exec } = await import('child_process');
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const ts = Date.now();
  const tempIn  = path.join(tempDir, `bg_in_${ts}.txt`);
  const tempOut = path.join(tempDir, `bg_out_${ts}.txt`);
  const scriptPath = resolveScript('remove_background.py');

  try {
    fs.writeFileSync(tempIn, base64DataUrl, 'utf8');

    const result = await new Promise<{ success: boolean; output?: string; error?: string }>((resolve) => {
      const command = `"${PYTHON_EXE}" "${scriptPath}" "${tempIn}" "${tempOut}" --base64`;
      exec(command, { maxBuffer: 1024 * 1024 * 100, timeout: 120000, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) resolve({ success: false, error: stderr || error.message });
          else resolve({ success: true, output: stdout });
        }
      );
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!fs.existsSync(tempOut)) {
      return { success: false, error: 'Arquivo de saída não encontrado após processamento.' };
    }

    const base64Out = fs.readFileSync(tempOut, 'utf8').trim();
    return { success: true, base64: base64Out };
  } catch (e: any) {
    return { success: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tempIn); } catch {}
    try { fs.unlinkSync(tempOut); } catch {}
  }
});

// Cache global de mapeamento fonte → arquivo
const fontFileCache = new Map<string, string>();

// Exporta o cache para uso no export
ipcMain.handle('get-font-file-cache', async () => {
  buildFontFileCache();
  return { success: true, cache: Object.fromEntries(fontFileCache) };
});

// Debug: busca uma fonte no cache (útil para testes)
ipcMain.handle('search-font-in-cache', async (_, searchTerm: string) => {
  buildFontFileCache();
  const matches = Array.from(fontFileCache.entries())
    .filter(([key]) => key.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(([key, value]) => ({ key, value }));
  return { success: true, matches };
});

ipcMain.handle('get-system-fonts', async () => {
  const { exec } = await import('child_process');
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const cmd = `powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing'); [System.Drawing.Text.InstalledFontCollection]::new().Families.Name"`;
      exec(cmd, { windowsHide: true }, (error, stdout) => {
        if (!error && stdout) {
          const fonts = stdout
            .split(/\r?\n/)
            .map(f => f.trim())
            .filter(f => f.length > 0);
          
          // Popula o cache de mapeamento fonte → arquivo
          buildFontFileCache();
          
          resolve({ success: true, fonts });
        } else {
          resolve({ success: false, error: error?.message || 'Failed to list fonts' });
        }
      });
    } else {
      resolve({ success: true, fonts: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact'] });
    }
  });
});

function buildFontFileCache() {
  if (fontFileCache.size > 0) return; // Já foi construído
  
  console.log('[Font Cache] Iniciando mapeamento de fontes...');
  
  const fontDirs = [
    path.join(__dirname, '..', 'scripts', 'fonts'),
    path.join(__dirname, 'scripts', 'fonts'),
    path.join(__dirname, '..', 'resources', 'fonts'),
    path.join(__dirname, 'resources', 'fonts'),
    path.join(process.resourcesPath || '', 'scripts', 'fonts'),
    path.join(process.resourcesPath || '', 'resources', 'fonts'),
    path.join(process.resourcesPath || '', 'fonts'),
    path.join(process.cwd(), 'scripts', 'fonts'),
    path.join(process.cwd(), 'resources', 'fonts'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Windows\\Fonts'),
    'C:\\Windows\\Fonts'
  ];
  
  let totalFonts = 0;
  let totalFiles = 0;
  
  for (const dir of fontDirs) {
    if (!fs.existsSync(dir)) continue;
    
    try {
      const files = fs.readdirSync(dir).filter(f => f.match(/\.(ttf|otf)$/i));
      totalFiles += files.length;
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        
        const namesToRegister = new Set<string>();
        
        // Tenta extrair nomes da fonte com opentype.js
        try {
          const opentype = require('opentype.js');
          const buf = fs.readFileSync(fullPath);
          const font = opentype.parse(buf.buffer);
          const win = font.names?.windows || {};
          const mac = font.names?.macintosh || {};
          
          // Adiciona todos os nomes possíveis
          if (win.preferredFamily?.en) namesToRegister.add(win.preferredFamily.en);
          if (mac.preferredFamily?.en) namesToRegister.add(mac.preferredFamily.en);
          if (win.fontFamily?.en) namesToRegister.add(win.fontFamily.en);
          if (mac.fontFamily?.en) namesToRegister.add(mac.fontFamily.en);
          if (win.fullName?.en) namesToRegister.add(win.fullName.en);
          if (mac.fullName?.en) namesToRegister.add(mac.fullName.en);
          if (win.postScriptName?.en) namesToRegister.add(win.postScriptName.en);
          if (mac.postScriptName?.en) namesToRegister.add(mac.postScriptName.en);
        } catch (e: any) {
          // Se falhar com opentype, usa nome do arquivo
        }
        
        // Adiciona nome do arquivo sempre
        const fileBase = path.basename(file, path.extname(file));
        namesToRegister.add(fileBase);
        namesToRegister.add(fileBase.replace(/[-_].*$/, ''));
        
        // Para cada nome, registra variações
        for (const name of namesToRegister) {
          if (!name) continue;
          if (!fontFileCache.has(name)) fontFileCache.set(name, `${dir}|${file}`);
          if (!fontFileCache.has(name.toLowerCase())) fontFileCache.set(name.toLowerCase(), `${dir}|${file}`);
          if (!fontFileCache.has(name.replace(/\s+/g, ''))) fontFileCache.set(name.replace(/\s+/g, ''), `${dir}|${file}`);
          if (!fontFileCache.has(name.replace(/\s+/g, '').toLowerCase())) fontFileCache.set(name.replace(/\s+/g, '').toLowerCase(), `${dir}|${file}`);
        }
        
        totalFonts++;
      }
    } catch (e: any) {
      console.error(`[Font Cache] Erro ao ler diretório ${dir}:`, e.message);
    }
  }
  
  console.log(`[Font Cache] ✓ ${totalFonts} fontes mapeadas. Total de variações no cache: ${fontFileCache.size}`);
}

function extractFontName(fontPath: string): string | null {
  try {
    const opentype = require('opentype.js');
    const buf = fs.readFileSync(fontPath);
    const font = opentype.parse(buf.buffer);
    const win = font.names?.windows || {};
    const mac = font.names?.macintosh || {};
    
    // Pega TODOS os nomes possíveis da fonte
    const allNames = new Set<string>();
    
    // Nome da família preferido
    if (win.preferredFamily?.en) allNames.add(win.preferredFamily.en);
    if (mac.preferredFamily?.en) allNames.add(mac.preferredFamily.en);
    
    // Nome da família
    if (win.fontFamily?.en) allNames.add(win.fontFamily.en);
    if (mac.fontFamily?.en) allNames.add(mac.fontFamily.en);
    
    // Nome completo (inclui Bold, Italic, etc)
    if (win.fullName?.en) allNames.add(win.fullName.en);
    if (mac.fullName?.en) allNames.add(mac.fullName.en);
    
    // Nome do PostScript
    if (win.postScriptName?.en) allNames.add(win.postScriptName.en);
    if (mac.postScriptName?.en) allNames.add(mac.postScriptName.en);
    
    // Retorna o primeiro nome encontrado
    for (const name of allNames) {
      if (name) return name;
    }
    
    // Fallback: nome do arquivo
    const basename = path.basename(fontPath, path.extname(fontPath));
    return basename
      .replace(/-Regular$/i, '')
      .replace(/Regular$/i, '')
      .replace(/-Bold$/i, '')
      .replace(/Bold$/i, '')
      .replace(/-Italic$/i, '')
      .replace(/Italic$/i, '')
      .replace(/[_-]/g, ' ')
      .trim();
  } catch (e: any) {
    try {
      const basename = path.basename(fontPath, path.extname(fontPath));
      return basename
        .replace(/-Regular$/i, '')
        .replace(/Regular$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();
    } catch (e2) {
      return null;
    }
  }
}

ipcMain.handle('patch-file', async (_, filePath: string, search: string, replace: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Arquivo não encontrado.' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const newContent = content.replace(search, replace);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-recursive', async (_, dirPath: string) => {
  try {
    const getAllFiles = (dir: string, fileList: any[] = []) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'release'].includes(file)) {
            fileList.push({ name: file, isDirectory: true, path: filePath });
            getAllFiles(filePath, fileList);
          }
        } else {
          fileList.push({ name: file, isDirectory: false, path: filePath });
        }
      });
      return fileList;
    };
    return { success: true, items: getAllFiles(dirPath) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── PROJECT MEMORY ───────────────────────────────────────────────────────────

ipcMain.handle('load-project-memory', async (_, dirPath: string) => {
  try {
    const memoryPath = path.join(dirPath, 'bill_project_memory.json');
    if (fs.existsSync(memoryPath)) {
      return { success: true, memory: JSON.parse(fs.readFileSync(memoryPath, 'utf-8')) };
    }
    return { success: true, memory: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-project-memory', async (_, dirPath: string, memory: any) => {
  try {
    const memoryPath = path.join(dirPath, 'bill_project_memory.json');
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── VISION & COMMANDS ────────────────────────────────────────────────────────

ipcMain.handle('see-screen', async (_, mode: 'describe' | 'ocr' = 'describe') => {
  return new Promise((resolve) => {
    if (!mainWindow) return resolve({ success: false, error: 'Janela não encontrada' });
    mainWindow.minimize();
    setTimeout(() => {
      const scriptPath = resolveScript('vision.py');
      const proc = spawn(PYTHON_EXE, [scriptPath, mode]);
      let output = '';
      proc.stdout.on('data', (data) => output += data.toString());
      proc.on('close', (code) => {
        if (mainWindow) mainWindow.restore();
        resolve({ success: code === 0, content: output.trim() });
      });
      proc.on('error', (err) => {
        if (mainWindow) mainWindow.restore();
        resolve({ success: false, error: err.message });
      });
    }, 1000);
  });
});

// ── CAPTURE SCREEN AREA (Screenshot com seleção de área) ────────────────────
ipcMain.handle('capture-screen-area', async () => {
  return new Promise((resolve) => {
    if (!mainWindow) return resolve({ success: false, error: 'Janela não encontrada' });
    
    const scriptPath = resolveScript('screenshot_area.py');
    const proc = spawn(PYTHON_EXE, [scriptPath]);
    
    let output = '';
    let errorOutput = '';
    
    proc.stdout.on('data', (data) => output += data.toString());
    proc.stderr.on('data', (data) => errorOutput += data.toString());
    
    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const base64Data = output.trim();
        resolve({ success: true, base64: base64Data });
      } else {
        resolve({ success: false, error: errorOutput || 'Captura cancelada' });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});


// ── LLM PROXIES (Ollama, Gemini, OpenRouter, Anthropic, OpenAI) ─────────────────

ipcMain.handle('ollama-chat', async (_, messages: any[], model: string) => {
  const http = await import('http');
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/chat', method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ success: true, response: JSON.parse(data) }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages, stream: false }));
    req.end();
  });
});

ipcMain.handle('ollama-stream', async (event, messages: any[], model: string) => {
  const http = await import('http');
  const windowId = event.sender.id;
  
  // Converte formato OpenAI vision para formato Ollama (images separado)
  const ollamaMessages = messages.map((m: any) => {
    if (Array.isArray(m.content)) {
      // Formato vision: [{type:'text',text:...},{type:'image_url',image_url:{url:'data:...'}}]
      const textPart = m.content.find((p: any) => p.type === 'text');
      const imagePart = m.content.find((p: any) => p.type === 'image_url');
      const result: any = { role: m.role, content: textPart?.text || '' };
      if (imagePart?.image_url?.url) {
        // Ollama espera base64 puro, sem o prefixo data:image/...
        const base64Data = imagePart.image_url.url.replace(/^data:image\/[^;]+;base64,/, '');
        result.images = [base64Data];
      }
      return result;
    }
    return m;
  });
  
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/chat', method: 'POST' }, (res) => {
      let fullContent = '';
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const win = BrowserWindow.fromId(windowId);
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              if (win) win.webContents.send('ollama-stream-chunk', parsed.message.content);
            }
            if (parsed.thought && win) win.webContents.send('ollama-stream-thought', parsed.thought);
            if (parsed.done) resolve({ success: true, response: { message: { content: fullContent } } });
          } catch {}
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages: ollamaMessages, stream: true }));
    req.end();
  });
});

ipcMain.handle('ollama-list-models', async () => {
  const http = await import('http');
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ success: true, models: JSON.parse(data).models || [] }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message, models: [] }));
    req.end();
  });
});

// Gemini
ipcMain.handle('gemini-stream', async (event, messages: any[], model: string, apiKey: string) => {
  const https = await import('https');
  const windowId = event.sender.id;
  // Extrai system prompt para usar como systemInstruction
  const systemMsg = messages.find((m: any) => m.role === 'system');
  const geminiMessages = messages.filter((m: any) => m.role !== 'system').map((m: any) => {
    // Se content é array (formato vision com imagem), converte para parts do Gemini
    if (Array.isArray(m.content)) {
      const parts: any[] = [];
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // Extrai mime type e base64 do data URL
          const match = part.image_url.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    };
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let fullContent = '';
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (content) {
                fullContent += content;
                const win = BrowserWindow.fromId(windowId);
                if (win) win.webContents.send('gemini-stream-chunk', content);
              }
            } catch {}
          }
        }
      });
      res.on('end', () => resolve({ success: true, response: { message: { content: fullContent } } }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ contents: geminiMessages }));
    req.end();
  });
});

// OpenRouter
ipcMain.handle('openrouter-stream', async (event, messages: any[], model: string, apiKey: string, baseUrl?: string) => {
  console.log('[Electron openrouter-stream] HANDLER CHAMADO');
  console.log('[Electron openrouter-stream] messages length:', messages?.length);
  console.log('[Electron openrouter-stream] model:', model);
  console.log('[Electron openrouter-stream] hasApiKey:', !!apiKey);
  console.log('[Electron openrouter-stream] baseUrl:', baseUrl);
  const https = await import('https');
  const windowId = event.sender.id;
  const url = new URL(baseUrl || 'https://openrouter.ai/api/v1/chat/completions');

  console.log('[Electron openrouter-stream] URL parsed:', url.hostname, url.pathname);

  return new Promise((resolve) => {
    console.log('[Electron openrouter-stream] Criando requisição HTTPS...');
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    }, (res) => {
      console.log('[Electron openrouter-stream] Resposta recebida, status:', res.statusCode);
      
      // Trata erros HTTP
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', (chunk) => { errorBody += chunk.toString(); });
        res.on('end', () => {
          console.error('[Electron openrouter-stream] Erro HTTP', res.statusCode, ':', errorBody.substring(0, 500));
          let errorMsg = `HTTP ${res.statusCode}`;
          if (res.statusCode === 429) {
            errorMsg = '⏳ Rate limit atingido! O OpenRouter está limitando suas requisições. Aguarde alguns segundos e tente novamente.';
          } else if (res.statusCode === 401) {
            errorMsg = '🔑 API Key inválida ou expirada. Verifique suas configurações.';
          } else if (res.statusCode === 402) {
            errorMsg = '💳 Créditos insuficientes no OpenRouter. Adicione créditos na sua conta.';
          }
          resolve({ success: false, error: errorMsg });
        });
        return;
      }
      
      let fullContent = '';
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                const win = BrowserWindow.fromId(windowId);
                if (win) win.webContents.send('openrouter-stream-chunk', content);
              }
            } catch {}
          }
        }
      });
      res.on('end', () => resolve({ success: true, response: { message: { content: fullContent } } }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages, stream: true }));
    req.end();
  });
});

// OpenAI & Anthropic (Chat Simplificado para economia de espaço)
ipcMain.handle('openai-stream', async (event, messages: any[], model: string, apiKey: string, baseUrl?: string) => {
  const windowId = event.sender.id;
  
  let hostname = 'api.openai.com';
  let port: string | undefined = undefined;
  let pathStr = '/v1/chat/completions';
  let protocol = 'https:';

  if (baseUrl) {
    try {
      const urlObj = new URL(baseUrl);
      hostname = urlObj.hostname;
      port = urlObj.port || undefined;
      protocol = urlObj.protocol;
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      pathStr = pathname + '/chat/completions';
    } catch (e) {
      console.error('Erro ao fazer parse da baseUrl:', e);
    }
  }

  const client = protocol === 'http:' ? await import('http') : await import('https');

  return new Promise((resolve) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const options: any = {
      hostname,
      port,
      path: pathStr,
      method: 'POST',
      headers
    };

    const req = client.request(options, (res) => {
      console.log('[Electron] Status HTTP:', res.statusCode);
      
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', (chunk) => { errorBody += chunk.toString(); });
        res.on('end', () => {
          console.error('[Electron] Erro HTTP', res.statusCode, ':', errorBody.substring(0, 500));
          resolve({ success: false, error: `HTTP ${res.statusCode}` });
        });
        return;
      }
      
      let fullContent = '';
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                const win = BrowserWindow.fromId(windowId);
                if (win) win.webContents.send('openai-stream-chunk', content);
              }
            } catch {}
          }
        }
      });
      res.on('end', () => resolve({ success: true, response: { message: { content: fullContent } } }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages, stream: true }));
    req.end();
  });
});

ipcMain.handle('openai-chat', async (_, messages: any[], model: string, apiKey: string, baseUrl?: string) => {
  let hostname = 'api.openai.com';
  let port: string | undefined = undefined;
  let pathStr = '/v1/chat/completions';
  let protocol = 'https:';

  if (baseUrl) {
    try {
      const urlObj = new URL(baseUrl);
      hostname = urlObj.hostname;
      port = urlObj.port || undefined;
      protocol = urlObj.protocol;
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      pathStr = pathname + '/chat/completions';
    } catch (e) {
      console.error('Erro ao fazer parse da baseUrl:', e);
    }
  }

  const client = protocol === 'http:' ? await import('http') : await import('https');

  return new Promise((resolve) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const options: any = {
      hostname,
      port,
      path: pathStr,
      method: 'POST',
      headers
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, response: JSON.parse(data) });
        } catch (e) {
          resolve({ success: false, error: 'JSON inválido retornado' });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages, stream: false }));
    req.end();
  });
});

// Anthropic
ipcMain.handle('anthropic-stream', async (event, messages: any[], model: string, apiKey: string) => {
  const https = await import('https');
  const windowId = event.sender.id;
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages.filter(m => m.role !== 'system');

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let fullContent = '';
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                const win = BrowserWindow.fromId(windowId);
                if (win) win.webContents.send('anthropic-stream-chunk', parsed.delta.text);
              }
            } catch {}
          }
        }
      });
      res.on('end', () => resolve({ success: true, response: { message: { content: fullContent } } }));
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(JSON.stringify({ model, messages: conversationMessages, system: systemMessage, max_tokens: 4096, stream: true }));
    req.end();
  });
});

// ── Busca e retorna imagem como base64 data URL (sem diálogo de salvar) ────────
ipcMain.handle('fetch-image-as-dataurl', async (_, imageUrl: string, referer?: string) => {
  try {
    const doFetch = (url: string, redirects: number): Promise<{ data: Buffer; ct: string }> => {
      return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? require('https') : require('http');
        lib.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Referer': referer || 'https://www.google.com/',
          }
        }, (res: any) => {
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location && redirects < 5) {
            doFetch(res.headers.location, redirects + 1).then(resolve).catch(reject);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ data: Buffer.concat(chunks), ct: res.headers['content-type'] || 'image/jpeg' }));
          res.on('error', reject);
        }).on('error', reject);
      });
    };

    const { data, ct } = await doFetch(imageUrl, 0);
    if (data.length < 500) return { success: false, error: 'Imagem muito pequena ou inválida' };

    const mime = ct.split(';')[0].trim() || 'image/jpeg';
    const b64 = data.toString('base64');
    return { success: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Busca imagem pelo query (Bing) e retorna como data URL (sem salvar em disco) ─
ipcMain.handle('search-image-as-dataurl', async (_, query: string, skip: number = 0) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tmpOut = path.join(tempDir, `search_tmp_${Date.now()}.jpg`);

    const scriptPath = resolveScript('search_image.py');
    const result: any = await new Promise((resolve) => {
      const proc = spawn(PYTHON_EXE, [scriptPath, query, tmpOut, String(skip)]);
      let out = '';
      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.on('close', () => {
        try { resolve(JSON.parse(out.trim())); } catch { resolve({ success: false, error: out }); }
      });
      proc.on('error', (e: Error) => resolve({ success: false, error: e.message }));
    });

    if (!result.success || !result.path) return result;

    const data = fs.readFileSync(result.path);
    const ext = path.extname(result.path).slice(1).toLowerCase() || 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${data.toString('base64')}`;

    try { fs.unlinkSync(result.path); } catch {}

    return { success: true, dataUrl };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Busca múltiplas imagens de uma vez (para painel de referência do Paint) ──
ipcMain.handle('search-images-multi', async (_, query: string, count: number = 12) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tmpBase = path.join(tempDir, `ref_multi_${Date.now()}`);

    const scriptPath = resolveScript('search_image.py');
    const result: any = await new Promise((resolve) => {
      const proc = spawn(PYTHON_EXE, [scriptPath, query, tmpBase + '.jpg', 'multi', String(count)]);
      let out = '';
      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.on('close', () => {
        try { resolve(JSON.parse(out.trim())); } catch { resolve({ success: false, error: out }); }
      });
      proc.on('error', (e: Error) => resolve({ success: false, error: e.message }));
    });

    if (!result.success || !result.paths) return { success: false, error: result.error };

    // Converte cada path para dataUrl
    const dataUrls: string[] = [];
    for (const p of result.paths as string[]) {
      try {
        if (fs.existsSync(p)) {
          const data = fs.readFileSync(p);
          const ext = path.extname(p).slice(1).toLowerCase() || 'jpg';
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          dataUrls.push(`data:${mime};base64,${data.toString('base64')}`);
          try { fs.unlinkSync(p); } catch {}
        }
      } catch {}
    }
    return { success: true, dataUrls };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Busca e baixa imagem por query (Bing) ──────────────────────────────────────
ipcMain.handle('search-download-image', async (_, query: string, skip: number = 0) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const safeName = query.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
    const outputPath = path.join(downloadsDir, `${safeName}_${Date.now()}.jpg`);

    const scriptPath = resolveScript('search_image.py');
    console.log(`[SearchImage] Buscando: "${query}" (skip=${skip})`);

    return new Promise((resolve) => {
      const proc = spawn(PYTHON_EXE, [scriptPath, query, outputPath, String(skip)]);
      let output = '';
      let errOutput = '';

      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { errOutput += d.toString(); console.log('[SearchImage]', d.toString()); });

      proc.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          if (result.success) {
            console.log(`[SearchImage] Salvo: ${result.path}`);
            shell.showItemInFolder(result.path);
          }
          resolve(result);
        } catch {
          resolve({ success: false, error: errOutput || `Código ${code}` });
        }
      });

      proc.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Download de imagem por URL (para o Bill Web) ──────────────────────────────
ipcMain.handle('download-image', async (_, imageUrl: string, suggestedName?: string) => {
  try {
    const ext = (imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|$)/i) || [])[1] || 'jpg';
    const defaultName = suggestedName || `imagem_${Date.now()}.${ext}`;
    const downloadsDir = app.getPath('downloads');

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Salvar imagem',
      defaultPath: path.join(downloadsDir, defaultName),
      filters: [
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Cancelado pelo usuário' };
    }

    const savePath = result.filePath;
    console.log(`[Download] Baixando: ${imageUrl} → ${savePath}`);

    // Baixa com fetch nativo do Node (usa https/http)
    await new Promise<void>((resolve, reject) => {
      const doDownload = (url: string, attempt: number) => {
        const lib = url.startsWith('https') ? require('https') : require('http');
        lib.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36' }
        }, (res: any) => {
          // Segue redirect
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location && attempt < 5) {
            doDownload(res.headers.location, attempt + 1);
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(savePath);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
          file.on('error', (err: any) => { try { fs.unlinkSync(savePath); } catch {} reject(err); });
        }).on('error', (err: any) => reject(err));
      };
      doDownload(imageUrl, 0);
    });

    console.log(`[Download] Concluído: ${savePath}`);
    // Abre a pasta do arquivo no Explorer
    shell.showItemInFolder(savePath);
    return { success: true, path: savePath };
  } catch (e: any) {
    console.error('[Download] Erro:', e.message);
    return { success: false, error: e.message };
  }
});

// ── Captura a imagem que está sob o cursor no webview ────────────────────────
ipcMain.handle('get-hovered-image', async () => {
  // Pede ao renderer que execute JS no webview ativo para pegar a imagem sob o cursor
  // O renderer faz isso diretamente; este handler apenas coordena se necessário
  return { success: true };
});

// ── Salva imagem em disco no temp (sem diálogo) para uso no editor de vídeo ──
ipcMain.handle('save-image-to-temp', async (_, imageUrl: string) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const doFetch = (url: string, redirects: number): Promise<{ data: Buffer; ct: string }> => {
      return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? require('https') : require('http');
        lib.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
          }
        }, (res: any) => {
          if ([301,302,307].includes(res.statusCode) && res.headers.location && redirects < 5) {
            doFetch(res.headers.location, redirects + 1).then(resolve).catch(reject);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ data: Buffer.concat(chunks), ct: res.headers['content-type'] || 'image/jpeg' }));
          res.on('error', reject);
        }).on('error', reject);
      });
    };

    const { data, ct } = await doFetch(imageUrl, 0);
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
    const outPath = path.join(tempDir, `img_video_${Date.now()}.${ext}`);
    fs.writeFileSync(outPath, data);
    console.log(`[SaveImage] Salvo: ${outPath}`);
    return { success: true, path: outPath };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('download-from-web', async (_, pageUrl: string, mode: 'video' | 'audio') => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'bill_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const ts = Date.now();

    // Monta args do yt-dlp
    let args: string[];
    let expectedExt: string;

    if (mode === 'audio') {
      expectedExt = 'mp3';
      const outTemplate = path.join(tempDir, `ytdl_audio_${ts}.%(ext)s`);
      args = [
        pageUrl,
        '-x',                          // extrai áudio
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', outTemplate,
        '--no-playlist',
        '--quiet',
        '--no-warnings',
      ];
    } else {
      expectedExt = 'mp4';
      const outTemplate = path.join(tempDir, `ytdl_video_${ts}.%(ext)s`);
      args = [
        pageUrl,
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outTemplate,
        '--no-playlist',
        '--quiet',
        '--no-warnings',
      ];
    }

    console.log(`[yt-dlp] Baixando ${mode}: ${pageUrl}`);

    const result: { success: boolean; path?: string; error?: string } = await new Promise((resolve) => {
      const proc = spawn('yt-dlp', args);
      let errOut = '';
      proc.stderr.on('data', (d: Buffer) => { errOut += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: errOut || `yt-dlp saiu com código ${code}` });
          return;
        }
        // Acha o arquivo gerado no tempDir
        const files = fs.readdirSync(tempDir)
          .filter(f => f.startsWith(`ytdl_${mode}_${ts}`))
          .map(f => path.join(tempDir, f));
        if (files.length > 0) {
          resolve({ success: true, path: files[0] });
        } else {
          resolve({ success: false, error: 'Arquivo não encontrado após download' });
        }
      });
      proc.on('error', (e) => resolve({ success: false, error: e.message }));
    });

    if (result.success && result.path) {
      console.log(`[yt-dlp] Concluído: ${result.path}`);
    }
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Descreve imagem via Moondream (visão local) ──────────────────────────────
ipcMain.handle('describe-image', async (_, base64DataUrl: string, model: string = 'moondream') => {
  try {
    // Extrai só o base64 (sem o prefixo data:image/...;base64,)
    const b64 = base64DataUrl.includes(',') ? base64DataUrl.split(',')[1] : base64DataUrl;

    const http = await import('http');
    return await new Promise((resolve) => {
      const payload = JSON.stringify({
        model: model,
        prompt: 'Look at this image and describe it simply: What are the main subjects (people, objects)? Where are they (left, right, center, top, bottom)? What is in front and what is behind? Keep it short and visual, like describing a photo to someone.',
        stream: false,
        images: [b64],
      });

      const req = http.request(
        { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ success: true, description: parsed.response || '' });
            } catch {
              resolve({ success: false, error: 'Resposta inválida do Moondream' });
            }
          });
        }
      );
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, error: 'Timeout — Moondream demorou demais' }); });
      req.write(payload);
      req.end();
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ── Servidor HTTP local para preview HTML (permite imagens externas + acesso ao DOM) ──
let previewServer: any = null;
let previewServerReady: Promise<void> = Promise.resolve();
let previewHtmlContent = '';
let previewCurrentDir = '';
const PREVIEW_PORT = 7432;

function getPreviewHtmlResponse(): string {
  if (!previewHtmlContent) return '';
  let html = previewHtmlContent;
  const baseHref = `http://127.0.0.1:${PREVIEW_PORT}/`;
  if (!/<base\s/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
    } else {
      html = `<base href="${baseHref}">` + html;
    }
  }
  return injectPreviewBridge(html);
}

function ensurePreviewServer(): Promise<void> {
  if (previewServer) return previewServerReady;

  const http = require('http');
  const url = require('url');
  previewServerReady = new Promise((resolve, reject) => {
    previewServer = http.createServer((req: any, res: any) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');

      if (pathname === '/' || pathname === '/index.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(getPreviewHtmlResponse());
        return;
      }

      // Tenta servir arquivos estáticos locais (imagens, css, etc.) do projeto
      if (previewCurrentDir) {
        const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
        const filePath = path.join(previewCurrentDir, relativePath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      res.statusCode = 404;
      res.end('Not Found');
    });

    previewServer.on('error', (err: any) => {
      console.error('[Preview] Erro no servidor:', err.message);
      previewServer = null;
      previewServerReady = Promise.resolve();
      reject(err);
    });

    previewServer.listen(PREVIEW_PORT, '127.0.0.1', () => {
      console.log(`[Preview] Servidor rodando em http://127.0.0.1:${PREVIEW_PORT}`);
      resolve();
    });
  });

  return previewServerReady;
}

ipcMain.handle('start-html-preview-server', async (_, htmlContent: string, dirPath?: string) => {
  previewHtmlContent = htmlContent || '';
  previewCurrentDir = dirPath ? path.normalize(dirPath) : '';

  try {
    await ensurePreviewServer();
    return { success: true, url: `http://127.0.0.1:${PREVIEW_PORT}/?t=${Date.now()}` };
  } catch (err: any) {
    console.error('[Preview] Falha ao iniciar servidor:', err?.message || err);
    return { success: false, error: err?.message || 'Falha ao iniciar servidor de preview' };
  }
});

ipcMain.handle('update-html-preview', async (_, htmlContent: string) => {
  previewHtmlContent = htmlContent;
  return { success: true };
});

// ── Controles da janela customizados ──────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  const isMaximized = mainWindow.isMaximized();
  const electronScreen = require('electron').screen;
  const display = electronScreen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const { x: screenX, y: screenY } = display.workArea;
  
  console.log('[Window] Estado atual - isMaximized:', isMaximized, 'bounds:', bounds.width, 'x', bounds.height);
  console.log('[Window] Resolução da tela:', screenWidth, 'x', screenHeight);
  
  // Se está maximizado OU tem largura próxima da tela toda, miniaturiza
  if (isMaximized || bounds.width >= screenWidth - 50) {
    // Miniaturiza: 1000x700 centralizado
    const miniWidth = 1000;
    const miniHeight = 700;
    const centerX = screenX + Math.round((screenWidth - miniWidth) / 2);
    const centerY = screenY + Math.round((screenHeight - miniHeight) / 2);
    
    console.log('[Window] Miniaturizando para:', miniWidth, 'x', miniHeight, 'na posição:', centerX, centerY);
    
    if (isMaximized) {
      mainWindow.unmaximize();
    }
    mainWindow.setResizable(true);
    mainWindow.setBounds({ 
      x: centerX, 
      y: centerY, 
      width: miniWidth, 
      height: miniHeight 
    });
    mainWindow.setAlwaysOnTop(true, 'floating');
  } else {
    // Volta para tela cheia (maximizado)
    console.log('[Window] Maximizando para tela cheia');
    mainWindow.setAlwaysOnTop(false);
    mainWindow.maximize();
    mainWindow.setResizable(false);
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.on('set-ignore-mouse-events', (_, ignore: boolean) => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
});

// ── Gaming mode — overlay sempre visível sobre o jogo ─────────────────────────
ipcMain.on('gaming-mode-enter', (_, opts: any) => {
  if (!mainWindow) return;
  savedBoundsBeforeGaming = mainWindow.getBounds();
  const wasFullScreen = mainWindow.isFullScreen();
  const wasMaximized = mainWindow.isMaximized();
  if (wasFullScreen) mainWindow.setFullScreen(false);
  else if (wasMaximized) mainWindow.unmaximize();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setSkipTaskbar(false);
  mainWindow.setResizable(true);

  const delay = wasFullScreen ? 400 : wasMaximized ? 200 : 80;
  setTimeout(() => {
    if (!mainWindow) return;
    const electronScreen = require('electron').screen;
    const display = electronScreen.getDisplayMatching(mainWindow.getBounds());
    const wa = display.workArea;
    const chatW: number = opts?.chatW ?? 380;
    console.log('[Gaming] renderer screen workArea:', wa.width, 'x', wa.height, 'chatW:', chatW);
    mainWindow.setBounds({ x: wa.x + wa.width - chatW, y: wa.y, width: chatW, height: wa.height });
  }, delay);
});

ipcMain.on('gaming-mode-exit', () => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setSkipTaskbar(false);
  mainWindow.setResizable(true);
  if (savedBoundsBeforeGaming) {
    const b = savedBoundsBeforeGaming;
    savedBoundsBeforeGaming = null;
    mainWindow.setSize(b.width, b.height, true);
    mainWindow.setPosition(b.x, b.y, true);
    setTimeout(() => mainWindow?.maximize(), 150);
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('gaming-mode-mini', () => {
  if (!mainWindow) return;
  const electronScreen = require('electron').screen;
  const display = electronScreen.getDisplayMatching(mainWindow.getBounds());
  const wa = display.workArea;
  const size = 48;
  
  // Usa a última posição salva, ou posição padrão
  let x, y;
  if (lastMiniIconPosition) {
    x = lastMiniIconPosition.x;
    y = lastMiniIconPosition.y;
  } else {
    x = mainWindow.getBounds().x;
    y = wa.y + Math.round(wa.height / 2 - size / 2);
  }
  
  mainWindow.setMinimumSize(1, 1);
  mainWindow.setBounds({ x, y, width: size, height: size });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  if ((mainWindow as any)._miniPollInterval) clearInterval((mainWindow as any)._miniPollInterval);
  (mainWindow as any)._miniPollInterval = setInterval(() => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const pos = require('electron').screen.getCursorScreenPoint();
    const display = require('electron').screen.getDisplayMatching(bounds);
    const scale = display.scaleFactor;
    const bx = bounds.x * scale;
    const by = bounds.y * scale;
    const bw = bounds.width * scale;
    const bh = bounds.height * scale;
    const dist = Math.sqrt((pos.x - (bx + bw/2)) ** 2 + (pos.y - (by + bh/2)) ** 2);
    mainWindow.setIgnoreMouseEvents(dist > (bw/2) * 0.9, { forward: true });
  }, 30);
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
});

ipcMain.on('gaming-mode-expand', (_, opts: any) => {
  if (!mainWindow) return;
  
  // Salva a posição atual do ícone mini antes de expandir
  const bounds = mainWindow.getBounds();
  if (bounds.width === 48 && bounds.height === 48) {
    lastMiniIconPosition = { x: bounds.x, y: bounds.y };
  }
  
  if ((mainWindow as any)._miniPollInterval) {
    clearInterval((mainWindow as any)._miniPollInterval);
    (mainWindow as any)._miniPollInterval = null;
  }
  mainWindow.setMinimumSize(300, 200);
  const electronScreen = require('electron').screen;
  const display = electronScreen.getDisplayMatching(mainWindow.getBounds());
  const wa = display.workArea;
  const chatW: number = opts?.chatW ?? 380;
  mainWindow.setBounds({ x: wa.x + wa.width - chatW, y: wa.y, width: chatW, height: wa.height });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(false);
});

ipcMain.on('set-mini-icon-position', (_, pos: { x: number; y: number }) => {
  if (!mainWindow) return;
  lastMiniIconPosition = { x: pos.x, y: pos.y };
  mainWindow.setBounds({ 
    x: pos.x, 
    y: pos.y, 
    width: 48, 
    height: 48 
  });
});

ipcMain.on('pause-mini-polling', () => {
  if (!mainWindow) return;
  if ((mainWindow as any)._miniPollInterval) {
    clearInterval((mainWindow as any)._miniPollInterval);
    (mainWindow as any)._miniPollInterval = null;
  }
  mainWindow.setIgnoreMouseEvents(false);
});

ipcMain.on('resume-mini-polling', () => {
  if (!mainWindow) return;
  if ((mainWindow as any)._miniPollInterval) return; // já está rodando
  
  (mainWindow as any)._miniPollInterval = setInterval(() => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const pos = require('electron').screen.getCursorScreenPoint();
    const display = require('electron').screen.getDisplayMatching(bounds);
    const scale = display.scaleFactor;
    const bx = bounds.x * scale;
    const by = bounds.y * scale;
    const bw = bounds.width * scale;
    const bh = bounds.height * scale;
    const dist = Math.sqrt((pos.x - (bx + bw/2)) ** 2 + (pos.y - (by + bh/2)) ** 2);
    mainWindow.setIgnoreMouseEvents(dist > (bw/2) * 0.9, { forward: true });
  }, 30);
});

// ── Pesquisa web em background (sem abrir navegador) ─────────────────────────
ipcMain.handle('web-research', async (_, query: string, searchProvider: 'tavily' | 'google' | 'brave' | 'duckduckgo' = 'duckduckgo', apiKeys: { tavilyApiKey?: string; googleApiKey?: string; googleCx?: string; braveApiKey?: string } = {}) => {
  console.log(`[WebResearch] ===== INÍCIO =====`);
  console.log(`[WebResearch] Query: "${query}"`);
  console.log(`[WebResearch] Provider recebido:`, searchProvider);
  console.log(`[WebResearch] API Keys recebidas:`, JSON.stringify(apiKeys, null, 2));
  console.log(`[WebResearch/${searchProvider.toUpperCase()}] Iniciando...`);
  
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    // Helper: HTTP GET com redirect automático
    const httpGet = (rawUrl: string, maxRedirects = 5, customHeaders: any = {}): Promise<{ status: number; data: string }> => {
      return new Promise((resolve) => {
        const doGet = (url: string, hops: number) => {
          let parsedUrl: any;
          try { parsedUrl = new URL(url); } catch { return resolve({ status: 0, data: '' }); }
          const lib = parsedUrl.protocol === 'https:' ? https : http;
          const req = lib.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json,text/html',
              ...customHeaders,
            },
            timeout: 12000,
          }, (res: any) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < maxRedirects) {
              let loc = res.headers.location;
              if (loc.startsWith('/')) loc = `${parsedUrl.protocol}//${parsedUrl.host}${loc}`;
              res.resume();
              return doGet(loc, hops + 1);
            }
            let data = '';
            res.on('data', (c: Buffer) => { if (data.length < 500000) data += c.toString(); });
            res.on('end', () => resolve({ status: res.statusCode, data }));
          });
          req.on('error', () => resolve({ status: 0, data: '' }));
          req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: '' }); });
        };
        doGet(rawUrl, 0);
      });
    };

    // Helper: HTTP POST para Tavily
    const httpPost = (rawUrl: string, body: string): Promise<{ status: number; data: string }> => {
      return new Promise((resolve) => {
        let parsedUrl: any;
        try { parsedUrl = new URL(rawUrl); } catch { return resolve({ status: 0, data: '' }); }
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 15000,
        };

        const req = lib.request(options, (res: any) => {
          let data = '';
          res.on('data', (c: Buffer) => { if (data.length < 500000) data += c.toString(); });
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', () => resolve({ status: 0, data: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: '' }); });
        req.write(body);
        req.end();
      });
    };

    // Helper: Extrai texto limpo de HTML
    const htmlToText = (html: string, maxLen = 6000): string => {
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&\w+;/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, maxLen);
    };

    let urls: string[] = [];
    let snippets: string[] = [];

    // ═══════════════════════════════════════════════════════════
    // 1. TAVILY SEARCH API (RECOMENDADO - FEITO PARA IAs)
    // ═══════════════════════════════════════════════════════════
    if (searchProvider === 'tavily') {
      const { tavilyApiKey } = apiKeys;
      if (!tavilyApiKey) {
        console.log(`[WebResearch/TAVILY] ❌ Chave não configurada`);
        return { success: false, error: 'Configure a API Key do Tavily nas configurações.' };
      }

      const tavilyUrl = `https://api.tavily.com/search`;
      const requestBody = JSON.stringify({
        api_key: tavilyApiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      });

      console.log(`[WebResearch/TAVILY] Chamando API...`);
      
      const response = await httpPost(tavilyUrl, requestBody);
      
      if (response.status !== 200 || !response.data) {
        console.log(`[WebResearch/TAVILY] ❌ API falhou (status: ${response.status})`);
        console.log(`[WebResearch/TAVILY] Resposta:`, response.data.substring(0, 500));
        return { success: false, error: `Tavily API retornou status ${response.status}. Verifique se a API Key está correta.` };
      }

      let results: any;
      try {
        results = JSON.parse(response.data);
      } catch (e) {
        console.log(`[WebResearch/TAVILY] ❌ JSON inválido`);
        return { success: false, error: 'Resposta inválida da Tavily API' };
      }

      if (!results.results || results.results.length === 0) {
        console.log(`[WebResearch/TAVILY] ❌ Nenhum resultado encontrado`);
        return { success: false, error: 'Nenhum resultado encontrado' };
      }

      console.log(`[WebResearch/TAVILY] ✅ ${results.results.length} resultados encontrados`);

      // Tavily já retorna conteúdo extraído, então vamos usar diretamente
      let combinedContent = '';
      let sourcesUsed: string[] = [];

      for (const item of results.results) {
        if (item.url && item.content) {
          combinedContent += `--- Fonte: ${item.url} ---\n${item.content}\n\n`;
          sourcesUsed.push(item.url);
        }
      }

      if (!combinedContent) {
        console.log(`[WebResearch/TAVILY] ❌ Nenhum conteúdo nos resultados`);
        return { success: false, error: 'Nenhum conteúdo útil encontrado' };
      }

      console.log(`[WebResearch/TAVILY] ✅ SUCESSO - ${sourcesUsed.length} fontes`);
      return { success: true, content: combinedContent.trim(), url: sourcesUsed.join(' | ') };
    }
    // ═══════════════════════════════════════════════════════════
    // 2. GOOGLE CUSTOM SEARCH API
    // ═══════════════════════════════════════════════════════════
    else if (searchProvider === 'google') {
      const { googleApiKey, googleCx } = apiKeys;
      if (!googleApiKey || !googleCx) {
        console.log(`[WebResearch/GOOGLE] ❌ Chaves não configuradas`);
        return { success: false, error: 'Configure a API Key e o Search Engine ID do Google nas configurações.' };
      }

      const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleApiKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(query)}&num=10`;
      console.log(`[WebResearch/GOOGLE] Chamando API...`);
      
      const response = await httpGet(googleUrl);
      
      if (response.status !== 200 || !response.data) {
        console.log(`[WebResearch/GOOGLE] ❌ API falhou (status: ${response.status})`);
        console.log(`[WebResearch/GOOGLE] Resposta:`, response.data.substring(0, 500));
        return { success: false, error: `Google API retornou status ${response.status}. Verifique se a Custom Search API está ativada e se as credenciais estão corretas.` };
      }

      let results: any;
      try {
        results = JSON.parse(response.data);
      } catch (e) {
        console.log(`[WebResearch/GOOGLE] ❌ JSON inválido`);
        return { success: false, error: 'Resposta inválida da Google API' };
      }

      if (!results.items || results.items.length === 0) {
        console.log(`[WebResearch/GOOGLE] ❌ Nenhum resultado encontrado`);
        return { success: false, error: 'Nenhum resultado encontrado' };
      }

      console.log(`[WebResearch/GOOGLE] ✅ ${results.items.length} resultados encontrados`);

      for (const item of results.items) {
        if (item.link) {
          urls.push(item.link);
          if (item.snippet) {
            snippets.push(item.snippet);
          }
        }
        if (urls.length >= 6) break;
      }
    }
    // ═══════════════════════════════════════════════════════════
    // 3. BRAVE SEARCH API
    // ═══════════════════════════════════════════════════════════
    else if (searchProvider === 'brave') {
      const { braveApiKey } = apiKeys;
      if (!braveApiKey) {
        console.log(`[WebResearch/BRAVE] ❌ Chave não configurada`);
        return { success: false, error: 'Configure a API Key do Brave Search nas configurações.' };
      }

      const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
      console.log(`[WebResearch/BRAVE] Chamando API...`);
      
      const response = await httpGet(braveUrl, 5, { 'X-Subscription-Token': braveApiKey });
      
      if (response.status !== 200 || !response.data) {
        console.log(`[WebResearch/BRAVE] ❌ API falhou (status: ${response.status})`);
        return { success: false, error: `Brave API retornou status ${response.status}` };
      }

      let results: any;
      try {
        results = JSON.parse(response.data);
      } catch (e) {
        console.log(`[WebResearch/BRAVE] ❌ JSON inválido`);
        return { success: false, error: 'Resposta inválida da Brave API' };
      }

      if (!results.web || !results.web.results || results.web.results.length === 0) {
        console.log(`[WebResearch/BRAVE] ❌ Nenhum resultado encontrado`);
        return { success: false, error: 'Nenhum resultado encontrado' };
      }

      console.log(`[WebResearch/BRAVE] ✅ ${results.web.results.length} resultados encontrados`);

      for (const item of results.web.results) {
        if (item.url) {
          urls.push(item.url);
          if (item.description) {
            snippets.push(item.description);
          }
        }
        if (urls.length >= 6) break;
      }
    }
    // ═══════════════════════════════════════════════════════════
    // 4. DUCKDUCKGO HTML SCRAPING (GRÁTIS, SEM API KEY)
    // ═══════════════════════════════════════════════════════════
    else if (searchProvider === 'duckduckgo') {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      console.log(`[WebResearch/DUCKDUCKGO] Fazendo scraping HTML...`);
      
      const response = await httpGet(ddgUrl, 5, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });
      
      if (response.status !== 200 || !response.data) {
        console.log(`[WebResearch/DUCKDUCKGO] ❌ Falha ao buscar (status: ${response.status})`);
        console.log(`[WebResearch/DUCKDUCKGO] Primeira linha da resposta:`, response.data.substring(0, 200));
        return { success: false, error: `DuckDuckGo retornou status ${response.status}` };
      }

      // Extrai URLs dos resultados usando regex mais robusto
      const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
      let match;
      while ((match = linkRegex.exec(response.data)) !== null && urls.length < 6) {
        try {
          let url = match[1];
          // Remove o redirect do DuckDuckGo
          if (url.includes('//duckduckgo.com/l/?')) {
            const uddgMatch = url.match(/uddg=([^&]+)/);
            if (uddgMatch) {
              url = decodeURIComponent(uddgMatch[1]);
            }
          }
          if (url.startsWith('http')) {
            urls.push(url);
          }
        } catch (e) {
          // Ignora URLs malformadas
        }
      }

      // Extrai snippets
      const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      while ((match = snippetRegex.exec(response.data)) !== null && snippets.length < 6) {
        const snippet = htmlToText(match[1], 300);
        if (snippet.length > 50) {
          snippets.push(snippet);
        }
      }

      console.log(`[WebResearch/DUCKDUCKGO] ✅ ${urls.length} URLs extraídas, ${snippets.length} snippets`);

      if (urls.length === 0) {
        console.log(`[WebResearch/DUCKDUCKGO] ❌ Nenhuma URL encontrada`);
        console.log(`[WebResearch/DUCKDUCKGO] HTML recebido (primeiros 500 chars):`, response.data.substring(0, 500));
        return { success: false, error: 'Nenhum resultado encontrado no DuckDuckGo' };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // VISITA URLs PARA EXTRAIR CONTEÚDO COMPLETO
    // ═══════════════════════════════════════════════════════════
    if (urls.length === 0) {
      console.log(`[WebResearch] ❌ Nenhuma URL para visitar`);
      return { success: false, error: 'Nenhuma URL válida encontrada' };
    }

    let combinedContent = '';
    let sourcesUsed: string[] = [];
    let visitedCount = 0;

    console.log(`[WebResearch] Visitando URLs para extrair conteúdo...`);
    for (const url of urls) {
      if (visitedCount >= 3) break;
      
      console.log(`[WebResearch] Visitando [${visitedCount + 1}]: ${url}`);
      const page = await httpGet(url);
      
      if (page.status === 200 && page.data.length > 200) {
        const text = htmlToText(page.data, 3000);
        if (text.length > 300) {
          combinedContent += `--- Fonte [${visitedCount + 1}]: ${url} ---\n${text}\n\n`;
          sourcesUsed.push(url);
          visitedCount++;
          console.log(`[WebResearch] ✅ Conteúdo extraído (${text.length} chars)`);
        }
      } else {
        console.log(`[WebResearch] ⚠️ Falha ao visitar (status: ${page.status})`);
      }
    }

    // Fallback: usar snippets se não conseguiu visitar sites
    if (!combinedContent && snippets.length > 0) {
      console.log(`[WebResearch] Usando snippets como fallback`);
      return { success: true, content: snippets.join('\n\n'), url: urls[0] || searchProvider };
    }

    if (!combinedContent) {
      console.log(`[WebResearch] ❌ Não foi possível extrair conteúdo das URLs`);
      return { success: false, error: 'Não foi possível extrair conteúdo dos resultados' };
    }

    console.log(`[WebResearch] ✅ SUCESSO - ${visitedCount} fontes visitadas`);
    return { success: true, content: combinedContent.trim(), url: sourcesUsed.join(' | ') };

  } catch (e: any) {
    console.log(`[WebResearch] ❌ ERRO: ${e.message}`);
    return { success: false, error: e.message };
  }
});

// ── Busca RSS de notícias ─────────────────────────────────────────────────────
ipcMain.handle('fetch-rss', async (_, url: string) => {
  try {
    const isHttps = url.startsWith('https://');
    const protocol = isHttps ? require('https') : require('http');
    
    const content: string = await new Promise((resolve, reject) => {
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }
      }, (res: any) => {
        // Segue redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            const redirectProtocol = redirectUrl.startsWith('https://') ? require('https') : require('http');
            redirectProtocol.get(redirectUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
              }
            }, (redirectRes: any) => {
              let data = '';
              redirectRes.setEncoding('utf8');
              redirectRes.on('data', (c: string) => { data += c; });
              redirectRes.on('end', () => resolve(data));
            }).on('error', reject);
          } else {
            reject(new Error('Redirect sem location'));
          }
        } else {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (c: string) => { data += c; });
          res.on('end', () => resolve(data));
        }
      }).on('error', reject);
      
      // Timeout de 10 segundos
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Timeout ao buscar RSS'));
      });
    });
    
    console.log(`[fetch-rss] Sucesso: ${url} (${content.length} bytes)`);
    return { success: true, content };
  } catch (e: any) {
    console.error(`[fetch-rss] Erro ao buscar ${url}:`, e.message);
    return { success: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════
// Paint — salvar imagem com diálogo nativo
// ═══════════════════════════════════════════════════════════
ipcMain.handle('save-paint-image', async (_, dataUrl: string, suggestedName?: string) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const defaultName = suggestedName || `paint_${Date.now()}.png`;
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Salvar imagem',
      defaultPath: path.join(downloadsDir, defaultName),
      filters: [
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return { success: false };
    // Remove prefixo data:image/...;base64,
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ═══════════════════════════════════════════════════════════
// Salvar arquivo base64 binário
// ═══════════════════════════════════════════════════════════
ipcMain.handle('save-base64-to-file', async (_, filePath: string, base64: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE SAVES - Projetos Recentes com Thumbnails
// ══════════════════════════════════════════════════════════════════════════════

function getSavesDir(appType: 'photo' | 'video' | 'code' | 'web' | 'paint'): string {
  const baseDir = path.join(app.getPath('userData'), 'bill_saves', appType);
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

// Salva projeto com thumbnail
ipcMain.handle('save-project', async (_, appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectData: any, thumbnailBase64?: string) => {
  try {
    const savesDir = getSavesDir(appType);
    const timestamp = Date.now();
    const projectId = `save_${timestamp}`;
    
    // Salva dados do projeto
    const projectPath = path.join(savesDir, `${projectId}.json`);
    const saveData = {
      id: projectId,
      appType,
      timestamp,
      data: projectData,
    };
    fs.writeFileSync(projectPath, JSON.stringify(saveData, null, 2), 'utf8');
    
    // Salva thumbnail se fornecido
    if (thumbnailBase64) {
      const thumbPath = path.join(savesDir, `${projectId}_thumb.png`);
      const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(thumbPath, Buffer.from(base64Data, 'base64'));
    }
    
    return { success: true, projectId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Carrega projeto
ipcMain.handle('load-project', async (_, appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => {
  try {
    const savesDir = getSavesDir(appType);
    const projectPath = path.join(savesDir, `${projectId}.json`);
    
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Projeto não encontrado' };
    }
    
    const content = fs.readFileSync(projectPath, 'utf8');
    const saveData = JSON.parse(content);
    
    return { success: true, data: saveData.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Lista projetos recentes
ipcMain.handle('list-recent-saves', async (_, appType: 'photo' | 'video' | 'code' | 'web' | 'paint', limit: number = 3) => {
  try {
    const savesDir = getSavesDir(appType);
    const files = fs.readdirSync(savesDir);
    
    // Filtra apenas arquivos .json (não thumbs)
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('_thumb'));
    
    // Ordena por timestamp (mais recente primeiro)
    const projects = jsonFiles
      .map(f => {
        const fullPath = path.join(savesDir, f);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const projectId = content.id;
        const thumbPath = path.join(savesDir, `${projectId}_thumb.png`);
        
        let thumbnailBase64 = null;
        if (fs.existsSync(thumbPath)) {
          const thumbBuffer = fs.readFileSync(thumbPath);
          thumbnailBase64 = `data:image/png;base64,${thumbBuffer.toString('base64')}`;
        }
        
        return {
          id: projectId,
          timestamp: content.timestamp,
          thumbnail: thumbnailBase64,
          appType: content.appType,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return { success: true, projects };
  } catch (error: any) {
    return { success: false, error: error.message, projects: [] };
  }
});

// Deleta projeto
ipcMain.handle('delete-project', async (_, appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => {
  try {
    const savesDir = getSavesDir(appType);
    const projectPath = path.join(savesDir, `${projectId}.json`);
    const thumbPath = path.join(savesDir, `${projectId}_thumb.png`);
    
    if (fs.existsSync(projectPath)) fs.unlinkSync(projectPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// ENHANCE IMAGE (usa Python do runtime)
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('enhance-image-python', async (_, inputOrSrc: string, optOutputPath?: string, optIsBase64?: boolean) => {
  const tempDir = path.join(app.getPath('userData'), 'bill_temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const scriptPath = resolveScript('enhance_image.py');
  const pythonExe = getPythonExe();
  const pyEnv = getPythonEnv();

  // Modo seguro direto: chamado apenas com imageSrc
  if (optOutputPath === undefined) {
    const src = inputOrSrc;
    const ts = Date.now();
    const isBase64 = src.startsWith('data:');
    let inputPath = '';
    const outputPath = path.join(tempDir, `enhance_out_${ts}.${isBase64 ? 'txt' : 'png'}`);
    let tempInTxt: string | null = null;

    if (isBase64) {
      tempInTxt = path.join(tempDir, `enhance_in_${ts}.txt`);
      fs.writeFileSync(tempInTxt, src, 'utf8');
      inputPath = tempInTxt;
    } else {
      let clean = src;
      if (clean.startsWith('file:///')) clean = clean.slice(8);
      else if (clean.startsWith('file://')) clean = clean.slice(7);
      inputPath = decodeURIComponent(clean).replace(/\//g, '\\');
    }

    const args = [scriptPath, inputPath, outputPath];
    if (isBase64) args.push('--base64');

    return new Promise((resolve) => {
      const proc = spawn(pythonExe, args, { env: pyEnv });
      let errorOutput = '';

      proc.stderr.on('data', (d) => { errorOutput += d.toString(); });
      proc.on('close', (code) => {
        try { if (tempInTxt && fs.existsSync(tempInTxt)) fs.unlinkSync(tempInTxt); } catch {}

        if (code === 0 && fs.existsSync(outputPath)) {
          try {
            let newSrc = '';
            if (isBase64) {
              const b64 = fs.readFileSync(outputPath, 'utf8').trim();
              newSrc = `data:image/png;base64,${b64}`;
            } else {
              const buf = fs.readFileSync(outputPath);
              newSrc = `data:image/png;base64,${buf.toString('base64')}`;
            }
            try { fs.unlinkSync(outputPath); } catch {}
            resolve({ success: true, newSrc });
          } catch (readErr: any) {
            resolve({ success: false, error: `Erro ao ler imagem aprimorada: ${readErr.message}` });
          }
        } else {
          try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
          resolve({ success: false, error: errorOutput || `Processo Python falhou com código ${code}` });
        }
      });

      proc.on('error', (err) => {
        try { if (tempInTxt && fs.existsSync(tempInTxt)) fs.unlinkSync(tempInTxt); } catch {}
        resolve({ success: false, error: `Erro ao iniciar Python: ${err.message}` });
      });
    });
  }

  // Modo compatibilidade com 3 argumentos
  return new Promise((resolve) => {
    const args = [scriptPath, inputOrSrc, optOutputPath];
    if (optIsBase64) args.push('--base64');

    const proc = spawn(pythonExe, args, { env: pyEnv });
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: output.trim() });
      } else {
        resolve({ success: false, error: errorOutput || `Processo terminou com código ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: `Erro ao iniciar Python: ${err.message}` });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// INSTALADOR DE DEPENDÊNCIAS
// ══════════════════════════════════════════════════════════════════════════════

// Verifica se as dependências estão instaladas
ipcMain.handle('check-runtime-installed', async () => {
  try {
    const runtimeDir = path.join(app.getPath('appData'), 'bill-code', 'runtime');
    
    // Busca recursiva por ffmpeg.exe
    const findFFmpeg = (dir: string): boolean => {
      try {
        if (!fs.existsSync(dir)) return false;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe') return true;
          if (e.isDirectory() && findFFmpeg(full)) return true;
        }
      } catch {}
      return false;
    };
    
    const checks = {
      ffmpeg: findFFmpeg(path.join(runtimeDir, 'ffmpeg')),
      ytdlp: fs.existsSync(path.join(runtimeDir, 'yt-dlp', 'yt-dlp.exe')),
      python: fs.existsSync(path.join(runtimeDir, 'python', 'python.exe')),
      piperTts: fs.existsSync(path.join(runtimeDir, 'piper-tts', 'piper.exe')),
    };
    
    const installed = checks.ffmpeg && checks.ytdlp && checks.python;
    
    return { installed, checks, runtimeDir };
  } catch (error: any) {
    return { installed: false, error: error.message };
  }
});

// Instala as dependências via PowerShell
ipcMain.handle('install-runtime-dependencies', async (event) => {
  try {
    const runtimeDir = path.join(app.getPath('appData'), 'bill-code', 'runtime');
    
    // Cria pasta runtime se não existir
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true });
    }

    // Script PowerShell que baixa tudo
    const script = `
$ErrorActionPreference = "Stop"
$runtimeDir = "${runtimeDir.replace(/\\\\/g, '\\\\\\\\')}"

Write-Host "Iniciando instalacao das dependencias..."
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. FFmpeg
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[1/6] Baixando FFmpeg..."
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$ffmpegZip = "$env:TEMP\\\\ffmpeg.zip"
$ffmpegExtract = "$env:TEMP\\\\ffmpeg-extract"

try {
  Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing
  Write-Host "[OK] FFmpeg baixado"

  Write-Host "Extraindo FFmpeg..."
  if (Test-Path $ffmpegExtract) { Remove-Item -Path $ffmpegExtract -Recurse -Force }
  Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force
  
  if (Test-Path "$runtimeDir\\\\ffmpeg") {
    Remove-Item -Path "$runtimeDir\\\\ffmpeg" -Recurse -Force
  }
  New-Item -ItemType Directory -Path "$runtimeDir\\\\ffmpeg" -Force | Out-Null
  
  # O zip do FFmpeg vem com pasta tipo ffmpeg-master-latest-win64-gpl/bin/
  # Normaliza para runtime/ffmpeg/bin/ffmpeg.exe
  $ffmpegBinExe = Get-ChildItem -Path $ffmpegExtract -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
  if ($ffmpegBinExe) {
    $binDir = $ffmpegBinExe.DirectoryName
    Write-Host "   Encontrado ffmpeg.exe em: $binDir"
    Move-Item -Path $binDir -Destination "$runtimeDir\\\\ffmpeg\\\\bin" -Force
    Write-Host "[OK] FFmpeg instalado em $runtimeDir\\\\ffmpeg\\\\bin\\\\ffmpeg.exe"
  } else {
    $ffmpegFolder = Get-ChildItem -Path $ffmpegExtract -Directory | Select-Object -First 1
    if ($ffmpegFolder) {
      Move-Item -Path $ffmpegFolder.FullName -Destination "$runtimeDir\\\\ffmpeg" -Force
    }
    Write-Host "[WARN] FFmpeg extraido (estrutura pode variar)"
  }
  
  Remove-Item -Path $ffmpegZip -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $ffmpegExtract -Recurse -Force -ErrorAction SilentlyContinue
} catch {
  Write-Host "[ERRO] Falha ao baixar/instalar FFmpeg"
  Write-Host "   $($_.Exception.Message)"
  exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1.5. yt-dlp
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[1.5/6] Baixando yt-dlp..."
$ytdlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
$ytdlpDir = "$runtimeDir\\\\yt-dlp"

try {
  if (Test-Path $ytdlpDir) {
    Remove-Item -Path $ytdlpDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $ytdlpDir -Force | Out-Null
  
  $ytdlpExe = "$ytdlpDir\\\\yt-dlp.exe"
  Invoke-WebRequest -Uri $ytdlpUrl -OutFile $ytdlpExe -UseBasicParsing
  Write-Host "[OK] yt-dlp instalado em $ytdlpExe"
} catch {
  Write-Host "[ERRO] Falha ao baixar yt-dlp"
  Write-Host "   $($_.Exception.Message)"
  exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. Python 3.11 Embeddable
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[2/6] Baixando Python 3.11..."
$pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
$pythonZip = "$env:TEMP\\\\python.zip"
$pythonDir = "$runtimeDir\\\\python"

try {
  Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip -UseBasicParsing
  Write-Host "[OK] Python baixado"

  Write-Host "Extraindo Python..."
  if (Test-Path $pythonDir) {
    Remove-Item -Path $pythonDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
  Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
  Remove-Item -Path $pythonZip -Force
  
  # CRITICO: Habilitar pip no Python embeddable editando o ._pth
  # IMPORTANTE: Escrever SEM BOM (Byte Order Mark) — BOM corrompe o path do Python!
  Write-Host "Configurando Python embeddable (._pth)..."
  $pthFile = Get-ChildItem -Path $pythonDir -Filter "python*._pth" | Select-Object -First 1
  if ($pthFile) {
    Write-Host "   Editando: $($pthFile.Name)"
    # Abordagem segura: reescreve o arquivo inteiro com conteudo correto, SEM BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $newContent = "python311.zip\`r\`n.\`r\`n\`r\`nimport site\`r\`n"
    [System.IO.File]::WriteAllText($pthFile.FullName, $newContent, $utf8NoBom)
    
    # Verificacao
    $verifyContent = Get-Content $pthFile.FullName
    Write-Host "   Conteudo do ._pth:"
    $verifyContent | ForEach-Object { Write-Host "      $_" }
    $hasImportSite = $verifyContent | Where-Object { $_.Trim() -eq 'import site' }
    if ($hasImportSite) {
      Write-Host "[OK] Python configurado (import site habilitado)"
    } else {
      Write-Host "[WARN] Forcando import site..."
      $fallback = "python311.zip\`r\`n.\`r\`nimport site\`r\`n"
      [System.IO.File]::WriteAllText($pthFile.FullName, $fallback, $utf8NoBom)
    }
  } else {
    Write-Host "[WARN] Arquivo ._pth nao encontrado, criando..."
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText("$pythonDir\\\\python311._pth", "python311.zip\`r\`n.\`r\`nimport site\`r\`n", $utf8NoBom)
  }
  
  Write-Host "[OK] Python instalado em $pythonDir"
  Write-Host "[OK] Python instalado em $pythonDir"
} catch {
  Write-Host "[ERRO] Falha ao baixar/instalar Python"
  Write-Host "   $($_.Exception.Message)"
  exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 3. pip (get-pip.py)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[3/6] Instalando pip..."
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$getPipPath = "$env:TEMP\\\\get-pip.py"

try {
  Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath -UseBasicParsing
  Write-Host "   Executando get-pip.py..."
  $pipInstallOutput = & "$pythonDir\\\\python.exe" $getPipPath --no-warn-script-location 2>&1
  $pipInstallOutput | ForEach-Object { Write-Host "   $_" }
  Remove-Item -Path $getPipPath -Force -ErrorAction SilentlyContinue
  
  # Verificar se pip foi instalado
  $pipCheck = & "$pythonDir\\\\python.exe" -m pip --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] pip instalado: $pipCheck"
  } else {
    Write-Host "[ERRO] pip NAO foi instalado corretamente!"
    Write-Host "   Output: $pipCheck"
    Write-Host "   Verificando ._pth novamente..."
    Get-Content (Get-ChildItem -Path $pythonDir -Filter "python*._pth" | Select-Object -First 1).FullName | ForEach-Object { Write-Host "      $_" }
    exit 1
  }
} catch {
  Write-Host "[ERRO] Falha ao instalar pip"
  Write-Host "   $($_.Exception.Message)"
  exit 1
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. Piper TTS (copia completo do extraResources)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[4/6] Instalando Piper TTS..."
$piperDir = "$runtimeDir\\\\piper-tts"

try {
  # Cria a pasta de destino
  if (Test-Path $piperDir) { Remove-Item -Path $piperDir -Recurse -Force }
  New-Item -ItemType Directory -Path $piperDir -Force | Out-Null
  
  # Copia TUDO do extraResources (exe, DLLs, vozes, espeak-ng-data)
  $appPath = (Get-Process -Id $PID).Path
  $appDir = Split-Path $appPath
  $resourcesDir = Join-Path (Split-Path $appDir) "resources"
  $piperSource = Join-Path $resourcesDir "piper-voices"
  
  if (Test-Path $piperSource) {
    Write-Host "   Fonte: $piperSource"
    
    # Copia TODOS os arquivos (piper.exe, DLLs, modelos .onnx)
    Get-ChildItem -Path $piperSource -File | ForEach-Object {
      Copy-Item -Path $_.FullName -Destination $piperDir -Force
      Write-Host "   [OK] $($_.Name)"
    }
    
    # Copia TODAS as pastas (espeak-ng-data, pkgconfig)
    Get-ChildItem -Path $piperSource -Directory | ForEach-Object {
      $destFolder = Join-Path $piperDir $_.Name
      Copy-Item -Path $_.FullName -Destination $destFolder -Recurse -Force
      Write-Host "   [OK] $($_.Name)/"
    }
    
    if (Test-Path "$piperDir\\\\piper.exe") {
      Write-Host "[OK] Piper TTS instalado completamente!"
    } else {
      Write-Host "[ERRO] piper.exe NAO encontrado em $piperSource"
    }
  } else {
    Write-Host "[ERRO] Fonte nao encontrada: $piperSource"
    Write-Host "   Piper TTS NAO foi instalado!"
  }
  
} catch {
  Write-Host "[ERRO] Falha ao instalar Piper TTS"
  Write-Host "   $($_.Exception.Message)"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 5. Bibliotecas Python
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[5/6] Instalando bibliotecas Python..."

$libraries = @(
  "numpy",
  "Pillow",
  "opencv-python",
  "faster-whisper",
  "rembg",
  "pytesseract",
  "pyautogui",
  "requests",
  "edge-tts"
)

$failed = @()

foreach ($lib in $libraries) {
  try {
    Write-Host "   - Instalando $lib..."
    $output = & "$pythonDir\\\\python.exe" -m pip install $lib --no-warn-script-location 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host "   [FALHA] $lib"
      $output | ForEach-Object { Write-Host "      $_" }
      $failed += $lib
    } else {
      Write-Host "   [OK] $lib"
    }
  } catch {
    Write-Host "   [ERRO] $lib : $($_.Exception.Message)"
    $failed += $lib
  }
}

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "[WARN] Algumas bibliotecas falharam:"
  $failed | ForEach-Object { Write-Host "   - $_" }
} else {
  Write-Host "[OK] Todas as bibliotecas Python instaladas!"
}
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 6. Verificacao Final
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[6/6] Verificacao pos-instalacao..."
Write-Host ""

$allOk = $true

# FFmpeg
$ffmpegExe = Get-ChildItem -Path "$runtimeDir\\\\ffmpeg" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ffmpegExe) {
  Write-Host "[OK] FFmpeg: $($ffmpegExe.FullName)"
} else {
  Write-Host "[ERRO] FFmpeg: NAO ENCONTRADO"
  $allOk = $false
}

# yt-dlp
$ytdlpExe = "$runtimeDir\\\\yt-dlp\\\\yt-dlp.exe"
if (Test-Path $ytdlpExe) {
  Write-Host "[OK] yt-dlp: $ytdlpExe"
} else {
  Write-Host "[ERRO] yt-dlp: NAO ENCONTRADO"
  $allOk = $false
}

# Python + pip
$pipVer = & "$pythonDir\\\\python.exe" -m pip --version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK] Python + pip: $pipVer"
} else {
  Write-Host "[ERRO] Python pip: FALHOU"
  $allOk = $false
}

# Libs criticas
foreach ($lib in @("PIL", "numpy", "faster_whisper")) {
  $check = & "$pythonDir\\\\python.exe" -c "import $lib; print('OK')" 2>&1
  if ($LASTEXITCODE -eq 0 -and "$check" -match "OK") {
    Write-Host "[OK] Python lib: $lib"
  } else {
    Write-Host "[ERRO] Python lib: $lib FALHOU"
    $allOk = $false
  }
}

# Piper
if (Test-Path "$runtimeDir\\\\piper-tts\\\\piper.exe") {
  Write-Host "[OK] Piper TTS: instalado"
} else {
  Write-Host "[WARN] Piper TTS: nao encontrado (opcional)"
}

Write-Host ""
if ($allOk) {
  Write-Host "=== INSTALACAO CONCLUIDA COM SUCESSO! ==="
} else {
  Write-Host "=== INSTALACAO CONCLUIDA COM AVISOS (veja acima) ==="
}
Write-Host ""
Write-Host "Reinicie o app para usar todas as funcionalidades!"
`;

    // Executa o script PowerShell
    return new Promise((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', script
      ]);

      ps.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          event.sender.send('install-output', { line });
        }
      });

      ps.stderr.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          event.sender.send('install-output', { line: `⚠️ ${line}` });
        }
      });

      ps.on('close', (code) => {
        if (code === 0) {
          event.sender.send('install-output', { line: '✅ Instalação concluída!' });
          refreshRuntimePaths();
          resolve({ success: true });
        } else {
          event.sender.send('install-output', { line: `❌ Erro no processo (código ${code})` });
          reject({ success: false, error: `Processo saiu com código ${code}` });
        }
      });

      ps.on('error', (error) => {
        event.sender.send('install-output', { line: `❌ Erro: ${error.message}` });
        reject({ success: false, error: error.message });
      });
    });

  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
