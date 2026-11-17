/** A value with every field, at any depth, optional. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * A test double: an object that carries only the members the code under test
 * reads. The type it stands in for is taken from where it is used, and a
 * member the type does not have is refused.
 */
export function double<T>(value: NoInfer<DeepPartial<T>>): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a double has only the members the code under test reads, which is what makes it a double
  return value as T;
}

/**
 * A test double of a host object, such as a window, a container or a mock,
 * that has members the type does not describe.
 */
export function stub<T>(value: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a stand-in for a host object carries the members the code under test uses, whatever the type says
  return value as T;
}
