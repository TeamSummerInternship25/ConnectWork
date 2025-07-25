@echo off
setlocal enabledelayedexpansion

:: ========================================
:: PopQuiz One-Click Startup Script
:: ========================================

echo ========================================
echo PopQuiz One-Click Startup
echo ========================================
echo.

:: Navigate to PopQuiz root directory (one level up from Step up folder)
cd /d "%~dp0.."

:: Check if we're in the correct directory
if not exist "package.json" (
    echo ERROR: Cannot find PopQuiz root directory
    echo Please ensure this script is in the Step up folder within PopQuiz project
    pause
    exit /b 1
)

:: Check if Node.js is installed
echo [1/8] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Get Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

:: Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not available
    pause
    exit /b 1
)

:: Check if PostgreSQL is available
echo [2/8] Checking PostgreSQL...
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: PostgreSQL command line tools not found in PATH
    echo Make sure PostgreSQL is installed and running
    echo You may need to start PostgreSQL service manually
) else (
    echo PostgreSQL tools found
)

:: Create environment file if it doesn't exist
echo [3/8] Setting up environment configuration...
if not exist "server\.env" (
    echo Creating server/.env file...
    copy "test\docs\examples\.env.example" "server\.env" >nul 2>nul
    if %errorlevel% neq 0 (
        echo WARNING: Could not copy .env.example, creating basic .env file...
        (
            echo # Database
            echo DATABASE_URL="postgresql://postgres:123456@localhost:5432/popquiz"
            echo.
            echo # Redis
            echo REDIS_URL="redis://localhost:6379"
            echo.
            echo # JWT
            echo JWT_SECRET="popquiz-super-secret-jwt-key-for-development-only"
            echo JWT_EXPIRES_IN="7d"
            echo.
            echo # Server
            echo PORT=5000
            echo NODE_ENV=development
            echo CLIENT_URL="http://localhost:3000"
            echo.
            echo # AI Services - Xfyun Spark AI
            echo XFYUN_API_PASSWORD="EnzAckpFjZKlfrCTLziM:DCbKCgAOpGyfJXTrnlHr"
            echo XFYUN_BASE_URL="https://spark-api-open.xf-yun.com"
            echo.
            echo # Backup AI Services
            echo OPENAI_API_KEY="sk-fake-key-for-testing"
            echo ANTHROPIC_API_KEY="fake-anthropic-key-for-testing"
            echo.
            echo # File Upload
            echo UPLOAD_DIR="./uploads"
            echo MAX_FILE_SIZE=50000000
            echo.
            echo # FFmpeg path
            echo FFMPEG_PATH="/usr/bin/ffmpeg"
        ) > "server\.env"
    )
    echo Environment file created at server/.env
) else (
    echo Environment file already exists
)

:: Install root dependencies
echo [4/8] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install root dependencies
    pause
    exit /b 1
)

:: Install client dependencies
echo [5/8] Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install client dependencies
    pause
    exit /b 1
)
cd ..

:: Install server dependencies
echo [6/8] Installing server dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install server dependencies
    pause
    exit /b 1
)

:: Generate Prisma client
echo [7/8] Setting up database...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)

:: Try to push database schema
call npx prisma db push
if %errorlevel% neq 0 (
    echo WARNING: Database push failed
    echo This might be because:
    echo 1. PostgreSQL is not running
    echo 2. Database 'popquiz' does not exist
    echo 3. Connection credentials are incorrect
    echo.
    echo Please check your PostgreSQL installation and database configuration
    echo You can continue, but some features may not work properly
    echo.
    set /p CONTINUE="Continue anyway? (Y/N): "
    if /i "!CONTINUE!" neq "Y" (
        echo Setup cancelled
        pause
        exit /b 1
    )
)

cd ..

:: Start the application
echo [8/8] Starting PopQuiz...
echo.
echo ========================================
echo Starting PopQuiz Application
echo ========================================
echo.
echo Frontend will be available at: http://localhost:3000
echo Backend API will be available at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the application
echo.

call npm run dev

echo.
echo ========================================
echo PopQuiz has been stopped
echo ========================================
pause
