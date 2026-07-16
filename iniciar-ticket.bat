@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Ticket. Web

cls
echo =============================================================
echo                       TICKET. WEB
echo =============================================================
echo.
echo Ajustes desta entrega:
echo - Registro manual de DATA e HORA com fotografia obrigatoria
echo - Opcao de salvar a imagem em cores ou alto contraste
echo - Registro de ambiente como evidencia auxiliar, sem alterar batidas
echo - Painel com Saldo do Dia e Saldo do Mes
echo - Assistente para Google Drive e Microsoft OneDrive
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale a versao LTS do Node.js e tente novamente.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado.
  echo Reinstale o Node.js LTS com a opcao de adicionar ao PATH.
  pause
  exit /b 1
)

set "NPM_CONFIG_REGISTRY=https://registry.npmjs.org/"
set "NPM_CONFIG_AUDIT=false"
set "NPM_CONFIG_FUND=false"

if not exist node_modules\vite\package.json (
  echo Instalando dependencias pelo registro publico do npm...
  echo.
  if exist package-lock.json (
    call npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
  ) else (
    call npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
  )
  if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel instalar as dependencias.
    echo Verifique o acesso a https://registry.npmjs.org/
    pause
    exit /b 1
  )
)

rem Encerra somente servidores Node/Python antigos nas portas usadas pelo Ticket.
for %%P in (8765 8766 8767 8768 8769 8770 8771 8772 8773 8774) do (
  for /f "usebackq tokens=*" %%I in (`powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue; foreach($x in $c){$p=Get-Process -Id $x.OwningProcess -ErrorAction SilentlyContinue; if($p -and @('node','python','pythonw') -contains $p.ProcessName){$p.Id}}"`) do (
    taskkill /PID %%I /F >nul 2>&1
  )
)

set "PORT=8773"
set "URL=http://127.0.0.1:!PORT!/"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object {$_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown'} ^| Select-Object -First 1 -ExpandProperty IPAddress); if($ip){$ip}"`) do set "LANIP=%%I"

echo Iniciando em uma aba normal do navegador:
echo !URL!
if defined LANIP (
  echo.
  echo No celular conectado a mesma rede Wi-Fi, acesse:
  echo http://!LANIP!:!PORT!/
  echo.
  echo Para acesso pela internet e uso completo da camera, publique o projeto em HTTPS.
)
echo.
echo Para encerrar, pressione Ctrl+C nesta janela.
echo.

rem Abre no navegador padrao, sem modo aplicativo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process '!URL!'"

call npm run dev -- --host 0.0.0.0 --port !PORT! --strictPort --force

if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro.
  pause
)
endlocal
