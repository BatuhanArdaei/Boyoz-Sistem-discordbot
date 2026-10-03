@echo off
chcp 65001 >nul
title Boyoz Sistem
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js kurulu degil. https://nodejs.org adresinden LTS surumunu kurun.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Paketler kuruluyor, ilk seferde biraz surebilir...
  call npm install
)

if not exist .env.local (
  (
    echo DISCORD_TOKEN=
    echo OWNER_IDS=
    echo GUILD_ID=
    echo AUTO_DEPLOY=true
  ) > .env.local
  echo .env.local dosyasi olusturuldu. Token ve OWNER_IDS bilgilerini girip kaydedin, sonra bu dosyayi tekrar calistirin.
  notepad .env.local
  pause
  exit /b 0
)

:dongu
node src/index.js
if errorlevel 1 (
  echo.
  echo Bot bir ayar hatasi yuzunden kapandi. Yukaridaki mesaji kontrol edin.
  pause
  exit /b 1
)
echo Bot kapandi, 5 saniye sonra yeniden baslatiliyor... (durdurmak icin pencereyi kapatin)
timeout /t 5 >nul
goto dongu
