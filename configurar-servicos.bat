@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Ticket. - Configurar servicos
cls
echo =============================================================
echo            TICKET. - CONFIGURAR SERVICOS OPCIONAIS
echo =============================================================
echo.
echo Informe somente os IDs publicos das aplicacoes OAuth.
echo Deixe em branco o servico que nao deseja usar.
echo Consulte CONFIGURAR-DRIVE-ONEDRIVE.md antes de preencher.
echo Para testes locais, autorize o endereco HTTPS publicado do Ticket. nos provedores.
echo.
set /p "GOOGLE_ID=Google OAuth Client ID (opcional): "
set /p "MICROSOFT_ID=Microsoft Application Client ID (opcional): "
set /p "MICROSOFT_TENANT=Microsoft Tenant ID [common]: "
if "%MICROSOFT_TENANT%"=="" set "MICROSOFT_TENANT=common"

(
  echo # Ticket. - configuracao local opcional
  echo VITE_GOOGLE_CLIENT_ID=%GOOGLE_ID%
  echo VITE_MICROSOFT_CLIENT_ID=%MICROSOFT_ID%
  echo VITE_MICROSOFT_TENANT_ID=%MICROSOFT_TENANT%
) > .env.local

echo.
echo Configuracao gravada em .env.local.
echo Feche e abra novamente o iniciar-ticket.bat.
echo.
pause
endlocal
