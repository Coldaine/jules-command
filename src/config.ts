import { z } from 'zod';

const configSchema = z.object({
  julesApiKey: z.string().min(1, 'JULES_API_KEY is required'),
  githubToken: z.string().optional(),
  bwsAccessToken: z.string().optional(),
  bwsGithubSecretId: z.string().optional(),
  databasePath: z.string().default('./data/jules-command.db'),

  // Polling
  pollingIntervalMs: z.number().default(5000),
  pollDelayBetweenSessionsMs: z.number().default(100),

  // Stall detection thresholds (minutes)
  stallPlanApprovalTimeoutMin: z.number().default(30),
  stallFeedbackTimeoutMin: z.number().default(30),
  stallNoProgressTimeoutMin: z.number().default(15),
  stallQueueTimeoutMin: z.number().default(10),
  stallConsecutiveErrors: z.number().default(3),

  // PR auto-merge thresholds
  autoMergeMaxComplexity: z.number().default(0.3),
  autoMergeMaxLines: z.number().default(200),
  autoMergeMaxFiles: z.number().default(5),
  autoMergeMinAgeHours: z.number().default(2),

  // Complexity scoring thresholds
  complexityLinesThreshold: z.number().default(500),
  complexityFilesThreshold: z.number().default(20),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    julesApiKey: process.env['JULES_API_KEY'],
    githubToken: process.env['GITHUB_TOKEN'],
    bwsAccessToken: process.env['BWS_ACCESS_TOKEN'],
    bwsGithubSecretId: process.env['BWS_GITHUB_SECRET_ID'],
    databasePath: process.env['DATABASE_PATH'] ?? './data/jules-command.db',

    pollingIntervalMs: parseOptionalInt(process.env['POLLING_INTERVAL_MS']),
    pollDelayBetweenSessionsMs: parseOptionalInt(process.env['POLL_DELAY_BETWEEN_SESSIONS_MS']),

    stallPlanApprovalTimeoutMin: parseOptionalInt(process.env['STALL_PLAN_APPROVAL_TIMEOUT_MIN']),
    stallFeedbackTimeoutMin: parseOptionalInt(process.env['STALL_FEEDBACK_TIMEOUT_MIN']),
    stallNoProgressTimeoutMin: parseOptionalInt(process.env['STALL_NO_PROGRESS_TIMEOUT_MIN']),
    stallQueueTimeoutMin: parseOptionalInt(process.env['STALL_QUEUE_TIMEOUT_MIN']),
    stallConsecutiveErrors: parseOptionalInt(process.env['STALL_CONSECUTIVE_ERRORS']),

    autoMergeMaxComplexity: parseOptionalFloat(process.env['AUTO_MERGE_MAX_COMPLEXITY']),
    autoMergeMaxLines: parseOptionalInt(process.env['AUTO_MERGE_MAX_LINES']),
    autoMergeMaxFiles: parseOptionalInt(process.env['AUTO_MERGE_MAX_FILES']),
    autoMergeMinAgeHours: parseOptionalFloat(process.env['AUTO_MERGE_MIN_AGE_HOURS']),

    complexityLinesThreshold: parseOptionalInt(process.env['COMPLEXITY_LINES_THRESHOLD']),
    complexityFilesThreshold: parseOptionalInt(process.env['COMPLEXITY_FILES_THRESHOLD']),
  });
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
}
