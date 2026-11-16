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
  '/api/checks': async () => import('@/app/api/checks/route'),
  '/api/domains': async () => import('@/app/api/domains/route'),
  '/api/domains/{id}': async () => import('@/app/api/domains/[id]/route'),
  '/api/domains/{id}/reports': async () =>
    import('@/app/api/domains/[id]/reports/route'),
  '/api/domains/{id}/reports/{report_id}': async () =>
    import('@/app/api/domains/[id]/reports/[report-id]/route'),
  '/api/domains/{id}/issues': async () =>
    import('@/app/api/domains/[id]/issues/route'),
  '/api/domains/{id}/runs': async () =>
    import('@/app/api/domains/[id]/runs/route'),
  '/api/domains/{id}/runs/{run_id}': async () =>
    import('@/app/api/domains/[id]/runs/[run-id]/route'),
  '/api/github/syncs': async () => import('@/app/api/github/syncs/route'),
  '/api/previews/{id}': async () => import('@/app/api/previews/[id]/route'),
  '/api/push/configuration': async () =>
    import('@/app/api/push/configuration/route'),
  '/api/scans': async () => import('@/app/api/scans/route'),
  '/api/scans/{id}/run': async () => import('@/app/api/scans/[id]/run/route'),
  '/api/sessions': async () => import('@/app/api/sessions/route'),
  '/api/sessions/self': async () => import('@/app/api/sessions/self/route'),
  '/api/users/self': async () => import('@/app/api/users/self/route'),
  '/api/users/self/connections': async () =>
    import('@/app/api/users/self/connections/route'),
  '/api/users/self/connections/{grant_id}': async () =>
    import('@/app/api/users/self/connections/[grant-id]/route'),
  '/api/users/self/github': async () =>
    import('@/app/api/users/self/github/route'),
  '/api/users/self/repositories/disabled/{owner}/{repo}': async () =>
    import('@/app/api/users/self/repositories/disabled/[owner]/[repo]/route'),
  '/api/users/self/push/subscriptions': async () =>
    import('@/app/api/users/self/push/subscriptions/route'),
  '/api/users/self/push/subscriptions/{id}': async () =>
    import('@/app/api/users/self/push/subscriptions/[id]/route'),
  '/api/users/self/push/subscriptions/{id}/tests': async () =>
    import('@/app/api/users/self/push/subscriptions/[id]/tests/route'),
};
