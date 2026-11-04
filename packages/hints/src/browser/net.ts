/**
 * @packageDocumentation
 *
 * `node:net` for a browser: telling addresses apart works, connecting refuses
 * (see `refusals.ts`).
 */

import { refuse } from './refusals.js';

const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Whether `value` is an IPv4 address, as Node's `isIPv4`. */
export function isIPv4(value: string): boolean {
  return IPV4.test(value);
}

/** Whether `value` is an IPv6 address, as Node's `isIPv6`. */
export function isIPv6(value: string): boolean {
  if (!value.includes(':') || /[^0-9a-f:.%]/i.test(value.split('%')[0] ?? '')) {
    return false;
  }
  try {
    return new URL(`http://[${value.split('%')[0]}]/`).hostname !== '';
  } catch {
    return false;
  }
}

/** 4, 6 or 0 for an IPv4 address, an IPv6 address or neither, as Node's `isIP`. */
export function isIP(value: string): 0 | 4 | 6 {
  if (isIPv4(value)) {
    return 4;
  }
  return isIPv6(value) ? 6 : 0;
}

/** Refuses: a browser cannot open a raw TCP connection. */
export function connect(): never {
  return refuse('socket', 'open a raw TCP connection');
}
