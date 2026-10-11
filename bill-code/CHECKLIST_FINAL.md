# ✅ Checklist Final - Sistema de Instalador Interno

## 📋 Antes de Fazer o Build Final

### 1. Validação das URLs de Download

Abra `electron/dependencyManager.ts` e teste cada URL:

- [ ] **FFmpeg**: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip`
  - Teste no navegador: deve baixar um arquivo ZIP
  - Tamanho esperado: ~100 MB

- [ ] **Python**: `https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip`
  - Teste no navegador: deve baixar um arquivo ZIP
  - Tamanho esperado: ~15 MB

- [ ] **Piper TTS**: `https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_windows_amd64.zip`
  - Teste no navegador: deve baixar um arquivo ZIP
  - Tamanho esperado: ~50 MB

- [ ] **Tesseract**: `https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe`
  - Teste no navegador: deve baixar um arquivo EXE
  - Tamanho esperado: ~60 MB

**⚠️ IMPORTANTE**: Se alguma URL não funcionar, você precisa encontrar URLs alternativas ou hospedar os arquivos você mesmo.

---

### 2. Teste em Desenvolvimento

```powershell
# Compilar TypeScript
npm run electron:compile

# Rodar app
npm run electron:dev
```

**Deve acontecer:**
- [ ] App abre sem erros
- [ ] Se runtime não existe: mostra tela de setup
- [ ] Se runtime existe: vai direto pro app

---

### 3. Teste de Primeira Execução

```powershell
# Limpar runtime
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force -ErrorAction SilentlyContinue

# Rodar novamente
npm run electron:dev
```

**Deve acontecer:**
- [ ] Tela "Bem-vindo ao Gabiru!" aparece
- [ ] Lista de dependências é exibida
- [ ] Tamanhos estão corretos
- [ ] Botão "Baixar dependências" está visível
- [ ] Botão "Pular" está visível

---

### 4. Teste de Download (CRÍTICO)

Na tela de setup:

- [ ] Clicar em "Baixar dependências"
- [ ] Barras de progresso aparecem
- [ ] Downloads começam (monitor de rede deve mostrar atividade)
- [ ] Cada dependência mostra progresso (0% → 100%)
- [ ] Ao terminar: mensagem "Tudo pronto!"
- [ ] Clicar em "Começar a usar" carrega o app

**⚠️ Se downloads travarem:**
1. Abra DevTools (F12)
2. Veja console para erros
3. Verifique Terminal onde rodou `npm run electron:dev`

---

### 5. Validação Pós-Download

```powershell
# Verificar pasta runtime
explorer "$env:APPDATA\bill-code\runtime"
```

**Estrutura esperada:**
```
runtime\
├── ffmpeg\
│   └── bin\
│       └── ffmpeg.exe (deve existir)
├── python\
│   └── python.exe (deve existir)
├── piper-tts\
│   └── piper.exe (deve existir)
└── tesseract\
    └── tesseract.exe (deve existir)
```

- [ ] Todos os executáveis existem
- [ ] Tamanho total da pasta: ~1.2 GB

---

### 6. Teste de Segunda Execução

Fechar e abrir o app novamente:

- [ ] App **NÃO** mostra tela de setup
- [ ] App vai direto para a interface principal
- [ ] Funcionalidades que dependem das dependências funcionam:
  - [ ] Video Editor (precisa FFmpeg)
  - [ ] Design (precisa Python + libs)
  - [ ] TTS (precisa Piper)

---

### 7. Teste de "Pular"

```powershell
# Limpar runtime novamente
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force -ErrorAction SilentlyContinry

npm run electron:dev
```

- [ ] Clicar em "Pular (instalar depois)"
- [ ] App deve carregar normalmente
- [ ] Funcionalidades que precisam de dependências devem mostrar erro amigável

---

## 🏗️ Build do Instalador

Após todos os testes passarem:

```powershell
npm run build
```

### Validação do Build

- [ ] Build completa sem erros
- [ ] Pasta `release/` é criada
- [ ] Arquivo `Gabiru-Setup.exe` existe

**Verificar tamanho:**
```powershell
Get-Item "release\Gabiru-Setup*.exe" | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

**Esperado**: ~150 MB (não mais 2 GB!)

