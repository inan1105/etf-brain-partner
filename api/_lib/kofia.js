// ── 금융투자협회(KOFIA) 전자공시 보강 어댑터 ──
//
// 출처: https://dis.kofia.or.kr/websquare/webSquare.jsp?w2xPath=/wq/fundMgr/DISFundMgrFundWebSrch.xml
//
// ⚠ 주의 — 이것은 공개 REST API 가 아니다.
// KOFIA 전자공시는 WebSquare(프로프레임) 기반이며, 화면이 XML 전문을
// /proframeWeb/XMLSERVICES/ 로 POST 하는 구조다. 전송 경로 자체는 동작을
// 확인했으나(HTTP 200 + proframeHeader 응답), 서비스명(pfmSvcName)은 공개되지
// 않은 스크립트에 정의되어 있고 협회 개편 시 예고 없이 바뀐다.
//
// 그래서 이 모듈은 "검증된 전송 계층 + 주입 가능한 서비스명" 형태로 둔다.
// KOFIA_ENRICH=1 과 KOFIA_SVC_NAME 을 함께 설정해야 동작하며, 실패해도
// 본 서비스의 주 원천(금융위 API)에는 영향을 주지 않는다.
//
// 종목 상세의 '펀드요약정보' 탭(findFund / fundDetail)은 별도다 — 아래 설명 참고.

import { ymd, todayKST } from './http.js'

const ENDPOINT = 'https://dis.kofia.or.kr/proframeWeb/XMLSERVICES/'

const enabled = () => process.env.KOFIA_ENRICH === '1' && !!process.env.KOFIA_SVC_NAME

function buildEnvelope ({ appName, svcName, fnName, dto, body }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<message><proframeHeader><pfmAppName>${appName}</pfmAppName><pfmSvcName>${svcName}</pfmSvcName><pfmFnName>${fnName}</pfmFnName></proframeHeader><systemHeader></systemHeader><${dto}>${body}</${dto}></message>`
}

const xmlEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const xmlUnesc = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')

/** 아주 단순한 반복 태그 파서 — 프로프레임 응답은 평평한 구조라 이것으로 충분하다 */
function parseRows (xml, rowTag) {
  const rows = []
  const re = new RegExp(`<${rowTag}>([\\s\\S]*?)</${rowTag}>`, 'g')
  let m
  while ((m = re.exec(xml))) {
    const rec = {}
    const fre = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g
    let f
    while ((f = fre.exec(m[1]))) rec[f[1]] = xmlUnesc(f[2].trim())
    rows.push(rec)
  }
  return rows
}

/**
 * 펀드 기본정보(운용사·유형·보수)를 조회한다.
 * 설정이 없으면 조용히 빈 맵을 반환한다 — 보강은 선택 기능이다.
 * @returns {Promise<Map<string, {issuer?:string, fundType?:string, expenseRatio?:number}>>}
 */
export async function enrich (standardDt) {
  if (!enabled()) return new Map()

  const envelope = buildEnvelope({
    appName: process.env.KOFIA_APP_NAME || 'FS-COM',
    svcName: process.env.KOFIA_SVC_NAME,
    fnName: process.env.KOFIA_FN_NAME || 'select',
    dto: process.env.KOFIA_DTO || 'COMFundUnityInfoInputDTO',
    body: `<standardDt>${standardDt}</standardDt><vSrchTp>1</vSrchTp><pageNo>1</pageNo>`
  })

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 12000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'application/xml; charset=UTF-8',
        referer: 'https://dis.kofia.or.kr/websquare/webSquare.jsp?w2xPath=/wq/fundMgr/DISFundMgrFundWebSrch.xml',
        'user-agent': 'Mozilla/5.0'
      },
      body: envelope
    })
    const xml = await res.text()
    if (/MODULE ERROR|pfmResponseType>E</.test(xml)) {
      console.warn('[kofia] 보강 실패 — 서비스명을 확인하세요:', xml.match(/<pfmResponseBasc>([^<]*)/)?.[1])
      return new Map()
    }
    const rows = parseRows(xml, process.env.KOFIA_ROW_TAG || 'selectMeta')
    const map = new Map()
    for (const r of rows) {
      const code = r.standardCd || r.stdCd
      if (!code) continue
      map.set(code, {
        issuer: r.companyNm || undefined,
        fundType: r.fundTypeNm || undefined,
        expenseRatio: r.totalFee ? Number(r.totalFee) : undefined
      })
    }
    return map
  } catch (e) {
    console.warn('[kofia] 보강 건너뜀:', e.message)
    return new Map()
  } finally {
    clearTimeout(timer)
  }
}

// ── 펀드요약정보 (종목 상세의 KOFIA 탭) ──────────────────────────
//
// 전자공시의 '펀드요약정보' 팝업(/wq/com/popup/DISComFundSmryInfo.xml)은
// 탭마다 아래 서비스를 부른다. 팝업 정의 XML 에 서비스명이 그대로 있어
// 위의 보강과 달리 서비스명을 추측할 필요가 없다 (2026-09 확인).
//   펀드기본정보   COMFundUnityBasInfoSO.fundBasInfoSrch · fundStdcotInfoSrch
//   수익률 추이    COMFundUnityPrfRtSO.prfRtAllSrch       (조회기간 1년 이내)
//   가격변동 추이  COMFundPriceModSO.priceModSrch
//   자산구성내역   COMFundAssetsCmpsDescSO.assetsCmpsDescSrch
//   결산 및 상환   COMFundSettleExSO.settleExSrch
//
// ETF 종목코드(KRX)·ISIN(KR7…)은 협회 펀드표준코드(KR5…/K55…)와 다르다.
// 그래서 펀드명 검색(DISComFundSrchSO)으로 표준코드를 찾는다.
// 금액 단위는 협회 표기 그대로 백만원이며, 응답에서 원 단위로 바꿔 내보낸다.

const POPUP_PATH = '/wq/com/popup/DISComFundSmryInfo.xml'
export const KOFIA_HOME = 'https://dis.kofia.or.kr/websquare/index.jsp?w2xPath=/wq/main/main.xml'

async function callService (appName, svcName, fnName, dto, fields) {
  const body = Object.entries(fields).map(([k, v]) => `<${k}>${xmlEsc(v)}</${k}>`).join('')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 12000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'text/xml; charset=UTF-8',
        referer: `https://dis.kofia.or.kr/websquare/popup.html?w2xPath=${POPUP_PATH}`,
        'user-agent': 'Mozilla/5.0'
      },
      body: buildEnvelope({ appName, svcName, fnName, dto, body })
    })
    if (!res.ok) throw new Error(`KOFIA 응답 오류 ${res.status}`)
    const xml = await res.text()
    if (/MODULE ERROR|pfmResponseType>E</.test(xml)) throw new Error(`KOFIA 서비스 오류 (${svcName})`)
    return xml
  } finally {
    clearTimeout(timer)
  }
}

