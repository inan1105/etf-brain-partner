// ── 공용 HTTP 유틸 ──

export class HttpError extends Error {
  constructor (status, message, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

/** 타임아웃과 재시도를 붙인 fetch */
export async function fetchJson (url, { timeout = 10000, retries = 2, headers = {} } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeout)
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { accept: 'application/json', 'user-agent': 'ETF-Partner/1.0.1', ...headers }
      })
      const text = await res.text()
      if (!res.ok) throw new HttpError(res.status, `상위 API 오류 ${res.status}`, text.slice(0, 500))
      try {
        return JSON.parse(text)
      } catch {
        // 공공데이터포털은 키 오류 시 JSON 대신 XML 을 돌려준다.
        throw new HttpError(502, '상위 API 가 JSON 이 아닌 응답을 반환했습니다', text.slice(0, 500))
      }
    } catch (e) {
      lastErr = e
      // 인증/파라미터 오류는 재시도해도 동일하므로 즉시 중단
      if (e instanceof HttpError && e.status >= 400 && e.status < 500) break
      if (attempt < retries) await sleep(250 * (attempt + 1))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))

/** YYYYMMDD */
export function ymd (date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** KST 기준 오늘 */
export function todayKST () {
  const now = new Date()
  return new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000)
}

export function json (res, status, payload, cacheSeconds = 0) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  if (cacheSeconds > 0) {
    res.setHeader('cache-control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`)
  } else {
    res.setHeader('cache-control', 'no-store')
  }
  res.end(JSON.stringify(payload))
}
