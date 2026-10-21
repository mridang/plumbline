import type { HintDefinition } from '../../core/define-hint.js';
import geoFaqSchema from './geo-faq-schema.js';
import geoSpeakableSchema from './geo-speakable-schema.js';
import geoOrganizationSchema from './geo-organization-schema.js';
import geoContentExtraction from './geo-content-extraction.js';
import geoStructuredDataInvalid from './geo-structured-data-invalid.js';

/** Hints of the `geo` set. */
export const geoHints: readonly HintDefinition[] = [
  geoFaqSchema,
  geoSpeakableSchema,
  geoOrganizationSchema,
  geoContentExtraction,
  geoStructuredDataInvalid,
];
