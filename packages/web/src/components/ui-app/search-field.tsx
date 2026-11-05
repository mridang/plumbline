'use client';

import type { ReactElement } from 'react';

import { SearchIcon } from '@/components/icons';

/**
 * A search box for narrowing a list on the page as you type. It filters what is
 * already there, so it asks the server for nothing; the parent holds the text.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: Readonly<{
  /** What it searches, read out with the box. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>): ReactElement {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{label}</span>
      <SearchIcon
        size="sm"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
      />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring-flush h-9 w-full rounded-control border border-field bg-surface pr-3 pl-9 text-sm placeholder:text-subtle"
      />
    </label>
  );
}
