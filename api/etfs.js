// ── GET /api/etfs ──
// 국내 상장 ETF(금융위 실시간) + 해외 상장 ETF(동봉 목록)를 하나의
// 정규화된 페이로드로 합쳐 반환한다. 분류·보수 보강까지 서버에서 끝내므로
// 클라이언트는 필터링과 렌더링만 담당한다.

import { loadDomestic, SOURCE_LABEL } from './_lib/domestic.js'
import { loadQuotes, usdKrwRate } from './_lib/yahoo.js'
import { enrich } from './_lib/kofia.js'
import { json } from './_lib/http.js'
import { classify } from '../shared/taxonomy.js'
import { US_ETFS } from '../shared/us-etfs.js'
import { KRX_SEED } from '../shared/krx-seed.js'
import { feeOf, FEES_UPDATED_AT } from '../shared/fees.js'

// 람다 인스턴스 재사용 구간의 메모리 캐시 (CDN 캐시 앞단의 2차 방어)
let cache = null
const TTL_MS = 15 * 60 * 1000

function decorate (rec, fxToKrw = null) {
  const tags = classify({
    name: rec.name,
    benchmark: rec.benchmarkRaw,
    symbol: rec.symbol,
    market: rec.market
  })
  const expenseRatio = rec.expenseRatio ?? feeOf(rec.code)

  // 거래대금은 국내가 원, 해외가 달러다. 정렬·필터가 통화를 섞지 않도록
  // 비교 전용 원화 환산값을 따로 둔다. 화면에는 원래 통화로 표시한다.
  const valueKrw =
    rec.market === 'US'
      ? (rec.value != null && fxToKrw ? rec.value * fxToKrw : null)
      : rec.value

  return {
    ...rec,
    ...tags,
    expenseRatio,
    valueKrw,
    fxToKrw: rec.market === 'US' ? fxToKrw : null,
    // 기술적분석·스토커에 전달할 식별자: 국내는 종목코드, 해외는 심볼
    queryKey: rec.market === 'US' ? rec.symbol : rec.code,
    // 검색용 평문 인덱스 (종목코드·종목명·심볼·지수·섹터·테마 전부 포함)
    haystack: [
      rec.code, rec.symbol, rec.name, rec.benchmarkRaw, rec.isin,
      tags.issuer, tags.brand, tags.benchmark, tags.region, tags.asset,
      ...(tags.sectors || []), ...(tags.themes || []), ...(tags.strategy || [])
    ].filter(Boolean).join(' ').toLowerCase()
  }
}

/** 해외 상장 ETF 에 Yahoo 시세를 얹는다. 실패한 종목은 목록만 남는다. */
export async function buildUs (range = '1y') {
  let quotes = new Map()
  let fx = null
  try {
    ;[quotes, fx] = await Promise.all([
      loadQuotes(US_ETFS.map(e => e.symbol), { range, concurrency: 8 }),
      usdKrwRate().catch(() => null)
    ])
  } catch { /* Yahoo 실패는 목록 표시로 대체 */ }

  const items = US_ETFS.map(rec => {
    const q = quotes.get(rec.symbol)
    return decorate(q ? { ...rec, ...q, symbol: rec.symbol, name: rec.name } : rec, fx)
  })
  return { items, quoted: quotes.size, fx }
}

async function build () {
  // 국내와 해외는 원천이 다르므로 한쪽이 죽어도 다른 쪽은 살린다.
  const [krxResult, usResult] = await Promise.allSettled([
    loadDomestic(),
    buildUs('1y')
  ])

  const us = usResult.status === 'fulfilled' ? usResult.value : { items: [], quoted: 0, fx: null }
  const krxErr = krxResult.status === 'rejected' ? krxResult.reason : null

  let krx = []
  let basDt = null
  let domesticSource = null

  if (krxResult.status === 'fulfilled') {
    basDt = krxResult.value.basDt
    domesticSource = krxResult.value.source

    // 선택적 보강 (설정 없으면 빈 맵)
    let extra = new Map()
    try {
      extra = await enrich(basDt)
    } catch { /* 보강 실패는 무시 */ }

    krx = krxResult.value.items.map(rec => {
      const add = extra.get(rec.isin) || extra.get(rec.code)
      const merged = add
        ? { ...rec, expenseRatio: add.expenseRatio ?? rec.expenseRatio }
        : rec
      const out = decorate(merged)
      if (add?.issuer) out.issuer = add.issuer
      return out
    })
  }

  // 국내 원천이 막혀도 종목 목록까지 사라지면 안 된다.
  // 시세 없이라도 시드를 내보내야 검색·분류·기술적분석/스토커 연결이 살아 있다.
  // (스냅샷 경로는 이미 이렇게 동작한다 — 라이브도 같은 보장을 해야 한다)
  let domesticFallback = false
  if (!krx.length) {
    krx = KRX_SEED.map(rec => decorate(rec))
    domesticFallback = true
  }

  // 그래도 아무것도 없으면 진짜 장애다
  if (!krx.length && !us.items.length) throw krxErr || new Error('데이터를 받지 못했습니다')

  return {
    meta: {
      version: '1.0.1',
      asOf: basDt,
      generatedAt: new Date().toISOString(),
      feesUpdatedAt: FEES_UPDATED_AT,
      domesticSource,
      domesticFallback,
      krxError: krxErr ? krxErr.message : undefined,
      usdKrw: us.fx ?? null,
      counts: { krx: krx.length, us: us.items.length, usQuoted: us.quoted, total: krx.length + us.items.length },
      sources: [
        domesticSource
          ? { name: SOURCE_LABEL[domesticSource], scope: '국내 상장 ETF 시세·NAV·순자산·기초지수', live: true }
          : { name: 'ETF 브레인 파트너 동봉 시드', scope: '국내 상장 ETF 종목 목록 (시세 미제공)', live: false },
        {
          name: 'Yahoo Finance',
          scope: `해외 상장 ETF 시세·거래량·기간수익률 (${us.quoted}/${us.items.length}종목)`,
          live: us.quoted > 0
        },
        { name: '총보수 큐레이션', scope: `보수 참고값 (${FEES_UPDATED_AT} 기준)`, live: false }
      ]
    },
    items: [...krx, ...us.items]
  }
}

export default async function handler (req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET 만 허용됩니다' })

  const fresh = 'refresh' in (req.query || {})
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) {
    return json(res, 200, cache.payload, 900)
  }

  try {
    const payload = await build()
    cache = { at: Date.now(), payload }
    return json(res, 200, payload, 900)
  } catch (e) {
    // 캐시가 있으면 만료됐더라도 장애 중에는 그것을 내보낸다
    if (cache) {
      return json(res, 200, { ...cache.payload, meta: { ...cache.payload.meta, stale: true, error: e.message } }, 60)
    }
    const status = /NO_KEY|UNAVAILABLE/.test(e.code || '') ? 503 : 502
    return json(res, status, {
      error: e.message,
      hint: '.env 에 KRX_AUTH_KEY(KRX 정보데이터시스템 Open API 키)를 설정하세요. '
        + '대체 경로로 DATA_GO_KR_KEY 도 사용할 수 있습니다.'
    })
  }
}
