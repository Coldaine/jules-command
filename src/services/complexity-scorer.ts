/**
 * ComplexityScorer — computes PR complexity scores.
 */

import type { Config } from '../config.js';

export interface ComplexityInput {
  linesChanged: number;
  filesChanged: number;
  testFilesChanged: number;
  criticalFilesTouched: boolean;
  dependencyFilesTouched: boolean;
}

export interface ComplexityResult {
  score: number;
  label: string;
  details: {
    linesComponent: number;
    filesComponent: number;
    criticalComponent: number;
    testComponent: number;
    dependencyComponent: number;
  };
}

const WEIGHTS = {
  lines: 0.25,
  files: 0.20,
  critical: 0.25,
  test: 0.15,
  dependency: 0.15,
} as const;

export class ComplexityScorer {
  constructor(private config: Config) {}

  score(input: ComplexityInput): ComplexityResult {
    const linesNorm = Math.min(input.linesChanged / this.config.complexityLinesThreshold, 1.0);
    const filesNorm = Math.min(input.filesChanged / this.config.complexityFilesThreshold, 1.0);
    const criticalPenalty = input.criticalFilesTouched ? 1.0 : 0.0;
    const testRatio = input.filesChanged > 0
      ? Math.min(input.testFilesChanged / input.filesChanged, 1.0)
      : 1.0;
    const depPenalty = input.dependencyFilesTouched ? 1.0 : 0.0;

    const linesComponent = WEIGHTS.lines * linesNorm;
    const filesComponent = WEIGHTS.files * filesNorm;
    const criticalComponent = WEIGHTS.critical * criticalPenalty;
    const testComponent = WEIGHTS.test * (1 - testRatio);
    const dependencyComponent = WEIGHTS.dependency * depPenalty;

    const score = linesComponent + filesComponent + criticalComponent + testComponent + dependencyComponent;

    return {
      score: Math.round(score * 100) / 100,
      label: this.getLabel(score),
      details: {
        linesComponent: Math.round(linesComponent * 100) / 100,
        filesComponent: Math.round(filesComponent * 100) / 100,
        criticalComponent: Math.round(criticalComponent * 100) / 100,
        testComponent: Math.round(testComponent * 100) / 100,
        dependencyComponent: Math.round(dependencyComponent * 100) / 100,
      },
    };
  }

  private getLabel(score: number): string {
    if (score < 0.2) return 'trivial';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'critical';
  }
}
