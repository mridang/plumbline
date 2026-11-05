import type { ReactElement } from 'react';

/** How many findings fill the bar: more than this and it is full. */
export const BAR_STEPS = 10;

/** The width of a segment of `n` steps. Whole classes, since the page allows no inline style. */
const WIDTHS: readonly string[] = [
  'w-0',
  'w-[10%]',
  'w-[20%]',
  'w-[30%]',
  'w-[40%]',
  'w-[50%]',
  'w-[60%]',
  'w-[70%]',
  'w-[80%]',
  'w-[90%]',
  'w-full',
];

/** How many steps each segment takes: one per finding, red first, until the bar is full. */
export function stepsOf(
  failed: number,
  warned: number,
): { failed: number; warned: number } {
  const failedSteps = Math.min(BAR_STEPS, failed);
  return {
    failed: failedSteps,
    warned: Math.min(BAR_STEPS - failedSteps, warned),
  };
}

/**
 * A thin bar that says how much a site has wrong at a glance: red for what
 * failed, amber for warnings, the rest of the track quiet. Ten findings fill
 * it; a site with none shows a quiet track. Its figures are read out.
 */
export function CountsBar({
  failed,
  warned,
}: Readonly<{ failed: number; warned: number }>): ReactElement {
  const steps = stepsOf(failed, warned);
  return (
    <span
      role="img"
      aria-label={`${failed} failed, ${warned} with warnings`}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-passed/15"
    >
      {steps.failed > 0 ? (
        <span
          className={`bg-failed ${WIDTHS[steps.failed]}`}
          data-segment="failed"
        />
      ) : null}
      {steps.warned > 0 ? (
        <span
          className={`bg-warned ${WIDTHS[steps.warned]}`}
          data-segment="warned"
        />
      ) : null}
    </span>
  );
}
