/**
 * @packageDocumentation
 *
 * Entry point of the domain list View: the file `scripts/build-views.mjs`
 * bundles into the list's HTML. It only mounts {@link DomainListApp}; the View
 * itself is in `domain-list-view.tsx`, which can be imported (and tested)
 * without a document.
 */

import { createRoot } from 'react-dom/client';

import { DomainListApp } from '@/views/domain-list-view';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<DomainListApp />);
}
