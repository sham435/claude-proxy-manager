@echo off
REM Claude Proxy Manager Launcher for Windows 10/11 64-bit
setlocal enabledelayedexpansion

set APP_NAME=Claude Proxy Manager
set APP_DIR=%~dp0

echo.
echo Starting %APP_NAME%...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed. Please install Node.js first:
    echo        https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION%") do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
    echo ERROR: Node.js version 18 or higher is required. Current: %NODE_VERSION%
    echo        Please update Node.js:
    echo        https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js %NODE_VERSION% detected

REM Check if .claude directory exists
set CLAUDE_DIR=%USERPROFILE%\.claude
if not exist "%CLAUDE_DIR%" (
    echo ERROR: Claude Code directory not found at %CLAUDE_DIR%
    echo        Please install Claude Code first
    echo.
    pause
    exit /b 1
)

echo [OK] Claude Code directory found

REM Check if proxy-server.mjs exists
set PROXY_FILE=%CLAUDE_DIR%\proxy-server.mjs
if not exist "%PROXY_FILE%" (
    echo ERROR: Proxy server file not found at %PROXY_FILE%
    echo        Please ensure Claude Code proxy is configured
    echo.
    pause
    exit /b 1
)

echo [OK] Proxy server file found

REM Check if .env exists
set ENV_FILE=%CLAUDE_DIR%\.env
if not exist "%ENV_FILE%" (
    echo WARNING: .env file not found at %ENV_FILE%
    echo          Some features may not work without API keys
) else (
    echo [OK] Environment file found
)

REM Check if Electron app is built
if exist "%APP_DIR%dist\win-unpacked\Claude Proxy Manager.exe" (
    echo [OK] Launching built application...
    start "" "%APP_DIR%dist\win-unpacked\Claude Proxy Manager.exe"
) else if exist "%APP_DIR%dist\Claude Proxy Manager Setup*.exe" (
    echo [OK] Launching built application...
    for %%f in ("%APP_DIR%dist\Claude Proxy Manager Setup*.exe") do start "" "%%f"
) else (
    echo WARNING: Built application not found. Starting in development mode...
    echo          To build: npm run build:win
    echo.
    
    REM Check if node_modules exists
    if not exist "%APP_DIR%node_modules" (
        echo Installing dependencies...
        cd /d "%APP_DIR%"
        call npm install
        if %ERRORLEVEL% NEQ 0 (
            echo ERROR: Failed to install dependencies
            pause
            exit /b 1
        )
    )
    
    REM Start in development mode
    cd /d "%APP_DIR%"
    call npm start
)

echo.
echo [OK] %APP_NAME% started successfully
echo.
timeout /t 2 /nobreak >nul