const num = v => (v == null || v === '' ? null : Number(v))
const won = v => (v == null || v === '' ? null : Number(v) * 1e6) // 백만원 → 원

// ── 종목 → 협회 펀드 찾기 ──

const norm = s => s.toUpperCase().replace(/[\s()[\]{}]/g, '')
// 헤지 표기: '(H)' 또는 '(합성 H)'
const isHedged = s => /[(\s]H\)/i.test(s)

/** 공식명에서 '증권상장지수투자신탁…' 이후를 떼고 앞부분(운용사+브랜드+이름)만 남긴다 */
function coreName (official) {
  const s = official.replace(/\s+/g, '')
  const i = s.search(/(증권|부동산|파생|특별자산|혼합자산)?상장지수/)
  return i > 0 ? s.slice(0, i) : s
}

async function searchFunds (word) {
  const xml = await callService('FS-DIS2', 'DISComFundSrchSO', 'search', 'DISComFundSrchListDTO', {
    uFundNm: word, manageCompCd: '', manageStt: '2', uTotCnt: '1' // 운용중 · 펀드명 검색
  })
  return parseRows(xml, 'list').filter(r => /상장지수/.test(r.koreanFundNm || ''))
}

const fundCache = new Map() // 종목명 → { at, fund }
const FUND_TTL_MS = 12 * 60 * 60 * 1000

/**
 * ETF 종목명으로 협회 펀드를 찾는다. 틀린 펀드를 보여주느니 못 찾는 편이 낫다 —
 * 공식명의 앞부분이 종목명으로 끝나는 경우만 받고(앞은 운용사명),
 * 그래도 없을 때만 '브랜드 + 나머지'가 모두 들어간 후보가 딱 하나일 때 받는다.
 * @returns {Promise<null | {standardCd, companyCd, name, shortCd, estDt, matchedBy}>}
 */
