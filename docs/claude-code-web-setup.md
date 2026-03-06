# Claude Code on the Web Setup

This repository is configured to work seamlessly with **Claude Code on the web** through automated SessionStart hooks that install dependencies and fetch secrets.

## How It Works

When you open this repository in Claude Code on the web, the SessionStart hook (`.claude/hooks/session-start.sh`) automatically:

1. ✅ Installs npm dependencies (`npm install`)
2. ✅ Installs Bitwarden Secrets Manager CLI (`bws`)
3. ✅ Fetches API keys and tokens from Bitwarden Secrets Manager
4. ✅ Exports secrets to the session environment

## Required Secrets Configuration

### Step 1: Set up secrets in Bitwarden Secrets Manager

Store these secrets in your Bitwarden Secrets Manager vault:

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `JULES_API_KEY` | Google Cloud API key with Jules API access | ✅ Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token (repo + PR scopes) | ✅ Yes |

### Step 2: Configure environment variables

Before starting a Claude Code on the web session, you need to provide these environment variables. You can set them in `.claude/settings.local.json` (not committed to git):

```json
{
  "env": {
    "BWS_ACCESS_TOKEN": "your-bitwarden-access-token-here",
    "BWS_GITHUB_SECRET_ID": "your-github-secret-id-from-bitwarden",
    "BWS_JULES_API_KEY_ID": "your-jules-api-key-id-from-bitwarden"
  }
}
```

**Important:** Only `BWS_ACCESS_TOKEN` and the secret IDs need to be configured. The actual `JULES_API_KEY` and `GITHUB_TOKEN` values are automatically fetched by the SessionStart hook.

### Step 3: Start your session

That's it! When you start a Claude Code on the web session:
- The hook runs automatically
- Dependencies get installed
- Secrets are fetched from Bitwarden and loaded into the environment
- You can immediately run tests, build, and use all MCP tools

## Local Development

For local development, you can skip the hook by using a standard `.env` file:

```bash
cp .env.example .env
# Edit .env with your actual values
```

The SessionStart hook **only runs in Claude Code on the web** (when `CLAUDE_CODE_REMOTE=true`), so your local workflow is unaffected.

## Hook Execution Mode

The SessionStart hook runs **synchronously** (blocking):

### Pros ✅
- Guarantees all dependencies and secrets are ready before your session starts
- No race conditions where Claude tries to run tests/linters before they're installed
- Predictable environment setup

### Cons ⚠️
- Your remote session will start ~10-15 seconds slower (time to install deps + fetch secrets)
- If the hook fails, the session won't start

### Switching to Async Mode

If you prefer faster session startup and are okay with a brief delay before tests/linters work, you can make the hook async by adding this line at the top of `.claude/hooks/session-start.sh`:

```bash
echo '{"async": true, "asyncTimeout": 300000}'
```

## Secrets Management Pattern for All Coldaine Personal Projects

This pattern is **recommended for all personal projects** under the Coldaine organization:

1. **Store secrets in Bitwarden Secrets Manager** (encrypted, centralized)
2. **Only expose one secret per session:** `BWS_ACCESS_TOKEN`
3. **SessionStart hook fetches everything else** automatically
4. **No secrets committed to git** (only `.env.example` templates)

### Benefits

- **Single point of configuration:** Update secrets in Bitwarden once, works everywhere
- **Secure:** Secrets never committed to git, only fetched at runtime
- **Automated:** Works in both Claude Code on the web and local dev environments
- **Consistent:** Same pattern across all projects makes setup predictable

## Troubleshooting

### Hook fails to install bws CLI

If you see errors about downloading the bws CLI, check:
- Network connectivity in the container
- GitHub releases availability: https://github.com/bitwarden/sdk-sm/releases

### Secrets not loading

If `JULES_API_KEY` or `GITHUB_TOKEN` are not available after session start:
1. Check that `BWS_ACCESS_TOKEN` is set in `.claude/settings.local.json`
2. Verify the secret IDs (`BWS_GITHUB_SECRET_ID`, `BWS_JULES_API_KEY_ID`) are correct
3. Test locally: `bws secret get <secret-id> --access-token <token>`

### Hook takes too long

The first session will take longer (~15-20 seconds) as npm installs all dependencies. Subsequent sessions will be faster due to container layer caching.

## Files

- `.claude/hooks/session-start.sh` — SessionStart hook script
- `.claude/settings.json` — Hook registration config
- `.env.example` — Environment variable template
- `docs/claude-code-web-setup.md` — This documentation
