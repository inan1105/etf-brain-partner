#!/usr/bin/env node
// ── 스냅샷 생성 ──
//
//   npm run snapshot
//
// 국내: KRX_AUTH_KEY(KRX 정보데이터시스템) → DATA_GO_KR_KEY(공공데이터포털) 순으로 시도.
// 해외: Yahoo Finance (키 불필요).
// 결과를 public/data/etfs.snapshot.json 으로 저장한다.
// 국내 키가 없으면 그 부분만 동봉 시드로 채우며, 앱은 프록시 없이 단독으로 동작한다.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// .env 를 자동으로 읽는다 (Node 20.6+). 없으면 조용히 넘어간다.
try { process.loadEnvFile() } catch { /* .env 없음 — 시드로 동작 */ }

import { loadDomestic, SOURCE_LABEL } from '../api/_lib/domestic.js'
import { loadQuotes, usdKrwRate } from '../api/_lib/yahoo.js'
import { classify } from '../shared/taxonomy.js'
import { US_ETFS } from '../shared/us-etfs.js'
import { KRX_SEED } from '../shared/krx-seed.js'
import { feeOf, FEES_UPDATED_AT } from '../shared/fees.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/data/etfs.snapshot.json')

function decorate (rec, fxToKrw = null) {
  const tags = classify({
    name: rec.name,
    benchmark: rec.benchmarkRaw,
    symbol: rec.symbol,
    market: rec.market
  })
  const expenseRatio = rec.expenseRatio ?? feeOf(rec.code)

  // 거래대금 통화 통일 — 정렬·필터 전용 원화 환산값
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
    queryKey: rec.market === 'US' ? rec.symbol : rec.code,
    haystack: [
      rec.code, rec.symbol, rec.name, rec.benchmarkRaw, rec.isin,
      tags.issuer, tags.brand, tags.benchmark, tags.region, tags.asset,
      ...(tags.sectors || []), ...(tags.themes || []), ...(tags.strategy || [])
    ].filter(Boolean).join(' ').toLowerCase()
  }
}

async function main () {
  let krxRaw = KRX_SEED
  let asOf = null
  let live = false
  let domesticSource = null

  process.stdout.write('국내 ETF 수집 중 (KRX 정보데이터시스템 → 공공데이터포털 순)…\n')
  try {
    const r = await loadDomestic()
    krxRaw = r.items
    asOf = r.basDt
    domesticSource = r.source
    live = true
    process.stdout.write(`  ${SOURCE_LABEL[r.source]} · 기준일 ${asOf} · ${r.items.length}종목\n`)
  } catch (e) {
    process.stderr.write(`  실패: ${e.message}\n  국내는 동봉 시드로 채웁니다.\n`)
  }

  // 해외 상장 ETF 는 Yahoo Finance 에서 받는다 (키 불필요).
  // range=2y 로 받아 1년 수익률까지 정확히 계산한다.
  process.stdout.write('Yahoo Finance 에서 해외 ETF 시세 수집 중…\n')
  let usQuoted = 0
  let usRows = US_ETFS
  let fx = null
  try {
    ;[fx] = await Promise.all([usdKrwRate().catch(() => null)])
    const quotes = await loadQuotes(US_ETFS.map(e => e.symbol), { range: '2y', concurrency: 8 })
    usQuoted = quotes.size
    usRows = US_ETFS.map(rec => {
      const q = quotes.get(rec.symbol)
      return q ? { ...rec, ...q, symbol: rec.symbol, name: rec.name } : rec
    })
    process.stdout.write(`  ${usQuoted}/${US_ETFS.length}종목 수신\n`)
  } catch (e) {
    process.stderr.write(`  실패: ${e.message} — 해외는 목록만 담습니다.\n`)
  }

  const items = [...krxRaw.map(r => decorate(r)), ...usRows.map(r => decorate(r, fx))]

  const payload = {
    meta: {
      version: '1.0.1',
      asOf,
      generatedAt: new Date().toISOString(),
      feesUpdatedAt: FEES_UPDATED_AT,
      bootstrap: !live,
      domesticSource,
      usdKrw: fx,
      counts: { krx: krxRaw.length, us: US_ETFS.length, usQuoted, total: items.length },
      sources: [
        live
          ? { name: SOURCE_LABEL[domesticSource], scope: '국내 상장 ETF 시세·NAV·순자산·기초지수', live: true }
          : { name: 'ETF 브레인 파트너 동봉 시드', scope: '국내 상장 ETF 종목 목록 (시세 미제공)', live: false },
        {
          name: 'Yahoo Finance',
          scope: `해외 상장 ETF 시세·거래량·기간수익률 (${usQuoted}/${US_ETFS.length}종목)`,
          live: usQuoted > 0
        },
        { name: '총보수 큐레이션', scope: `보수 참고값 (${FEES_UPDATED_AT} 기준)`, live: false }
      ]
    },
    items
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload), 'utf8')

  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)
  process.stdout.write(`저장 완료: public/data/etfs.snapshot.json (${items.length}종목, ${kb}KB)\n`)
  if (!live) {
    process.stdout.write('⚠ 국내 시세가 비어 있습니다. KRX_AUTH_KEY(또는 DATA_GO_KR_KEY)를 설정하고 다시 실행하세요.\n')
  }
  if (!usQuoted) {
    process.stdout.write('⚠ 해외 시세를 받지 못했습니다. 네트워크 또는 Yahoo 응답 구조를 확인하세요.\n')
  }
}

main().catch(e => {
  process.stderr.write(`스냅샷 생성 실패: ${e.stack || e.message}\n`)
  process.exit(1)
})
