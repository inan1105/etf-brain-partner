// ── 조건 모델과 URL 직렬화 ──
//
// 요건: 종목코드·종목명·심볼·국내/해외·주요섹터·주요자산·참조지수 등을
// and/or 로 묶어 조건검색한다.
//
// 설계
//  · 패싯(facet) 안에서 선택한 값들끼리 or / and 를 고른다.
//  · 패싯들 사이를 다시 or / and 로 묶는다  ← 2단 구조로 대부분의 질의를 표현
//  · 자유검색어(q)와 연금적합(pension)은 항상 AND 로 붙는다 (검색창의 자연스러운 기대)
//
// URL 은 그대로 공유·색인 대상이므로 사람이 읽을 수 있는 형태를 유지한다.
//   /?q=반도체&themes=AI·인공지능,반도체&themes_m=or&exposure=해외&join=and

/** 값이 하나만 의미 있는 패싯 — and 모드가 성립하지 않는다 */
export const SINGLE_VALUED = new Set(['exposure', 'listing', 'region', 'asset', 'issuer'])

/** 다중 태그 패싯 — and 모드가 의미를 갖는다 */
export const MULTI_VALUED = new Set(['sectors', 'themes', 'strategy'])

export const FACET_KEYS = [
  'exposure', 'listing', 'region', 'asset', 'sectors', 'themes', 'strategy', 'issuer'
]

export const FACET_LABELS = {
  exposure: '국내/해외',
  listing: '상장시장',
  region: '투자지역',
  asset: '주요자산',
  sectors: '주요섹터',
  themes: '테마',
  strategy: '전략·구조',
  issuer: '운용사'
}

export const SORTS = {
  fit: '적합도순',
  value: '거래대금순',
  netAssets: '순자산순',
  changeRate: '등락률순',
  fee: '보수 낮은순',
  name: '종목명순'
}

export function emptyQuery () {
  const facets = {}
  for (const k of FACET_KEYS) facets[k] = { values: [], mode: 'or' }
  return {
    q: '',
    facets,
    join: 'and',
    pension: false,
    minValue: 0,
    sort: 'fit',
    preset: null
  }
}

export function isActive (query) {
  if (query.q.trim()) return true
  if (query.pension) return true
  if (query.minValue > 0) return true
  return FACET_KEYS.some(k => query.facets[k].values.length > 0)
}

export function activeFacets (query) {
  // 부분 조건 객체(프리셋·SEO 기본값 등)가 들어와도 터지지 않게 방어한다
  return FACET_KEYS.filter(k => query.facets?.[k]?.values?.length > 0)
}

/** 선택된 조건을 사람이 읽을 수 있는 문장으로 — 화면 요약과 SEO title 에 함께 쓴다 */
export function describe (query) {
  const parts = []
  for (const k of activeFacets(query)) {
    const f = query.facets[k]
    const glue = f.mode === 'and' ? ' + ' : ' 또는 '
    parts.push(f.values.join(glue))
  }
  const joined = parts.join(query.join === 'and' ? ' · ' : ' 또는 ')
  const bits = []
  if (query.q.trim()) bits.push(`"${query.q.trim()}"`)
  if (joined) bits.push(joined)
  if (query.pension) bits.push('연금계좌(IRP/DC) 편입 가능')
  if (query.minValue > 0) bits.push(`거래대금 ${(query.minValue / 100000000).toFixed(0)}억원 이상`)
  return bits.join(' · ')
}

// ── URL ↔ 조건 ────────────────────────────────────────────

export function toSearchParams (query) {
  const p = new URLSearchParams()
  if (query.q.trim()) p.set('q', query.q.trim())
  for (const k of FACET_KEYS) {
    const f = query.facets[k]
    if (!f.values.length) continue
    p.set(k, f.values.join(','))
    if (f.mode === 'and' && MULTI_VALUED.has(k)) p.set(`${k}_m`, 'and')
  }
  if (activeFacets(query).length > 1 && query.join === 'or') p.set('join', 'or')
  if (query.pension) p.set('pension', '1')
  if (query.minValue > 0) p.set('minv', String(query.minValue))
  if (query.sort !== 'fit') p.set('sort', query.sort)
  if (query.preset) p.set('preset', query.preset)
  return p
}

export function toUrl (query, base = '/') {
  const p = toSearchParams(query)
  const s = p.toString()
  return s ? `${base}?${decodeURIComponent(s)}` : base
}

export function fromSearchParams (params) {
  const query = emptyQuery()
  query.q = params.get('q') || ''
  for (const k of FACET_KEYS) {
    const raw = params.get(k)
    if (!raw) continue
    query.facets[k].values = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (params.get(`${k}_m`) === 'and' && MULTI_VALUED.has(k)) query.facets[k].mode = 'and'
  }
  query.join = params.get('join') === 'or' ? 'or' : 'and'
  query.pension = params.get('pension') === '1'
  query.minValue = Number(params.get('minv') || 0) || 0
  const sort = params.get('sort')
  if (sort && sort in SORTS) query.sort = sort
  query.preset = params.get('preset') || null
  return query
}

export function fromLocation () {
  return fromSearchParams(new URLSearchParams(window.location.search))
}

/** 히스토리를 더럽히지 않고 주소만 동기화 */
export function syncLocation (query, { push = false } = {}) {
  const url = toUrl(query, window.location.pathname)
  if (url === window.location.pathname + window.location.search) return
  window.history[push ? 'pushState' : 'replaceState'](null, '', url)
}
