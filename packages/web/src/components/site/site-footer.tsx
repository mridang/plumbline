import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { SOURCE_URL } from '@/utils/site';

/** The line at the foot of every page: what the checks are built on. */
export function SiteFooter(): ReactElement {
  return (
    <footer className="border-t border-line">
      <Container className="max-w-4xl py-6 text-sm text-subtle">
        Built on{' '}
        <a href="https://webhint.io" className="focus-ring underline">
          webhint
        </a>
        . For the full scan with a browser, run the{' '}
        <a
          href={`${SOURCE_URL}/tree/master/packages/docker`}
          className="focus-ring underline"
        >
          Docker image
        </a>
        .
      </Container>
    </footer>
  );
}
