# 📦 Sistema de Instalador Interno - Referência Rápida

## 🎯 O Que É?

Um sistema que **baixa automaticamente** as dependências do app na primeira execução, mantendo o instalador leve (~150 MB ao invés de 2+ GB).

---

## 🚀 Como Usar

### Para Testar (Desenvolvimento)
```powershell
npm run electron:compile
npm run electron:dev
```

### Para Gerar o Instalador
```powershell
npm run build
```

O instalador estará em `release/Gabiru-Setup-1.0.0.exe` (~150 MB)

---

## 📁 Arquivos Importantes

### Código Principal
- `electron/dependencyManager.ts` - Gerencia downloads
- `src/components/FirstRunSetup.tsx` - Interface visual
- `src/components/AppWrapper.tsx` - Controle de fluxo

### Documentação
- `CHECKLIST_FINAL.md` - ⭐ **COMECE AQUI** - Lista de verificação completa
- `INSTALADOR_INTERNO.md` - Documentação técnica
- `COMO_TESTAR_INSTALADOR.md` - Guia de testes
- `MUDANCAS_INSTALADOR.md` - O que foi alterado

---

## ✅ Mudanças Feitas

### No `package.json`
❌ **REMOVIDO**: `extraFiles` (que incluía 2 GB de dependências)
✅ **RESULTADO**: Instalador leve (~150 MB)

### Novos Recursos
✅ Tela de setup na primeira execução
✅ Download automático de dependências
✅ Barras de progresso
✅ Validação de instalação

---

## 🧪 Teste Rápido

```powershell
# 1. Limpar runtime
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force -ErrorAction SilentlyContinue

# 2. Rodar app
npm run electron:dev

# 3. Deve mostrar tela de setup com botão "Baixar dependências"
```

---

## ⚠️ IMPORTANTE: URLs de Download

As URLs estão em `electron/dependencyManager.ts`:

```typescript
const DEPENDENCY_URLS = {
  ffmpeg: 'https://github.com/BtbN/FFmpeg-Builds/...',
  python: 'https://www.python.org/ftp/python/...',
  'piper-tts': 'https://github.com/rhasspy/piper/...',
  tesseract: 'https://digi.bib.uni-mannheim.de/tesseract/...',
};
```

**Você DEVE**:
1. ✅ Testar essas URLs no navegador
2. ✅ Confirmar que os downloads funcionam
3. ✅ Considerar hospedar em CDN própria

---

## 📊 Antes vs Depois

| | ANTES | AGORA |
|---|---|---|
| **Instalador** | 2.2 GB | 150 MB ✅ |
| **Distribuição** | Lenta | Rápida ✅ |
| **Atualização** | Difícil | Fácil ✅ |

---

## 🐛 Problemas Comuns

### Instalador ainda grande?
Verifique se `extraFiles` foi removido do `package.json`

### Downloads não funcionam?
Teste as URLs em `electron/dependencyManager.ts` no navegador

### App não mostra setup?
Delete `%APPDATA%\bill-code\runtime` e teste novamente

---

## 📞 Próximos Passos

1. ✅ **Ler**: `CHECKLIST_FINAL.md`
2. ✅ **Testar**: `npm run electron:dev`
3. ✅ **Validar**: Seguir checklist
4. ✅ **Build**: `npm run build`
5. ✅ **Distribuir**: Upload do instalador

---

## 🎉 Status

✅ Sistema implementado
✅ Package.json atualizado
✅ Código compilando sem erros
⏳ **Aguardando seus testes**

**Leia o `CHECKLIST_FINAL.md` para validar tudo!**
