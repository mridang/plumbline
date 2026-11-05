/**
 * The first name to greet a person with: the first word of their name, or the
 * part of their email address before the `@` when they share no name.
 */
export function firstNameOf(
  person: Readonly<{ name: string | null; email: string }>,
): string {
  const first = person.name?.trim().split(/\s+/)[0];
  return first || person.email.split('@')[0] || person.email;
}
