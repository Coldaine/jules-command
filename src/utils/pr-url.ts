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

  const [, owner, repo, numberStr] = match;

  return {
    owner: owner!,
    repo: repo!,
    number: Number.parseInt(numberStr!, 10),
  };
}
