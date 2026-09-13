// ── FAQ 요건 → 조건 프리셋 ──
//
// requirement/FAQ_ETF_20260329.txt 의 20개 항목을 그대로 진입점으로 옮긴다.
// 각 프리셋은 조건(query)을 적용하고, 필요하면 특수 모드(mode)를 켠다.
//
//   mode 'list'      기본 결과 목록
//   mode 'compare'   두 그룹을 나란히 비교
//   mode 'portfolio' 투자금 입력 → 배분안 제시
//   mode 'holdings'  보유 종목 입력 → 점검
//   mode 'bridge'    바로 상담·분석으로 이동

import { emptyQuery } from './query.js'

/** 부분 조건을 빈 조건 위에 얹는다 */
export function applyPreset (preset) {
  const q = emptyQuery()
  const p = preset.query || {}
  if (p.q) q.q = p.q
  if (p.facets) {
    for (const [k, v] of Object.entries(p.facets)) {
      q.facets[k] = { values: [...v.values], mode: v.mode || 'or' }
    }
  }
  if (p.join) q.join = p.join
  if (p.pension) q.pension = true
  if (p.minValue) q.minValue = p.minValue
  if (p.sort) q.sort = p.sort
  q.preset = preset.id
  return q
}

const f = (key, values, mode = 'or') => ({ [key]: { values, mode } })

