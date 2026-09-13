// ── 데이터 로딩 ──
//
// 1순위: /api/etfs (서버리스 → 금융위 공공데이터포털)
// 2순위: /data/etfs.snapshot.json (빌드 시 만들어 둔 스냅샷)
//
// "독립적으로 실행 가능한 웹앱" 요건에 맞춰, 프록시나 키가 없는 환경에서도
// 스냅샷만으로 전체 기능(조건검색·랭킹·연결)이 동작하도록 한다.

const SNAPSHOT_URL = '/data/etfs.snapshot.json'

async function getJson (url, timeout = 15000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) throw new Error(`${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/**
 * @returns {Promise<{meta:object, items:Array, source:'live'|'snapshot'}>}
 */
export async function loadEtfs () {
  try {
    const live = await getJson('/api/etfs')
    if (live?.items?.length) return { ...live, source: 'live' }
    throw new Error('빈 응답')
  } catch (liveErr) {
    try {
      const snap = await getJson(SNAPSHOT_URL, 10000)
      if (snap?.items?.length) {
        return {
          ...snap,
          source: 'snapshot',
          meta: { ...snap.meta, liveError: String(liveErr.message || liveErr) }
        }
      }
      throw new Error('스냅샷이 비어 있습니다')
    } catch (snapErr) {
      const err = new Error(
        '시세 데이터를 불러오지 못했습니다. /api/etfs 와 스냅샷 모두 응답하지 않습니다.'
      )
      err.detail = { live: String(liveErr.message || liveErr), snapshot: String(snapErr.message || snapErr) }
      throw err
    }
  }
}

/** 기간별 수익률 — 실패해도 앱 전체를 막지 않는 선택 데이터 */
export async function loadReturns () {
  try {
    const r = await getJson('/api/returns', 25000)
    if (r?.returns) return r
  } catch { /* 무시 */ }
  return null
}

export const RETURN_PERIODS = [
  { key: 'w1', label: '1주' },
  { key: 'm1', label: '1개월' },
  { key: 'm3', label: '3개월' },
  { key: 'm6', label: '6개월' },
  { key: 'y1', label: '1년' }
]

// ── 표시 포맷 ───────────────────────────────────────────

export const fmtNum = v =>
  v == null ? '—' : new Intl.NumberFormat('ko-KR').format(Math.round(v))

export const fmtPrice = v =>
  v == null ? '—' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(v)

export function fmtMoney (v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조원`
  if (abs >= 1e8) return `${(v / 1e8).toFixed(0)}억원`
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}만원`
  return `${fmtNum(v)}원`
}

/** 달러 금액 — 억/조 단위가 의미 없으므로 K/M/B 로 줄인다 */
export function fmtUsd (v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${fmtNum(v)}`
}

/**
 * 종목의 통화에 맞춰 금액을 표시한다.
 * 화면에는 원래 통화로 보여주고, 정렬·필터만 valueKrw 로 비교한다
 * (환산값을 그대로 보여주면 사용자가 아는 숫자와 달라진다).
 */
export const fmtAmount = (item, v) =>
  item?.market === 'US' ? fmtUsd(v) : fmtMoney(v)

export const fmtPct = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`)

export const fmtFee = v => (v == null ? '—' : `${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}%`)

export function fmtDate (basDt) {
  if (!basDt || basDt.length !== 8) return '—'
  return `${basDt.slice(0, 4)}.${basDt.slice(4, 6)}.${basDt.slice(6, 8)}`
}
