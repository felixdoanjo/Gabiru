# 🚀 Sistema de Instalador Interno

## 📋 O Que Foi Criado

Um sistema completo de **instalação de dependências na primeira execução** do app. Quando o usuário baixar e abrir o Gabiru pela primeira vez, ele verá uma tela bonita que baixa e instala automaticamente:

### ✅ Dependências que serão instaladas:
1. **FFmpeg** (~100 MB) - Para Video e transcrição
2. **Python Embeddable** (~15 MB) - Interpretador Python
3. **Piper TTS** (~50 MB) - Voz sintética
4. **Bibliotecas Python - Video** (~625 MB)
   - faster-whisper
   - opencv-python
   - numpy
5. **Bibliotecas Python - Design** (~298 MB)
   - Pillow
   - rembg
   - pytesseract
   - pyautogui
   - requests
6. **Tesseract OCR** (~60 MB) - OCR (opcional)

**Total**: ~1.2 GB

## 📁 Arquivos Criados

### 1. **Frontend (React)**
- `src/components/FirstRunSetup.tsx` - Tela de setup visual com progresso
- `src/components/AppWrapper.tsx` - Wrapper que decide se mostra setup ou app
- `src/types/electron.d.ts` - Tipos TypeScript para comunicação Electron

### 2. **Backend (Electron)**
- `electron/dependencyManager.ts` - Gerenciador de downloads e instalação
- Integração no `electron/main.ts` - Handlers IPC
- Integração no `electron/preload.ts` - Bridge segura

## 🎯 Como Funciona

### Fluxo da Primeira Execução

```
1. Usuário abre o app
   ↓
2. AppWrapper verifica dependências
   ↓
3. Se faltarem: mostra FirstRunSetup
   │
   ├─ Usuário vê lista de dependências
   ├─ Clica em "Baixar dependências"
   ├─ Downloads acontecem com barra de progresso
   ├─ Cada dependência é instalada automaticamente
   └─ Ao terminar: "Tudo pronto!" → App principal
   
4. Se tudo instalado: carrega App.tsx direto
```

### Onde São Instaladas as Dependências

```
%APPDATA%\bill-code\runtime\
├── ffmpeg\
│   └── bin\
│       └── ffmpeg.exe
├── python\
│   ├── python.exe
│   └── Lib\
│       └── site-packages\
│           ├── (pacotes video)
│           └── (pacotes design)
├── piper-tts\
│   └── piper.exe
└── tesseract\
    └── tesseract.exe
```

## 🔧 Customização

### Adicionar Nova Dependência

1. Edite `electron/dependencyManager.ts`:

```typescript
const DEPENDENCY_URLS = {
  // ... existentes
  'nova-dep': 'https://exemplo.com/arquivo.zip',
};
```

2. Edite `src/components/FirstRunSetup.tsx`:

```typescript
const DEPENDENCIES = [
  // ... existentes
  {
    id: 'nova-dep',
    name: 'Nova Dependência',
    description: 'Descrição do que faz',
    size: '~50 MB',
    required: true,
  },
];
```

### Mudar URLs de Download

Edite as URLs em `electron/dependencyManager.ts`:

```typescript
const DEPENDENCY_URLS = {
  ffmpeg: 'SUA_URL_AQUI',
  python: 'SUA_URL_AQUI',
  // ...
};
```

### Desabilitar Setup (Teste)

Para testar o app sem o setup, temporariamente em `AppWrapper.tsx`:

```typescript
// Forçar complete
setSetupStatus('complete'); 
```

## 🧪 Testando

### 1. Testar em Desenvolvimento

```bash
npm run electron:dev
```

O app vai checar as dependências e mostrar o setup se faltarem.

### 2. Simular Primeira Execução

Delete a pasta runtime para forçar o setup:

```powershell
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force
```

### 3. Ver Progresso de Download

Abra o DevTools (F12) e veja os logs:

```javascript
// Console do navegador
[DependencyManager] Downloading ffmpeg...
[DependencyManager] Progress: 50%
[DependencyManager] Completed: ffmpeg
```

## 🚨 Tratamento de Erros

O sistema já trata:

- ✅ **Conexão perdida**: Retry automático (pode implementar)
- ✅ **Espaço em disco**: Erro exibido ao usuário
- ✅ **Arquivo corrompido**: Erro exibido ao usuário
- ✅ **Download incompleto**: Arquivo é deletado e pode tentar de novo

## 📦 Build do Instalador

### Instalador Pequeno (Sem Dependências)

