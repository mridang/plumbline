/**
 * @packageDocumentation
 *
 * Entry point of the report View: the file `scripts/build-views.mjs` bundles
 * into the report's HTML. It only mounts {@link ReportApp}; the View itself is
 * in `report-view.tsx`, which can be imported (and tested) without a document.
 */

import { createRoot } from 'react-dom/client';

import { ReportApp } from '@/views/report-view';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ReportApp />);
}
