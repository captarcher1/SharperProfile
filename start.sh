#!/bin/bash
# SharperProfile launcher (Linux) — 2026-09-28.
#
# Run from a terminal:  chmod +x start.sh && ./start.sh
#
# Linux has no universal "double-click a script you just downloaded and it
# runs" convention the way Windows (.bat) and macOS (.command) do — most
# file managers either require enabling "allow executing" per file/folder,
# or disable it outright for anything that just arrived from a ZIP, for
# good security reasons. Running it from a terminal like this is the
# reliable path on any distro.
#
# It installs dependencies the first time only, starts the tool, and opens
# your default browser to it once it's actually ready — no manual "now copy
# this localhost link into your browser" step.

cd "$(dirname "$0")" || exit 1

have_curl() { command -v curl >/dev/null 2>&1; }

server_is_up() {
  have_curl && curl -s -o /dev/null -m 1 http://localhost:3001
}

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3001 >/dev/null 2>&1 &
  else
    echo "Couldn't find a way to open your browser automatically - open this yourself:"
    echo "  http://localhost:3001"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed, or isn't on your PATH."
  echo "Install it from https://nodejs.org (choose the \"LTS\" version), then run this script again."
  echo ""
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
    exit 1
  fi
fi

# If SharperProfile is already running (e.g. this script was run twice),
# just open it instead of trying to start a second copy, which would fail
# with a port-already-in-use error.
if server_is_up; then
  echo "SharperProfile is already running - opening it in your browser."
  open_browser
  exit 0
fi

echo ""
echo "Starting SharperProfile... your browser will open automatically once it's ready."
echo "Press Ctrl+C in this window to stop SharperProfile when you're done."
echo ""

# Opens the browser the moment the server actually responds, instead of
# guessing a fixed delay. Falls back to a fixed 5-second wait if curl isn't
# available, rather than never opening.
(
  if have_curl; then
    for _ in $(seq 1 60); do
      if server_is_up; then
        open_browser
        exit 0
      fi
      sleep 1
    done
  else
    sleep 5
    open_browser
  fi
) &

npm run dev
