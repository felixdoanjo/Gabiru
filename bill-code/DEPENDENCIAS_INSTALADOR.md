# DEPENDÊNCIAS EXTERNAS PARA O INSTALADOR DO GABIRU

## 🏠 ABA HOME

### 1. **Python** (Sistema Elysa - DESABILITADO mas código ainda presente)
- **O que é**: Interpretador Python para rodar o backend Elysa
- **Onde está**: `electron/main.ts` linha 546, 550, 602
- **Status**: DESABILITADO (linha 626 comentada)
- **Necessário?**: ❌ NÃO (sistema antigo, não usado atualmente)

### 2. **Piper TTS** (Text-to-Speech)
- **O que é**: Engine de voz sintética para ler textos em voz alta
- **Onde está**: `electron/main.ts` linha 16-17
- **Path esperado**: `C:\Users\Administrator\Desktop\piper\piper.exe`
- **Usado em**: Lembretes com áudio, notificações faladas
- **Necessário?**: ✅ SIM
- **Arquivos necessários**:
  - `piper.exe`
  - Modelos de voz (`.onnx` files)
  - Configs das vozes

### 3. **FFmpeg** (Processamento de Áudio/Vídeo)
- **O que é**: Conversor e processador multimídia
- **Onde está**: `electron/main.ts` linha 1117-1123
- **Paths procurados**:
  1. `C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\ffmpeg.exe`
  2. `ffmpeg` no PATH do sistema
- **Usado em**: 
  - Transcrição de áudio (lembretes de voz)
  - Mixagem de áudio (não diretamente na Home, mas backend compartilhado)
- **Necessário?**: ✅ SIM (para transcrição via `transcribe.py`)

### 4. **Script Python de Transcrição** 
- **O que é**: `scripts/transcribe.py`
- **Onde está**: `electron/main.ts` linha 995-996
- **Depende de**: 
  - Python instalado
  - Biblioteca `whisper` (OpenAI Whisper)
- **Usado em**: Transcrever lembretes de voz gravados
- **Necessário?**: ⚠️ PARCIAL (só se usar lembretes de voz)

---

## 📊 RESUMO - ABA HOME

### Obrigatório:
1. ✅ **Piper TTS** + modelos de voz
2. ✅ **FFmpeg** (para transcrições)

### Opcional (se usar feature específica):
3. ⚠️ **Python** + **Whisper** (só para transcrição de lembretes de voz)

### Não necessário:
4. ❌ Sistema Elysa Python (desabilitado)

---

## 📝 NOTAS PARA O INSTALADOR

- **Piper TTS**: Precisa empacotar o executável + modelos de voz na pasta `piper-tts/`
- **FFmpeg**: Pode incluir no instalador OU checar se já existe no PATH
- **Python/Whisper**: Pode ser opcional (feature avançada)



---

## 💻 ABA CODE

### Análise do Sistema:
A aba CODE usa `executeCommand` que permite rodar **QUALQUER comando do sistema operacional**. Isso significa que ela depende do que o **usuário instalar no PC**.

### Comandos Comuns que Usuários Executam:

#### 1. **Node.js** + **npm**
- **O que é**: Runtime JavaScript e gerenciador de pacotes
- **Comandos típicos**: 
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `node script.js`
- **Necessário?**: ✅ SIM (para projetos JavaScript/TypeScript)

#### 2. **Git**
- **O que é**: Controle de versão
- **Comandos típicos**:
  - `git clone`
  - `git commit`
  - `git push`
- **Necessário?**: ✅ SIM (para projetos com Git)

#### 3. **Python** + **pip**
- **O que é**: Interpretador Python e gerenciador de pacotes
- **Comandos típicos**:
  - `python script.py`
  - `pip install`
- **Necessário?**: ✅ SIM (para projetos Python)

#### 4. **Outros Gerenciadores** (menos comuns):
- **Composer** (PHP)
- **Cargo** (Rust)
- **Maven/Gradle** (Java)
- **Go** (Golang)

---

## 📊 RESUMO - ABA CODE

### O Problema:
A aba CODE **não tem dependências fixas próprias** - ela executa o que o usuário mandar. É como um terminal integrado.

### Solução para o Instalador:
Você tem 3 opções:

