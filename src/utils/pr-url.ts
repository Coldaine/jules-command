export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
}

export function parsePrUrl(url: string): ParsedPrUrl {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/.exec(url.trim());
  if (!match) {
    throw new Error(`Invalid GitHub PR URL: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2],
    number: Number.parseInt(match[3], 10),
  };
}
