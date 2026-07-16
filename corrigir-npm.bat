@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Ticket. - Correcao do npm

cls
echo =====================================================
echo        CORRECAO DE INSTALACAO DO TICKET.
echo =====================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)

echo Configurando o registro publico do npm...
call npm config set registry https://registry.npmjs.org/

if exist node_modules (
  echo Removendo uma instalacao incompleta...
  rmdir /s /q node_modules
)

echo Limpando o cache local do npm...
call npm cache clean --force

echo Instalando novamente as dependencias...
call npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund

if errorlevel 1 (
  echo.
  echo A correcao nao foi concluida.
  echo Verifique firewall, proxy ou bloqueio da rede empresarial.
  pause
  exit /b 1
)

echo.
echo Correcao concluida com sucesso.
echo Agora execute iniciar-ticket.bat.
echo.
pause
endlocal
