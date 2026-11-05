import type { ReactElement, ReactNode } from 'react';

/** One fact: what it is and its value. */
export interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

/** Facts as a definition list: the label above or beside its value. */
export function KeyValue({
  facts,
}: Readonly<{ facts: readonly Fact[] }>): ReactElement {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="font-medium text-subtle">{fact.label}</dt>
          <dd className="min-w-0 wrap-break-word">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
