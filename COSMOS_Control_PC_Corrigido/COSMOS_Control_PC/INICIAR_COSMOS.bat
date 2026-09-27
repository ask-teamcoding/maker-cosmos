@echo off
REM Inicia o Painel de Controle COSMOS a partir da mesma pasta deste .bat
cd /d "%~dp0"

if exist "COSMOS_Control_PC.exe" (
    start "" "COSMOS_Control_PC.exe"
) else (
    echo [ERRO] COSMOS_Control_PC.exe nao encontrado nesta pasta.
    echo Gere o executavel com: pyinstaller COSMOS_Control_PC.spec
    pause
)