- [ ] Tamanho do instalador é < 300 MB ✅
- [ ] Se for > 500 MB: algo está errado (dependências ainda estão sendo incluídas)

---

## 🧪 Teste do Instalador Final

### 1. Instalação
```powershell
# Rodar o instalador
.\release\Gabiru-Setup-1.0.0.exe
```

- [ ] Instalador abre
- [ ] Processo de instalação é rápido (~1 minuto)
- [ ] App é instalado em `C:\Program Files\Gabiru` (ou pasta escolhida)
- [ ] Atalho é criado no Desktop
- [ ] Atalho é criado no Menu Iniciar

### 2. Primeira Execução Pós-Instalação

- [ ] Abrir app pelo atalho
- [ ] Tela de setup aparece automaticamente
- [ ] Download de dependências funciona
- [ ] Ao terminar: app principal carrega

### 3. Funcionalidades

Testar cada aba do app:

- [ ] **Home**: Abre sem erros
- [ ] **Code**: Editor funciona
- [ ] **Video**: Pode importar vídeo (precisa FFmpeg)
- [ ] **Design**: Ferramentas de imagem funcionam (precisa Python)
- [ ] **Web**: Navegador funciona
- [ ] **Paint**: Ferramentas de desenho funcionam

---

## 📊 Métricas de Sucesso

| Métrica | Valor Esperado | Seu Resultado |
|---------|----------------|---------------|
| Tamanho do instalador | < 300 MB | _____ MB |
| Tempo de instalação | < 2 min | _____ min |
| Tempo de 1º download | 5-15 min | _____ min |
| Espaço total usado | ~1.35 GB | _____ GB |
| Tela de setup aparece? | ✅ SIM | ☐ SIM ☐ NÃO |
| Downloads funcionam? | ✅ SIM | ☐ SIM ☐ NÃO |
| App funciona após setup? | ✅ SIM | ☐ SIM ☐ NÃO |

---

## 🚨 Problemas Comuns e Soluções

### Instalador Ainda Está Grande (> 500 MB)

**Causa**: `extraFiles` ainda está no `package.json`

**Solução**:
```powershell
# Verificar package.json
code package.json

# Procure por "extraFiles" - deve estar REMOVIDO
# Se existir, delete a seção inteira
```

### Downloads Não Funcionam

**Causa**: URLs inválidas ou problema de rede

**Solução**:
1. Testar URLs manualmente no navegador
2. Verificar console de erros (F12)
3. Substituir URLs em `electron/dependencyManager.ts`

### Erro de Compilação TypeScript

**Causa**: Tipos incorretos ou imports faltando

**Solução**:
```powershell
npm run electron:compile
# Ver erros e corrigir
```

### App Não Mostra Tela de Setup

**Causa**: Runtime já existe ou verificação falhando

**Solução**:
```powershell
# Forçar limpeza
Remove-Item "$env:APPDATA\bill-code" -Recurse -Force

# Testar novamente
npm run electron:dev
```

---

## ✅ Lista Final de Aprovação

Antes de distribuir o instalador ao público:

- [ ] Todos os testes passaram
- [ ] Instalador tem < 300 MB
- [ ] Downloads de dependências funcionam
- [ ] App funciona completamente após setup
- [ ] Testado em máquina limpa (sem dev environment)
- [ ] Testado com internet lenta
- [ ] Testado sem internet (deve mostrar erro amigável)
- [ ] Documentação criada para usuários finais

---

## 📚 Documentação Gerada

Arquivos de referência:

1. ✅ `INSTALADOR_INTERNO.md` - Documentação técnica completa
2. ✅ `COMO_TESTAR_INSTALADOR.md` - Guia de testes
3. ✅ `RESUMO_INSTALADOR.md` - Visão geral
4. ✅ `MUDANCAS_INSTALADOR.md` - O que mudou
5. ✅ `CHECKLIST_FINAL.md` - Este arquivo

---

## 🎉 Pronto para Lançar!

Se todos os checkboxes estão marcados:

✅ **O sistema está pronto para produção!**

Você pode:
1. Distribuir o instalador (~150 MB)
2. Upload para site/servidor
3. Compartilhar com usuários

**Parabéns!** 🚀
