@echo off

:: ========================================
:: PopQuiz Prerequisites Installation
:: ========================================

echo ========================================
echo PopQuiz Prerequisites Installation
echo ========================================
echo.
echo This script will help you install required software for PopQuiz.
echo.
echo Required software:
echo - Node.js 18+ (JavaScript runtime)
echo - PostgreSQL 13+ (Database)
echo.
echo Optional software:
echo - Git (Version control)
echo - Redis (Caching)
echo.

set /p CONFIRM="Do you want to continue? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo Installation cancelled.
    pause
    exit /b 0
)

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo This installation requires administrator privileges.
    echo Please run this script as Administrator.
    echo.
    echo Right-click on the script and select "Run as administrator"
    pause
    exit /b 1
)

echo.
echo Starting installation...
echo.

:: Check if Chocolatey is installed
where choco >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing Chocolatey package manager...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    
    :: Refresh environment variables
    call refreshenv
) else (
    echo Chocolatey is already installed.
)

:: Install Node.js
echo.
echo Installing Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    choco install nodejs -y
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install Node.js
        echo Please install manually from https://nodejs.org/
        pause
        exit /b 1
    )
    echo Node.js installed successfully.
) else (
    echo Node.js is already installed.
)

:: Install PostgreSQL
echo.
echo Installing PostgreSQL...
where psql >nul 2>nul
if %errorlevel% neq 0 (
    choco install postgresql -y
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install PostgreSQL
        echo Please install manually from https://www.postgresql.org/download/windows/
        pause
        exit /b 1
    )
    echo PostgreSQL installed successfully.
) else (
    echo PostgreSQL is already installed.
)

:: Install Git (optional)
echo.
set /p INSTALL_GIT="Do you want to install Git? (Y/N): "
if /i "%INSTALL_GIT%" equ "Y" (
    where git >nul 2>nul
    if %errorlevel% neq 0 (
        choco install git -y
        echo Git installed successfully.
    ) else (
        echo Git is already installed.
    )
)

:: Install Redis (optional)
echo.
set /p INSTALL_REDIS="Do you want to install Redis? (Y/N): "
if /i "%INSTALL_REDIS%" equ "Y" (
    choco install redis-64 -y
    echo Redis installed successfully.
)

:: Refresh environment variables
call refreshenv

echo.
echo ========================================
echo Installation completed!
echo ========================================
echo.
echo Installed software:
echo - Node.js (JavaScript runtime)
echo - PostgreSQL (Database)
if /i "%INSTALL_GIT%" equ "Y" echo - Git (Version control)
if /i "%INSTALL_REDIS%" equ "Y" echo - Redis (Caching)
echo.
echo IMPORTANT: Please restart your Command Prompt or computer
echo to ensure all PATH changes take effect.
echo.
echo Next steps:
echo 1. Restart Command Prompt
echo 2. Navigate to PopQuiz directory
echo 3. Run: start-popquiz.bat
echo.
pause
