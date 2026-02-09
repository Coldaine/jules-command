# Database & Schema

[← Back to Architecture](./architecture.md)

## Engine

SQLite via `better-sqlite3` with `drizzle-orm` for type-safe queries and migrations. Single-file database at `$DATABASE_PATH` (default `./data/jules-command.db`).

## Tables

### `repos`

Tracks GitHub repositories connected to Jules.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | `owner/name` |
| `owner` | TEXT | NOT NULL | GitHub owner |
| `name` | TEXT | NOT NULL | Repo name |
| `full_name` | TEXT | NOT NULL UNIQUE | `owner/name` |
| `description` | TEXT | | Repo description |
| `default_branch` | TEXT | | e.g. `main` |
| `primary_language` | TEXT | | Primary language |
| `stars` | INTEGER | | Star count |
| `is_private` | BOOLEAN | | |
| `jules_source_name` | TEXT | | `sources/github/owner/repo` |
| `jules_connected` | BOOLEAN | DEFAULT FALSE | Jules app installed |
| `synced_at` | TEXT (ISO) | | Last GitHub sync |
| `created_at` | TEXT (ISO) | DEFAULT NOW | |

### `jules_sessions`

Every Jules task/session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | Jules session ID |
| `title` | TEXT | | Session title |
| `prompt` | TEXT | NOT NULL | Initial prompt |
| `repo_id` | TEXT | FK → repos.id | NULL for repoless |
| `source_branch` | TEXT | | Starting branch |
| `state` | TEXT | NOT NULL | SessionState enum |
| `automation_mode` | TEXT | | `AUTO_CREATE_PR` / `UNSPECIFIED` |
| `require_plan_approval` | BOOLEAN | | |
| `plan_json` | TEXT | | JSON of plan steps |
| `plan_approved_at` | TEXT | | |
| `jules_url` | TEXT | | Web app URL |
| `pr_url` | TEXT | | Output PR URL |
| `pr_title` | TEXT | | |
| `error_reason` | TEXT | | Failure info |
| `stall_detected_at` | TEXT | | When stall detected |
| `stall_reason` | TEXT | | Stall classification |
| `created_at` | TEXT | NOT NULL | API createTime |
| `updated_at` | TEXT | NOT NULL | API updateTime |
| `completed_at` | TEXT | | Terminal state timestamp |
| `last_polled_at` | TEXT | | |

### `jules_activities`

Individual activities within sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | Activity ID |
| `session_id` | TEXT | FK NOT NULL | |
| `type` | TEXT | NOT NULL | Discriminator |
| `originator` | TEXT | | `user`/`agent`/`system` |
| `message` | TEXT | | Message body |
| `plan_step_count` | INTEGER | | For planGenerated |
| `progress_title` | TEXT | | For progressUpdated |
| `progress_description` | TEXT | | |
| `has_changeset` | BOOLEAN | DEFAULT FALSE | |
| `has_bash_output` | BOOLEAN | DEFAULT FALSE | |
| `has_media` | BOOLEAN | DEFAULT FALSE | |
| `files_changed` | INTEGER | | From changeset |
| `lines_added` | INTEGER | | |
| `lines_deleted` | INTEGER | | |
| `created_at` | TEXT | NOT NULL | |

### `pr_reviews`

PR lifecycle tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `pr_url` | TEXT | NOT NULL UNIQUE | |
| `pr_number` | INTEGER | NOT NULL | |
| `repo_id` | TEXT | FK → repos.id | |
| `session_id` | TEXT | FK → jules_sessions.id | |
| `pr_title` | TEXT | | |
| `pr_description` | TEXT | | |
| `pr_state` | TEXT | | `open`/`closed`/`merged` |
| `review_status` | TEXT | DEFAULT 'pending' | |
| `complexity_score` | REAL | | 0.0–1.0 |
| `complexity_details` | TEXT | | JSON breakdown |
| `lines_changed` | INTEGER | | |
| `files_changed` | INTEGER | | |
| `test_files_changed` | INTEGER | | |
| `critical_files_touched` | BOOLEAN | DEFAULT FALSE | |
| `ci_status` | TEXT | | `pending`/`success`/`failure` |
| `auto_merge_eligible` | BOOLEAN | DEFAULT FALSE | |
| `auto_merge_reason` | TEXT | | |
| `review_notes` | TEXT | | |
| `pr_created_at` | TEXT | | |
| `first_seen_at` | TEXT | DEFAULT NOW | |
| `last_checked_at` | TEXT | | |
| `merged_at` | TEXT | | |

### `poll_cursors`

Polling state tracking per entity.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | Entity ID |
| `poll_type` | TEXT | NOT NULL | `session`/`activities`/`pr` |
| `last_poll_at` | TEXT | | |
| `last_activity_seen_at` | TEXT | | Activity cursor |
| `last_page_token` | TEXT | | Pagination |
| `poll_count` | INTEGER | DEFAULT 0 | |
| `consecutive_unchanged` | INTEGER | DEFAULT 0 | Stall signal |
| `error_count` | INTEGER | DEFAULT 0 | Backoff |
| `last_error` | TEXT | | |

## Indexes

```sql
CREATE INDEX idx_repos_jules_connected ON repos(jules_connected);
CREATE INDEX idx_sessions_state ON jules_sessions(state);
CREATE INDEX idx_sessions_repo_id ON jules_sessions(repo_id);
CREATE INDEX idx_sessions_created_at ON jules_sessions(created_at);
CREATE INDEX idx_activities_session_id ON jules_activities(session_id);
CREATE INDEX idx_activities_type ON jules_activities(type);
CREATE INDEX idx_activities_created_at ON jules_activities(created_at);
CREATE INDEX idx_pr_reviews_repo_id ON pr_reviews(repo_id);
CREATE INDEX idx_pr_reviews_session_id ON pr_reviews(session_id);
CREATE INDEX idx_pr_reviews_review_status ON pr_reviews(review_status);
CREATE INDEX idx_pr_reviews_auto_merge ON pr_reviews(auto_merge_eligible);
```

## Complexity Scoring Formula

```
score = 0.25 * norm(lines_changed, 500) +
        0.20 * norm(files_changed, 20) +
        0.25 * critical_file_penalty +
        0.15 * (1 - test_ratio) +
        0.15 * dependency_touch_penalty

norm(x, threshold) = min(x / threshold, 1.0)
critical_file_penalty = 1.0 if any file matches critical patterns
test_ratio = test_files / total_files (capped at 1.0)
dependency_touch_penalty = 1.0 if package.json, lock files, CI configs touched
```

### Critical File Patterns

```
package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
*.config.js, *.config.ts, tsconfig.json
.github/**, .env*, Dockerfile, docker-compose*
```

### Auto-Merge Thresholds (configurable)

| Criterion | Default |
|-----------|---------|
| Max complexity score | 0.3 |
| Max lines changed | 200 |
| Max files changed | 5 |
| Critical files touched | false |
| CI status | success |
| Min PR age (hours) | 2 |
