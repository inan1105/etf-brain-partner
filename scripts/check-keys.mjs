#!/usr/bin/env node
// ── 데이터 원천 연결 점검 ──
//
//   npm run check
//
// 각 원천이 지금 어떤 상태인지 한 번에 보여준다.
// 키 승인을 기다리는 동안 "됐는지" 확인하려고 앱을 띄울 필요가 없게 하는 것이 목적이다.

try { process.loadEnvFile() } catch { /* .env 없음 */ }

import { ymd, todayKST } from '../api/_lib/http.js'

const ok = s => `\x1b[32m${s}\x1b[0m`
const bad = s => `\x1b[31m${s}\x1b[0m`
const warn = s => `\x1b[33m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

/** 최근 영업일 후보 — 주말은 건너뛴다 */
function recentDates (n = 5) {
  const out = []
  const c = todayKST()
  while (out.length < n) {
    const day = c.getDay()
    if (day !== 0 && day !== 6) out.push(ymd(c))
    c.setDate(c.getDate() - 1)
  }
  return out
}

async function checkKrx () {
  const key = process.env.KRX_AUTH_KEY
  if (!key) return { name: 'KRX 정보데이터시스템', state: 'skip', msg: 'KRX_AUTH_KEY 미설정' }

  for (const basDd of recentDates()) {
    const url = `https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=${basDd}`
    try {
      const r = await fetch(url, { headers: { AUTH_KEY: key } })
      const t = await r.text()
      if (r.ok) {
        const rows = JSON.parse(t).OutBlock_ || []
        if (rows.length) {
          return { name: 'KRX 정보데이터시스템', state: 'ok', msg: `${basDd} · ${rows.length}종목` }
        }
        continue // 휴장일 — 이전 날짜로
      }
      const msg = (() => { try { return JSON.parse(t).respMsg } catch { return t.slice(0, 60) } })()
      if (/Unauthorized API Call/i.test(msg)) {
        return {
          name: 'KRX 정보데이터시스템',
          state: 'pending',
          msg: '키는 유효 · API 이용 권한 없음 (활용신청 승인 대기)',
          hint: 'data.krx.co.kr → 오픈API → 마이페이지 에서 "ETF 일별매매정보" 승인 확인'
        }
      }
      if (/Unauthorized Key/i.test(msg)) {
        return {
          name: 'KRX 정보데이터시스템',
          state: 'fail',
          msg: '키를 인식하지 못함',
          hint: 'KRX_AUTH_KEY 값을 다시 확인하세요 (공공데이터포털 키와 다릅니다)'
        }
      }
      return { name: 'KRX 정보데이터시스템', state: 'fail', msg: `${r.status} ${msg}` }
    } catch (e) {
      return { name: 'KRX 정보데이터시스템', state: 'fail', msg: e.message }
    }
  }
  return { name: 'KRX 정보데이터시스템', state: 'fail', msg: '최근 영업일 데이터 없음' }
}

async function checkDataGoKr () {
  const key = process.env.DATA_GO_KR_KEY
  if (!key) return { name: '공공데이터포털 (대체)', state: 'skip', msg: 'DATA_GO_KR_KEY 미설정' }

  const base = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo'
  for (const basDt of recentDates()) {
    const qs = new URLSearchParams({ serviceKey: key, resultType: 'json', numOfRows: '1', pageNo: '1', basDt })
    try {
      const r = await fetch(`${base}?${qs}`)
      const t = await r.text()
      if (r.ok) {
        const total = JSON.parse(t)?.response?.body?.totalCount ?? 0
        if (total > 0) return { name: '공공데이터포털 (대체)', state: 'ok', msg: `${basDt} · ${total}종목` }
        continue
      }
      const msg = t.match(/returnAuthMsg>?"?:?\s*"?([^"<,}]+)/)?.[1] || `${r.status}`
      return {
        name: '공공데이터포털 (대체)',
        state: 'fail',
        msg: msg.trim(),
        hint: 'https://www.data.go.kr/iim/api/selectApiKeyList.do 에서 활용신청 승인 상태 확인'
      }
    } catch (e) {
      return { name: '공공데이터포털 (대체)', state: 'fail', msg: e.message }
    }
  }
  return { name: '공공데이터포털 (대체)', state: 'fail', msg: '최근 영업일 데이터 없음' }
}

async function checkYahoo () {
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5d&interval=1d', {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }
    })
    if (!r.ok) return { name: 'Yahoo Finance (해외)', state: 'fail', msg: `HTTP ${r.status}` }
    const m = (await r.json())?.chart?.result?.[0]?.meta
    return m?.regularMarketPrice
      ? { name: 'Yahoo Finance (해외)', state: 'ok', msg: `SPY ${m.regularMarketPrice} ${m.currency}` }
      : { name: 'Yahoo Finance (해외)', state: 'fail', msg: '응답 구조가 예상과 다릅니다' }
  } catch (e) {
    return { name: 'Yahoo Finance (해외)', state: 'fail', msg: e.message }
  }
}

async function checkOpenAI () {
  const key = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o'
  if (!key) return { name: `OpenAI (${model})`, state: 'skip', msg: 'OPENAI_API_KEY 미설정 — AI 해설만 비활성' }
  try {
    const r = await fetch('https://api.openai.com/v1/models/' + encodeURIComponent(model), {
      headers: { authorization: `Bearer ${key}` }
    })
    if (r.ok) return { name: `OpenAI (${model})`, state: 'ok', msg: '모델 사용 가능' }
    const msg = (await r.json())?.error?.message || `HTTP ${r.status}`
    return { name: `OpenAI (${model})`, state: 'fail', msg, hint: 'OPENAI_MODEL 로 사용 가능한 모델을 지정하세요' }
  } catch (e) {
    return { name: `OpenAI (${model})`, state: 'fail', msg: e.message }
  }
}

const MARK = { ok: ok('●  정상'), pending: warn('●  대기'), fail: bad('●  실패'), skip: dim('○  미설정') }

const results = await Promise.all([checkKrx(), checkDataGoKr(), checkYahoo(), checkOpenAI()])

process.stdout.write('\nETF 브레인 파트너 — 데이터 원천 점검\n')
process.stdout.write('─'.repeat(64) + '\n')
for (const r of results) {
  process.stdout.write(`${MARK[r.state]}  ${r.name.padEnd(26)} ${r.msg}\n`)
  if (r.hint) process.stdout.write(`${' '.repeat(10)}${dim('→ ' + r.hint)}\n`)
}
process.stdout.write('─'.repeat(64) + '\n')

const domestic = results.slice(0, 2).some(r => r.state === 'ok')
process.stdout.write(
  domestic
    ? ok('국내 시세 연결됨 — npm run snapshot 으로 반영하세요.\n\n')
    : warn('국내 시세 미연결 — 해외(Yahoo)만으로도 앱은 동작합니다.\n\n')
)
