import { contextBridge, ipcRenderer } from 'electron';

// Expor APIs seguras para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // FileSystem
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('list-directory', dirPath),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('create-directory', dirPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // Internal Project Management (Code workspace projects)
  listInternalProjects: () => ipcRenderer.invoke('list-projects'),
  createInternalProject: (projectName: string, customFolder?: string) => ipcRenderer.invoke('create-project', projectName, customFolder),
  deleteInternalProject: (projectPath: string) => ipcRenderer.invoke('delete-project-folder', projectPath),
  
  listRecursive: (dirPath: string) => ipcRenderer.invoke('list-recursive', dirPath),
  patchFile: (filePath: string, search: string, replace: string) => ipcRenderer.invoke('patch-file', filePath, search, replace),
  seeScreen: (mode?: 'describe' | 'ocr') => ipcRenderer.invoke('see-screen', mode),
  captureScreenArea: () => ipcRenderer.invoke('capture-screen-area'),
  saveScreenshot: (base64Data: string) => ipcRenderer.invoke('save-screenshot', base64Data),
  loadProjectMemory: (dirPath: string) => ipcRenderer.invoke('load-project-memory', dirPath),
  saveProjectMemory: (dirPath: string, memory: any) => ipcRenderer.invoke('save-project-memory', dirPath, memory),
  saveBillProject: (clips: any[]) => ipcRenderer.invoke('save-bill-project', clips),
  loadBillProject: () => ipcRenderer.invoke('load-bill-project'),
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  removeBackground: (base64DataUrl: string) => ipcRenderer.invoke('remove-background', base64DataUrl),
  enhanceImagePython: (inputPath: string, outputPath?: string, isBase64?: boolean) => ipcRenderer.invoke('enhance-image-python', inputPath, outputPath, isBase64),

  // Shell
  executeCommand: (command: string, cwd?: string) => ipcRenderer.invoke('execute-command', command, cwd),
  startNativeExport: (clips: any[], settings: any, trackingData?: any[]) => ipcRenderer.invoke('start-native-export', clips, settings, trackingData),
  startWebGLExport: (clips: any[], settings: any, trackingData?: any[]) => ipcRenderer.invoke('start-webgl-export', clips, settings, trackingData),
  webglExportFrame: (frameData: string, frameIndex: number, tempDir: string) => ipcRenderer.invoke('webgl-export-frame', frameData, frameIndex, tempDir),
  webglExportFinalize: (tempDir: string, settings: any, clips: any[]) => ipcRenderer.invoke('webgl-export-finalize', tempDir, settings, clips),
  muxVideoWithAudio: (payload: any) => ipcRenderer.invoke('mux-video-with-audio', payload),
  transcribeVideo: (videoPath: string) => ipcRenderer.invoke('transcribe-video', videoPath),
  motionTrack: (config: { videoPath: string; bbox: [number, number, number, number]; startFrame?: number; endFrame?: number; trackerType?: 'CSRT' | 'KCF' | 'MOSSE' }) => ipcRenderer.invoke('motion-track', config),
  onMotionTrackProgress: (callback: (data: { progress: number; current?: number; total?: number }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('motion-track-progress', listener);
    return () => ipcRenderer.removeListener('motion-track-progress', listener);
  },
  extractVideoSegment: (videoPath: string, startTime: number, duration: number) => ipcRenderer.invoke('extract-video-segment', videoPath, startTime, duration),
  detectSilence: (videoPath: string, noiseDb?: number, minSilence?: number) => ipcRenderer.invoke('detect-silence', videoPath, noiseDb, minSilence),
  detectSpeech: (videoPath: string, aggressiveness?: number) => ipcRenderer.invoke('detect-speech', videoPath, aggressiveness),
  isolateVoice: (inputPath: string) => ipcRenderer.invoke('isolate-voice', inputPath),
  generateTTS: (payload: { text: string; voice: string }) => ipcRenderer.invoke('generate-tts', payload),
  speak: (text: string, volume?: number) => ipcRenderer.invoke('speak', text, volume),
  
  // Activity Detection
  getCurrentActivity: () => ipcRenderer.invoke('get-current-activity'),
  onActivityChanged: (callback: (activity: { app: string; title: string } | null) => void) => {
    const listener = (_: any, activity: any) => callback(activity);
    ipcRenderer.on('activity-changed', listener);
    return () => ipcRenderer.removeListener('activity-changed', listener);
  },
  generateImage: (payload: { prompt: string; apiKey?: string }) => ipcRenderer.invoke('generate-image', payload),
  getWaveform: (filePath: string) => ipcRenderer.invoke('get-waveform', filePath),
  
  // Dependency Manager
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  downloadDependencies: () => ipcRenderer.invoke('download-dependencies'),
  onDependencyProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('dependency-progress', listener);
    return () => ipcRenderer.removeListener('dependency-progress', listener);
  },
  skipFirstRun: () => ipcRenderer.send('skip-first-run'),
  completeFirstRun: () => ipcRenderer.send('complete-first-run'),
  saveAudioBlob: (base64Data: string, ext: string) => ipcRenderer.invoke('save-audio-blob', base64Data, ext),
  transcribeAudio: (audioPath: string) => ipcRenderer.invoke('transcribe-audio', audioPath),
  downloadImage: (imageUrl: string, suggestedName?: string) => ipcRenderer.invoke('download-image', imageUrl, suggestedName),
  searchDownloadImage: (query: string, skip?: number) => ipcRenderer.invoke('search-download-image', query, skip ?? 0),
  fetchImageAsDataUrl: (imageUrl: string, referer?: string) => ipcRenderer.invoke('fetch-image-as-dataurl', imageUrl, referer),
  searchImageAsDataUrl: (query: string, skip?: number) => ipcRenderer.invoke('search-image-as-dataurl', query, skip ?? 0),
  searchImagesMulti: (query: string, count?: number) => ipcRenderer.invoke('search-images-multi', query, count ?? 12),
  downloadFromWeb: (pageUrl: string, mode: 'video' | 'audio') => ipcRenderer.invoke('download-from-web', pageUrl, mode),
  saveImageToTemp: (imageUrl: string) => ipcRenderer.invoke('save-image-to-temp', imageUrl),
  savePaintImage: (dataUrl: string, suggestedName?: string) => ipcRenderer.invoke('save-paint-image', dataUrl, suggestedName),

  // Screen Recorder
  startScreenRecording: (config: { micDeviceName: string; micVolume: number; systemVolume: number; savePath: string; fps: number }) => ipcRenderer.invoke('start-screen-recording', config),
  stopScreenRecording: () => ipcRenderer.invoke('stop-screen-recording'),

  // Save System - Projetos Recentes
  saveProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectData: any, thumbnailBase64?: string) => ipcRenderer.invoke('save-project', appType, projectData, thumbnailBase64),
  loadProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => ipcRenderer.invoke('load-project', appType, projectId),
  listRecentSaves: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', limit?: number) => ipcRenderer.invoke('list-recent-saves', appType, limit ?? 3),
  deleteProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => ipcRenderer.invoke('delete-project', appType, projectId),

  saveBase64ToFile: (filePath: string, base64: string) => ipcRenderer.invoke('save-base64-to-file', filePath, base64),
  startHtmlPreviewServer: (htmlContent: string, dirPath?: string) => ipcRenderer.invoke('start-html-preview-server', htmlContent, dirPath),
  updateHtmlPreview: (htmlContent: string) => ipcRenderer.invoke('update-html-preview', htmlContent),
  describeImage: (base64DataUrl: string, model?: string) => ipcRenderer.invoke('describe-image', base64DataUrl, model ?? 'moondream'),
  onExportProgress: (callback: (progress: number) => void) => {
    const listener = (_: any, progress: number) => callback(progress);
    ipcRenderer.on('export-progress', listener);
    return () => ipcRenderer.removeListener('export-progress', listener);
  },
  onExportLog: (callback: (msg: string) => void) => {
    const listener = (_: any, msg: string) => callback(msg);
    ipcRenderer.on('export-log', listener);
    return () => ipcRenderer.removeListener('export-log', listener);
  },

  // --- BILL WORKER INTEGRATION ---
  processWithBill: (message: string) => ipcRenderer.invoke('process-with-bill', message),
  onBillMessage: (callback: (msg: string) => void) => {
    const listener = (_: any, msg: string) => callback(msg);
    ipcRenderer.on('bill-message', listener);
    return () => ipcRenderer.removeListener('bill-message', listener);
  },
  onBillUserSpeech: (callback: (content: string) => void) => {
    const listener = (_: any, content: string) => callback(content);
    ipcRenderer.on('bill-user-speech', listener);
    return () => ipcRenderer.removeListener('bill-user-speech', listener);
  },
  onBillProgress: (callback: (progress: number, label: string) => void) => {
    const listener = (_: any, progress: number, label: string) => callback(progress, label);
    ipcRenderer.on('bill-progress', listener);
    return () => ipcRenderer.removeListener('bill-progress', listener);
  },
  
  // Video Downloader
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
  downloadVideo: (url: string, formatId: string, outputPath: string) => ipcRenderer.invoke('download-video', url, formatId, outputPath),
  downloadFile: (url: string, filename: string) => ipcRenderer.invoke('download-file', url, filename),
  
  // Downloads Manager
  onDownloadUpdate: (callback: (event: any, info: any) => void) => ipcRenderer.on('download-update', callback),
  removeDownloadListener: (callback: any) => ipcRenderer.removeListener('download-update', callback),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  
  // Tradutor
  translateText: (text: string, from: string, to: string) => ipcRenderer.invoke('translate-text', text, from, to),

  // Ollama
  ollamaChat: (messages: any[], model: string) => ipcRenderer.invoke('ollama-chat', messages, model),
  ollamaListModels: () => ipcRenderer.invoke('ollama-list-models'),
  ollamaStream: (messages: any[], model: string) => ipcRenderer.invoke('ollama-stream', messages, model),

  // Gemini
  geminiChat: (messages: any[], model: string, apiKey: string) => ipcRenderer.invoke('gemini-chat', messages, model, apiKey),
  geminiStream: (messages: any[], model: string, apiKey: string) => ipcRenderer.invoke('gemini-stream', messages, model, apiKey),

  // OpenRouter
  openrouterChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => ipcRenderer.invoke('openrouter-chat', messages, model, apiKey, baseUrl),
  openrouterStream: (messages: any[], model: string, apiKey: string, baseUrl?: string) => ipcRenderer.invoke('openrouter-stream', messages, model, apiKey, baseUrl),

  // Anthropic
  anthropicChat: (messages: any[], model: string, apiKey: string) => ipcRenderer.invoke('anthropic-chat', messages, model, apiKey),
  anthropicStream: (messages: any[], model: string, apiKey: string) => ipcRenderer.invoke('anthropic-stream', messages, model, apiKey),

  // OpenAI
  openaiChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => ipcRenderer.invoke('openai-chat', messages, model, apiKey, baseUrl),
  openaiStream: (messages: any[], model: string, apiKey: string, baseUrl?: string) => ipcRenderer.invoke('openai-stream', messages, model, apiKey, baseUrl),

  // Settings
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  fetchCustomModels: (url: string, key?: string) => ipcRenderer.invoke('fetch-custom-models', url, key),

  // Stream event listeners
  onOllamaChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('ollama-stream-chunk', subscription);
    return () => ipcRenderer.removeListener('ollama-stream-chunk', subscription);
  },
  onOllamaThought: (callback: (thought: string) => void) => {
    const subscription = (_: any, thought: string) => callback(thought);
    ipcRenderer.on('ollama-stream-thought', subscription);
    return () => ipcRenderer.removeListener('ollama-stream-thought', subscription);
  },
  onGeminiChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('gemini-stream-chunk', subscription);
    return () => ipcRenderer.removeListener('gemini-stream-chunk', subscription);
  },
  onOpenRouterChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('openrouter-stream-chunk', subscription);
    return () => ipcRenderer.removeListener('openrouter-stream-chunk', subscription);
  },
  onAnthropicChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('anthropic-stream-chunk', subscription);
    return () => ipcRenderer.removeListener('anthropic-stream-chunk', subscription);
  },
  onOpenAIChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('openai-stream-chunk', subscription);
    return () => ipcRenderer.removeListener('openai-stream-chunk', subscription);
  },
  onOpenRouterThought: (callback: (thought: string) => void) => {
    const subscription = (_: any, thought: string) => callback(thought);
    ipcRenderer.on('openrouter-stream-thought', subscription);
    return () => ipcRenderer.removeListener('openrouter-stream-thought', subscription);
  },
  onAnthropicThought: (callback: (thought: string) => void) => {
    const subscription = (_: any, thought: string) => callback(thought);
    ipcRenderer.on('anthropic-stream-thought', subscription);
    return () => ipcRenderer.removeListener('anthropic-stream-thought', subscription);
  },
  onOpenAIThought: (callback: (thought: string) => void) => {
    const subscription = (_: any, thought: string) => callback(thought);
    ipcRenderer.on('openai-stream-thought', subscription);
    return () => ipcRenderer.removeListener('openai-stream-thought', subscription);
  },
  onGeminiThought: (callback: (thought: string) => void) => {
    const subscription = (_: any, thought: string) => callback(thought);
    ipcRenderer.on('gemini-stream-thought', subscription);
    return () => ipcRenderer.removeListener('gemini-stream-thought', subscription);
  },
  onBillBrowserOpen: (callback: (url: string, newTab: boolean) => void) => {
    const listener = (_: any, url: string, newTab: boolean) => callback(url, newTab);
    ipcRenderer.on('bill-browser-open', listener);
    return () => ipcRenderer.removeListener('bill-browser-open', listener);
  },
  onBillBrowserClose: (callback: (id: number) => void) => {
    const listener = (_: any, id: number) => callback(id);
    ipcRenderer.on('bill-browser-close', listener);
    return () => ipcRenderer.removeListener('bill-browser-close', listener);
  },
  onBillBrowserSwitch: (callback: (id: number) => void) => {
    const listener = (_: any, id: number) => callback(id);
    ipcRenderer.on('bill-browser-switch', listener);
    return () => ipcRenderer.removeListener('bill-browser-switch', listener);
  },
  readSoul: () => ipcRenderer.invoke('read-soul'),
  saveSoul: (soul: any) => ipcRenderer.invoke('save-soul', soul),
  
  // Instalador de Dependências
  checkRuntimeInstalled: () => ipcRenderer.invoke('check-runtime-installed'),
  installRuntimeDependencies: () => ipcRenderer.invoke('install-runtime-dependencies'),
  onInstallOutput: (callback: (data: { line: string }) => void) => {
    const listener = (_: any, data: { line: string }) => callback(data);
    ipcRenderer.on('install-output', listener);
    return () => ipcRenderer.removeListener('install-output', listener);
  },
  
  installPlugin: (pluginId: string, url: string) => ipcRenderer.invoke('install-plugin', pluginId, url),
  uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('uninstall-plugin', pluginId),
  checkPluginInstalled: (pluginId: string) => ipcRenderer.invoke('check-plugin-installed', pluginId),
  relaunchApp: () => ipcRenderer.send('relaunch-app'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  gamingModeEnter: (opts?: { x?: number; y?: number; w?: number; h?: number }) => ipcRenderer.send('gaming-mode-enter', opts ?? {}),
  gamingModeExit: () => ipcRenderer.send('gaming-mode-exit'),
  gamingModeMini: (opts?: { screenW?: number; screenH?: number }) => ipcRenderer.send('gaming-mode-mini', opts ?? {}),
  gamingModeExpand: (opts?: { w?: number; h?: number }) => ipcRenderer.send('gaming-mode-expand', opts ?? {}),
  setMiniIconPosition: (pos: { x: number; y: number }) => ipcRenderer.send('set-mini-icon-position', pos),
  pauseMiniPolling: () => ipcRenderer.send('pause-mini-polling'),
  resumeMiniPolling: () => ipcRenderer.send('resume-mini-polling'),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  webResearch: (query: string, searchProvider: string, apiKeys: any) => ipcRenderer.invoke('web-research', query, searchProvider, apiKeys),
  fetchRss: (url: string) => ipcRenderer.invoke('fetch-rss', url),
  checkDownloadCache: () => ipcRenderer.invoke('check-download-cache'),
  clearDownloadCache: (category?: string) => ipcRenderer.invoke('clear-download-cache', category),
  // Extensions
  loadExtension: (extPath?: string) => ipcRenderer.invoke('load-extension', extPath),
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  removeExtension: (extId: string) => ipcRenderer.invoke('remove-extension', extId),
  selectExtensionFolder: () => ipcRenderer.invoke('select-extension-folder'),
  scanChromeExtensions: () => ipcRenderer.invoke('scan-chrome-extensions'),
});


