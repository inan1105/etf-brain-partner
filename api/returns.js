// ── GET /api/returns ──
//
// 기간별 수익률. 금융위 API 는 기준일자별 종가만 주므로,
// 과거 기준일의 전종목 종가를 함께 받아 현재가와 비교해 계산한다.
//
// 기간: 1주 · 1개월 · 3개월 · 6개월 · 1년
// 휴장일에는 데이터가 없으므로 목표일에서 최대 7일 뒤로 물러나며 찾는다.
// 응답이 무거우므로 CDN 캐시(s-maxage 1h)에 기대고, 람다 메모리 캐시도 함께 둔다.

import { loadDomestic, closesOn } from './_lib/domestic.js'
import { loadQuotes } from './_lib/yahoo.js'
import { US_ETFS } from '../shared/us-etfs.js'
import { json, ymd } from './_lib/http.js'

const PERIODS = [
  { key: 'w1', label: '1주', days: 7 },
  { key: 'm1', label: '1개월', days: 30 },
  { key: 'm3', label: '3개월', days: 91 },
  { key: 'm6', label: '6개월', days: 182 },
  { key: 'y1', label: '1년', days: 365 }
]

let cache = null
const TTL_MS = 60 * 60 * 1000

const parseBasDt = s =>
  new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))

/** 목표일에서 과거로 물러나며 데이터가 있는 기준일의 종가 맵을 얻는다 */
async function closesNear (source, target, maxBack = 8) {
  const cursor = new Date(target)
  for (let i = 0; i < maxBack; i++) {
    const basDt = ymd(cursor)
    try {
      const map = await closesOn(basDt, source)
      if (map) return { basDt, map }
    } catch { /* 다음 날짜로 */ }
    cursor.setDate(cursor.getDate() - 1)
  }
  return null
}

/** 해외 상장 ETF — Yahoo 는 한 번의 호출로 기간수익률까지 계산해 준다 */
async function usReturns () {
  const out = {}
  try {
    const quotes = await loadQuotes(US_ETFS.map(e => e.symbol), { range: '2y', concurrency: 8 })
    for (const [symbol, q] of quotes) {
      if (q.returns && Object.keys(q.returns).length) out[symbol] = q.returns
    }
  } catch { /* 해외 실패는 국내 결과를 막지 않는다 */ }
  return out
}

async function buildKrx () {
  // 최신 기준일과 원천(krx/mofin)을 한 번에 확정한다
  const { basDt: latest, source } = await loadDomestic()
  const base = await closesNear(source, parseBasDt(latest), 1)
  if (!base) throw new Error('기준일 종가를 받지 못했습니다')

  const periods = []
  const returns = {} // code → { w1, m1, ... }

  for (const p of PERIODS) {
    const target = parseBasDt(latest)
    target.setDate(target.getDate() - p.days)
    const past = await closesNear(source, target)
    if (!past) {
      periods.push({ ...p, basDt: null, available: false })
      continue
    }
    periods.push({ key: p.key, label: p.label, days: p.days, basDt: past.basDt, available: true })

    for (const [code, now] of base.map) {
      const then = past.map.get(code)
      if (!then || then <= 0) continue
      const pct = ((now - then) / then) * 100
      ;(returns[code] ||= {})[p.key] = Math.round(pct * 100) / 100
    }
  }

  return { asOf: base.basDt, periods, returns, source }
}

async function build () {
  // 국내(무거움)와 해외(가벼움)를 함께 돌리고, 한쪽 실패는 격리한다
  const [krxRes, usRes] = await Promise.allSettled([
    buildKrx(),
    usReturns()
  ])

  const krx = krxRes.status === 'fulfilled' ? krxRes.value : null
  const us = usRes.status === 'fulfilled' ? usRes.value : {}

  const returns = { ...(krx?.returns || {}), ...us }
  if (!Object.keys(returns).length) {
    throw krxRes.status === 'rejected' ? krxRes.reason : new Error('수익률 데이터를 만들지 못했습니다')
  }

  return {
    meta: {
      asOf: krx?.asOf ?? null,
      generatedAt: new Date().toISOString(),
      // 해외는 전 기간을 항상 계산하므로, 국내가 없으면 기본 기간표를 쓴다
      periods: krx?.periods ?? PERIODS.map(p => ({ ...p, basDt: null, available: true })),
      krxError: krxRes.status === 'rejected' ? krxRes.reason.message : undefined,
      counts: {
        total: Object.keys(returns).length,
        krx: Object.keys(krx?.returns || {}).length,
        us: Object.keys(us).length
      }
    },
    returns
  }
}

export default async function handler (req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET 만 허용됩니다' })

  if (cache && Date.now() - cache.at < TTL_MS) return json(res, 200, cache.payload, 3600)

  try {
    const payload = await build()
    cache = { at: Date.now(), payload }
    return json(res, 200, payload, 3600)
  } catch (e) {
    if (cache) return json(res, 200, { ...cache.payload, meta: { ...cache.payload.meta, stale: true } }, 60)
    return json(res, 502, {
      error: e.message,
      hint: '국내 수익률에는 KRX_AUTH_KEY(또는 DATA_GO_KR_KEY)가 필요합니다. 해외는 키 없이 동작합니다.'
    })
  }
}

export { PERIODS }
