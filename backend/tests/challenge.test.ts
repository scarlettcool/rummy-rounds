import { describe, expect, it } from 'vitest';
import { challengeGroups, isChallengeState } from '../src/game/rules/challenge';

function hand(values: (number | 'wild' | 'skip')[]) {
  return values.map((value, i) => ({ id: `card-${i}`, value: String(value), color: typeof value === 'number' ? 'red' : 'wild' }));
}

describe('two natural sets challenge rules', () => {
  it('requires two disjoint groups of three, even if all six have the same number', () => {
    const cards = hand([7, 7, 7, 7, 7, 7, 1, 2, 3, 4]);
    const groups = challengeGroups(cards);
    expect(groups).toHaveLength(2);
    expect(groups.every(group => group.length === 3)).toBe(true);
    expect(new Set(groups.flat()).size).toBe(6);
    expect(challengeGroups([...cards].reverse())).toEqual(groups);
  });

  it('does not use runs, pairs, special cards or repeated physical ids to satisfy a goal', () => {
    expect(challengeGroups(hand([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toEqual([]);
    expect(challengeGroups(hand([2, 2, 3, 3, 'wild', 'wild', 'skip', 1, 4, 5]))).toEqual([]);
    const cards = hand([1, 1, 1, 2, 2, 2]);
    cards[1].id = cards[0].id;
    expect(challengeGroups(cards)).toEqual([]);
  });

  it('returns partial progress without changing the input', () => {
    const cards = hand([12, 12, 12, 1, 2, 3, 4, 5, 6, 7]);
    const before = JSON.stringify(cards);
    expect(challengeGroups(cards)).toHaveLength(1);
    expect(JSON.stringify(cards)).toBe(before);
  });

  it('rejects invalid, overlapping or fabricated result proofs', () => {
    const cards = hand([1, 1, 1, 2, 2, 2, 3, 4, 5, 6]);
    const result = { goal: 'two-sets', status: 'completed', groups: challengeGroups(cards), completedAt: 100, turnsPlayed: 3 };
    expect(isChallengeState(result, cards, false, 4)).toBe(true);
    expect(isChallengeState(result, cards, true, 4)).toBe(false);
    expect(isChallengeState(result, cards, false, 5)).toBe(false);
    expect(isChallengeState({ ...result, groups: [result.groups[0], result.groups[0]] }, cards, false, 4)).toBe(false);
    expect(isChallengeState({ ...result, groups: [['missing', 'bad', 'ids'], result.groups[1]] }, cards, false, 4)).toBe(false);
    expect(isChallengeState({ ...result, groups: null }, cards, false, 4)).toBe(false);
    expect(isChallengeState({ ...result, completedAt: NaN }, cards, false, 4)).toBe(false);
  });
});
