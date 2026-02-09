/**
 * StallDetector — rule engine for detecting stalled Jules sessions.
 */

import type { Config } from '../config.js';
import type { SessionRow } from '../db/repositories/session.repo.js';
import type { ActivityRow } from '../db/repositories/activity.repo.js';

export interface StallInfo {
  sessionId: string;
  reason: string;
  ruleId: string;
  detectedAt: string;
  sessionState: string;
  sessionTitle: string | null;
  minutesSinceUpdate: number;
}

export class StallDetector {
  constructor(private config: Config) {}

  detect(session: SessionRow, activities: ActivityRow[]): StallInfo | null {
    const now = Date.now();
    const updatedAt = new Date(session.updatedAt).getTime();
    const ageMinutes = (now - updatedAt) / (1000 * 60);

    // Rule: Plan approval timeout
    if (session.state === 'awaiting_plan_approval' && ageMinutes > this.config.stallPlanApprovalTimeoutMin) {
      return this.makeStall(session, 'plan_approval_timeout', ageMinutes,
        `Plan awaiting approval for ${Math.round(ageMinutes)} min (threshold: ${this.config.stallPlanApprovalTimeoutMin} min)`);
    }

    // Rule: Feedback timeout
    if (session.state === 'awaiting_user_feedback' && ageMinutes > this.config.stallFeedbackTimeoutMin) {
      return this.makeStall(session, 'feedback_timeout', ageMinutes,
        `Jules asked a question ${Math.round(ageMinutes)} min ago, no response (threshold: ${this.config.stallFeedbackTimeoutMin} min)`);
    }

    // Rule: No progress
    if (session.state === 'in_progress') {
      const latestActivity = activities[0]; // assumes sorted desc
      if (latestActivity) {
        const activityAge = (now - new Date(latestActivity.createdAt).getTime()) / (1000 * 60);
        if (activityAge > this.config.stallNoProgressTimeoutMin) {
          return this.makeStall(session, 'no_progress', activityAge,
            `No new activity for ${Math.round(activityAge)} min (threshold: ${this.config.stallNoProgressTimeoutMin} min)`);
        }
      }
    }

    // Rule: Queue timeout
    if (session.state === 'queued') {
      const createdAt = new Date(session.createdAt).getTime();
      const queueMinutes = (now - createdAt) / (1000 * 60);
      if (queueMinutes > this.config.stallQueueTimeoutMin) {
        return this.makeStall(session, 'queue_timeout', queueMinutes,
          `Session stuck in queue for ${Math.round(queueMinutes)} min (threshold: ${this.config.stallQueueTimeoutMin} min)`);
      }
    }

    // Rule: Repeated errors
    const recentActivities = activities.slice(0, this.config.stallConsecutiveErrors);
    const allErrors = recentActivities.every(a =>
      a.hasBashOutput && a.progressDescription?.includes('Exit Code: 1')
    );
    if (allErrors && recentActivities.length >= this.config.stallConsecutiveErrors) {
      return this.makeStall(session, 'repeated_errors', ageMinutes,
        `Last ${this.config.stallConsecutiveErrors} activities had bash errors`);
    }

    return null;
  }

  private makeStall(
    session: SessionRow,
    ruleId: string,
    minutesSinceUpdate: number,
    reason: string,
  ): StallInfo {
    return {
      sessionId: session.id,
      reason,
      ruleId,
      detectedAt: new Date().toISOString(),
      sessionState: session.state,
      sessionTitle: session.title,
      minutesSinceUpdate: Math.round(minutesSinceUpdate),
    };
  }
}
