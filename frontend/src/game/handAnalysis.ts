import type { Card } from './room'

export type HandGroup = { kind: 'set' | 'run'; cards: Card[]; label: string }
export type HandAnalysis = { groups: HandGroup[]; covered: number; ungrouped: Card[] }

// Practice references only: natural sets of 3+ and mixed-color runs of 4+.
// Wild/skip effects and phase objectives are deliberately outside this evaluator.
export function analyzeHand(hand: readonly Card[]): HandAnalysis {
  if (hand.length > 11) throw new RangeError('Hand analysis supports at most 11 cards')
  const cards = [...hand].sort((a, b) => (Number(a.value) || 99) - (Number(b.value) || 99) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const candidates: { mask: number; group: HandGroup }[] = []
  const limit = 1 << cards.length
  for (let mask = 1; mask < limit; mask++) {
    const subset = cards.filter((_, i) => mask & (1 << i))
    if (subset.length < 3 || subset.some(c => c.color === 'wild')) continue
    const values = subset.map(c => Number(c.value))
    const set = values.every(value => value === values[0])
    const run = subset.length >= 4 && values.every((value, i) => i === 0 || value === values[i - 1] + 1)
    if (!set && !run) continue
    candidates.push({ mask, group: {
      kind: set ? 'set' : 'run', cards: subset,
      label: set ? `同点 ${values[0]} · ${subset.length} 张` : `连号 ${values[0]}–${values[values.length - 1]}`,
    } })
  }
  type Plan = { covered: number; groups: HandGroup[] }
  const memo = new Map<number, Plan>()
  function best(remaining: number): Plan {
    if (!remaining) return { covered: 0, groups: [] }
    const cached = memo.get(remaining)
    if (cached) return cached
    const first = remaining & -remaining
    let result = best(remaining ^ first)
    for (const { mask, group } of candidates) {
      if (!(mask & first) || (remaining & mask) !== mask) continue
      const rest = best(remaining ^ mask)
      const covered = group.cards.length + rest.covered
      if (covered > result.covered || (covered === result.covered && rest.groups.length + 1 < result.groups.length)) {
        result = { covered, groups: [group, ...rest.groups] }
      }
    }
    memo.set(remaining, result)
    return result
  }
  const result = best(limit - 1)
  const used = new Set(result.groups.flatMap(g => g.cards.map(c => c.id)))
  return { ...result, ungrouped: cards.filter(c => !used.has(c.id)) }
}
