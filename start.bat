@echo off
rem AI 创意岛 一键启动（首次会自动安装依赖并构建）
cd /d "%~dp0"

if not exist node_modules (
  echo [1/3] 首次运行，安装依赖中...
  call npm install || goto :fail
) else (
  echo [1/3] 依赖已就绪
)

if not exist apps\web\dist (
  echo [2/3] 构建前端中...
  call npm run build || goto :fail
) else (
  echo [2/3] 前端已构建
)

if not exist data\config.json (
  if not exist data mkdir data
  copy config.example.json data\config.json >nul
  echo.
  echo ============================================
  echo   已生成 data\config.json
  echo   想启用真正的 AI 伙伴，请用记事本打开它填上 apiKey
  echo   （不填也能玩，AI 伙伴会以离线替身模式回复）
  echo ============================================
  echo.
)

echo [3/3] 启动服务器...
call npm run start
goto :eof

:fail
echo.
echo 启动失败，请把上面的报错发给爸爸妈妈检查。
pause