#### Opção 1: **Não incluir nada** ❌
- Deixar o usuário instalar o que precisar (Node, Python, Git, etc)
- **Problema**: Usuário precisa saber o que instalar

#### Opção 2: **Incluir o básico** ⚠️
- Node.js + npm
- Git
- Python + pip
- **Problema**: Instalador fica GIGANTE (>500MB)

#### Opção 3: **Checagem + Avisos** ✅ RECOMENDADO
- Instalador **checa** se tem Node/Git/Python instalados
- Se não tiver, **avisa** o usuário com link de download
- Não instala automaticamente

---

## 📝 RECOMENDAÇÃO FINAL - ABA CODE

**NÃO INCLUIR** dependências de desenvolvimento no instalador.

**Por que?**
1. Usuário provavelmente já tem instalado
2. Instalador ficaria muito pesado
3. Conflitos de versão com o que usuário já tem

**Em vez disso:**
- Mostrar aviso na primeira vez: "Para usar a aba Code com projetos Node.js, instale Node.js primeiro"
- Links diretos para downloads oficiais



---

## 🎬 ABA VIDEO

### 1. **FFmpeg** + **ffprobe**
- **O que é**: Suite completa de processamento multimídia
- **Onde está**: `electron/main.ts` linha 1520-1530
- **Paths procurados**:
  1. `C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\ffmpeg.exe`
  2. `C:\ffmpeg\bin\ffmpeg.exe`
  3. `C:\Program Files\ffmpeg\bin\ffmpeg.exe`
  4. `ffmpeg` no PATH
- **Usado em**:
  - Exportação de vídeo (mixagem de áudio)
  - Isolamento de voz (redução de ruído)
  - Extração de segmentos
  - Detecção de silêncio
  - Análise de waveform
  - Conversão de formatos
- **Necessário?**: ✅ **OBRIGATÓRIO**

### 2. **Python** (versão 3.x)
- **O que é**: Interpretador Python
- **Onde está**: Múltiplos scripts chamados via `spawn('python', ...)`
- **Usado em**: Todos os scripts abaixo
- **Necessário?**: ✅ **OBRIGATÓRIO**

### 3. **faster-whisper** (biblioteca Python)
- **O que é**: Motor de transcrição de áudio/vídeo (OpenAI Whisper otimizado)
- **Onde está**: `scripts/transcribe.py` linha 19
- **Instalação**: `pip install faster-whisper`
- **Usado em**:
  - Legendar vídeo automaticamente
  - Transcrever áudio
  - Detecção de fala
- **Necessário?**: ✅ **OBRIGATÓRIO** (feature muito usada)

### 4. **OpenCV** (cv2 - biblioteca Python)
- **O que é**: Biblioteca de visão computacional
- **Onde está**: `motion_tracker.py` linha 9
- **Instalação**: `pip install opencv-python` ou `opencv-contrib-python`
- **Usado em**:
  - Motion Tracking (rastrear objetos em movimento)
  - Análise de frames
- **Necessário?**: ✅ **OBRIGATÓRIO** (feature de tracking)

### 5. **numpy** (biblioteca Python)
- **O que é**: Biblioteca de computação numérica
- **Onde está**: `motion_tracker.py` linha 10
- **Instalação**: `pip install numpy`
- **Usado em**: Processamento de dados do motion tracker
- **Necessário?**: ✅ SIM (dependência do OpenCV)

### 6. **Scripts Python Incluídos**
Estes já vêm com o app, mas precisam do Python + bibliotecas:
- `scripts/transcribe.py` - Transcrição (precisa: faster-whisper, ffmpeg)
- `scripts/silencedetect.py` - Detecta silêncio
- `scripts/vad_detect.py` - Detecção de voz (VAD)
- `motion_tracker.py` - Rastreamento de movimento (precisa: opencv-python, numpy)

---

## 📊 RESUMO - ABA VIDEO

### Obrigatório (binários):
1. ✅ **FFmpeg** + **ffprobe**

### Obrigatório (Python + bibliotecas):
2. ✅ **Python 3.x** (3.8 ou superior recomendado)
3. ✅ **faster-whisper** (`pip install faster-whisper`)
4. ✅ **opencv-python** (`pip install opencv-python`)
5. ✅ **numpy** (`pip install numpy`)

