#!/usr/bin/env node
// ── sitemap.xml 생성 ──
//
//   SITE_ORIGIN=https://etf.example.com npm run sitemap
//
// "SEO 관점의 종목 제시" 중 색인 측면. 조건 조합마다 고유 URL 이 생기므로
// 대표 조합(FAQ 프리셋 + 주요 테마·섹터·자산군)을 사이트맵에 올린다.
// 조합의 수는 이론상 무한하므로, 사람이 실제로 찾을 만한 축만 노출한다.

import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_PRESETS, applyPreset } from '../src/lib/presets.js'
import { toUrl } from '../src/lib/query.js'
import { emptyQuery } from '../src/lib/query.js'
import { THEME_RULES, SECTOR_RULES, ASSET_RULES } from '../shared/taxonomy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/sitemap.xml')
const ORIGIN = (process.env.SITE_ORIGIN || 'https://etf-partner.example.com').replace(/\/$/, '')

const entries = new Map() // url → priority

const add = (path, priority) => {
  if (!entries.has(path) || entries.get(path) < priority) entries.set(path, priority)
}

// 홈
add('/', 1.0)

// FAQ 프리셋 — 조건이 붙는 것만 (bridge/holdings 는 상태가 없어 제외)
for (const p of ALL_PRESETS) {
  if (!p.query) continue
  add(toUrl(applyPreset(p), '/'), 0.9)
}

// 단일 축 조합 — 테마 / 섹터 / 자산군
const single = (facet, value, priority) => {
  const q = emptyQuery()
  q.facets[facet].values = [value]
  add(toUrl(q, '/'), priority)
}
for (const r of THEME_RULES) single('themes', r.tag, 0.8)
for (const r of SECTOR_RULES) single('sectors', r.tag, 0.7)
for (const r of ASSET_RULES) if (r.tag !== '주식') single('asset', r.tag, 0.7)

// 국내/해외 × 대표 테마 — 실제로 많이 찾는 2축 조합
for (const exposure of ['국내', '해외']) {
  for (const theme of ['AI·인공지능', '반도체', '배당', '월배당', '2차전지·전기차']) {
    const q = emptyQuery()
    q.facets.exposure.values = [exposure]
    q.facets.themes.values = [theme]
    add(toUrl(q, '/'), 0.75)
  }
}

// 연금계좌
{
  const q = emptyQuery()
  q.pension = true
  add(toUrl(q, '/'), 0.85)
}

const today = new Date().toISOString().slice(0, 10)
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...entries.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([path, priority]) => `  <url>
    <loc>${ORIGIN}${encodeURI(path).replace(/&/g, '&amp;')}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`)
  .join('\n')}
</urlset>
`

await writeFile(OUT, xml, 'utf8')
process.stdout.write(`sitemap.xml 생성 완료: ${entries.size}개 URL (origin ${ORIGIN})\n`)
if (!process.env.SITE_ORIGIN) {
  process.stdout.write('⚠ SITE_ORIGIN 이 없어 예시 도메인을 썼습니다. 배포 도메인으로 다시 실행하세요.\n')
}
