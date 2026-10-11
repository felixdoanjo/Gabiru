# 🧪 Como Testar o Instalador Interno

## ⚡ Teste Rápido (Desenvolvimento)

### 1. Compilar o TypeScript

```powershell
cd "c:\Users\Administrator\Desktop\Aqui\bill-code"
npm run electron:compile
```

### 2. Rodar o App

```powershell
npm run electron:dev
```

### O Que Deve Acontecer

1. **Primeira vez**: App vai abrir na tela de setup (FirstRunSetup)
2. Você verá a lista de dependências com status "pending"
3. Clique em **"Baixar dependências"**
4. Barras de progresso vão aparecer para cada download
5. Quando terminar: mensagem "Tudo pronto!" e botão "Começar a usar"

## 🔄 Simular Primeira Execução de Novo

Se você já rodou uma vez e quer testar de novo:

```powershell
# Delete a pasta runtime
Remove-Item "$env:APPDATA\bill-code\runtime" -Recurse -Force

# Rode novamente
npm run electron:dev
```

## 🐛 Debug: Ver o Que Está Acontecendo

### 1. Console do Electron (Terminal)

Quando rodar `npm run electron:dev`, veja o terminal:

```
[DependencyManager] Checking dependencies...
[DependencyManager] ffmpeg: false
[DependencyManager] python: false
[DependencyManager] Downloading ffmpeg...
[DependencyManager] Progress: 25%
```

### 2. DevTools do App (F12)

Dentro do app, abra F12 e veja console:

```javascript
// Ver status atual
await window.electronAPI.checkDependencies()

// Deve retornar algo como:
{
  ffmpeg: false,
  python: false,
  "piper-tts": false,
  "python-libs-video": false,
  "python-libs-design": false,
  tesseract: false
}
```

### 3. Ver Arquivos Baixados

```powershell
# Abrir pasta runtime
explorer "$env:APPDATA\bill-code\runtime"
```

Estrutura esperada:

```
runtime\
├── ffmpeg\
│   └── bin\
│       └── ffmpeg.exe
├── python\
│   └── python.exe
├── piper-tts\
│   └── piper.exe
└── tesseract\
    └── tesseract.exe
```

## ⚠️ Problemas Comuns

### Erro: "Cannot find module 'extract-zip'"

**Solução:**
```powershell
npm install extract-zip --save
```

### Erro: "ENOENT: no such file or directory"

**Causa:** Pasta runtime não existe ainda.

**Solução:** É normal na primeira execução. O app vai criar automaticamente.

### Download fica travado em 0%

**Causa:** Problema de rede ou URL inválida.

**Solução:**
1. Verifique sua conexão
2. Teste as URLs manualmente no navegador
3. Veja o terminal para erros específicos

### App não mostra tela de setup

**Causa:** Dependências já estão instaladas.

**Solução:** Delete a pasta runtime (comando acima) e teste de novo.

## 📝 Checklist de Teste

- [ ] App abre na tela de setup
- [ ] Lista de dependências aparece
- [ ] Botão "Baixar dependências" funciona
- [ ] Barras de progresso funcionam
- [ ] Downloads acontecem sem erros
- [ ] Ao terminar, mostra "Tudo pronto!"
- [ ] Clicar em "Começar a usar" abre o app principal
- [ ] Na segunda execução, pula o setup e vai direto pro app

## 🚀 Build Final

Quando tudo estiver funcionando no desenvolvimento:

```powershell
npm run build
```

Isso vai gerar o instalador em `release/` sem as dependências (elas serão baixadas na primeira execução do usuário).

## 💡 Dicas

1. **URLs reais**: As URLs no código são exemplos. Você precisa confirmar que estão corretas.

2. **Teste com internet lenta**: Simule uma conexão lenta para ver o comportamento das barras de progresso.

3. **Teste sem internet**: Veja como o app se comporta sem conexão (deve mostrar erro amigável).

4. **Espaço em disco**: Tenha pelo menos 2 GB livres para os downloads.

---

**Bom teste!** 🎯
