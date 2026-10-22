import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { jobPostingFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `JobPosting` node in the page's JSON-LD against Google's
 * job-posting rich-results requirements: `title`, `description`, `datePosted`,
 * `hiringOrganization` and `jobLocation` are required (`jobLocation` may be
 * omitted only for a fully remote role declared with `jobLocationType`
 * TELECOMMUTE), and `validThrough` and `baseSalary` are recommended. A page
 * with no JobPosting node reports nothing. Source: Google Job posting rich
 * results.
 */
export default defineHint({
  id: 'richresults-jobposting',
  name: 'JobPosting structured data is valid',
  description:
    'Validates JobPosting JSON-LD (title, description, datePosted, hiringOrganization, jobLocation) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.jobposting,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, jobPostingFindings));
  },
});
