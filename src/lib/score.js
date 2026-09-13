// ── 적합도 스코어링 ──
//
// "SEO 관점의 종목 제시" 중 내부 랭킹에 해당한다.
// 조건에 걸린 종목이 수십~수백 건이 되므로, 무엇을 위에 올릴지가 곧 품질이다.
//
// 축 구성 (합계 100점)
//   조건 적합 40 · 유동성 25 · 규모 20 · 보수 10 · 모멘텀 5
// 각 축은 단독으로도 해석 가능하도록 breakdown 을 함께 돌려준다.

import { activeFacets, SINGLE_VALUED } from './query.js'

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** 로그 스케일 정규화 — 거래대금·순자산처럼 자릿수가 다른 값에 쓴다 */
function logNorm (v, lo, hi) {
  if (!v || v <= 0) return 0
  const x = Math.log10(v)
  return clamp((x - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)))
}

const WEIGHTS = { fit: 40, liquidity: 25, size: 20, fee: 10, momentum: 5 }

/** 조건 적합도 — 선택한 값 중 실제로 몇 개를 보유했는지 */
function fitRatio (item, query) {
  const active = activeFacets(query)
  let selected = 0
  let hit = 0

  for (const facet of active) {
    const want = query.facets[facet].values
    const have = Array.isArray(item[facet]) ? item[facet] : item[facet] == null ? [] : [item[facet]]
    if (SINGLE_VALUED.has(facet)) {
      // 단일값 패싯은 '맞다/아니다' 하나로 센다
      selected += 1
      if (want.some(w => have.includes(w))) hit += 1
    } else {
      selected += want.length
      hit += want.filter(w => have.includes(w)).length
    }
  }

  // 검색어가 종목명 앞쪽에 걸리면 가산 (KODEX 반도체 > TIGER 미국반도체 …)
  let textBonus = 0
  const q = query.q.trim().toLowerCase()
  if (q) {
    const name = item.name.toLowerCase()
    if (name.startsWith(q)) textBonus = 0.25
    else if (name.includes(q)) textBonus = 0.15
    else if (String(item.code).toLowerCase() === q || String(item.symbol || '').toLowerCase() === q) textBonus = 0.3
  }

  if (!selected) return clamp(0.5 + textBonus) // 조건 없이 검색어만 있는 경우
  return clamp(hit / selected + textBonus)
}

/**
 * 한 종목의 점수를 낸다.
 * @returns {{total:number, breakdown:Record<string,number>}}
 */
export function scoreItem (item, query) {
  const fit = fitRatio(item, query)
  // 거래대금 1억 ~ 5,000억 구간을 0~1 로. 해외는 달러이므로 원화 환산값을 쓴다.
  const liquidity = logNorm(item.valueKrw ?? item.value, 1e8, 5e11)
  // 순자산 100억 ~ 10조 구간을 0~1 로
  const size = logNorm(item.netAssets, 1e10, 1e13)
  // 보수 0.8% → 0점, 0.01% → 1점. 값이 없으면 중간값으로 둔다(불이익도 특혜도 없음)
  const fee = item.expenseRatio == null ? 0.5 : clamp((0.8 - item.expenseRatio) / 0.79)
  // 등락률 ±5% 를 0~1 로 (과열 가점이 아니라 주목도 보정이므로 비중 5점)
  const momentum = item.changeRate == null ? 0.5 : clamp((item.changeRate + 5) / 10)

  const breakdown = {
    fit: fit * WEIGHTS.fit,
    liquidity: liquidity * WEIGHTS.liquidity,
    size: size * WEIGHTS.size,
    fee: fee * WEIGHTS.fee,
    momentum: momentum * WEIGHTS.momentum
  }
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { total: Math.round(total * 10) / 10, breakdown }
}

const cmpNum = (a, b) => (b ?? -Infinity) - (a ?? -Infinity)

/** 정렬 + 점수 부착 */
export function rank (items, query) {
  const scored = items.map(it => ({ ...it, score: scoreItem(it, query) }))
  const by = {
    fit: (a, b) => b.score.total - a.score.total,
    value: (a, b) => cmpNum(a.valueKrw ?? a.value, b.valueKrw ?? b.value),
    netAssets: (a, b) => cmpNum(a.netAssets, b.netAssets),
    changeRate: (a, b) => cmpNum(a.changeRate, b.changeRate),
    fee: (a, b) => (a.expenseRatio ?? 99) - (b.expenseRatio ?? 99),
    name: (a, b) => a.name.localeCompare(b.name, 'ko')
  }
  return scored.sort(by[query.sort] || by.fit)
}

export const SCORE_AXES = [
  { key: 'fit', label: '조건 적합', max: WEIGHTS.fit, desc: '선택한 조건을 얼마나 충족하는지' },
  { key: 'liquidity', label: '유동성', max: WEIGHTS.liquidity, desc: '거래대금 기준 체결 용이성' },
  { key: 'size', label: '규모', max: WEIGHTS.size, desc: '순자산총액 기준 안정성' },
  { key: 'fee', label: '보수', max: WEIGHTS.fee, desc: '총보수가 낮을수록 높은 점수' },
  { key: 'momentum', label: '모멘텀', max: WEIGHTS.momentum, desc: '최근 등락률 기준 주목도' }
]
