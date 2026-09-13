// ── 빠른 찾기 · 쉬운 찾기 ──
//
// ETF 는 이름이 길고 서로 비슷하다.
//   KODEX 미국나스닥100 / TIGER 미국나스닥100 / RISE 미국나스닥100 / ACE 미국나스닥100
// 그래서 "정확히 입력해서 찾기"는 사실상 불가능하고, 다음 세 가지가 필요하다.
//
//   1) 초성 검색       ㅁㄱㄴㅅㄷ → 미국나스닥
//   2) 브랜드 분리     운용사 접두어를 떼어내 구별되는 부분을 앞으로
//   3) 같은 지수 묶기  동일 기초지수 추종 종목을 한 덩어리로 보고 차이만 비교

import { BRANDS } from '../../shared/taxonomy.js'

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** 문자열의 초성만 뽑는다. 한글이 아닌 문자는 그대로 둔다 */
export function choseong (str) {
  let out = ''
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0)
    if (code >= HANGUL_START && code <= HANGUL_END) {
      out += CHO[Math.floor((code - HANGUL_START) / 588)]
    } else {
      out += ch
    }
  }
  return out
}

/** 입력이 초성만으로 이루어졌는지 (ㄱ~ㅎ + 숫자·영문 허용) */
export function isChoseongQuery (q) {
  const s = String(q).replace(/\s+/g, '')
  if (!s) return false
  // 완성형 한글이 하나라도 있으면 초성 질의가 아니다
  if (/[가-힣]/.test(s)) return false
  return /[ㄱ-ㅎ]/.test(s)
}

const BRAND_NAMES = BRANDS.map(([b]) => b).sort((a, b) => b.length - a.length)

/**
 * 종목명을 [브랜드, 나머지] 로 쪼갠다.
 * "KODEX 미국나스닥100" → { brand: 'KODEX', rest: '미국나스닥100' }
 * 목록에서 브랜드를 작은 칩으로 빼면 구별되는 부분이 맨 앞에 온다.
 */
export function splitBrand (name) {
  const n = String(name || '').trim()
  for (const b of BRAND_NAMES) {
    if (n.toUpperCase().startsWith(b.toUpperCase())) {
      const rest = n.slice(b.length).trim()
      if (rest) return { brand: n.slice(0, b.length), rest }
    }
  }
  return { brand: null, rest: n }
}

/** 검색용 인덱스를 한 번만 만들어 둔다 (종목당 1회) */
export function buildIndex (items) {
  return items.map(it => {
    const { brand, rest } = splitBrand(it.name)
    const lowerName = it.name.toLowerCase()
    return {
      item: it,
      brand,
      rest,
      lowerName,
      lowerRest: rest.toLowerCase(),
      cho: choseong(it.name),
      choRest: choseong(rest),
      code: String(it.code || '').toLowerCase(),
      symbol: String(it.symbol || '').toLowerCase(),
      bench: String(it.benchmarkRaw || it.benchmark || '').toLowerCase()
    }
  })
}

/**
 * 한 건의 매칭 점수를 낸다. 높을수록 먼저.
 * 0 이면 매칭 아님.
 */
function scoreEntry (e, q, qCho) {
  // 코드·심볼 완전 일치가 최우선 — 숫자 6자리를 쳤다면 그걸 찾는 것이다
  if (e.code === q || e.symbol === q) return 1000
  if (e.code.startsWith(q) || e.symbol.startsWith(q)) return 900

  // 브랜드를 뗀 이름의 앞부분 일치 — "나스닥"을 치면 KODEX/TIGER 가릴 것 없이 잡힌다
  if (e.lowerRest.startsWith(q)) return 800
  if (e.lowerName.startsWith(q)) return 760

  // 초성 질의
  if (qCho) {
    if (e.choRest.startsWith(qCho)) return 700
    if (e.cho.includes(qCho)) return 640
  }

  if (e.lowerRest.includes(q)) return 600
  if (e.lowerName.includes(q)) return 560
  if (e.bench.includes(q)) return 400
  return 0
}

/**
 * 빠른 찾기 — 입력 한 줄로 후보를 좁힌다.
 * @param {Array} index buildIndex 결과
 * @param {string} raw 사용자 입력
 * @param {number} limit
 */
export function quickSearch (index, raw, limit = 12) {
  const q = String(raw || '').trim().toLowerCase()
  if (!q) return []
  const qCho = isChoseongQuery(q) ? q.replace(/\s+/g, '') : null

  const hits = []
  for (const e of index) {
    const s = scoreEntry(e, q, qCho)
    if (s > 0) hits.push({ entry: e, s })
  }

  hits.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s
    // 같은 점수면 규모가 큰(= 사람들이 실제로 쓰는) 종목을 위로
    const av = a.entry.item.netAssets ?? a.entry.item.value ?? 0
    const bv = b.entry.item.netAssets ?? b.entry.item.value ?? 0
    if (bv !== av) return bv - av
    return a.entry.item.name.localeCompare(b.entry.item.name, 'ko')
  })

  return hits.slice(0, limit).map(h => h.entry)
}

/**
 * 매칭 구간을 [before, match, after] 로 쪼갠다 — 화면에서 하이라이트용.
 * 초성 질의는 구간이 모호하므로 하이라이트하지 않는다.
 */
export function highlight (text, raw) {
  const q = String(raw || '').trim()
  if (!q || isChoseongQuery(q)) return [text, '', '']
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return [text, '', '']
  return [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)]
}

// ── 쉬운 찾기: 같은 지수 묶기 ────────────────────────────

/** 기초지수를 묶음 키로 정규화한다 */
function benchKey (it) {
  const b = it.benchmark || it.benchmarkRaw
  if (!b) return null
  return String(b).toLowerCase().replace(/[\s()·]/g, '')
}

/**
 * 같은 기초지수를 추종하는 종목을 한 덩어리로 묶는다.
 * 대표 1건 + 나머지를 접어두면 "비슷한 이름 20개" 문제가 사라진다.
 * 대표는 현재 정렬 순서의 첫 종목(= 적합도/규모 1위)을 쓴다.
 */
export function groupByBenchmark (ranked) {
  const groups = new Map()
  const out = []

  for (const it of ranked) {
    const key = benchKey(it)
    if (!key) { out.push({ lead: it, peers: [], key: null }); continue }
    const g = groups.get(key)
    if (g) {
      g.peers.push(it)
    } else {
      const ng = { lead: it, peers: [], key }
      groups.set(key, ng)
      out.push(ng)
    }
  }
  return out
}

/**
 * 같은 지수를 추종하는 종목들 사이의 '실제 차이'만 뽑는다.
 * 이름이 거의 같을 때 사용자가 봐야 하는 건 보수·규모·환헤지·구조뿐이다.
 */
export function diffPoints (lead, peer) {
  const out = []
  if (lead.expenseRatio != null && peer.expenseRatio != null) {
    const d = peer.expenseRatio - lead.expenseRatio
    if (Math.abs(d) >= 0.005) {
      out.push({ k: '보수', v: `${d > 0 ? '+' : ''}${d.toFixed(3)}%p`, good: d < 0 })
    }
  }
  if (lead.netAssets && peer.netAssets) {
    const r = peer.netAssets / lead.netAssets
    if (r < 0.5 || r > 2) {
      out.push({ k: '규모', v: `${r > 1 ? '×' + r.toFixed(1) : '÷' + (1 / r).toFixed(1)}`, good: r > 1 })
    }
  }
  const ls = new Set(lead.strategy || [])
  for (const s of peer.strategy || []) if (!ls.has(s)) out.push({ k: '구조', v: s, good: null })
  return out
}
