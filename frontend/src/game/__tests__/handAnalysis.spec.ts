import { describe, expect, it } from 'vitest'
import { analyzeHand } from '../handAnalysis'
import type { Card, CardColor } from '../room'

function cards(values: (number | 'wild' | 'skip')[]): Card[] {
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue']
  return values.map((value, i) => ({ id: `card-${i}`, value: String(value), color: typeof value === 'number' ? colors[i % 4] : 'wild' }))
}

describe('natural-card practice suggestions', () => {
  it('requires three matching numbers or four consecutive numbers', () => {
    expect(analyzeHand(cards([7, 7])).groups).toEqual([])
    expect(analyzeHand(cards([2, 3, 4])).groups).toEqual([])
    expect(analyzeHand(cards([7, 7, 7])).groups[0].kind).toBe('set')
    const run = analyzeHand(cards([2, 3, 4, 5]))
    expect(run.groups[0].kind).toBe('run')
    expect(run.covered).toBe(4)
  })

  it('does not wrap 12 to 1, bridge gaps or use a repeated number twice in a run', () => {
    for (const values of [[11, 12, 1, 2], [1, 2, 4, 5], [2, 3, 3, 4]]) {
      expect(analyzeHand(cards(values)).covered).toBe(0)
    }
    expect(analyzeHand(cards([9, 10, 11, 12])).groups[0].label).toBe('连号 9–12')
  })

  it('keeps wild and skip cards outside suggestions', () => {
    const hand = cards([1, 2, 3, 'wild', 'wild', 'skip', 'skip', 'skip'])
    expect(analyzeHand(hand).covered).toBe(0)
    expect(analyzeHand(cards([6, 6, 6, 'wild', 'skip'])).covered).toBe(3)
  })

  it('finds a complete partition that a longest-run-first strategy would miss', () => {
    const result = analyzeHand(cards([1, 1, 1, 2, 2, 2, 3, 4, 5, 6]))
    expect(result.covered).toBe(10)
    expect(result.groups.map(g => g.kind).sort()).toEqual(['run', 'set', 'set'])
    expect(result.ungrouped).toEqual([])
  })

  it('can use two physical copies in separate runs, without reusing any card', () => {
    const result = analyzeHand(cards([1, 1, 2, 2, 3, 3, 4, 4, 10, 'wild', 'skip']))
    expect(result.covered).toBe(8)
    expect(result.groups).toHaveLength(2)
    expect(new Set(result.groups.flatMap(g => g.cards.map(c => c.id))).size).toBe(8)
    expect(result.ungrouped.map(c => c.value).sort()).toEqual(['10', 'skip', 'wild'])
  })

  it('prefers one long group over splitting the same coverage', () => {
    const result = analyzeHand(cards([1, 2, 3, 4, 5, 6, 7, 8]))
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].cards).toHaveLength(8)
  })

  it('is stable across sorting and never mutates the hand', () => {
    const hand = cards([1, 1, 1, 2, 2, 2, 3, 4, 5, 6])
    const before = JSON.stringify(hand)
    const result = analyzeHand(hand)
    expect(analyzeHand([...hand].reverse())).toEqual(result)
    expect(JSON.stringify(hand)).toBe(before)
  })

  it('conserves cards across deterministic sample hands', () => {
    let seed = 71
    for (let sample = 0; sample < 80; sample++) {
      const values = Array.from({ length: 11 }, () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed % 12 + 1
      })
      const hand = cards(values)
      const result = analyzeHand(hand)
      const grouped = result.groups.flatMap(g => g.cards)
      expect(grouped.length).toBe(result.covered)
      expect(new Set([...grouped, ...result.ungrouped].map(c => c.id)).size).toBe(11)
      expect(grouped.length + result.ungrouped.length).toBe(11)
      for (const group of result.groups) {
        const numbers = group.cards.map(c => Number(c.value))
        if (group.kind === 'set') {
          expect(numbers.length).toBeGreaterThanOrEqual(3)
          expect(new Set(numbers).size).toBe(1)
        } else {
          expect(numbers.length).toBeGreaterThanOrEqual(4)
          expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => numbers[0] + i))
        }
      }
    }
  })

  it('handles an empty hand and bounds the subset search to a practice hand', () => {
    expect(analyzeHand([])).toEqual({ covered: 0, groups: [], ungrouped: [] })
    expect(() => analyzeHand(cards(Array(12).fill(1)))).toThrow(RangeError)
  })
})
