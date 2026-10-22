import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-recipe.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-recipe', () => {
  it('does nothing when no Recipe node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors when a Recipe is missing required name and image', async () => {
    const problems = await runHint(hint, page({ '@type': 'Recipe' }));
    const errors = problems.filter((p) => p.severity === Severity.error);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain('Recipe');
  });

  it('passes a complete Recipe', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'Recipe',
          name: 'Pie',
          image: 'p.jpg',
          recipeIngredient: ['flour'],
          recipeInstructions: ['bake'],
        }),
      ),
    ).toEqual([]);
  });
});
