// ── SEO: 동적 메타 · JSON-LD · 사이트맵 힌트 ──
//
// 조건 조합마다 고유 URL 이 생기므로(query.js), 그 URL 이 검색결과에서
// 의미를 갖도록 title / description / canonical / OG / JSON-LD 를 갱신한다.
// 스토커가 쓰는 문법(WebApplication + ItemList)과 같은 결을 유지한다.

import { describe, emptyQuery } from './query.js'

const BRAND = 'ETF 브레인 파트너'
const TAGLINE = '국내외 ETF 조건검색'
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

function upsertMeta (selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function upsertLink (rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd (id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/** 조건 → 검색결과에 그대로 노출될 제목 */
export function buildTitle (query, count) {
  const d = describe(query)
  if (!d) return `${BRAND} | ${TAGLINE}과 기술적분석·AI 상담 연결`
  const n = count != null ? ` ${count}종목` : ''
  return `${d} ETF${n} | ${BRAND}`
}

export function buildDescription (query, count, top = []) {
  const d = describe(query)
  const names = top.slice(0, 5).map(i => i.name).join(', ')
  if (!d) {
    return '국내외 ETF를 종목코드·종목명·심볼·국내/해외·주요섹터·주요자산·참조지수 조건으로 묶어 찾고, 기술적분석 계산기와 아임차트 스토커 상담으로 바로 이어집니다.'
  }
  const head = `${d} 조건에 맞는 ETF ${count ?? 0}종목을 적합도순으로 정리했습니다.`
  return names ? `${head} 상위: ${names}. 기술적분석과 AI 상담으로 바로 연결됩니다.` : head
}

/**
 * 현재 조건과 결과로 문서 헤드를 갱신한다.
 * @param {object} query
 * @param {Array} results 랭킹이 끝난 결과
 */
export function applySeo (query, results) {
  if (typeof document === 'undefined') return
  const count = results.length
  const title = buildTitle(query, count)
  const desc = buildDescription(query, count, results)
  const url = ORIGIN + window.location.pathname + window.location.search

  document.title = title
  upsertMeta('meta[name="description"]', { name: 'description', content: desc })
  upsertLink('canonical', url)

  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: desc })

  // 조건이 걸린 화면은 색인 대상, 결과 0건은 색인에서 제외
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: count === 0 ? 'noindex, follow' : 'index, follow'
  })

  setJsonLd('ld-app', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: BRAND,
    alternateName: ['ETF브레인파트너', 'ETF Brain Partner'],
    url: ORIGIN + '/',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: 'ko-KR',
    description: buildDescription(emptyQuery(), null),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${ORIGIN}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  })

  if (count > 0) {
    setJsonLd('ld-list', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: count,
      itemListElement: results.slice(0, 20).map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        identifier: it.queryKey,
        url: `${ORIGIN}/?q=${encodeURIComponent(it.queryKey)}`
      }))
    })
  } else {
    const el = document.getElementById('ld-list')
    if (el) el.remove()
  }
}

/** 종목 상세를 열었을 때의 보강 — FinancialProduct */
export function applyItemSeo (item) {
  if (!item) {
    const el = document.getElementById('ld-item')
    if (el) el.remove()
    return
  }
  setJsonLd('ld-item', {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: item.name,
    identifier: item.queryKey,
    category: `ETF · ${item.asset} · ${item.exposure}`,
    provider: item.issuer ? { '@type': 'Organization', name: item.issuer } : undefined,
    url: `${ORIGIN}/?q=${encodeURIComponent(item.queryKey)}`
  })
}
