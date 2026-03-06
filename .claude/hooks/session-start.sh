#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "🚀 SessionStart hook: Setting up jules-command environment..."

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install bws CLI if not already installed
if ! command -v bws &> /dev/null; then
  echo "🔐 Installing Bitwarden Secrets Manager CLI..."

  # Download bws v2.0.0 for Linux x86_64
  BWS_VERSION="2.0.0"
  curl -fsSL "https://github.com/bitwarden/sdk-sm/releases/download/bws-v${BWS_VERSION}/bws-x86_64-unknown-linux-gnu-${BWS_VERSION}.zip" -o /tmp/bws.zip

  # Unzip and install
  unzip -q /tmp/bws.zip -d /tmp/
  mkdir -p ~/.local/bin
  mv /tmp/bws ~/.local/bin/bws
  chmod +x ~/.local/bin/bws
  rm /tmp/bws.zip

  # Add to PATH
  export PATH="$HOME/.local/bin:$PATH"

  echo "✅ bws CLI v${BWS_VERSION} installed to ~/.local/bin/bws"
fi

# Fetch secrets from Bitwarden if BWS_ACCESS_TOKEN is set
if [ -n "${BWS_ACCESS_TOKEN:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "🔑 Fetching secrets from Bitwarden Secrets Manager..."

  # Fetch GITHUB_TOKEN
  if [ -n "${BWS_GITHUB_SECRET_ID:-}" ]; then
    echo "  → Fetching GITHUB_TOKEN..."
    GITHUB_TOKEN=$(bws secret get "$BWS_GITHUB_SECRET_ID" --access-token "$BWS_ACCESS_TOKEN" 2>/dev/null | grep -oP '(?<=value: ).*' || echo "")

    if [ -n "$GITHUB_TOKEN" ]; then
      echo "export GITHUB_TOKEN=\"$GITHUB_TOKEN\"" >> "$CLAUDE_ENV_FILE"
      echo "  ✅ GITHUB_TOKEN exported"
    else
      echo "  ⚠️  Failed to fetch GITHUB_TOKEN from BWS"
    fi
  fi

  # Fetch JULES_API_KEY
  if [ -n "${BWS_JULES_API_KEY_ID:-}" ]; then
    echo "  → Fetching JULES_API_KEY..."
    JULES_API_KEY=$(bws secret get "$BWS_JULES_API_KEY_ID" --access-token "$BWS_ACCESS_TOKEN" 2>/dev/null | grep -oP '(?<=value: ).*' || echo "")

    if [ -n "$JULES_API_KEY" ]; then
      echo "export JULES_API_KEY=\"$JULES_API_KEY\"" >> "$CLAUDE_ENV_FILE"
      echo "  ✅ JULES_API_KEY exported"
    else
      echo "  ⚠️  Failed to fetch JULES_API_KEY from BWS"
    fi
  fi

  # Export BWS_ACCESS_TOKEN itself for runtime use
  echo "export BWS_ACCESS_TOKEN=\"$BWS_ACCESS_TOKEN\"" >> "$CLAUDE_ENV_FILE"

  # Export secret IDs for runtime use
  if [ -n "${BWS_GITHUB_SECRET_ID:-}" ]; then
    echo "export BWS_GITHUB_SECRET_ID=\"$BWS_GITHUB_SECRET_ID\"" >> "$CLAUDE_ENV_FILE"
  fi

  if [ -n "${BWS_JULES_API_KEY_ID:-}" ]; then
    echo "export BWS_JULES_API_KEY_ID=\"$BWS_JULES_API_KEY_ID\"" >> "$CLAUDE_ENV_FILE"
  fi
else
  echo "⚠️  BWS_ACCESS_TOKEN or CLAUDE_ENV_FILE not set, skipping secret fetch"
fi

echo "✅ SessionStart hook completed successfully"
