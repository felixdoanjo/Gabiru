# 📦 COMO GERAR O INSTALADOR COMPLETO OFFLINE DO GABIRU

## 🎯 O que o instalador inclui:

- ✅ App Electron do Gabiru
- ✅ Python 3.11 Embeddable + todas as bibliotecas
- ✅ FFmpeg completo
- ✅ Piper TTS + voz em português
- ✅ Tesseract OCR + dados em português
- ✅ Todos os modelos de IA necessários

**Tamanho final estimado**: ~1.5-2GB

---

## 📋 Pré-requisitos:

1. Node.js instalado
2. Todas as dependências do projeto (`npm install`)
3. Conexão com internet (para baixar as dependências)
4. ~5GB de espaço livre em disco

---

## 🚀 Passos para gerar o instalador:

### **Passo 1: Preparar dependências**

Execute o script que baixa todas as dependências externas:

```bash
npm run prepare-installer
```

Este comando vai:
- Baixar Python Embeddable 3.11
- Baixar FFmpeg
- Baixar Piper TTS + voz PT-BR
- Baixar Tesseract OCR
- Instalar todas as bibliotecas Python necessárias
- Organizar tudo na pasta `installer-deps/`

**Tempo estimado**: 15-30 minutos (dependendo da internet)

**IMPORTANTE**: Você só precisa fazer isso UMA VEZ. Depois pode reusar os arquivos.

---

### **Passo 2: Gerar o instalador**

Depois que o passo 1 terminar, execute:

```bash
npm run build
```

Ou para fazer tudo de uma vez (passo 1 + 2):

```bash
npm run build-full
```

O instalador será gerado em: `release/Gabiru Setup X.X.X.exe`

**Tempo estimado**: 10-20 minutos

---

## 📂 Estrutura de pastas criada:

```
bill-code/
├── installer-deps/          ← Dependências para o instalador
│   ├── python/              ← Python Embeddable
│   ├── python-packages/     ← Bibliotecas pip instaladas
│   ├── ffmpeg/              ← FFmpeg completo
│   ├── piper-tts/           ← Piper TTS + vozes
│   └── tesseract-setup.exe  ← Instalador do Tesseract
│
└── release/                 ← Instalador final
    └── Gabiru Setup 1.0.0.exe
```

---

## 🔧 O que acontece na instalação:

Quando o usuário roda o instalador:

1. **Escolhe pasta de instalação** (padrão: `C:\Program Files\Gabiru`)
2. **Instala o app** Gabiru
3. **Instala Python** em `C:\Program Files\Gabiru\runtime\python`
4. **Instala FFmpeg** em `C:\Program Files\Gabiru\runtime\ffmpeg`
5. **Instala Piper TTS** em `C:\Program Files\Gabiru\runtime\piper-tts`
6. **Instala Tesseract** em `C:\Program Files\Gabiru\runtime\tesseract`
7. **Cria atalhos** na área de trabalho e menu iniciar
8. **Configura paths** automaticamente

**Pronto!** O app abre e funciona 100% offline, sem precisar instalar nada.

---

## ✅ Vantagens deste método:

- ✅ **Instalação única**: Usuário baixa 1 arquivo só
- ✅ **Funciona offline**: Não precisa internet depois de instalado
- ✅ **Zero configuração**: Tudo é configurado automaticamente
- ✅ **Isolado**: Não interfere com Python/FFmpeg do sistema
- ✅ **Desinstalação limpa**: Remove tudo pelo uninstaller

---

## ⚠️ Troubleshooting:

### Erro: "Cannot find module 'https'"
- Certifique-se de estar usando Node.js versão 14 ou superior

### Erro no download de alguma dependência
- Verifique sua conexão com internet
- Alguns servidores podem estar lentos, tente novamente

### Instalador muito grande (>3GB)
- Normal! O instalador completo inclui:
  - Electron: ~200MB
  - Python + libs: ~600MB
  - FFmpeg: ~100MB
  - Modelos de IA: ~800MB

### Erro ao executar `npm run build`
- Execute `npm run prepare-installer` primeiro
- Certifique-se que a pasta `installer-deps/` existe e está completa

---

## 🔄 Para atualizar o instalador:

Se você fez mudanças no código:

```bash
npm run build
```

Se você quer atualizar as dependências (Python, FFmpeg, etc):

```bash
# Apagar pasta antiga
rmdir /s /q installer-deps

# Baixar novamente
npm run prepare-installer

# Gerar instalador
npm run build
```

---

## 📊 Checklist de teste:

Depois de gerar o instalador, teste:

- [ ] Instalador abre e mostra wizard
- [ ] Instalação completa sem erros
- [ ] App abre normalmente
- [ ] Aba HOME: lembretes com áudio funcionam
- [ ] Aba VIDEO: transcrição e legendas funcionam
- [ ] Aba DESIGN: remoção de fundo e OCR funcionam
- [ ] Desinstalador remove tudo corretamente

---

## 🎉 Pronto!

Agora você tem um instalador completo offline do Gabiru que funciona 100% standalone!
