import { CHECKS } from './checks.js';
import type { AgentCategory, CheckResult } from './types.js';

/** Categories in report order, with the names isitagentready.com shows. */
const CATEGORY_LABELS: Record<AgentCategory, string> = {
  discoverability: 'Discoverability',
  content: 'Content Accessibility',
  'bot-access': 'Bot Access Control',
  discovery: 'API, Auth, MCP & Skill Discovery',
  commerce: 'Commerce',
};

/**
 * PROVISIONAL category weights. Isitagentready.com does not publish its
 * weights, so these were fitted to one observed scan: chowdown scored
 * Discoverability 50 (2/4), Content 0 (0/1), Bot Access 50 (1/2) and
 * API/Auth/MCP/Skill 13 (1/8), overall 27. The plain mean would be 28.1;
 * 0.25*50 + 0.20*0 + 0.20*50 + 0.35*12.5 = 26.9, which rounds to 27.
 * Commerce counts only when commerce signals are detected; its weight is
 * then added to the others, which are rescaled to keep the result 0-100.
 */
export const CATEGORY_WEIGHTS: Record<AgentCategory, number> = {
  discoverability: 0.25,
  content: 0.2,
  'bot-access': 0.2,
  discovery: 0.35,
  commerce: 0.15,
};

/** A level of agent readiness. */
export interface Level {
  level: number;
  name: string;
  /** The lowest overall score that reaches this level. */
  min: number;
}

/**
 * PROVISIONAL level thresholds. Only one data point is known (27 is level 1,
 * "Basic Web Presence"); the other names and boundaries are guesses.
 */
export const LEVELS: readonly Level[] = [
  { level: 0, name: 'Not Agent Ready', min: 0 },
  { level: 1, name: 'Basic Web Presence', min: 10 },
  { level: 2, name: 'Agent Aware', min: 40 },
  { level: 3, name: 'Agent Friendly', min: 65 },
  { level: 4, name: 'Agent Native', min: 85 },
];

/** The level a score reaches (the highest whose minimum it meets). */
export function levelFor(score: number): Level {
  return [...LEVELS].reverse().find((l) => score >= l.min) ?? LEVELS[0];
}

/** Score and counts of one category. */
interface CategoryScore {
  category: AgentCategory;
  label: string;
  /** 0-100. */
  score: number;
  passed: number;
  total: number;
  /** False for Commerce when no commerce signals were detected. */
  counted: boolean;
}

export interface AgentScore {
  /** 0-100. */
  score: number;
  level: Level;
  categories: CategoryScore[];
}

const SCORED = new Set(CHECKS.filter((c) => c.scored).map((c) => c.id));

/**
 * Computes the overall score from check results. Unscored checks (see
 * `CheckDefinition.scored`) are left out of the counts, and Commerce is only
 * counted when `commerceDetected` is true.
 */
export function computeScore(
  results: readonly CheckResult[],
  commerceDetected: boolean,
): AgentScore {
  const categories: CategoryScore[] = (
    Object.keys(CATEGORY_LABELS) as AgentCategory[]
  ).map((category) => {
    const own = results.filter(
      (r) => r.category === category && SCORED.has(r.id),
    );
    const passed = own.filter((r) => r.passed).length;
    return {
      category,
      label: CATEGORY_LABELS[category],
      score: own.length === 0 ? 0 : Math.round((passed / own.length) * 100),
      passed,
      total: own.length,
      counted: own.length > 0 && (category !== 'commerce' || commerceDetected),
    };
  });
  let weighted = 0;
  let weights = 0;
  for (const c of categories.filter((entry) => entry.counted)) {
    // Use the exact fraction, not the rounded category score.
    weighted += CATEGORY_WEIGHTS[c.category] * (c.passed / c.total) * 100;
    weights += CATEGORY_WEIGHTS[c.category];
  }
  const score = weights === 0 ? 0 : Math.round(weighted / weights);
  return { score, level: levelFor(score), categories };
}
