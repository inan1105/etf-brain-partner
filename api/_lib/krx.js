// ── KRX 정보데이터시스템 Open API 어댑터 (국내 상장 ETF) ──
//
//   https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=YYYYMMDD
//   헤더: AUTH_KEY: <KRX 발급 인증키>
//
// 키 발급: data.krx.co.kr → 오픈API → 이용신청 (공공데이터포털 키와 별개다)
//
// 왜 이 경로인가
//   · data.krx.co.kr 의 화면용 내부 엔드포인트(getJsonData.cmd)는 세션·OTP 검증이
//     걸려 있어 서버에서 호출하면 'LOGOUT' 으로 거부된다. 공식 API 가 유일하게
//     안정적인 경로다.
//   · 경로 유효성은 응답 코드로 구분된다 — 401 Unauthorized Key(경로 존재, 키 문제),
//     404(경로 없음). 아래 진단 메시지가 이 둘을 구분해 알려준다.

import { fetchJson, ymd, todayKST, HttpError } from './http.js'

const BASE = 'https://data-dbg.krx.co.kr/svc/apis'

const num = v => {
  if (v === null || v === undefined || v === '' || v === '-') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const str = v => {
  const s = String(v ?? '').trim()
  return s && s !== '-' ? s : null
}

/** KRX 는 인증키를 헤더로 받는다 (쿼리스트링이 아니다) */
async function call (key, path, params = {}) {
  const qs = new URLSearchParams(params)
  const url = `${BASE}/${path}${qs.toString() ? `?${qs}` : ''}`
  return fetchJson(url, {
    timeout: 15000,
    retries: 2,
    headers: { AUTH_KEY: key }
  })
}

/**
 * 응답에서 행 배열을 꺼낸다.
 * KRX 는 OutBlock_ 을 쓰지만 서비스별로 키가 다를 수 있어 방어적으로 찾는다.
 */
function rowsOf (payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.OutBlock_)) return payload.OutBlock_
  if (Array.isArray(payload?.outBlock_)) return payload.outBlock_
  // 알 수 없는 구조 — 배열인 첫 번째 속성을 쓴다
  for (const v of Object.values(payload || {})) if (Array.isArray(v)) return v
  return []
}

