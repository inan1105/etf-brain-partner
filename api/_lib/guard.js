// ── 공개 엔드포인트 남용 방지 ──
//
// /api/ask 는 우리 OpenAI 키로 과금되는 호출을 대신 수행한다.
// 인증 없는 공개 URL 이므로, 그대로 두면 주소를 아는 누구나 크레딧을 소진시킬 수 있다.
//
// 완벽한 차단이 목표가 아니다 (그러려면 로그인이 필요하다).
// 목표는 "지나가다 발견해서 긁어가는" 수준의 비용 사고를 막는 것이다.
//   1) 우리 페이지에서 온 요청만 받는다 (Origin 검사)
//   2) 같은 IP 의 호출 빈도를 제한한다
//
// 서버리스 인스턴스는 수명이 짧아 메모리 카운터가 완벽하진 않지만,
// 한 인스턴스로 몰리는 연속 호출은 실제로 막아준다.

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const hits = new Map() // ip → number[] (타임스탬프)

/** 프록시를 거친 실제 클라이언트 IP */
function clientIp (req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim()
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

function hostOf (value) {
  if (!value) return null
  try {
    return new URL(value).host
  } catch {
    return null
  }
}

/**
 * 우리 페이지에서 온 요청인지 본다.
 * Origin 헤더는 위조할 수 있지만, 브라우저에서 남의 페이지로 호출하는 경로는 막힌다.
 * ALLOWED_ORIGINS 로 추가 허용 도메인을 지정할 수 있다.
 */
export function checkOrigin (req) {
  const origin = hostOf(req.headers.origin) || hostOf(req.headers.referer)
  // Origin 이 없는 요청(curl 등)은 브라우저가 아니다 — 통과시키지 않는다
  if (!origin) return { ok: false, reason: 'Origin 헤더가 없습니다' }

  const self = req.headers['x-forwarded-host'] || req.headers.host
  if (self && origin === self) return { ok: true }

  // 로컬 개발
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return { ok: true }

  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => hostOf(s.trim()) || s.trim())
    .filter(Boolean)
  if (extra.includes(origin)) return { ok: true }

  return { ok: false, reason: `허용되지 않은 출처: ${origin}` }
}

/** 같은 IP 의 분당 호출 수를 제한한다 */
export function rateLimit (req, { max = MAX_PER_WINDOW, windowMs = WINDOW_MS } = {}) {
  const ip = clientIp(req)
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs)

  if (recent.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000)
    return { ok: false, retryAfter }
  }

  recent.push(now)
  hits.set(ip, recent)

  // 오래된 항목 청소 — 메모리가 무한정 늘지 않게
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some(t => now - t < windowMs)) hits.delete(k)
    }
  }

  return { ok: true, remaining: max - recent.length }
}

/**
 * 두 검사를 한 번에. 통과하면 null, 막히면 { status, body }.
 * GUARD_DISABLED=1 이면 건너뛴다 (비공개 내부 배포용 탈출구).
 */
export function guard (req, opts) {
  if (process.env.GUARD_DISABLED === '1') return null

  const origin = checkOrigin(req)
  if (!origin.ok) {
    return { status: 403, body: { error: '이 엔드포인트는 서비스 페이지에서만 호출할 수 있습니다', detail: origin.reason } }
  }

  const rl = rateLimit(req, opts)
  if (!rl.ok) {
    return {
      status: 429,
      body: { error: `요청이 너무 잦습니다. ${rl.retryAfter}초 후 다시 시도하세요.`, retryAfter: rl.retryAfter }
    }
  }

  return null
}
