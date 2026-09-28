@echo off
REM SharperProfile launcher (Windows) — 2026-09-28.
REM
REM Double-click this file instead of opening a terminal and typing
REM `npm install` / `npm run dev` yourself. It installs dependencies the
REM first time only, starts the tool, and opens your browser to it
REM automatically once it's actually ready — no manual "now copy this
REM localhost link into your browser" step.
REM
REM This is a plain-text batch script, not a compiled .exe, on purpose: it
REM needs no packaging step, and — being plain text — you (or anyone
REM technical you trust, or your antivirus) can open it in Notepad and read
REM exactly what it does line by line. A compiled .exe would also very
REM likely get flagged by Windows SmartScreen as being from an "unrecognized
REM publisher," since it wouldn't be code-signed.
setlocal
title SharperProfile
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js isn't installed, or isn't on your PATH.
  echo Install it from https://nodejs.org - choose the "LTS" version - then double-click this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo npm wasn't found even though Node.js is installed - that's unusual.
  echo Try reinstalling Node.js from https://nodejs.org, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo Installing SharperProfile's dependencies - this only happens once, and can take a minute or two...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed - see the messages above for what went wrong.
    echo.
    pause
    exit /b 1
  )
)

REM If SharperProfile is already running (e.g. this file was double-clicked
REM twice), just open it instead of trying to start a second copy, which
REM would fail with a port-already-in-use error.
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo SharperProfile is already running - opening it in your browser.
  start "" http://localhost:3001
  exit /b 0
)

echo.
echo Starting SharperProfile... your browser will open automatically once it's ready.
echo Keep this window open while you use the tool - closing it stops SharperProfile.
echo.

REM Opens the browser the moment the server actually responds, instead of
REM guessing a fixed delay. Runs invisibly in the background so the only
REM window you see is this one - the real running server, below.
start /min "" powershell -NoProfile -WindowStyle Hidden -Command ^
  "for ($i=0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { Start-Process 'http://localhost:3001'; exit } } catch {}; Start-Sleep -Seconds 1 }"

call npm run dev
