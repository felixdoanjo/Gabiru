@echo off
echo ========================================
echo   BILL CODE - INICIANDO...
echo ========================================
echo.

REM Limpa cache antigo se existir
if exist ".vite" (
    echo Limpando cache do Vite...
    rmdir /s /q ".vite" 2>nul
)

echo Iniciando servidor de desenvolvimento...
echo.
npm run dev