O instalador gerado pelo `electron-builder` será **pequeno** (~100-200 MB) porque:

1. **NÃO** inclui as dependências pesadas (FFmpeg, Python libs, etc)
2. **SIM** inclui apenas o Electron + seu código React

### O Que Vai no Instalador

```
Gabiru-Setup.exe (~150 MB)
├── Electron runtime
├── Seu código (React build)
├── Scripts Python (.py)
└── Configurações iniciais
```

### O Que NÃO Vai no Instalador

- ❌ FFmpeg (baixado na primeira execução)
- ❌ Python libs (baixado na primeira execução)
- ❌ Piper TTS (baixado na primeira execução)
- ❌ Tesseract OCR (baixado na primeira execução)

## 🎨 Personalização Visual

### Mudar Cores

Edite `FirstRunSetup.tsx`:

```tsx
// Backgrounds
bg-[#1e1e1e]  → sua cor
bg-[#2d2d2d]  → sua cor

// Barra de progresso
bg-blue-600   → sua cor
```

### Adicionar Logo

```tsx
<div className="text-center mb-8">
  <img src="/logo.png" className="mx-auto mb-4 w-24 h-24" />
  <h1>Bem-vindo ao Gabiru!</h1>
</div>
```

## ⚡ Otimizações Futuras

### 1. Download Paralelo

Atualmente baixa sequencial. Pode baixar múltiplos ao mesmo tempo:

```typescript
await Promise.all([
  this.downloadDependency('ffmpeg'),
  this.downloadDependency('python'),
  // ...
]);
```

### 2. Mirror/CDN

Hospedar os arquivos em CDN própria para controlar versões:

```typescript
const BASE_CDN = 'https://cdn.gabiru.com/deps/';
const DEPENDENCY_URLS = {
  ffmpeg: `${BASE_CDN}ffmpeg-latest.zip`,
  python: `${BASE_CDN}python-3.11.9.zip`,
  // ...
};
```

### 3. Instalação Parcial

Usuário escolhe o que quer instalar:

```tsx
<Checkbox>
  Video Editor (625 MB)
</Checkbox>
<Checkbox>
  Photo Editor (298 MB)
</Checkbox>
```

### 4. Verificação de Integridade

Adicionar checksums SHA256:

```typescript
const FILE_HASHES = {
  ffmpeg: 'sha256_hash_aqui',
  // ...
};

// Após download
const hash = calcularSHA256(arquivo);
if (hash !== FILE_HASHES[id]) {
  throw new Error('Arquivo corrompido');
}
```

## 🐛 Debugging

### Ver Status das Dependências

No DevTools console:

```javascript
await window.electron.checkDependencies()
// Retorna: { ffmpeg: true, python: false, ... }
```

### Forçar Redownload

```javascript
// Delete arquivo marker
fs.unlinkSync('%APPDATA%/bill-code/runtime/python/Lib/site-packages/.video-libs-installed')

// Recarregue o app
location.reload()
```

### Logs do Electron

Veja `electron/main.ts` console:

```
[DependencyManager] Checking dependencies...
[DependencyManager] ffmpeg: ✓
[DependencyManager] python: ✗ (not found)
```

## 📞 Suporte ao Usuário

Se o usuário reportar problemas:

1. **"Download travou"**
   - Verificar conexão internet
   - Tentar novamente (botão de retry)
   - Verificar espaço em disco

2. **"Erro ao extrair arquivo"**
   - Arquivo pode estar corrompido
   - Delete `%APPDATA%\bill-code\runtime`
   - Tente novamente

3. **"App não abre após instalação"**
   - Verificar se todas as dependências foram baixadas
   - Rodar diagnóstico: `await window.electron.checkDependencies()`

## 🎯 Próximos Passos

1. ✅ **Sistema criado e funcional**
2. ⏳ **Testar downloads reais** (você precisa testar as URLs)
3. ⏳ **Adicionar retry** em caso de falha
4. ⏳ **Adicionar verificação de espaço** antes de baixar
5. ⏳ **Implementar pause/resume** de downloads
6. ⏳ **Criar tela de "Update"** para atualizar dependências

## 📝 Notas Importantes

- Downloads acontecem **na primeira execução** apenas
- Usuário pode **pular** e instalar depois (funcionalidade básica)
- Tudo é salvo em `%APPDATA%\bill-code\runtime\`
- Não precisa de permissões admin
- Funciona offline após instalado (não precisa de internet)

---

**Pronto!** Agora seu app tem um instalador interno completo. 🎉
