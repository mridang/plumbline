import { GitHubApi } from '@/domain/github/api';

/** One request the fake GitHub received. */
export interface Request {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

/**
 * A GitHub that records what it is asked. `answers` maps "METHOD /path-start"
 * to the status (or status and JSON body) to answer with; a request nobody
 * answers for gets an ordinary success, and a new issue gets the next number
 * from `firstNumber`.
 */
export function github(
  answers: Record<string, number | [number, unknown]> = {},
  firstNumber = 21,
) {
  const requests: Request[] = [];
  let next = firstNumber;
  const api = new GitHubApi('tok', (async (
    input: unknown,
    init?: RequestInit,
  ) => {
    const method = init?.method ?? 'GET';
    const path = String(input).replace('https://api.github.com', '');
    requests.push({
      method,
      path,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    const key = Object.keys(answers).find((k) =>
      `${method} ${path}`.startsWith(k),
    );
    if (key) {
      const answer = answers[key]!;
      const [status, body] = typeof answer === 'number' ? [answer, {}] : answer;
      return Response.json(body, { status });
    }
    if (method === 'GET') {
      return Response.json([]);
    }
    if (method === 'POST' && path.endsWith('/issues')) {
      const number = next;
      next += 1;
      return Response.json({ id: number, number, state: 'open' });
    }
    return Response.json({ id: 1, number: 21, state: 'open' });
  }) as typeof fetch);
  return { api, requests };
}

/** The requests as "METHOD /path" lines. */
export const lines = (requests: Request[]): string[] =>
  requests.map((r) => `${r.method} ${r.path}`);

/** The text of the comments made. */
export const said = (requests: Request[]): string[] =>
  requests
    .filter((r) => r.path.endsWith('/comments'))
    .map((r) => String(r.body['body']));
