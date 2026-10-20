// Pure rules shared by the backend and browser; no storage or Node dependencies.
type RuleCard = { id: string; color: string; value: string };
export type ChallengeState = { goal: 'two-sets'; status: 'active' } | {
  goal: 'two-sets'; status: 'completed'; groups: string[][]; completedAt: number; turnsPlayed: number;
};

export function challengeGroups(hand: readonly RuleCard[]): string[][] {
  if (hand.length > 11 || new Set(hand.map(card => card.id)).size !== hand.length) return [];
  const groups: string[][] = [];
  for (let value = 1; value <= 12; value++) {
    const matching = hand.filter(card => ['red', 'yellow', 'green', 'blue'].includes(card.color) && card.value === String(value))
      .map(card => card.id).sort();
    for (let i = 0; i + 2 < matching.length && groups.length < 2; i += 3) groups.push(matching.slice(i, i + 3));
    if (groups.length === 2) break;
  }
  return groups;
}

export function isChallengeState(value: unknown, hand: readonly RuleCard[], hasDrawn: boolean, turn: number): value is ChallengeState {
  if (!value || typeof value !== 'object') return false;
  const state = value as ChallengeState;
  if (state.goal !== 'two-sets') return false;
  if (state.status === 'active') return true;
  if (state.status !== 'completed' || hasDrawn || hand.length !== 10 ||
      !Number.isFinite(state.completedAt) || state.completedAt < 0 ||
      !Number.isSafeInteger(state.turnsPlayed) || state.turnsPlayed !== turn - 1 ||
      !Array.isArray(state.groups) || state.groups.length !== 2 ||
      !state.groups.every(group => Array.isArray(group) && group.length === 3 && group.every(id => typeof id === 'string'))) return false;
  const ids = state.groups.flat();
  if (new Set(ids).size !== 6) return false;
  return state.groups.every(group => {
    const cards = group.map(id => hand.find(card => card.id === id));
    return cards.every(card => card && ['red', 'yellow', 'green', 'blue'].includes(card.color) && /^(?:[1-9]|1[0-2])$/.test(card.value) && card.value === cards[0]?.value);
  });
}
