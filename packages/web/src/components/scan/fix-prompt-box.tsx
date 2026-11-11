'use client';

import { useState, type ReactElement } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { fixPrompt, hasProblems, type PromptScan } from './fix-prompt';

/** How long "Copied" stays on the button before it goes back to "Copy". */
const CONFIRMATION_MS = 1600;

/**
 * A prompt to paste into a coding assistant to have the scan's problems fixed,
 * in a large read-only box with a Copy button. Draws nothing when nothing
 * failed or warned.
 */
export function FixPromptBox({
  scan,
  repository,
}: Readonly<{
  scan: PromptScan;
  /** `owner/name` of the project that serves the site, when known. */
  repository?: string;
}>): ReactElement | null {
  const [copied, setCopied] = useState(false);
  if (!hasProblems(scan.hints)) {
    return null;
  }
  const prompt = fixPrompt(scan, repository);
  return (
    <section aria-labelledby="fix-prompt" className="mt-10">
      <h3 id="fix-prompt" className="text-xl font-semibold">
        Fix these with your coding assistant
      </h3>
      <p className="mt-1 max-w-2xl text-muted">
        Copy this prompt into Claude Code, Cursor, Copilot or any assistant that
        has your project open, and ask it to make the fixes.
      </p>
      <textarea
        readOnly
        aria-label="Prompt for a coding assistant"
        value={prompt}
        rows={14}
        onFocus={(event) => event.currentTarget.select()}
        className="focus-ring mt-4 w-full rounded-control border border-field bg-white p-4 font-mono text-sm"
      />
      <div className="mt-3">
        <Button
          variant="accent"
          onClick={() => {
            // `clipboard` is missing on insecure pages; then there is nothing to confirm.

            void navigator.clipboard?.writeText(prompt).then(() => {
              setCopied(true);
              return setTimeout(() => setCopied(false), CONFIRMATION_MS);
            });
          }}
        >
          {copied ? <CheckIcon size="sm" /> : <CopyIcon size="sm" />}
          {copied ? 'Copied' : 'Copy the prompt'}
        </Button>
      </div>
    </section>
  );
}
