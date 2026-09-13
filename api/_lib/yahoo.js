// ── Yahoo Finance 어댑터 (해외 상장 ETF) ──
//
// 금융위 API 는 국내 상장 ETF 만 다루므로, 미국 상장 ETF(SPY·QQQ·SCHD…)의
// 시세는 Yahoo Finance 차트 엔드포인트에서 받는다.
//
//   https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1y&interval=1d
//
// 이 엔드포인트를 고른 이유
//   · v7/finance/quote 는 crumb/cookie 인증이 필요해져 서버에서 쓰기 번거롭다.
//   · chart 는 인증 없이 meta(현재가·거래량·52주)와 일봉 종가를 함께 준다.
//     → 시세와 기간별 수익률을 한 번의 호출로 해결한다.
//
// ⚠ 공식 API 가 아니다. 응답 구조가 바뀔 수 있으므로 실패해도 앱 전체가
//    멈추지 않도록 종목 단위로 실패를 격리한다.

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; ETF-Brain-Partner/1.0)',
  accept: 'application/json'
}

/** 한 종목의 차트를 받는다. 실패하면 null (전체를 막지 않는다) */
async function fetchChart (symbol, { range = '5d', interval = '1d', timeout = 9000 } = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const url = `${BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
    const res = await fetch(url, { headers: HEADERS, signal: ac.signal })
    if (!res.ok) return null
    const json = await res.json()
    return json?.chart?.result?.[0] || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 결측(null) 종가를 걸러낸 [timestampMs, close] 시계열 */
function series (result) {
  const ts = result?.timestamp || []
  const closes = result?.indicators?.quote?.[0]?.close || []
  const out = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c != null && Number.isFinite(c)) out.push([ts[i] * 1000, c])
  }
  return out
}

/**
 * 기간별 수익률. 목표 시점 이전의 가장 가까운 거래일 종가와 비교한다.
 * 휴장일에는 데이터가 없으므로 "이전 중 가장 가까운" 값을 쓴다.
 */
export function returnsFrom (rows) {
  if (rows.length < 2) return {}
  const [lastMs, lastClose] = rows[rows.length - 1]
  const DAY = 86400000
  const PERIODS = [['w1', 7], ['m1', 30], ['m3', 91], ['m6', 182], ['y1', 365]]

  const firstMs = rows[0][0]
  const out = {}
  for (const [key, days] of PERIODS) {
    const target = lastMs - days * DAY
    let pick = null
    for (const [ms, close] of rows) {
      if (ms <= target) pick = close
      else break
    }
    // 목표 시점보다 데이터가 늦게 시작하면(상장 직후, 또는 창 경계에 걸린 경우)
    // 창 시작이 목표의 2주 이내일 때만 첫 종가로 근사한다.
    // 그보다 짧으면 계산하지 않는다 — 0% 로 오해되는 편이 더 나쁘다.
    if (pick == null && firstMs - target <= 14 * DAY) pick = rows[0][1]
    if (pick == null || pick <= 0) continue
    out[key] = Math.round(((lastClose - pick) / pick) * 10000) / 100
  }
  return out
}

/** 차트 응답 → 내부 시세 스키마 */
function normalize (result) {
  const m = result?.meta
  if (!m) return null
  const rows = series(result)
  const close = m.regularMarketPrice ?? (rows.length ? rows[rows.length - 1][1] : null)

  // ⚠ meta.chartPreviousClose 는 '전일 종가'가 아니라 '요청한 range 직전의 종가'다.
  // range=1y 로 부르면 1년 전 값이 들어와 등락률이 +300% 같은 값이 된다.
  // 전일 종가는 시계열의 끝에서 두 번째 값으로 잡는다.
  const prev = rows.length > 1 ? rows[rows.length - 2][1] : (m.chartPreviousClose ?? null)
  const change = close != null && prev != null ? close - prev : null
  const asOf = m.regularMarketTime ? new Date(m.regularMarketTime * 1000) : null

  return {
    symbol: m.symbol,
    close,
    change,
    // meta 의 등락률은 장중 갱신이 늦을 때가 있어 종가 기준으로 직접 계산한다
    changeRate: change != null && prev ? Math.round((change / prev) * 10000) / 100 : null,
    open: null,
    high: m.regularMarketDayHigh ?? null,
    low: m.regularMarketDayLow ?? null,
    volume: m.regularMarketVolume ?? null,
    // 거래대금은 Yahoo 가 주지 않으므로 종가×거래량으로 근사한다 (USD)
    value: close != null && m.regularMarketVolume != null ? close * m.regularMarketVolume : null,
    currency: m.currency || 'USD',
    exchange: m.fullExchangeName || m.exchangeName || null,
    week52High: m.fiftyTwoWeekHigh ?? null,
    week52Low: m.fiftyTwoWeekLow ?? null,
    longName: m.longName || m.shortName || null,
    basDt: asOf
      ? `${asOf.getUTCFullYear()}${String(asOf.getUTCMonth() + 1).padStart(2, '0')}${String(asOf.getUTCDate()).padStart(2, '0')}`
      : null,
    returns: returnsFrom(rows)
  }
}

/**
 * USD/KRW 환율.
 * 해외 ETF 의 거래대금은 달러, 국내는 원이다. 그대로 두면 "거래대금 상위"
 * 정렬과 "최소 거래대금" 필터가 통화를 섞어 비교하게 되므로 원화로 환산한다.
 * 실패하면 null 을 돌려주고, 호출측은 환산을 생략한다(잘못된 값보다 낫다).
 */
export async function usdKrwRate () {
  const chart = await fetchChart('KRW=X', { range: '5d', timeout: 6000 })
  const rate = chart?.meta?.regularMarketPrice
  return Number.isFinite(rate) && rate > 500 && rate < 3000 ? rate : null
}

/** 동시 실행 수를 제한한 map — Yahoo 에 순간 부하를 주지 않는다 */
async function pooled (items, worker, concurrency = 8) {
  const out = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return out
}

/**
 * 심볼 목록의 시세를 받는다.
 * @param {string[]} symbols
 * @param {{range?:string, concurrency?:number}} opts
 *   range '5d'  → 시세만 필요할 때 (가볍다)
 *   range '1y'  → 기간별 수익률까지 필요할 때
 * @returns {Promise<Map<string, object>>} 실패한 종목은 맵에 없다
 */
export async function loadQuotes (symbols, { range = '5d', concurrency = 8 } = {}) {
  const results = await pooled(
    symbols,
    async sym => {
      const chart = await fetchChart(sym, { range })
      return chart ? normalize(chart) : null
    },
    concurrency
  )

  const map = new Map()
  for (const r of results) if (r?.symbol) map.set(r.symbol, r)
  return map
}
