import { describe, it, expect } from 'vitest';
import { parsePrUrl } from '../../src/utils/pr-url.js';

describe('parsePrUrl', () => {
  it('parses a valid PR URL', () => {
    expect(parsePrUrl('https://github.com/openai/codex/pull/123')).toEqual({ owner: 'openai', repo: 'codex', number: 123 });
  });

  it('throws on invalid URL', () => {
    expect(() => parsePrUrl('https://example.com')).toThrow(/Invalid GitHub PR URL/);
  });
});