export async function findFund (name) {
  const hit = fundCache.get(name)
  if (hit && Date.now() - hit.at < FUND_TTL_MS) return hit.fund

  const plain = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(plain)
  const hedged = isHedged(name)

  let best = null
  for (const r of await searchFunds(plain)) {
    const c = norm(coreName(r.koreanFundNm))
    if (!c.endsWith(target)) continue
    let score = 100 - (c.length - target.length)
    if (isHedged(r.koreanFundNm) !== hedged) score -= 30
    if (!best || score > best.score) best = { r, score, matchedBy: 'exact' }
  }

  // 공식명이 종목명과 조금 다른 경우 (예: TIGER 글로벌자원생산기업 → TIGER모닝스타글로벌자원생산기업)
  const [brand, ...rest] = plain.split(' ')
  if (!best && rest.length) {
    const parts = [norm(brand), norm(rest.join(''))]
    const cands = (await searchFunds(rest.join(' ')))
      .filter(r => parts.every(p => norm(coreName(r.koreanFundNm)).includes(p)))
    // 종목 약칭에는 '(합성 H)' 같은 표기가 빠지기도 하므로, 후보가 하나뿐이면 받는다
    const same = cands.filter(r => isHedged(r.koreanFundNm) === hedged)
    const only = same.length === 1 ? same[0] : cands.length === 1 ? cands[0] : null
    if (only) best = { r: only, matchedBy: 'partial' }
  }

  const fund = best
    ? {
        standardCd: best.r.standardCd,
        companyCd: best.r.manageCompCd,
        name: best.r.koreanFundNm,
        shortCd: best.r.shortCd,
        estDt: best.r.trustEstDt,
        matchedBy: best.matchedBy
      }
    : null

  fundCache.set(name, { at: Date.now(), fund })
  if (fundCache.size > 500) fundCache.delete(fundCache.keys().next().value)
  return fund
}

/** 협회 원문 팝업 주소 — 상담 중 원문을 바로 띄울 수 있게 */
export function popupUrl ({ standardCd, companyCd }, standardDt) {
  const q = new URLSearchParams({
    companyCd, standardCd, standardDt, grntGb: 'S', search: '', check: '1', companyGb: 'A'
  })
  return `https://dis.kofia.or.kr/websquare/webSquare.jsp?w2xPath=${POPUP_PATH}&${q}`
}

// ── 탭별 조회 ──

async function basicTab ({ standardCd, companyCd }, today) {
  const input = { standardCd, companyCd, standardDt: today }
  const [basXml, cotXml] = await Promise.all([
    callService('FS-COM', 'COMFundUnityBasInfoSO', 'fundBasInfoSrch', 'COMFundUnityInfoInputDTO', input),
    callService('FS-COM', 'COMFundUnityBasInfoSO', 'fundStdcotInfoSrch', 'COMFundUnityInfoInputDTO', input)
  ])
  const b = parseRows(basXml, 'COMFundBasInfoOutDTO')[0]
  const c = parseRows(cotXml, 'COMFundStdcotInfoDTO')[0]
  if (!b?.vManageCompNm) throw new Error('기본정보가 비어 있습니다')

  return {
    asOf: b.standardDt || null,
    status: b.val4 || null,
    fundKind: b.vFundGbNm || null,         // 투자신탁/투자회사
    fundType: b.uFundTypNm || null,        // 주식형 등
    trait: b.vTraitDivNm || null,          // ETF
    offering: b.vPriPubGBNm || null,       // 공모/사모
    additional: b.vAdditionalEstMtdNm || null,
    estDt: b.establishmentDt || null,
    initialNav: num(b.establishmentCot),   // 최초설정기준가격
    classCd: b.classCd || null,
    shortCd: b.shortCd || null,
    investRegion: b.vInvestRgnGbNm || null,
    saleRegion: b.vSaleRgnGbNm || null,
    profitType: b.vProfitTypeCdNm || null, // 운용실적공시분류
    // 보수(연 %) — avg 는 같은 유형의 평균
    fees: {
      manage: num(b.manageRewRate), sale: num(b.saleRewRate), trust: num(b.trustRewRate),
      office: num(b.generalOfctrtrewRate), total: num(b.rewSum), ter: num(b.ter),
      frontLoad: num(b.frontendCmsRate), backLoad: num(b.backendCmsRate),
      avg: {
        manage: num(b.uNoVal5), sale: num(b.uNoVal6), trust: num(b.uNoVal7),
        office: num(b.uNoVal8), total: num(b.uNoVal9), ter: num(b.uNoVal10)
      }
    },
    companies: {
      manager: b.vManageCompNm || null, managerUrl: b.val1 || null,
      office: b.vGeneralOfctrtcompNm || null, officeUrl: b.val2 || null,
      trustee: b.vTrustCompNm || null, trusteeUrl: b.val3 || null
    },
    nav: c
      ? {
          asOf: c.standardDt || null,
          value: num(c.standardCot),
          dayChg: num(c.vBefDayFltstdcot), dayChgRt: num(c.vBeDayFltstdcotRt),
          weekChg: num(c.vBefWeekFltstdcot), weekChgRt: num(c.vBefWeeFltstdcotRt),
          originalAmt: won(c.uOriginalAmt),
          netAssets: won(c.netAsstotAmt)
        }
      : null
  }
}

