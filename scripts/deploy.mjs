#!/usr/bin/env node
// ── Vercel 배포 ──
//
//   npx vercel login     ← 브라우저 인증이라 사람이 한 번 해야 한다
//   npm run deploy
//
// 로그인 이후의 나머지를 한 번에 처리한다.
//   1) 프로젝트 연결 (.vercel 생성)
//   2) .env 의 비밀을 Vercel 환경변수로 올림 — 값이 터미널 기록에 남지 않게 stdin 으로 전달
//   3) 프로덕션 배포
//
// .env 파일 자체는 .vercelignore 로 업로드에서 제외된다.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Vercel 프로젝트명 — 소문자·숫자·. _ - 만 허용되고 '---' 는 쓸 수 없다 */
const PROJECT = process.env.VERCEL_PROJECT_NAME || 'etf-brain-partner'

/** Vercel 에 올릴 값 — 여기 없는 키는 올리지 않는다 */
const SECRETS = ['KRX_AUTH_KEY', 'DATA_GO_KR_KEY', 'OPENAI_API_KEY']
const PLAIN = ['OPENAI_MODEL', 'KOFIA_ENRICH', 'ALLOWED_ORIGINS']

const dim = s => `\x1b[2m${s}\x1b[0m`
const ok = s => `\x1b[32m${s}\x1b[0m`
const bad = s => `\x1b[31m${s}\x1b[0m`

// Windows 에서는 shell 이 필요하다.
//   · npx.cmd 를 shell 없이 spawn → Node 20+ 가 EINVAL 로 거부 (.cmd 실행 차단)
//   · npx 를 shell 없이 spawn     → PATHEXT 해석이 안 돼 ENOENT
// shell:true 는 DEP0190 경고를 내지만, 그 경고의 요지는 "인자가 이스케이프되지 않는다"이다.
// 여기서 argv 에 들어가는 값은 전부 이 파일에 박힌 고정 리터럴(env, add, 키 이름, production)이고,
// 비밀 값은 argv 가 아니라 stdin 으로만 전달하므로 주입 경로가 없다.
const IS_WIN = process.platform === 'win32'

function run (args, { input, capture = false } = {}) {
  return new Promise((res, rej) => {
    const p = spawn('npx', ['vercel', ...args], {
      cwd: ROOT,
      stdio: [input != null ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
      shell: IS_WIN
    })
    let out = ''
    if (capture) {
      p.stdout?.on('data', d => { out += d })
      p.stderr?.on('data', d => { out += d })
    }
    if (input != null) {
      p.stdin.write(input)
      p.stdin.end()
    }
    p.on('close', code => (code === 0 ? res(out) : rej(Object.assign(new Error(`vercel ${args[0]} 실패 (exit ${code})`), { out }))))
    p.on('error', rej)
  })
}

function readEnv () {
  const f = resolve(ROOT, '.env')
  if (!existsSync(f)) return {}
  const out = {}
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const v = m[2].trim().replace(/^["']|["']$/g, '')
    if (v) out[m[1]] = v
  }
  return out
}

async function main () {
  // 1) 로그인 확인 — 브라우저 인증이라 대신해 줄 수 없다
  // 로그아웃과 "CLI 를 실행조차 못함"을 구분한다.
  // 둘을 뭉뚱그리면 실행 실패를 로그인 문제로 오인해 엉뚱한 곳을 고치게 된다.
  let who
  try {
    who = (await run(['whoami'], { capture: true })).trim()
  } catch (e) {
    process.stderr.write(
      `${bad('●')} Vercel CLI 를 실행하지 못했습니다: ${e.message}\n` +
      `${dim(String(e.out || '').trim().slice(-300))}\n\n` +
      `  Node 와 npx 가 PATH 에 있는지 확인하세요.\n`
    )
    process.exit(1)
  }

  if (/Logged out|not authenticated/i.test(who) || !who) {
    process.stderr.write(
      `${bad('●')} Vercel 에 로그인되어 있지 않습니다.\n\n` +
      `  먼저 이 명령을 직접 실행하세요 (브라우저 인증이 필요합니다):\n\n` +
      `    npx vercel login\n\n` +
      `  로그인 후 다시 npm run deploy 를 실행하면 나머지는 자동으로 진행됩니다.\n`
    )
    process.exit(1)
  }

  process.stdout.write(`${ok('●')} Vercel 로그인: ${who.split('\n').filter(Boolean).pop().trim()}\n`)

  // 2) 프로젝트 연결
  // 이름을 명시하지 않으면 폴더명(_AnyQ_ETF)에서 유도하는데, Vercel 프로젝트명은
  // 소문자·숫자·. _ - 만 허용하므로 거부된다. 고정 이름을 넘긴다.
  if (!existsSync(resolve(ROOT, '.vercel'))) {
    process.stdout.write(`\n${dim(`프로젝트를 연결합니다… (${PROJECT})`)}\n`)
    await run(['link', '--yes', '--project', PROJECT])
  }

  // 3) 환경변수 — 값은 stdin 으로만 넘겨 셸 기록에 남기지 않는다
  const env = readEnv()
  const targets = ['production', 'preview']
  process.stdout.write(`\n${dim('환경변수를 올립니다…')}\n`)

  for (const key of [...SECRETS, ...PLAIN]) {
    const value = env[key]
    if (!value) {
      process.stdout.write(`  ${dim('○')} ${key.padEnd(18)} ${dim('.env 에 값 없음 — 건너뜀')}\n`)
      continue
    }
    for (const t of targets) {
      try {
        await run(['env', 'rm', key, t, '--yes'], { capture: true })
      } catch { /* 없으면 무시 */ }
      try {
        await run(['env', 'add', key, t], { input: value, capture: true })
      } catch (e) {
        process.stdout.write(`  ${bad('●')} ${key} (${t}) 실패: ${String(e.out || e.message).trim().split('\n').pop()}\n`)
        continue
      }
    }
    const shown = SECRETS.includes(key) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
    process.stdout.write(`  ${ok('●')} ${key.padEnd(18)} ${dim(shown)}\n`)
  }

  // 4) 배포
  process.stdout.write(`\n${dim('프로덕션 배포…')}\n`)
  await run(['deploy', '--prod'])

  process.stdout.write(
    `\n${ok('배포 완료')}\n` +
    `  · 배포 후 ALLOWED_ORIGINS 에 커스텀 도메인을 추가하면 /api/ask 를 그 도메인에서도 호출할 수 있습니다.\n` +
    `  · 국내 시세는 KRX 활용신청 승인 후 자동으로 붙습니다 (코드 수정 불필요).\n`
  )
}

main().catch(e => {
  process.stderr.write(`\n${bad('배포 실패')}: ${e.message}\n`)
  if (e.out) process.stderr.write(dim(String(e.out).trim().slice(-800)) + '\n')
  process.exit(1)
})
