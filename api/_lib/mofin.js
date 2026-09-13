// ── 금융위원회 ETF시세정보 (공공데이터포털) 어댑터 ──
// https://www.data.go.kr/data/15094807/openapi.do
// 국내 상장 ETF 전종목의 일별 시세·NAV·기초지수명을 제공한다.
// 섹터/테마/자산군 분류는 제공하지 않으므로 shared/taxonomy.js 에서 추론한다.

import { fetchJson, ymd, todayKST } from './http.js'

const BASE =
  'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo'

const num = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * 공공데이터포털은 같은 키를 Encoding / Decoding 두 형태로 보여준다.
 *   Decoding: aBc+dEf/gHi==
 *   Encoding: aBc%2BdEf%2FgHi%3D%3D
 * URLSearchParams 는 값을 스스로 인코딩하므로 Encoding 키를 그대로 넣으면
 * '%' 가 다시 '%25' 로 이중 인코딩되어 인증에 실패한다.
 * 어느 쪽을 넣어도 동작하도록 한 번 정규화한다.
 */
export function normalizeKey (raw) {
  const key = String(raw || '').trim()
  if (!key) return key
  // %2B / %3D 처럼 Base64 특수문자가 퍼센트 인코딩되어 있으면 디코딩 형태로 되돌린다
  if (/%[0-9A-Fa-f]{2}/.test(key)) {
    try {
      return decodeURIComponent(key)
    } catch {
      return key // 디코딩 불가능한 문자열이면 원문 유지
    }
  }
  return key
}

function buildUrl (key, params) {
  const qs = new URLSearchParams({
    serviceKey: normalizeKey(key),
    resultType: 'json',
    ...params
  })
  return `${BASE}?${qs}`
}

function unwrap (payload) {
  const body = payload?.response?.body
  if (!body) {
    const msg =
      payload?.response?.header?.resultMsg ||
      payload?.cmmMsgHeader?.returnAuthMsg ||
      '예상치 못한 응답 구조'
    throw new Error(`금융위 API: ${msg}`)
  }
  const items = body.items?.item
  return {
    total: Number(body.totalCount ?? 0),
    rows: Array.isArray(items) ? items : items ? [items] : []
  }
}

/**
 * 가장 최근 영업일(데이터가 존재하는 기준일자)을 찾는다.
 * 휴장일·데이터 반영 지연을 감안해 최대 `maxBack` 일 거슬러 올라간다.
 */
export async function findLatestBasDt (key, maxBack = 12) {
  const cursor = todayKST()
  for (let i = 0; i < maxBack; i++) {
    const basDt = ymd(cursor)
    const url = buildUrl(key, { numOfRows: '1', pageNo: '1', basDt })
    try {
      const { total } = unwrap(await fetchJson(url, { timeout: 8000, retries: 1 }))
      if (total > 0) return basDt
    } catch (e) {
      // 인증 오류는 날짜를 바꿔도 동일하므로 즉시 전파
      if (/SERVICE_KEY|등록되지 않은|IP|LIMITED/i.test(e.message)) throw e
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  throw new Error(`최근 ${maxBack}일 내 ETF 시세 데이터를 찾지 못했습니다`)
}

/** 지정 기준일의 전종목을 페이지네이션으로 모두 수집 */
export async function fetchAll (key, basDt, { pageSize = 1000, maxPages = 5 } = {}) {
  const rows = []
  let total = Infinity
  for (let page = 1; page <= maxPages && rows.length < total; page++) {
    const url = buildUrl(key, { numOfRows: String(pageSize), pageNo: String(page), basDt })
    const r = unwrap(await fetchJson(url, { timeout: 15000, retries: 2 }))
    total = r.total
    rows.push(...r.rows)
    if (r.rows.length < pageSize) break
  }
  return { basDt, total, rows }
}

/** 원본 레코드 → 내부 표준 스키마 */
export function normalize (row) {
  const close = num(row.clpr)
  const shares = num(row.lstgStCnt) // 상장좌수
  const nav = num(row.nav)
  return {
    code: String(row.srtnCd || '').trim(),
    isin: String(row.isinCd || '').trim() || null,
    name: String(row.itmsNm || '').trim(),
    symbol: null, // 국내 상장은 심볼 대신 종목코드를 사용
    market: 'KRX',
    basDt: String(row.basDt || '').trim(),
    close,
    change: num(row.vs),
    changeRate: num(row.fltRt),
    open: num(row.mkp),
    high: num(row.hipr),
    low: num(row.lopr),
    volume: num(row.trqu), // 거래량(좌)
    value: num(row.trPrc), // 거래대금(원)
    nav,
    // 순자산총액: API 가 주면 그 값을, 없으면 NAV × 상장좌수로 추정
    netAssets: num(row.ntastTotAmt) ?? (nav != null && shares != null ? nav * shares : null),
    marketCap: num(row.mrktTotAmt),
    shares,
    benchmarkRaw: String(row.bssIdxIdxNm || '').trim() || null,
    benchmarkClose: num(row.bssIdxClpr)
  }
}

/** 전종목 수집 + 정규화 */
export async function loadKrxEtfs (key) {
  const basDt = await findLatestBasDt(key)
  const { rows, total } = await fetchAll(key, basDt)
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const rec = normalize(row)
    if (!rec.code || seen.has(rec.code)) continue
    seen.add(rec.code)
    out.push(rec)
  }
  return { basDt, total, items: out }
}
