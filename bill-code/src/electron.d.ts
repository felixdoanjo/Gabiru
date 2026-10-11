export interface ElectronAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  listDirectory: (dirPath: string) => Promise<{ success: boolean; items?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  executeCommand: (command: string, cwd?: string) => Promise<{ success: boolean; output?: string; exitCode?: number; error?: string }>;
  ollamaChat: (messages: any[], model: string) => Promise<{ success: boolean; response?: any; error?: string }>;
  ollamaListModels: () => Promise<{ success: boolean; models?: Array<{ name: string }>; error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
  onBillUserSpeech: (callback: (content: string) => void) => () => void;
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

export {};
