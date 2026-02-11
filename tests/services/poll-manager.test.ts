import { describe, it, expect, beforeEach } from "vitest";
import { PollManager } from "../../src/services/poll-manager.js";
import { createTestDb } from "../setup.js";
import { SessionRepository } from "../../src/db/repositories/session.repo.js";
import { ActivityRepository } from "../../src/db/repositories/activity.repo.js";
import { PollCursorRepository } from "../../src/db/repositories/poll-cursor.repo.js";
import { JulesService } from "../../src/services/jules.service.js";
import { GitHubService } from "../../src/services/github.service.js";
import type { Config } from "../../src/config.js";

describe("PollManager", () => {
  const defaultConfig: Config = {
    julesApiKey: "test-jules-key",
    databasePath: ":memory:",
    pollingIntervalMs: 5000,
    pollDelayBetweenSessionsMs: 0,
    stallPlanApprovalTimeoutMin: 30,
    stallFeedbackTimeoutMin: 30,
    stallNoProgressTimeoutMin: 15,
    stallQueueTimeoutMin: 10,
    stallConsecutiveErrors: 3,
    autoMergeMaxComplexity: 0.3,
    autoMergeMaxLines: 200,
    autoMergeMaxFiles: 5,
    autoMergeMinAgeHours: 2,
    complexityLinesThreshold: 500,
    complexityFilesThreshold: 20,
  };

  let pollManager: PollManager;
  let sessionRepo: SessionRepository;
  let activityRepo: ActivityRepository;
  let cursorRepo: PollCursorRepository;

  beforeEach(() => {
    const testDb = createTestDb();
    const jules = new JulesService(defaultConfig, testDb.db);
    const github = new GitHubService(defaultConfig, testDb.db);
    pollManager = new PollManager(jules, github, defaultConfig, testDb.db);
    sessionRepo = new SessionRepository(testDb.db);
    activityRepo = new ActivityRepository(testDb.db);
    cursorRepo = new PollCursorRepository(testDb.db);
  });

  async function seedSession(overrides: Record<string, unknown> = {}) {
    return sessionRepo.upsert({
      id: "session-1",
      title: "Test Session",
      prompt: "Fix tests",
      repoId: null,
      sourceBranch: "main",
      state: "in_progress",
      automationMode: null,
      requirePlanApproval: null,
      planJson: null,
      planApprovedAt: null,
      julesUrl: null,
      prUrl: null,
      prTitle: null,
      errorReason: null,
      stallDetectedAt: null,
      stallReason: null,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      lastPolledAt: null,
      ...overrides,
    });
  }

  describe("pollSession", () => {
    it("returns error when session does not exist", async () => {
      const result = await pollManager.pollSession("missing-session");

      expect(result.updated).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.stall).toBeNull();
    });

    it("updates lastPolledAt and cursor poll count", async () => {
      await seedSession();

      const result = await pollManager.pollSession("session-1");
      const updated = await sessionRepo.findById("session-1");
      const cursor = await cursorRepo.findById("session-1");

      expect(result.updated).toBe(true);
      expect(result.error).toBeNull();
      expect(updated?.lastPolledAt).toBeTruthy();
      expect(cursor?.pollType).toBe("session");
      expect(cursor?.pollCount).toBe(1);
    });

    it("increments existing poll cursor", async () => {
      await seedSession();
      await cursorRepo.upsert({
        id: "session-1",
        pollType: "session",
        lastPollAt: new Date(Date.now() - 10000).toISOString(),
        pollCount: 5,
        consecutiveUnchanged: 0,
        errorCount: 0,
      });

      await pollManager.pollSession("session-1");

      const cursor = await cursorRepo.findById("session-1");
      expect(cursor?.pollCount).toBe(6);
    });

    it("detects stalls and persists stall fields on the session", async () => {
      await seedSession({
        state: "awaiting_plan_approval",
        updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      });

      const result = await pollManager.pollSession("session-1");
      const updated = await sessionRepo.findById("session-1");

      expect(result.stall).not.toBeNull();
      expect(result.stall?.ruleId).toBe("plan_approval_timeout");
      expect(updated?.stallDetectedAt).toBeTruthy();
      expect(updated?.stallReason).toContain("Plan awaiting approval");
    });

    it("uses activities to detect no-progress stalls", async () => {
      await seedSession({ state: "in_progress" });
      await activityRepo.insertMany([
        {
          id: "activity-1",
          sessionId: "session-1",
          activityType: "message",
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          content: "Old activity",
          metadata: null,
        },
      ]);

      const result = await pollManager.pollSession("session-1");

      expect(result.stall?.ruleId).toBe("no_progress");
    });
  });

  describe("pollAllActive", () => {
    it("polls only active sessions and returns a summary", async () => {
      await seedSession({ id: "active-1", state: "in_progress" });
      await seedSession({ id: "active-2", state: "queued", updatedAt: new Date().toISOString() });
      await seedSession({ id: "done-1", state: "completed", updatedAt: new Date().toISOString() });

      const summary = await pollManager.pollAllActive();

      expect(summary.sessionsPolled).toBe(2);
      expect(summary.sessionsUpdated).toBe(2);
      expect(summary.prsUpdated).toBe(0);
      expect(summary.errors).toEqual([]);
      expect(Array.isArray(summary.stallsDetected)).toBe(true);
    });

    it("collects stalls from multiple sessions", async () => {
      await seedSession({
        id: "stalled-1",
        state: "awaiting_plan_approval",
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      });
      await seedSession({
        id: "stalled-2",
        state: "queued",
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      });

      const summary = await pollManager.pollAllActive();

      expect(summary.stallsDetected).toHaveLength(2);
      expect(summary.stallsDetected.map(s => s.sessionId).sort()).toEqual(["stalled-1", "stalled-2"]);
    });
  });
});

