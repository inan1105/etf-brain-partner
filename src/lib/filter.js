// ── 조건 평가 엔진 (and / or) ──

import { FACET_KEYS, SINGLE_VALUED, activeFacets } from './query.js'

/** 항목에서 패싯 값을 꺼낸다 — 단일값은 배열로 감싸 동일하게 다룬다 */
function valuesOf (item, facet) {
  const v = item[facet]
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

/**
 * 하나의 패싯을 평가한다.
 * mode 'or'  → 선택값 중 하나라도 보유
 * mode 'and' → 선택값을 모두 보유 (다중태그 패싯에서만 의미)
 */
export function matchFacet (item, facet, selected, mode) {
  if (!selected.length) return null // 비활성
  const have = valuesOf(item, facet)
  if (SINGLE_VALUED.has(facet) || mode === 'or') {
    return selected.some(s => have.includes(s))
  }
  return selected.every(s => have.includes(s))
}

/** 자유검색어 — 공백으로 나눈 토큰을 모두 포함해야 한다 */
export function matchText (item, q) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return needle.split(/\s+/).every(tok => item.haystack.includes(tok))
}

/**
 * 조건 전체를 평가한다.
 * 패싯들 사이는 query.join(and/or), 검색어·연금·거래대금은 항상 AND.
 */
export function matches (item, query) {
  if (!matchText(item, query.q)) return false
  if (query.pension && !item.pensionEligible) return false
  // 거래대금 비교는 원화 환산값으로 — 해외는 달러라 그대로 비교하면 통화가 섞인다
  if (query.minValue > 0 && !((item.valueKrw ?? item.value) >= query.minValue)) return false

  const active = activeFacets(query)
  if (!active.length) return true

  const results = active.map(k =>
    matchFacet(item, k, query.facets[k].values, query.facets[k].mode)
  )
  return query.join === 'and' ? results.every(Boolean) : results.some(Boolean)
}

export function applyFilter (items, query) {
  return items.filter(it => matches(it, query))
}

/**
 * 현재 조건에서 각 패싯 값이 몇 건을 만들어내는지 센다.
 * 자기 자신 패싯은 제외하고 계산해야 (선택해도 0건이 되지 않는) 정상적인
 * 다중선택 UI 가 된다.
 */
export function facetCounts (items, query) {
  const out = {}
  for (const facet of FACET_KEYS) {
    const probe = {
      ...query,
      facets: { ...query.facets, [facet]: { values: [], mode: query.facets[facet].mode } }
    }
    const pool = applyFilter(items, probe)
    const counter = new Map()
    for (const it of pool) {
      for (const v of valuesOf(it, facet)) counter.set(v, (counter.get(v) || 0) + 1)
    }
    out[facet] = counter
  }
  return out
}
