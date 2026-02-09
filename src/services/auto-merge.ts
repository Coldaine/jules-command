/**
 * AutoMergeEvaluator — checks whether a PR is eligible for auto-merge.
 */

import type { Config } from '../config.js';
import type { PrReviewRow } from '../db/repositories/pr-review.repo.js';

export interface AutoMergeResult {
  eligible: boolean;
  reasons: string[];
}

export class AutoMergeEvaluator {
  constructor(private config: Config) {}

  evaluate(pr: PrReviewRow): AutoMergeResult {
    const reasons: string[] = [];

    // Complexity check
    if (pr.complexityScore !== null && pr.complexityScore > this.config.autoMergeMaxComplexity) {
      reasons.push(`complexity_score ${pr.complexityScore} exceeds threshold ${this.config.autoMergeMaxComplexity}`);
    }

    // Lines check
    if (pr.linesChanged !== null && pr.linesChanged > this.config.autoMergeMaxLines) {
      reasons.push(`lines_changed ${pr.linesChanged} exceeds max ${this.config.autoMergeMaxLines}`);
    }

    // Files check
    if (pr.filesChanged !== null && pr.filesChanged > this.config.autoMergeMaxFiles) {
      reasons.push(`files_changed ${pr.filesChanged} exceeds max ${this.config.autoMergeMaxFiles}`);
    }

    // Critical files check
    if (pr.criticalFilesTouched) {
      reasons.push('critical files touched');
    }

    // CI status check
    if (pr.ciStatus !== 'success') {
      reasons.push(`ci_status is '${pr.ciStatus ?? 'unknown'}' (must be 'success')`);
    }

    // Age check
    if (pr.prCreatedAt) {
      const ageHours = (Date.now() - new Date(pr.prCreatedAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < this.config.autoMergeMinAgeHours) {
        reasons.push(`pr_age ${ageHours.toFixed(1)}h below minimum ${this.config.autoMergeMinAgeHours}h`);
      }
    } else {
      reasons.push('pr_created_at unknown — cannot verify age');
    }

    // Review status check
    if (pr.reviewStatus === 'changes_requested') {
      reasons.push('review status is changes_requested');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }
}
