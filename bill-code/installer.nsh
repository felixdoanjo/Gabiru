!macro customInstall
  DetailPrint "Extraindo dependencias pesadas (IA, Python, FFmpeg)... Isso pode levar alguns minutos."
  
  ; Cria a pasta runtime
  CreateDirectory "$INSTDIR\runtime"
  
  ; Extrai o tar.gz para dentro da pasta runtime
  ExecWait 'tar -xzf "$INSTDIR\runtime.tar.gz" -C "$INSTDIR\runtime"'
  
  ; Deleta o arquivo comprimido para não ocupar espaço em dobro
  Delete "$INSTDIR\runtime.tar.gz"
  
  DetailPrint "Instalação de dependências completa!"
!macroend

!macro customUnInstall
  DetailPrint "Removendo dependências..."
  RMDir /r "$INSTDIR\runtime"
!macroend
