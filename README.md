# Jules Command

An MCP (Model Context Protocol) server for orchestrating Google Jules AI coding agents with persistent tracking, stall detection, PR lifecycle management, and auto-merge evaluation.

## What It Does

Jules Command wraps the [Google Jules API](https://jules.google.com) via the official SDK, providing:

- **Session Management** — Create, monitor, and manage Jules coding sessions
- **Persistent State** — SQLite-backed storage for all sessions, activities, and PRs
- **Stall Detection** — Automatic detection of stuck sessions (plan approval timeouts, no progress, queue timeouts)
- **PR Lifecycle** — Track PRs from creation to merge with complexity scoring
- **Auto-Merge Evaluation** — Identify low-risk PRs eligible for automated merging
- **GitHub Integration** — Sync repo metadata, PR status, and execute merges via Octokit

## Quick Start

### Prerequisites

- Node.js 20+
- Google Cloud API key with Jules API access
- GitHub Personal Access Token (repo + pull request scopes)

### Installation

```bash
npm install
npm run build
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Required
JULES_API_KEY=your-jules-api-key
GITHUB_TOKEN=your-github-pat

# Optional — via Bitwarden Secrets Manager instead
BWS_ACCESS_TOKEN=your-bws-token
BWS_GITHUB_SECRET_ID=your-secret-id

# Database (default: ./data/jules-command.db)
DB_PATH=./data/jules-command.db
```

### Running

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start

# Run database migrations
npm run db:migrate
```

## Usage

Jules Command exposes 18+ MCP tools for integration with MCP clients (Claude Desktop, Claude Code, etc.):

### Jules-Native Tools

| Tool | Description |
|------|-------------|
| `jules_create_session` | Create a new Jules task |
| `jules_sessions_list` | List sessions with filtering |
| `jules_session_get` | Get detailed session info |
| `jules_activities_list` | Get activities for a session |
| `jules_approve_plan` | Approve a pending plan |
| `jules_send_message` | Send a message to Jules |
| `jules_get_diff` | Get code diff for a session |
| `jules_get_bash_outputs` | Get bash command outputs |

### Orchestration Tools

| Tool | Description |
|------|-------------|
| `jules_dashboard` | Comprehensive status dashboard |
| `jules_status` | Quick compact status |
| `jules_poll` | Sync all active sessions to DB |
| `jules_detect_stalls` | Analyze sessions for stall patterns |
| `jules_repo_sync` | Sync GitHub repo metadata |
| `pr_review_status` | Get PR review tracking |
| `pr_update_review` | Update PR review status |
| `pr_check_auto_merge` | Evaluate auto-merge eligibility |
| `pr_merge` | Merge an approved PR |

See [docs/mcp-tools.md](docs/mcp-tools.md) for complete tool documentation.

## Development

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run typecheck
```

### Project Structure

```
src/
├── index.ts              # MCP server entry point
├── config.ts             # Environment configuration
├── db/                   # Database schema, migrations, repositories
├── mcp/                  # MCP server and tool handlers
├── services/             # Business logic (Jules, GitHub, stall detection, etc.)
├── types/                # Shared TypeScript types
└── utils/                # Utilities (PR URL parser, etc.)

tests/
├── db/                   # Database tests
├── mcp/                  # MCP server/tool tests
├── services/             # Service tests
└── e2e/                  # End-to-end integration tests

docs/
├── architecture.md       # System architecture
├── mcp-tools.md          # Tool reference
├── database.md           # Schema documentation
├── github-integration.md # GitHub service docs
└── ...
```

## Architecture

```
┌─────────────────────────────────────────┐
│           MCP Client                    │
│     (Claude Desktop / Claude Code)      │
└──────────────┬──────────────────────────┘
               │ MCP (stdio/SSE)
               ▼
┌─────────────────────────────────────────┐
│        JULES COMMAND MCP SERVER         │
│                                         │
│  ┌──────────┐  ┌──────────────┐        │
│  │  Tools   │  │   Services   │        │
│  │ (18+)    │──│              │        │
│  └──────────┘  │ JulesService │        │
│                │ GitHubService│        │
│                │ PollManager  │        │
│                │ StallDetect  │        │
│                └──────┬───────┘        │
└───────────────────────┼─────────────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
     Jules API     GitHub API   SQLite DB
     (SDK)         (Octokit)
```

See [docs/architecture.md](docs/architecture.md) for detailed design documentation.

## Safety & Security

- **No raw SQL exposure** — All queries use parameterized statements via Drizzle ORM
- **Destructive operation gates** — `pr_merge` requires explicit confirmation and auto-merge eligibility
- **Secrets management** — GitHub tokens can be loaded from Bitwarden Secrets Manager
- **Schema validation** — Zod schemas enforce type safety on all tool inputs

## License

MIT
