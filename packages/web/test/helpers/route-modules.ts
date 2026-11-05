/**
 * The modules of the route files under `src/app/api`, by the path each serves,
 * for the test that holds `openapi.json` to them. Each is imported by name, so
 * that nothing is imported from a computed path; the test fails when a route
 * file has no entry here, or an entry has no file. The two routes kept only so
 * that addresses still registered with the GitHub App keep answering are left
 * out: they are not part of the contract.
 */
export const ROUTE_MODULES: Readonly<
  Record<string, () => Promise<Record<string, unknown>>>
> = {
  '/api/checks': () => import('@/app/api/checks/route'),
  '/api/domains': () => import('@/app/api/domains/route'),
  '/api/domains/{id}': () => import('@/app/api/domains/[id]/route'),
  '/api/domains/{id}/reports': () =>
    import('@/app/api/domains/[id]/reports/route'),
  '/api/domains/{id}/reports/{report_id}': () =>
    import('@/app/api/domains/[id]/reports/[report_id]/route'),
  '/api/domains/{id}/issues': () =>
    import('@/app/api/domains/[id]/issues/route'),
  '/api/domains/{id}/runs': () => import('@/app/api/domains/[id]/runs/route'),
  '/api/domains/{id}/runs/{run_id}': () =>
    import('@/app/api/domains/[id]/runs/[run_id]/route'),
  '/api/github/syncs': () => import('@/app/api/github/syncs/route'),
  '/api/previews/{id}': () => import('@/app/api/previews/[id]/route'),
  '/api/push/configuration': () => import('@/app/api/push/configuration/route'),
  '/api/scans': () => import('@/app/api/scans/route'),
  '/api/scans/{id}/run': () => import('@/app/api/scans/[id]/run/route'),
  '/api/sessions': () => import('@/app/api/sessions/route'),
  '/api/sessions/self': () => import('@/app/api/sessions/self/route'),
  '/api/users/self': () => import('@/app/api/users/self/route'),
  '/api/users/self/connections': () =>
    import('@/app/api/users/self/connections/route'),
  '/api/users/self/connections/{grant_id}': () =>
    import('@/app/api/users/self/connections/[grant_id]/route'),
  '/api/users/self/github': () => import('@/app/api/users/self/github/route'),
  '/api/users/self/repositories/hidden/{owner}/{repo}': () =>
    import('@/app/api/users/self/repositories/hidden/[owner]/[repo]/route'),
  '/api/users/self/push/subscriptions': () =>
    import('@/app/api/users/self/push/subscriptions/route'),
  '/api/users/self/push/subscriptions/{id}': () =>
    import('@/app/api/users/self/push/subscriptions/[id]/route'),
  '/api/users/self/push/subscriptions/{id}/tests': () =>
    import('@/app/api/users/self/push/subscriptions/[id]/tests/route'),
};
