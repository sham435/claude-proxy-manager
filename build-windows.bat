@echo off
REM Build script for Windows 10/11 64-bit
setlocal enabledelayedexpansion

echo.
echo Building Claude Proxy Manager for Windows...
echo.

REM Check if we're on Windows
if not "%OS%"=="Windows_NT" (
    echo ERROR: This script must be run on Windows
    pause
    exit /b 1
)

REM Check architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    echo [OK] Windows 64-bit detected
) else (
    echo WARNING: Non-64-bit architecture detected. Build may not work correctly.
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed
    echo        Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM Install dependencies
echo.
echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

REM Create build directory if it doesn't exist
if not exist build mkdir build

REM Check for icon
if not exist build\icon.ico (
    echo WARNING: build\icon.ico not found
    echo          The app will use default Electron icon
    echo          To add custom icon: create build\icon.ico (256x256 or larger)
)

REM Build the app
echo.
echo Building application...
call npm run build:win
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build complete!
echo ========================================
echo.
echo Output files:
dir /b dist\*.exe 2>nul || echo   No .exe files found
echo.
echo To install:
echo   1. Run the installer in dist\ folder
echo   2. Follow the installation wizard
echo   3. Launch from Start Menu or use launch-windows.bat
echo.
pause