export const GROUPS = [
  {
    id: 'A',
    title: '상담 시작',
    hint: '핵심 진입',
    accent: 'purple',
    items: [
      {
        id: 'a1',
        label: '오늘의 ETF 상담 시작하기',
        desc: '스토커에서 대화로 시작합니다',
        mode: 'bridge',
        bridge: 'stockr',
        bridgeText: '오늘 주목할 ETF를 추천해줘'
      },
      {
        id: 'a2',
        label: '고객 적합 ETF 바로 찾기',
        desc: '조건을 직접 조합해 좁혀갑니다',
        mode: 'builder',
        query: { sort: 'fit' }
      },
      {
        id: 'a3',
        label: '지금 시장에서 유망 ETF는?',
        desc: '거래 활발 + 상승 흐름 상위',
        mode: 'list',
        query: { minValue: 1e9, sort: 'changeRate' }
      },
      {
        id: 'a4',
        label: '지금 매수 타이밍 ETF는?',
        desc: '유동성 상위 종목을 기술적분석으로 확인',
        mode: 'list',
        query: { minValue: 5e9, sort: 'value' },
        cta: 'ta'
      },
      {
        id: 'a5',
        label: '최근 자금 몰리는 ETF 보기',
        desc: '거래대금 기준 상위',
        mode: 'list',
        query: { minValue: 1e10, sort: 'value' }
      }
    ]
  },
  {
    id: 'B',
    title: '테마 기반 추천',
    hint: '테마적합도 반영',
    accent: 'lime',
    items: [
      {
        id: 'b6',
        label: 'AI·반도체 ETF 추천받기',
        desc: 'AI · 반도체 · 빅테크',
        mode: 'list',
        query: { facets: f('themes', ['AI·인공지능', '반도체', '빅테크']), sort: 'fit' }
      },
      {
        id: 'b7',
        label: '배당·월배당 ETF 비교하기',
        desc: '배당 · 월배당 · 고배당 · 커버드콜',
        mode: 'list',
        query: { facets: f('themes', ['배당', '월배당', '고배당', '커버드콜']), sort: 'fit' }
      },
      {
        id: 'b8',
        label: '금리 인하 수혜 ETF 찾기',
        desc: '장기채 · 듀레이션 · 금리민감 자산',
        mode: 'list',
        query: { facets: f('themes', ['금리인하수혜']), sort: 'fit' }
      },
      {
        id: 'b9',
        label: '인플레이션 대비 ETF 보기',
        desc: '금 · 원자재 · 물가연동',
        mode: 'list',
        query: { facets: f('themes', ['인플레이션헤지']), sort: 'fit' }
      },
      {
        id: 'b10',
        label: '요즘 뜨는 테마 ETF는?',
        desc: '원자력 · 방산 · 로봇 · 밸류업',
        mode: 'list',
        query: {
          facets: f('themes', ['원자력·SMR', '방산·우주', '로봇', '밸류업', '자율주행']),
          sort: 'changeRate'
        }
      }
    ]
  },
  {
    id: 'C',
    title: 'ETF vs ETF 비교·선택',
    hint: '품질 + 전략',
    accent: 'blue',
    items: [
      {
        id: 'c11',
        label: '판매 ETF 우선 비교',
        desc: '운용사를 골라 해당 시리즈만',
        mode: 'builder',
        focusFacet: 'issuer',
        query: { sort: 'netAssets' }
      },
      {
        id: 'c12',
        label: '인기 ETF vs 숨은 ETF 비교',
        desc: '거래대금 상위 ↔ 소외 종목',
        mode: 'compare',
        compare: {
          leftLabel: '인기 (거래대금 상위)',
          rightLabel: '숨은 종목 (거래 한산)',
          split: 'popularity'
        },
        query: { sort: 'value' }
      },
      {
        id: 'c13',
        label: '국내 vs 미국 ETF 비교하기',
        desc: '투자지역을 나눠 나란히',
        mode: 'compare',
        compare: {
          leftLabel: '국내 투자',
          rightLabel: '미국 투자',
          split: 'exposure',
          leftQuery: { facets: f('exposure', ['국내']) },
          rightQuery: { facets: f('region', ['미국']) }
        },
        query: { sort: 'netAssets' }
      },
      {
        id: 'c14',
        label: '수익률·보수·유동성 한번에 보기',
        desc: '표로 비교',
        mode: 'table',
        query: { minValue: 1e9, sort: 'value' }
      }
    ]
  },
  {
    id: 'D',
    title: '고객 맞춤',
    hint: '고객적합도 반영',
    accent: 'indigo',
    items: [
      {
        id: 'd15',
        label: '내 투자금으로 포트폴리오 구성',
        desc: '금액을 넣으면 배분 수량까지',
        mode: 'portfolio',
        query: { minValue: 1e9, sort: 'fit' }
      },
      {
        id: 'd16',
        label: 'IRP/DC 가능 ETF만 보기',
        desc: '레버리지·인버스 제외, 국내 상장',
        mode: 'list',
        query: { pension: true, sort: 'netAssets' }
      },
      {
        id: 'd17',
        label: '위험 낮춘 ETF 조합 추천',
        desc: '저변동 · 배당 · 채권 중심',
        mode: 'list',
        query: {
          facets: {
            ...f('themes', ['저변동성', '배당', '퀄리티']),
            ...f('asset', ['채권', '머니마켓'])
          },
          join: 'or',
          pension: true,
          sort: 'fit'
        }
      },
      {
        id: 'd18',
        label: '지금 내 보유 ETF 점검하기',
        desc: '종목코드를 넣으면 한 번에 연결',
        mode: 'holdings'
      }
    ]
  },
  {
    id: 'E',
    title: '실행·트레이딩',
    hint: '현재시점 적합도',
    accent: 'lime',
    items: [
      {
        id: 'e19',
        label: '기술적 매수·매도 구간 확인',
        desc: '기술적분석 계산기로 이동',
        mode: 'bridge',
        bridge: 'ta',
        needsTarget: true
      },
      {
        id: 'e20',
        label: '지금은 매수 vs 관망 판단하기',
        desc: '스토커에 판단 근거를 물어봅니다',
        mode: 'bridge',
        bridge: 'stockr',
        needsTarget: true,
        bridgeText: '지금 매수와 관망 중 무엇이 나은지 근거와 함께 알려줘'
      }
    ]
  }
]

export const ALL_PRESETS = GROUPS.flatMap(g => g.items.map(it => ({ ...it, group: g.id })))
export const presetById = id => ALL_PRESETS.find(p => p.id === id) || null

/**
 * FAQ 하단 단축 문법 — 스토커/계산기와 동일한 규칙.
 *   005930      빠른 분석
 *   !!005930    가격거래표
 *   !!!005930   종합차트
 */
export const SHORTCUTS = [
  { prefix: '', label: '빠른 분석', desc: '종목코드·심볼만 입력' },
  { prefix: '!!', label: '가격거래표', desc: '원자료 표 전체 출력' },
  { prefix: '!!!', label: '종합차트', desc: '캔들·볼린저·Stochastic·DMI' }
]

/** 입력이 단축 문법인지 판정한다 (기술적분석 가이드라인의 패턴과 동일) */
export function parseShortcut (input) {
  const m = String(input || '').trim().match(/^(!{0,3})([A-Za-z0-9]{1,6})$/)
  if (!m) return null
  return { prefix: m[1], code: m[2].toUpperCase() }
}
