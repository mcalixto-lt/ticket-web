@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Ticket. - Limpar servidores antigos
cls
echo =============================================================
echo          TICKET. - LIMPEZA DE SERVIDORES ANTIGOS
echo =============================================================
echo.
for %%P in (8765 8766 8767 8768 8769 8770 8771 8772 8773 8774) do (
  for /f "usebackq tokens=*" %%I in (`powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue; foreach($x in $c){$p=Get-Process -Id $x.OwningProcess -ErrorAction SilentlyContinue; if($p -and @('node','python','pythonw') -contains $p.ProcessName){$p.Id}}"`) do taskkill /PID %%I /F >nul 2>&1
)

echo Servidores antigos encerrados.
echo O cadastro e os registros salvos no navegador nao foram apagados.
echo.
pause
endlocal
