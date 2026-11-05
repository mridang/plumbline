import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** The list of domains is the dashboard now: the old address leads there. */
export default function DomainsPage(): never {
  redirect('/dashboard');
}
