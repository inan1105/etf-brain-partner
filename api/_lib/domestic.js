// ── 국내 상장 ETF 원천 선택 ──
//
// 1순위: KRX 정보데이터시스템 Open API (KRX_AUTH_KEY)
//        순자산총액·NAV·기초지수를 직접 제공해 추정이 필요 없다.
// 2순위: 공공데이터포털 금융위 ETF시세정보 (DATA_GO_KR_KEY)
//        KRX 키가 없거나 KRX 가 장애일 때의 대체 경로.
//
// 두 원천은 같은 내부 스키마로 정규화되므로 호출측은 어느 쪽인지 신경 쓰지 않는다.

import { loadKrxEtfs as loadFromKrx, closesOn as krxClosesOn } from './krx.js'
import { loadKrxEtfs as loadFromMofin, findLatestBasDt, fetchAll, normalize as mofinNormalize } from './mofin.js'

export const SOURCE_LABEL = {
  krx: 'KRX 정보데이터시스템 Open API',
  mofin: '금융위원회 ETF시세정보 (공공데이터포털)'
}

/**
 * 국내 ETF 전종목을 가져온다.
 * @returns {Promise<{basDt:string, items:Array, source:'krx'|'mofin'}>}
 */
export async function loadDomestic () {
  const krxKey = process.env.KRX_AUTH_KEY
  const mofinKey = process.env.DATA_GO_KR_KEY
  const errors = []

  if (krxKey) {
    try {
      const r = await loadFromKrx(krxKey)
      return { ...r, source: 'krx' }
    } catch (e) {
      errors.push(`KRX: ${e.message}`)
      // 인증·스키마 오류는 대체 원천으로 넘어가 볼 가치가 있다
    }
  } else {
    errors.push('KRX: KRX_AUTH_KEY 미설정')
  }

  if (mofinKey) {
    try {
      const r = await loadFromMofin(mofinKey)
      return { ...r, source: 'mofin' }
    } catch (e) {
      errors.push(`공공데이터포털: ${e.message}`)
    }
  } else {
    errors.push('공공데이터포털: DATA_GO_KR_KEY 미설정')
  }

  const err = new Error(`국내 ETF 시세를 받지 못했습니다 — ${errors.join(' / ')}`)
  err.code = 'DOMESTIC_UNAVAILABLE'
  err.detail = errors
  throw err
}

/**
 * 지정 기준일의 종가 맵 — 기간수익률 계산용.
 * 휴장일에는 없으므로 호출측이 날짜를 물리며 재시도한다.
 */
export async function closesOn (basDd, source) {
  if (source === 'krx') return krxClosesOn(process.env.KRX_AUTH_KEY, basDd)

  const { rows } = await fetchAll(process.env.DATA_GO_KR_KEY, basDd, { pageSize: 1000, maxPages: 5 })
  if (!rows.length) return null
  const map = new Map()
  for (const row of rows) {
    const rec = mofinNormalize(row)
    if (rec.code && rec.close) map.set(rec.code, rec.close)
  }
  return map.size ? map : null
}

export { findLatestBasDt }
