#!/bin/bash
# SharperProfile launcher (macOS) — 2026-09-28.
#
# Double-click this file in Finder instead of opening Terminal and typing
# `npm install` / `npm run dev` yourself. Terminal.app runs it automatically;
# it installs dependencies the first time only, starts the tool, and opens
# your browser to it once it's actually ready — no manual "now copy this
# localhost link into your browser" step.
#
# First run: macOS Gatekeeper will likely block it as being from an
# "unidentified developer" (it isn't code-signed). Right-click (or
# Control-click) this file and choose "Open" once to get past that — after
# that, double-clicking works normally.

cd "$(dirname "$0")" || exit 1

have_curl() { command -v curl >/dev/null 2>&1; }

server_is_up() {
  have_curl && curl -s -o /dev/null -m 1 http://localhost:3001
}

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed, or isn't on your PATH."
  echo "Install it from https://nodejs.org (choose the \"LTS\" version), then double-click this file again."
  echo ""
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo ""
  echo "Installing SharperProfile's dependencies - this only happens once, and can take a minute or two..."
  echo ""
  if ! npm install; then
    echo ""
    echo "npm install failed - see the messages above for what went wrong."
    echo ""
    read -r -p "Press Enter to close this window..."
    exit 1
  fi
fi

# If SharperProfile is already running (e.g. this file was double-clicked
# twice), just open it instead of trying to start a second copy, which
# would fail with a port-already-in-use error.
if server_is_up; then
  echo "SharperProfile is already running - opening it in your browser."
  open http://localhost:3001
  exit 0
fi

echo ""
echo "Starting SharperProfile... your browser will open automatically once it's ready."
echo "Keep this window open while you use the tool - closing it stops SharperProfile."
echo ""

# Opens the browser the moment the server actually responds, instead of
# guessing a fixed delay. Runs in the background so this window stays free
# to show the server's own log output below. Falls back to a fixed 5-second
# wait if curl isn't available for some reason, rather than never opening.
(
  if have_curl; then
    for _ in $(seq 1 60); do
      if server_is_up; then
        open http://localhost:3001
        exit 0
      fi
      sleep 1
    done
  else
    sleep 5
    open http://localhost:3001
  fi
) &

npm run dev
