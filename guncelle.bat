@echo off
chcp 65001 >nul
title Boyoz Sistem - Sunucu Guncelleme
echo Sunucudaki bot guncelleniyor (once degisikliklerini GitHuba pushladigindan emin ol)...
echo.
ssh boyoz "cd ~/Boyoz-Sistem-discordbot && git pull --ff-only && npm ci --omit=dev --no-audit --no-fund && pm2 restart boyoz && sleep 8 && pm2 logs boyoz --lines 15 --nostream"
echo.
if errorlevel 1 (echo [HATA] Guncelleme basarisiz, yukaridaki mesaji kontrol et.) else (echo Guncelleme tamam!)
pause
