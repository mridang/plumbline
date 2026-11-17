import { Category, defineHint } from '../../core/define-hint.js'; // eslint-disable-line unicorn/prevent-abbreviations -- file name is the permanent hint id that configs and docs reference
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import {
  domRelationshipLinks,
  headerRelationshipLinks,
} from '../../lib/discovery/links.js';
import { relationshipMeFindings } from '../../lib/discovery/rel-me.js';
import { reportFindings } from '../headers/shared.js';
import type { RelationshipLink } from '../../lib/discovery/links.js';

/**
 * IndieWeb `rel=me`: the page links to the author's other profiles with
 * `rel="me"` so identity can be verified two-way. This hint reports the
 * identity links it finds (in the DOM or the `Link` header) and warns about a
 * `rel=me` link with no target.
 */
export default defineHint({
  id: 'rel-me',
  name: 'rel=me identity links',
  description:
    'Reports rel=me identity links and warns when one has no target (IndieWeb).',
  category: Category.development,
  groups: ['indieweb', 'social'],
  reference: 'https://microformats.org/wiki/rel-me',
  setup(context) {
    onPage(context, (page) => {
      const links: RelationshipLink[] = [
        ...domRelationshipLinks(page.document),
        ...headerRelationshipLinks(headerValue(page.headers, 'link')),
      ];
      reportFindings(page, relationshipMeFindings(links));
    });
  },
});