// 협회는 한 번에 6개월치까지만 돌려준다. 더 길게 요청하면 앞쪽을 잘라
// 최근 6개월만 온다. 그래서 1년은 6개월 이내 구간 여러 개로 나눠 받는다.
function sixMonthsAfter (from) {
  const d = new Date(Number(from.slice(0, 4)), Number(from.slice(4, 6)) - 1, Number(from.slice(6, 8)))
  d.setMonth(d.getMonth() + 6)
  d.setDate(d.getDate() - 1)
  return ymd(d)
}

/** [from, to] 를 6개월 이내 구간들로 — 이웃 구간은 경계일을 함께 가진다 */
function windows (from, to) {
  const out = []
  let cur = from
  while (out.length < 4) {
    const end = sixMonthsAfter(cur)
    if (end >= to) { out.push([cur, to]); break }
    out.push([cur, end])
    cur = end
  }
  return out
}

const RETURN_KEYS = ['fund', 'kospi', 'kosdaq', 'bond3y', 'corp3y']

async function returnsWindow ({ standardCd }, from, to) {
  const xml = await callService('FS-COM', 'COMFundUnityPrfRtSO', 'prfRtAllSrch', 'COMFundUnityInfoInputDTO', {
    standardCd, vSrchTrmFrom: from, vSrchTrmTo: to, vSrchStd: '1' // 일일기준
  })
  return parseRows(xml, 'prfRtList').map(r => ({
    d: r.standardDt,
    fund: num(r.managePrfRate),
    kospi: num(r.kospiEpn),
    kosdaq: num(r.kosdaqEpn),
    bond3y: num(r.tbondBnd3y),
    corp3y: num(r.companyBnd3y)
  })).sort((a, b) => a.d.localeCompare(b.d))
}

/** 구간 기준(0%)으로 받은 누적 수익률을 앞 구간의 마지막 값에 곱으로 이어 붙인다 */
function chain (base, r) {
  const out = { d: r.d }
  for (const k of RETURN_KEYS) {
    out[k] = r[k] == null || base[k] == null
      ? null
      : Math.round(((1 + base[k] / 100) * (1 + r[k] / 100) - 1) * 10000) / 100
  }
  return out
}

async function returnsTab (fund, from, to) {
  // 값은 조회 시작일 대비 누적 수익률(%)이다.
  // 다음 구간은 앞 구간의 마지막 거래일에서 시작해야 그날이 0% 기준이 되므로 차례로 받는다.
  const rows = []
  let cur = from
  for (let i = 0; i < 4; i++) {
    const end = sixMonthsAfter(cur) < to ? sixMonthsAfter(cur) : to
    const part = await returnsWindow(fund, cur, end)
    const base = rows[rows.length - 1]
    for (const r of part) {
      if (!base) rows.push(r)
      else if (r.d > base.d) rows.push(chain(base, r))
    }
    const last = rows[rows.length - 1]?.d
    if (end === to || !last || last <= cur) break
    cur = last
  }
  return { from, to, rows }
}

