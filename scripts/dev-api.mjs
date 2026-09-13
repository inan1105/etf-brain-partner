// ── 로컬 개발용 /api 미들웨어 ──
//
// Vercel 서버리스 함수는 배포 환경에서만 동작한다. 그래서 로컬에서 vite 만 띄우면
// /api/etfs · /api/returns · /api/ask 가 전부 404 가 되어, 키를 넣어도 확인할 수 없다.
//
// 이 플러그인은 api/*.js 의 default export 를 vite 개발/프리뷰 서버에
// 그대로 마운트해 같은 코드로 로컬에서도 동작하게 한다.
// (별도 프로세스나 프록시가 필요 없다 — `npm run dev` 하나로 끝난다)

import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolve(__dirname, '../api')

/** api/ 최상위의 핸들러 파일만 (밑줄로 시작하는 _lib 등은 제외) */
function routeFiles () {
  try {
    return readdirSync(API_DIR, { withFileTypes: true })
      .filter(d => d.isFile() && d.name.endsWith('.js') && !d.name.startsWith('_'))
      .map(d => d.name.replace(/\.js$/, ''))
  } catch {
    return []
  }
}

function readBody (req) {
  return new Promise((res, rej) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')))
    req.on('error', rej)
  })
}

function mount (server) {
  const routes = routeFiles()
  if (!routes.length) return

  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    const m = url.pathname.match(/^\/api\/([A-Za-z0-9_-]+)\/?$/)
    if (!m) return next()

    const name = m[1]
    if (!routes.includes(name)) return next()

    try {
      // 매번 새로 import 해야 핸들러를 고쳤을 때 서버 재시작 없이 반영된다
      const mod = await import(
        `${pathToFileURL(resolve(API_DIR, `${name}.js`)).href}?t=${Date.now()}`
      )
      const handler = mod.default
      if (typeof handler !== 'function') return next()

      // Vercel 핸들러가 기대하는 최소한의 모양을 맞춰준다
      req.query = Object.fromEntries(url.searchParams)
      if (req.method === 'POST' || req.method === 'PUT') {
        const raw = await readBody(req)
        try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = raw }
      }

      await handler(req, res)
      if (!res.writableEnded) res.end()
    } catch (e) {
      console.error(`[dev-api] /api/${name} 오류:`, e)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json; charset=utf-8')
      }
      if (!res.writableEnded) {
        res.end(JSON.stringify({ error: e.message, where: `api/${name}.js` }))
      }
    }
  })

  console.log(`  \x1b[2m/api 로컬 마운트: ${routes.map(r => '/api/' + r).join(', ')}\x1b[0m`)
}

/** vite 플러그인 */
export default function devApi () {
  return {
    name: 'etf-dev-api',
    configureServer: mount,
    configurePreviewServer: mount
  }
}