/** 가장 최근 영업일(데이터가 있는 기준일)을 찾는다 */
export async function findLatestBasDd (key, maxBack = 12) {
  const cursor = todayKST()
  for (let i = 0; i < maxBack; i++) {
    const basDd = ymd(cursor)
    try {
      const payload = await call(key, 'etp/etf_bydd_trd', { basDd })
      if (rowsOf(payload).length) return basDd
    } catch (e) {
      // 인증 오류는 날짜를 바꿔도 같으므로 즉시 전파
      if (e instanceof HttpError && (e.status === 401 || e.status === 403)) throw authError(e)
      if (e instanceof HttpError && e.status === 404) throw pathError(e)
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  throw new Error(`KRX: 최근 ${maxBack}일 내 ETF 시세 데이터를 찾지 못했습니다`)
}

/**
 * KRX 는 401 을 두 가지 뜻으로 쓴다. 조치가 완전히 달라서 반드시 구분해야 한다.
 *
 *   "Unauthorized Key"      → 키 자체를 모른다. 오타이거나 발급받지 않은 키.
 *   "Unauthorized API Call" → 키는 인식된다. 다만 이 API 의 이용 권한이 없다.
 *                             (서비스별 활용신청 미승인 또는 승인 반영 대기)
 *
 * 전자를 후자처럼 안내하면 사용자가 멀쩡한 키를 다시 발급받게 되므로 위험하다.
 */
function authError (e) {
  const body = String(e?.body ?? '')
  const apiScope = /Unauthorized API Call/i.test(body)

  const err = new Error(
    apiScope
      ? 'KRX 인증키는 유효하지만 이 API 의 이용 권한이 없습니다 (Unauthorized API Call). ' +
        'data.krx.co.kr → 오픈API → 마이페이지 에서 "ETF 일별매매정보" 서비스의 ' +
        '활용신청이 승인되었는지 확인하세요. 승인 직후에는 반영에 시간이 걸릴 수 있습니다.'
      : 'KRX 인증키를 인식하지 못했습니다 (Unauthorized Key). ' +
        'data.krx.co.kr → 오픈API → 이용신청 에서 발급받은 키를 KRX_AUTH_KEY 에 설정하세요. ' +
        '공공데이터포털(data.go.kr) 키와는 서로 다른 키입니다.'
  )
  err.code = apiScope ? 'KRX_API_SCOPE' : 'KRX_AUTH'
  err.cause = e
  return err
}

function pathError (e) {
  const err = new Error(
    'KRX API 경로를 찾을 수 없습니다. 서비스 개편으로 엔드포인트가 바뀌었을 수 있습니다. ' +
    '(현재 경로: etp/etf_bydd_trd)'
  )
  err.code = 'KRX_PATH'
  err.cause = e
  return err
}

/**
 * 원본 레코드 → 내부 표준 스키마 (mofin.js 와 동일한 모양)
 *
 * 필드명은 KRX 문서 기준이되, 개편에 대비해 후보를 나열해 첫 번째로 존재하는 값을 쓴다.
 */
function pick (row, ...keys) {
  for (const k of keys) if (row[k] !== undefined) return row[k]
  return undefined
}

export function normalize (row) {
  const close = num(pick(row, 'TDD_CLSPRC', 'CLSPRC'))
  const shares = num(pick(row, 'LIST_SHRS'))
  const nav = num(pick(row, 'NAV'))

  return {
    code: str(pick(row, 'ISU_CD', 'ISU_SRT_CD')) || '',
    isin: str(pick(row, 'ISU_SRT_CD')) && str(pick(row, 'ISU_CD'))?.length === 12
      ? str(pick(row, 'ISU_CD'))
      : null,
    name: str(pick(row, 'ISU_NM', 'ISU_ABBRV')) || '',
    symbol: null,
    market: 'KRX',
    basDt: str(pick(row, 'BAS_DD')),
    close,
    change: num(pick(row, 'CMPPREVDD_PRC')),
    changeRate: num(pick(row, 'FLUC_RT')),
    open: num(pick(row, 'TDD_OPNPRC', 'OPNPRC')),
    high: num(pick(row, 'TDD_HGPRC', 'HGPRC')),
    low: num(pick(row, 'TDD_LWPRC', 'LWPRC')),
    volume: num(pick(row, 'ACC_TRDVOL')),
    value: num(pick(row, 'ACC_TRDVAL')),
    nav,
    // 순자산총액을 직접 주므로 추정할 필요가 없다 (공공데이터포털 대비 장점)
    netAssets: num(pick(row, 'INVSTASST_NETASST_TOTAMT', 'NETASST_TOTAMT')) ??
      (nav != null && shares != null ? nav * shares : null),
    marketCap: num(pick(row, 'MKTCAP')),
    shares,
    benchmarkRaw: str(pick(row, 'IDX_IND_NM')),
    benchmarkClose: num(pick(row, 'OBJ_STKPRC_IDX'))
  }
}

/** 전종목 수집 + 정규화 */
export async function loadKrxEtfs (key) {
  if (!key) {
    const err = new Error('KRX_AUTH_KEY 환경변수가 설정되지 않았습니다')
    err.code = 'NO_KEY'
    throw err
  }

  let basDd
  try {
    basDd = await findLatestBasDd(key)
  } catch (e) {
    throw e
  }

  const payload = await call(key, 'etp/etf_bydd_trd', { basDd })
  const rows = rowsOf(payload)

  if (!rows.length) throw new Error(`KRX: ${basDd} 기준 데이터가 비어 있습니다`)

  const seen = new Set()
  const items = []
  for (const row of rows) {
    const rec = normalize(row)
    if (!rec.code || !rec.name || seen.has(rec.code)) continue
    seen.add(rec.code)
    items.push(rec)
  }

  // 필드명이 바뀌면 조용히 빈 목록이 되는 것이 가장 위험하다.
  // 원본 행은 있는데 하나도 매핑되지 않으면 키 목록을 담아 올린다.
  if (!items.length) {
    const err = new Error(
      `KRX: 응답 ${rows.length}행을 받았지만 필드 매핑에 실패했습니다. ` +
      `응답 필드: ${Object.keys(rows[0] || {}).join(', ')}`
    )
    err.code = 'KRX_SCHEMA'
    throw err
  }

  return { basDt: basDd, total: rows.length, items }
}

/** 특정 기준일의 종가 맵 — 기간수익률 계산용 */
export async function closesOn (key, basDd) {
  const payload = await call(key, 'etp/etf_bydd_trd', { basDd })
  const rows = rowsOf(payload)
  const map = new Map()
  for (const row of rows) {
    const rec = normalize(row)
    if (rec.code && rec.close) map.set(rec.code, rec.close)
  }
  return map.size ? map : null
}
