@echo off
rem 开发模式：server(8787) + vite(5173) 同时启动，前端改动热更新
cd /d "%~dp0"

if not exist node_modules (
  call npm install || goto :fail
)
if not exist data\config.json (
  if not exist data mkdir data
  copy config.example.json data\config.json >nul
)

call npm run dev
goto :eof

:fail
pause
