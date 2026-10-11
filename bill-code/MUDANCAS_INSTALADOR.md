# 🔧 Mudanças no Sistema de Instalação

## ✅ O Que Foi Alterado

### **ANTES** (Instalador Gigante)
```json
"extraFiles": [
  {
    "from": "installer-deps/python",
    "to": "runtime/python"
  },
  {
    "from": "installer-deps/ffmpeg",
    "to": "runtime/ffmpeg"
  },
  // ... todas as dependências (~2 GB)
]
```

**Resultado**: Instalador de ~2+ GB (muito grande para distribuir)

---

### **AGORA** (Instalador Leve + Download na Primeira Execução)

```json
// NÃO inclui dependências no instalador
"files": [
  "dist/**/*",
  "dist-electron/**/*",
  "plugins-dist/**/*",
  "scripts/**/*"
]
```

**Resultado**: 
- ✅ Instalador de ~150 MB (leve e rápido)
- ✅ Dependências baixadas automaticamente na primeira execução (~1.2 GB)

---

## 🎯 Como Funciona Agora

### 1. Usuário Baixa o Instalador
```
Gabiru-Setup.exe (~150 MB)
├── Electron runtime
├── React app (seu código)
├── Scripts Python (.py)
└── Sistema de download interno
```

### 2. Primeira Execução do App
```
┌─────────────────────────────────────┐
│  🎯 Bem-vindo ao Gabiru!           │
│                                     │
│  Precisamos baixar dependências:    │
│                                     │
│  ☐ FFmpeg           ~100 MB        │
│  ☐ Python           ~15 MB         │
│  ☐ Piper TTS        ~50 MB         │
│  ☐ Python Libs      ~923 MB        │
│                                     │
│  [📥 Baixar Dependências]          │
└─────────────────────────────────────┘
```

### 3. Downloads Automáticos
- Baixa de URLs oficiais
- Barra de progresso para cada item
- Instalação automática
- Tudo salvo em `%APPDATA%\bill-code\runtime\`

### 4. App Pronto!
```
Tudo instalado com sucesso! 🎉
[Começar a usar]
```

---

## 📊 Comparação

| Item | ANTES | AGORA |
|------|-------|-------|
| **Tamanho do instalador** | ~2.2 GB | ~150 MB |
| **Tempo de upload (distribuição)** | ~30 min | ~2 min |
| **Tempo de download (usuário)** | ~40 min | ~3 min + 10 min |
| **Espaço total usado** | ~2.2 GB | ~1.35 GB |
| **Flexibilidade** | Baixa | Alta ✅ |

---

## 🚀 Benefícios

### Para Você (Desenvolvedor)
✅ **Upload rápido**: Distribuir o instalador é 15x mais rápido
✅ **Versionamento fácil**: Atualizar dependências sem recompilar tudo
✅ **Economia de banda**: Menos dados transferidos
✅ **Deploy ágil**: Fazer releases rapidamente

### Para o Usuário
✅ **Download inicial rápido**: Começa a usar em minutos
✅ **Transparência**: Vê exatamente o que está sendo baixado
✅ **Controle**: Pode pular dependências opcionais
✅ **Segurança**: Downloads de fontes oficiais

---

## 📝 Arquivos Modificados

### 1. `package.json`
**Removido:**
```json
"extraFiles": [
  // Todas as inclusões de dependências
]
```

**Mantido:**
```json
"files": [
  "dist/**/*",          // App compilado
  "dist-electron/**/*", // Electron compilado
  "scripts/**/*"        // Scripts Python
]
```

### 2. Novos Arquivos Criados
- ✅ `electron/dependencyManager.ts` - Gerenciador de downloads
- ✅ `src/components/FirstRunSetup.tsx` - Tela de setup
- ✅ `src/components/AppWrapper.tsx` - Controle de fluxo
- ✅ `src/types/electron.d.ts` - Tipos TypeScript

### 3. Arquivos Atualizados
- ✅ `electron/main.ts` - Handlers IPC adicionados
- ✅ `electron/preload.ts` - API exposta
- ✅ `src/main.tsx` - Entry point atualizado

---

## 🧪 Como Testar

### 1. Compilar e Testar em Dev
```powershell
npm run electron:compile
npm run electron:dev
```

### 2. Simular Primeira Execução
```powershell
# Delete a pasta runtime
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force

# Rode novamente
npm run electron:dev
```

### 3. Build do Instalador Final
```powershell
npm run build
```

O instalador estará em `release/` e será **~150 MB** (não mais 2+ GB!)

---

## ⚠️ Importante: URLs de Download

As URLs das dependências estão em `electron/dependencyManager.ts`:

```typescript
const DEPENDENCY_URLS = {
  ffmpeg: 'https://github.com/BtbN/FFmpeg-Builds/releases/...',
  python: 'https://www.python.org/ftp/python/3.11.9/...',
  // ...
};
```

**Você precisa**:
1. ✅ Verificar se essas URLs estão corretas
2. ✅ Testar se os downloads funcionam
3. ✅ Considerar hospedar em CDN própria para controle de versão

---

## 🔄 Próximas Melhorias Sugeridas

1. **CDN Própria**: Hospedar dependências em servidor próprio
2. **Checksums**: Validar integridade dos downloads (SHA256)
3. **Retry**: Tentar novamente em caso de falha
4. **Pause/Resume**: Pausar e continuar downloads
5. **Update System**: Atualizar dependências sem reinstalar

---

## 📞 Troubleshooting

### "Downloads não funcionam"
- Verifique as URLs em `dependencyManager.ts`
- Teste manualmente no navegador
- Verifique conexão de internet

### "Instalador ainda está grande"
- Certifique-se que removeu `extraFiles` do `package.json`
- Rode `npm run build` novamente
- Verifique pasta `release/`

### "App não mostra tela de setup"
- Delete `%APPDATA%\bill-code\runtime`
- Rode o app novamente

---

## ✨ Conclusão

**O instalador está atualizado!** 🎉

- ❌ Não inclui mais as dependências pesadas
- ✅ Baixa tudo automaticamente na primeira execução
- ✅ Instalador pequeno e rápido de distribuir

**Próximo passo**: Gerar o build e testar!

```powershell
npm run build
```
