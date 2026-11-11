/**
 * A stand-in for the `cloudflare:workers` runtime module, which only exists
 * inside the Workers runtime. A test that loads a Durable Object registers it
 * before the dynamic import:
 *
 *   jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
 *     virtual: true,
 *   } as never);.
 */
class DurableObject {
  constructor(
    protected ctx: unknown,
    protected env: unknown,
  ) {}
}

/** The module factory for `jest.unstable_mockModule`. */
export const cloudflareWorkersStub = (): {
  DurableObject: typeof DurableObject;
} => ({ DurableObject });
