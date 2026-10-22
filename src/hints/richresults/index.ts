import type { HintDefinition } from '../../core/define-hint.js';
import richresultsRecipe from './richresults-recipe.js';
import richresultsProduct from './richresults-product.js';
import richresultsArticle from './richresults-article.js';
import richresultsBreadcrumb from './richresults-breadcrumb.js';
import richresultsEvent from './richresults-event.js';
import richresultsVideo from './richresults-video.js';
import richresultsJobposting from './richresults-jobposting.js';
import richresultsLocalbusiness from './richresults-localbusiness.js';
import richresultsReview from './richresults-review.js';
import richresultsWebsiteSearchaction from './richresults-website-searchaction.js';

/** Hints of the `richresults` set. */
export const richresultsHints: readonly HintDefinition[] = [
  richresultsRecipe,
  richresultsProduct,
  richresultsArticle,
  richresultsBreadcrumb,
  richresultsEvent,
  richresultsVideo,
  richresultsJobposting,
  richresultsLocalbusiness,
  richresultsReview,
  richresultsWebsiteSearchaction,
];