// Types para TypeScript
declare global {
  interface Window {
    electronAPI: {
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      listDirectory: (dirPath: string) => Promise<{ success: boolean; items?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
      createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      selectFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
      listRecursive: (dirPath: string) => Promise<{ success: boolean; items?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
      patchFile: (filePath: string, search: string, replace: string) => Promise<{ success: boolean; error?: string }>;
      seeScreen: (mode?: 'describe' | 'ocr') => Promise<{ success: boolean; content?: string; error?: string }>;
      captureScreenArea: () => Promise<{ success: boolean; path?: string; error?: string }>;
      loadProjectMemory: (dirPath: string) => Promise<{ success: boolean; memory?: any; error?: string }>;
      saveProjectMemory: (dirPath: string, memory: any) => Promise<{ success: boolean; error?: string }>;
      saveBillProject: (clips: any[]) => Promise<{ success: boolean; error?: string }>;
      loadBillProject: () => Promise<{ success: boolean; clips?: any[]; error?: string }>;
      getSystemFonts: () => Promise<{ success: boolean; fonts?: string[]; error?: string }>;
      removeBackground: (base64DataUrl: string) => Promise<{ success: boolean; base64?: string; error?: string }>;
      executeCommand: (command: string, cwd?: string) => Promise<{ success: boolean; output?: string; exitCode?: number; error?: string }>;
      transcribeVideo: (videoPath: string) => Promise<{ success: boolean; segments?: Array<{ start: number; end: number; text: string }>; error?: string }>;
      motionTrack: (config: { videoPath: string; bbox: [number, number, number, number]; startFrame?: number; endFrame?: number; trackerType?: 'CSRT' | 'KCF' | 'MOSSE' }) => Promise<{ success: boolean; tracking_data?: Array<{ frame: number; x: number; y: number; width: number; height: number; timestamp: number; tracked: boolean }>; fps?: number; error?: string }>;
      extractVideoSegment: (videoPath: string, startTime: number, duration: number) => Promise<{ success: boolean; path?: string; error?: string }>;
      detectSilence: (videoPath: string, noiseDb?: number, minSilence?: number) => Promise<{ success: boolean; segments?: Array<{ start: number; end: number; text: string; no_speech_prob: number }>; duration?: number; language?: string; error?: string }>;
      detectSpeech: (videoPath: string, aggressiveness?: number) => Promise<{ success: boolean; segments?: Array<{ start: number; end: number; text: string; no_speech_prob: number }>; language?: string; error?: string }>;
      isolateVoice: (inputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      generateTTS: (payload: { text: string; voice: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
      speak: (text: string, volume?: number) => Promise<{ success: boolean; error?: string }>;
      generateImage: (payload: { prompt: string; apiKey?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
      getWaveform: (filePath: string) => Promise<{ success: boolean; peaks?: number[]; error?: string }>;
      saveAudioBlob: (base64Data: string, ext: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      transcribeAudio: (audioPath: string) => Promise<{ success: boolean; segments?: Array<{ start: number; end: number; text: string }>; error?: string }>;
      downloadImage: (imageUrl: string, suggestedName?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      searchDownloadImage: (query: string, skip?: number) => Promise<{ success: boolean; path?: string; url?: string; error?: string }>;
      fetchImageAsDataUrl: (imageUrl: string, referer?: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
      searchImageAsDataUrl: (query: string, skip?: number) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
      downloadFromWeb: (pageUrl: string, mode: 'video' | 'audio') => Promise<{ success: boolean; path?: string; error?: string }>;
      saveImageToTemp: (imageUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      savePaintImage: (dataUrl: string, suggestedName?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      // Save System - Projetos Recentes
      saveProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectData: any, thumbnailBase64?: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;
      loadProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      listRecentSaves: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', limit?: number) => Promise<{ success: boolean; projects?: Array<{ id: string; timestamp: number; thumbnail: string | null; appType: string }>; error?: string }>;
      deleteProject: (appType: 'photo' | 'video' | 'code' | 'web' | 'paint', projectId: string) => Promise<{ success: boolean; error?: string }>;
      saveBase64ToFile: (filePath: string, base64: string) => Promise<{ success: boolean; error?: string }>;
      describeImage: (base64DataUrl: string, model?: string) => Promise<{ success: boolean; description?: string; error?: string }>;
      ollamaChat: (messages: any[], model: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      ollamaListModels: () => Promise<{ success: boolean; models?: Array<{ name: string }>; error?: string }>;
      // Gemini
      geminiChat: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      // OpenRouter
      openrouterChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      // Anthropic
      anthropicChat: (messages: any[], model: string, apiKey: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      // OpenAI
      openaiChat: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      openaiStream: (messages: any[], model: string, apiKey: string, baseUrl?: string) => Promise<{ success: boolean; response?: any; error?: string }>;
      saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
      loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
      fetchCustomModels: (url: string, key?: string) => Promise<{ success: boolean; models?: string[]; error?: string }>;
      // Stream event listeners
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
      onBillBrowserOpen: (callback: (url: string, newTab: boolean) => void) => () => void;
      onBillBrowserClose: (callback: (id: number) => void) => () => void;
      onBillBrowserSwitch: (callback: (id: number) => void) => () => void;
      processWithBill: (message: string) => Promise<{ success: boolean; error?: string }>;
      onBillMessage: (callback: (msg: string) => void) => () => void;
      onBillUserSpeech: (callback: (content: string) => void) => () => void;
      onBillProgress: (callback: (progress: number, label: string) => void) => () => void;
      
      // Video Downloader
      getVideoInfo: (url: string) => Promise<{ success: boolean; info?: any; formats?: any[]; error?: string }>;
      downloadVideo: (url: string, formatId?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      downloadFile: (url: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}
