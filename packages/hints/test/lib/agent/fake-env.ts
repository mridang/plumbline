import type { DnsRecord } from '../../../src/core/dns.js';
import type { AgentEnv, Probe } from '../../../src/lib/agent/types.js';

/** What a fake path answers; defaults mirror a plain 200 text response. */
export type FakeRoute = Partial<Omit<Probe, 'url'>> | string | object;

/**
 * Builds an environment whose probes are answered from a table. A string
 * becomes a text body, an object a JSON body, and unknown paths fail like
 * an unreachable URL (null). `dnsAnswers` maps `TYPE name` to record data.
 */
export function fakeEnv(
  routes: Partial<Record<string, FakeRoute>> = {},
  options: {
    origin?: string;
    dnsAnswers?: Record<string, string[]>;
    evaluate?: NonNullable<AgentEnv['evaluate']>;
    /** Answer for every path not in `routes` (default: unreachable). */
    fallback?: FakeRoute;
  } = {},
): AgentEnv {
  const origin = options.origin ?? 'https://example.com';
  return {
    origin,
    host: new URL(origin).hostname,
    async probe(path, headers = {}) {
      const key = headers.accept ? `${path} ${headers.accept}` : path;
      const route = routes[key] ?? routes[path] ?? options.fallback;
      if (route === undefined) {
        return null;
      }
      const isProbe =
        typeof route === 'object' &&
        ('status' in route || 'body' in route || 'contentType' in route);
      if (typeof route === 'string') {
        return {
          url: path,
          status: 200,
          headers: {},
          contentType: 'text/plain',
          body: route,
        };
      }
      if (!isProbe) {
        return {
          url: path,
          status: 200,
          headers: {},
          contentType: 'application/json',
          body: JSON.stringify(route),
        };
      }
      const given = route as Partial<Probe>;
      return {
        url: path,
        status: given.status ?? 200,
        headers: given.headers ?? {},
        contentType: given.contentType ?? 'text/plain',
        body: given.body ?? '',
      };
    },
    dns: {
      async query(name, type) {
        const data = options.dnsAnswers?.[`${type} ${name}`] ?? [];
        const answers: DnsRecord[] = data.map((d) => ({
          name,
          type: 0,
          ttl: 60,
          data: d,
        }));
        return { status: 0, authenticated: false, answers, authority: [] };
      },
    },
    evaluate: options.evaluate,
  };
}

/** Copy of an object without one key (to build "missing field" cases). */
export function without<T extends object>(value: T, key: keyof T): object {
  return Object.fromEntries(
    Object.entries(value).filter(([k]) => k !== String(key)),
  );
}
