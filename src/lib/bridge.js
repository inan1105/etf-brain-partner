// ── 기술적분석 계산기 · 아임차트 스토커 연결 ──
//
// 두 서비스 모두 현재 URL 쿼리파라미터로 종목을 받지 않는다
// (ta 는 자체 api/identify, stockr 는 Vue SPA — 둘 다 인바운드 파라미터 미처리).
// 그래서 "새 탭으로 열고 + 입력값을 클립보드에 넣고 + 붙여넣기를 안내" 한다.
//
// 추후 두 서비스가 ?q= 를 받게 되면 TARGETS 의 url 만 바꾸면 된다.

export const TARGETS = {
  ta: {
    key: 'ta',
    name: '기술적분석 계산기',
    short: '기술적분석',
    url: 'https://ta.iamchart.co.kr/',
    accent: 'lime',
    placeholder: '분석 입력창',
    guide: '입력창에 붙여넣고 [분석]을 누르면 10개 축 시그널이 계산됩니다.'
  },
  stockr: {
    key: 'stockr',
    name: '아임차트 스토커',
    short: '스토커 상담',
    url: 'https://stockr.iamchart.co.kr/',
    accent: 'blue',
    placeholder: '대화 입력창',
    guide: '대화창에 붙여넣고 전송하면 해당 종목으로 상담이 이어집니다.'
  }
}

/**
 * 전달할 문자열을 만든다.
 * 기술적분석 가이드라인의 단축 문법을 그대로 따른다.
 *   code            빠른 분석
 *   !!code          가격거래표
 *   !!!code         종합차트
 */
export function buildPayload (target, { key, prefix = '', text = '' } = {}) {
  const id = String(key || '').trim()
  if (target === 'ta') return `${prefix}${id}`
  if (!id) return text
  return text ? `${id} ${text}` : id
}

/** 클립보드 복사 — execCommand 폴백 포함 (비보안 컨텍스트·구형 브라우저 대응) */
export async function copy (text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 폴백으로 진행 */ }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 대상 서비스를 새 탭으로 연다.
 * 팝업 차단을 피하려면 사용자 제스처와 같은 틱에서 호출해야 하므로,
 * 클립보드 복사보다 창 열기를 먼저 수행한다.
 */
export function openTarget (targetKey) {
  const t = TARGETS[targetKey]
  if (!t) return null
  return window.open(t.url, '_blank', 'noopener,noreferrer')
}

/**
 * 이동 한 번에 필요한 일을 모두 처리한다.
 * @returns {{opened:boolean, copied:boolean, payload:string, target:object}}
 */
export async function go (targetKey, payloadOpts) {
  const target = TARGETS[targetKey]
  const payload = buildPayload(targetKey, payloadOpts)
  const win = openTarget(targetKey) // 제스처 직후 — 차단 방지
  const copied = await copy(payload)
  return { opened: !!win, copied, payload, target }
}

/** 최근 본 종목 — 두 서비스를 오가는 동안 자리를 잃지 않게 한다 */
const RECENT_KEY = 'etfp.recent'
const RECENT_MAX = 12

export function readRecent () {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function pushRecent (item) {
  try {
    const list = readRecent().filter(r => r.code !== item.code)
    list.unshift({ code: item.code, name: item.name, queryKey: item.queryKey, market: item.market })
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)))
    return list.slice(0, RECENT_MAX)
  } catch {
    return readRecent()
  }
}

export function clearRecent () {
  try { localStorage.removeItem(RECENT_KEY) } catch { /* 무시 */ }
}

// ── 관심 종목 (즐겨찾기) ─────────────────────────────
// ETF 는 이름이 길고 비슷해서 "한 번 찾은 걸 다시 찾는" 비용이 크다.
// 최근 본 종목이 시간순 자동 기록이라면, 관심 종목은 사용자가 직접 고정하는 목록이다.

const FAV_KEY = 'etfp.favorites'

export function readFavorites () {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeFavorites (list) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)) } catch { /* 무시 */ }
  return list
}

export const isFavorite = (list, code) => list.some(f => f.code === code)

/** 토글 후 새 목록을 돌려준다 */
export function toggleFavorite (item) {
  const list = readFavorites()
  const i = list.findIndex(f => f.code === item.code)
  if (i >= 0) list.splice(i, 1)
  else list.unshift({ code: item.code, name: item.name, queryKey: item.queryKey, market: item.market })
  return writeFavorites(list)
}

export function clearFavorites () {
  return writeFavorites([])
}
