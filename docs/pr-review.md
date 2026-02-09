# PR Review & Auto-Merge

[← Back to Architecture](./architecture.md)

## PR Lifecycle

```
Jules Session Completes
    │
    ▼
PR Created on GitHub
    │
    ▼
Detected by PollManager → INSERT pr_reviews (review_status = 'pending')
    │
    ▼
GitHub Sync → Update ci_status, files_changed, lines_changed
    │
    ▼
Complexity Scored → complexity_score computed
    │
    ▼
Auto-Merge Evaluated → auto_merge_eligible computed
    │
    ├─ eligible ──► Age Check ──► Merge (auto or manual confirm)
    │
    └─ ineligible ──► Human Review Required
                         │
                         ├─ Approved → Merge
                         ├─ Changes Requested → Send feedback to Jules?
                         └─ Closed → Mark closed
```

## Complexity Scoring

### Formula

```
score = w_lines   * norm(lines_changed, T_lines) +
        w_files   * norm(files_changed, T_files) +
        w_crit    * critical_penalty +
        w_test    * (1 - test_ratio) +
        w_deps    * dependency_penalty
```

### Default Weights & Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `w_lines` | 0.25 | Weight for lines changed |
| `w_files` | 0.20 | Weight for files changed |
| `w_crit` | 0.25 | Weight for critical files |
| `w_test` | 0.15 | Weight for test coverage |
| `w_deps` | 0.15 | Weight for dependency changes |
| `T_lines` | 500 | Lines threshold for normalization |
| `T_files` | 20 | Files threshold for normalization |

### Interpretation

| Score Range | Label | Suggested Action |
|-------------|-------|------------------|
| 0.0 – 0.2 | Trivial | Auto-merge candidate |
| 0.2 – 0.4 | Low | Quick review → merge |
| 0.4 – 0.6 | Medium | Standard review |
| 0.6 – 0.8 | High | Careful review |
| 0.8 – 1.0 | Critical | Deep review required |

## Auto-Merge Criteria

All criteria must be met:

| Criterion | Check | Default |
|-----------|-------|---------|
| Complexity | `complexity_score < max_score` | < 0.3 |
| Lines | `lines_changed <= max_lines` | ≤ 200 |
| Files | `files_changed <= max_files` | ≤ 5 |
| Critical files | `critical_files_touched == false` | false |
| CI | `ci_status == 'success'` | required |
| Age | `pr_age_hours >= min_age` | ≥ 2h |
| Reviews | No `changes_requested` reviews | required |

### Reason Strings

When not eligible, the evaluator returns specific reasons:

```
"complexity_score 0.45 exceeds threshold 0.3"
"lines_changed 350 exceeds max 200"
"critical files touched: package.json, .github/workflows/ci.yml"
"ci_status is 'failure'"
"pr_age 0.5h below minimum 2h"
```

## Review Challenge Questions

When Jules completes a task, the zo computer (or human) should consider:

1. **Does the PR match the original prompt?** — Compare session prompt vs PR diff.
2. **Are there unintended side effects?** — Files changed that weren't mentioned in the task.
3. **Are tests adequate?** — test_ratio check, are new functions covered?
4. **Does it follow project conventions?** — AGENTS.md compliance.
5. **Are there security concerns?** — Hardcoded secrets, unsafe patterns.
6. **Is the change minimal?** — Could it be simpler / smaller scope?