### Scripts incluídos (já vêm no app):
- ✅ `transcribe.py`
- ✅ `motion_tracker.py`
- ✅ `silencedetect.py`
- ✅ `vad_detect.py`

---

## 📝 NOTAS PARA O INSTALADOR - ABA VIDEO

### Estratégia Recomendada:

1. **FFmpeg**: 
   - Incluir no instalador (versão portable ~100MB)
   - Colocar em `C:\Program Files\Gabiru\ffmpeg\bin\`
   - Adicionar ao PATH do app

2. **Python + Bibliotecas**:
   - **Opção A (Recomendada)**: Incluir Python Embeddable + bibliotecas pré-instaladas
     - Python Embeddable: ~15MB
     - faster-whisper + dependências: ~500MB (modelos Whisper)
     - opencv-python: ~90MB
     - numpy: ~20MB
     - **Total**: ~625MB
   
   - **Opção B**: Checar se Python já instalado, instalar bibliotecas via pip
     - Mais leve no instalador
     - Requer conexão com internet
     - Pode dar conflitos com Python do usuário

3. **Scripts Python**:
   - Já inclusos no build (pasta `scripts/`)
   - Nenhuma ação necessária

### Tamanho Estimado - ABA VIDEO:
- FFmpeg: ~100MB
- Python Embeddable + libs: ~625MB
- **TOTAL**: ~725MB



---

## 🎨 ABA DESIGN (PHOTO EDITOR)

### 1. **Python** (versão 3.x)
- **O que é**: Interpretador Python
- **Onde está**: Scripts chamados via `spawn('python', ...)`
- **Usado em**: Script de melhoria de qualidade
- **Necessário?**: ✅ **OBRIGATÓRIO**

### 2. **Pillow (PIL)** (biblioteca Python)
- **O que é**: Biblioteca de processamento de imagens
- **Onde está**: 
  - `scripts/enhance_image.py` linha 17
  - `scripts/remove_background.py` linha 14
- **Instalação**: `pip install Pillow`
- **Usado em**:
  - Melhorar qualidade de imagem (upscale, sharpening, denoising)
  - Remover fundo de imagens
  - Manipulação de cores e filtros
  - Conversão de formatos
- **Necessário?**: ✅ **OBRIGATÓRIO**

### 3. **numpy** (biblioteca Python)
- **O que é**: Biblioteca de computação numérica
- **Onde está**: `scripts/enhance_image.py` linha 18
- **Instalação**: `pip install numpy`
- **Usado em**: Processamento avançado de pixels (sharpening, denoising, correção de gamma)
- **Necessário?**: ✅ **OBRIGATÓRIO**

### 4. **rembg** (biblioteca Python)
- **O que é**: Remoção automática de fundo usando IA
- **Onde está**: `scripts/remove_background.py` linha 13
- **Instalação**: `pip install rembg`
- **Usado em**: Remover fundo de imagens automaticamente
- **Necessário?**: ✅ SIM (feature usada)
- **Tamanho**: ~200MB (modelo U2-Net incluído)

### 5. **requests** (biblioteca Python)
- **O que é**: Biblioteca HTTP para fazer requisições
- **Onde está**: `scripts/generate_image.py` linha 4
- **Instalação**: `pip install requests`
- **Usado em**: Gerar imagens via Pollinations API
- **Necessário?**: ✅ SIM (feature de geração de imagens por IA)

### 6. **pyautogui** (biblioteca Python)
- **O que é**: Automação de interface e captura de tela
- **Onde está**: `scripts/vision.py` linha 1
- **Instalação**: `pip install pyautogui`
- **Usado em**: Captura de tela para OCR e análise visual
- **Necessário?**: ⚠️ PARCIAL (só se usar feature de visão)

### 7. **pytesseract** (biblioteca Python)
- **O que é**: Wrapper Python para Tesseract OCR
- **Onde está**: `scripts/vision.py` linha 6
- **Instalação**: `pip install pytesseract`
- **Usado em**: Extrair texto de imagens (OCR)
- **Necessário?**: ⚠️ PARCIAL (só se usar OCR)

### 8. **Tesseract OCR** (executável externo)
- **O que é**: Engine de reconhecimento óptico de caracteres
- **Onde está**: `scripts/vision.py` linha 9 - Path: `C:\Program Files\Tesseract-OCR\tesseract.exe`
- **Usado em**: Backend do pytesseract para OCR
- **Necessário?**: ⚠️ PARCIAL (só se usar OCR)
- **Tamanho**: ~60MB

### 9. **Scripts Python Incluídos**
Estes já vêm com o app:
- `scripts/enhance_image.py` - Melhoria de qualidade (precisa: Pillow, numpy)
- `scripts/remove_background.py` - Remoção de fundo (precisa: rembg, Pillow)
- `scripts/generate_image.py` - Geração de imagens IA (precisa: requests)
- `scripts/search_image.py` - Busca de imagens web (usa só stdlib - sem dependências!)
- `scripts/vision.py` - OCR e análise visual (precisa: pyautogui, pytesseract, tesseract)

---

## 📊 RESUMO - ABA DESIGN

### Obrigatório:
1. ✅ **Python 3.x** (3.8 ou superior)
2. ✅ **Pillow** (`pip install Pillow`)
3. ✅ **numpy** (`pip install numpy`)
4. ✅ **rembg** (`pip install rembg`)
5. ✅ **requests** (`pip install requests`)
6. ✅ **pyautogui** (`pip install pyautogui`)
7. ✅ **pytesseract** (`pip install pytesseract`)
8. ✅ **Tesseract OCR** (executável)

### Scripts incluídos (já vêm no app):
- ✅ `enhance_image.py`
- ✅ `remove_background.py`
- ✅ `generate_image.py`
- ✅ `search_image.py` (sem dependências!)
- ✅ `vision.py`

---

## 📝 NOTAS PARA O INSTALADOR - ABA DESIGN

### Estratégia Recomendada:

1. **Python + Bibliotecas**:
   - Usar Python Embeddable (mesmo da aba Video)
   - Pillow: ~10MB
   - numpy: ~20MB (já incluído para Video)
   - rembg: ~200MB (modelo U2-Net)
   - requests: ~2MB
   - pyautogui: ~5MB
   - pytesseract: ~1MB
   - Tesseract OCR: ~60MB

### Tamanho Estimado - ABA DESIGN:
- **TOTAL**: ~298MB (reutiliza Python e numpy da aba Video)



---

## 🌐 ABA WEB (NAVEGADOR)

### Análise do Sistema:
A aba WEB é um **navegador integrado** usando o webview do Electron (Chromium). Não tem dependências externas Python ou scripts separados.

### Componentes:
1. **Webview do Electron** (já incluído no Electron)
   - Motor Chromium embutido
   - Suporte a HTML5, CSS3, JavaScript
   - Extensões de navegador
   - Cookies, cache, histórico

2. **LocalExtensions** (extensões web carregadas)
   - Path: `AppData\Roaming\bill-code\LocalExtensions\`
   - Formato: extensões Chrome/Chromium

---

## 📊 RESUMO - ABA WEB

### Dependências:
- ❌ **NENHUMA** dependência externa necessária
- ✅ Tudo é nativo do Electron/Chromium

### Componentes já incluídos:
- ✅ Webview (Chromium)
- ✅ Sistema de abas múltiplas
- ✅ Suporte a extensões

---

## 📝 NOTAS PARA O INSTALADOR - ABA WEB

**Não precisa incluir nada** - a aba Web usa componentes nativos do Electron que já vêm no build.

**Tamanho adicional**: 0 MB



---

## 🎨 ABA PAINT (EDITOR DE DESENHO)

### Análise do Sistema:
A aba PAINT é um **plugin opcional** carregado dinamicamente. O usuário pode instalar ou desinstalar pela Store do app.

### Status:
- **Tipo**: Plugin
- **Instalação**: Via Store interna do app
- **Código**: Componente React carregado via `PluginLoader`

---

## 📊 RESUMO - ABA PAINT

### Dependências:
- ❌ **NENHUMA** dependência externa necessária
- ✅ Plugin JavaScript puro (canvas HTML5)

### Componentes:
- ✅ Canvas HTML5 nativo
- ✅ JavaScript/React puro
- ✅ Ferramentas de desenho (pincel, formas, cores)

---

## 📝 NOTAS PARA O INSTALADOR - ABA PAINT

**Não precisa incluir nada** - é um plugin JavaScript que vem no build do app.

**Tamanho adicional**: 0 MB (já incluído no bundle)

