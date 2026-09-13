// ── GET /api/fund?name=KODEX%20200&code=069500 ──
//
// 국내 ETF 한 종목의 금융투자협회 전자공시 '펀드요약정보'.
// 펀드기본정보 · 수익률 추이 · 가격변동 추이 · 자산구성내역 · 결산 및 상환.
// 협회는 공개 API 가 아니므로 결과를 오래 캐시해 호출 수를 줄이고,
// 같은 IP 의 연속 호출은 막는다 (협회 쪽에서 우리 서버가 차단되지 않도록).

import { findFund, fundDetail, KOFIA_HOME } from './_lib/kofia.js'
import { guard } from './_lib/guard.js'
import { json } from './_lib/http.js'

const cache = new Map() // code|name → { at, payload }
const TTL_MS = 60 * 60 * 1000

export default async function handler (req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET 만 허용됩니다' })

  const name = String(req.query?.name || '').trim().slice(0, 80)
  const code = String(req.query?.code || '').trim().slice(0, 12)
  if (!name) return json(res, 400, { error: 'name 파라미터가 필요합니다' })

  const key = code || name
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return json(res, 200, hit.payload, 3600)

  const blocked = guard(req, { max: 30 })
  if (blocked) return json(res, blocked.status, blocked.body)

  try {
    const fund = await findFund(name)
    if (!fund) {
      return json(res, 404, {
        error: '금융투자협회 전자공시에서 이 종목의 펀드를 찾지 못했습니다',
        hint: '종목명이 바뀌었거나 협회 공식 펀드명과 표기가 다를 수 있습니다. 협회 사이트에서 직접 검색해 보세요.',
        kofiaUrl: KOFIA_HOME
      }, 600)
    }

    const detail = await fundDetail(fund)
    const payload = { fund, ...detail, fetchedAt: new Date().toISOString() }

    // 다섯 탭이 모두 실패했다면 캐시하지 않는다 — 일시 장애일 가능성이 크다
    const ok = ['basic', 'returns', 'price', 'assets', 'settle'].some(k => payload[k])
    if (!ok) return json(res, 502, { error: '협회 전자공시가 응답하지 않습니다', detail: payload.errors, kofiaUrl: payload.sourceUrl })

    cache.set(key, { at: Date.now(), payload })
    if (cache.size > 300) cache.delete(cache.keys().next().value)
    return json(res, 200, payload, 3600)
  } catch (e) {
    return json(res, 502, { error: '협회 전자공시 조회에 실패했습니다', detail: e.message, kofiaUrl: KOFIA_HOME })
  }
}
