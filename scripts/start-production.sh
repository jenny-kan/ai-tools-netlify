#!/bin/sh
# Start the standalone production server (run `pnpm build` first).
#
# Why this wrapper exists: Next.js's `.next/standalone/server.js` is a plain
# Node process and does NOT read `.env` files. `next start` refuses to serve a
# standalone build ("next start does not work with output: standalone").
# This script gives `pnpm start` the same ergonomics as `next start`:
#
#   1. exports every KEY="value" from .env (when present) into the environment
#   2. execs the standalone server, which honours PORT and HOSTNAME
#
# Usage:
#   pnpm build && pnpm start          # http://localhost:3000
#   PORT=8080 pnpm start              # different port
#
# Works on macOS and Linux (POSIX sh). Platform-hosted deployments
# (Railway/Render/…) can keep using it — platform env vars are already set
# and the .env file is simply absent there, so step 1 is skipped.
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ -f "$DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$DIR/.env"
  set +a
fi

if [ ! -f "$DIR/.next/standalone/server.js" ]; then
  echo "error: $DIR/.next/standalone/server.js not found." >&2
  echo "       Build first:  pnpm build" >&2
  exit 1
fi

exec node "$DIR/.next/standalone/server.js"