async function priceWindow ({ standardCd, companyCd }, from, to) {
  const xml = await callService('FS-COM', 'COMFundPriceModSO', 'priceModSrch', 'COMFundUnityInfoInputDTO', {
    standardCd, companyCd, vSrchTrmFrom: from, vSrchTrmTo: to, vSrchStd: '1'
  })
  return parseRows(xml, 'priceModList')
}

async function priceTab (fund, from, to) {
  const parts = await Promise.all(windows(from, to).map(([a, b]) => priceWindow(fund, a, b)))
  const byDate = new Map(parts.flat().map(r => [r.standardDt, r]))
  const rows = [...byDate.values()].map(r => ({
    d: r.standardDt,
    nav: num(r.standardCot),
    chg: num(r.vBefDayFltstdcot),
    taxNav: num(r.standardassStdCot),   // 과표기준가격
    originalAmt: won(r.uOriginalAmt),
    kospi: num(r.kospiEpn),
    kospi200: num(r.kospi200Epn)
  })).sort((a, b) => a.d.localeCompare(b.d))
  return { from, to, rows }
}

async function assetsTab ({ standardCd }) {
  const xml = await callService('FS-COM', 'COMFundAssetsCmpsDescSO', 'assetsCmpsDescSrch', 'COMFundUnityInfoInputDTO', { standardCd })
  const r = parseRows(xml, 'list')[0]
  if (!r) return null
  const n = k => num(r[k]) ?? 0
  // 세부 비중은 각 자산군 안에서의 비율(%)이다
  return {
    asOf: r.standardDt || null,
    groups: [
      { key: 'stock', label: '주식', pct: n('vAssetsCmpsStockRt'),
        detail: [['KSE', n('vAssetsCmpsStockKseRt')], ['KOSDAQ', n('vAssetsCmpsStockKosdaqRt')], ['기타', n('vAssetsCmpsStockEtcRt')]] },
      { key: 'bond', label: '채권', pct: n('vAssetsCmpsBondRt'),
        detail: [['국고채', n('vAssetsCmpsBondNatRt')], ['통안채', n('vAssetsCmpsBondCurrRt')], ['금융채', n('vAssetsCmpsBondFinRt')], ['회사채', n('vAssetsCmpsBondCompRt')], ['기타', n('vAssetsCmpsBondEtcRt')]] },
      { key: 'liquid', label: '유동성', pct: n('vAssetsCmpsLiquidRt'),
        detail: [['CD', n('vAssetsCmpsLiquidCdRt')], ['CP', n('vAssetsCmpsLiquidCpRt')], ['콜론', n('vAssetsCmpsLiquidCallRt')], ['예금', n('vAssetsCmpsLiquidDpsRt')], ['기타', n('vAssetsCmpsLiquidEtcRt')]] },
      { key: 'etc', label: '기타', pct: n('vAssetsCmpsEtcRt'), detail: [] }
    ]
  }
}

async function settleTab ({ standardCd, companyCd }) {
  const xml = await callService('FS-COM', 'COMFundSettleExSO', 'settleExSrch', 'COMFundUnityInfoInputDTO', { standardCd, companyCd })
  return parseRows(xml, 'settleExList').slice(0, 24).map(r => ({
    from: r.trustAccSrt,
    to: r.trustAccend,
    days: num(r.vPassDayCnt),
    nav: num(r.standardCot),
    taxNav: num(r.standardassCot),
    originalAmt: won(r.uOriginalAmt),
    kind: r.vSettleGbNm || null         // 분배 / 상환 등
  }))
}

/**
 * 펀드요약정보 다섯 탭을 한 번에. 탭 하나가 실패해도 나머지는 살린다.
 */
export async function fundDetail (fund) {
  const end = todayKST()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  const to = ymd(end)
  const from = ymd(start)

  const tabs = {
    basic: () => basicTab(fund, to),
    returns: () => returnsTab(fund, from, to),
    price: () => priceTab(fund, from, to),
    assets: () => assetsTab(fund),
    settle: () => settleTab(fund)
  }
  const keys = Object.keys(tabs)
  const settled = await Promise.allSettled(keys.map(k => tabs[k]()))

  const out = { errors: {} }
  settled.forEach((s, i) => {
    out[keys[i]] = s.status === 'fulfilled' ? s.value : null
    if (s.status === 'rejected') out.errors[keys[i]] = s.reason?.message || String(s.reason)
  })
  out.sourceUrl = popupUrl(fund, out.basic?.nav?.asOf || to)
  return out
}
