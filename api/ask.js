// ── POST /api/ask ──
//
// ETF 관련 자주 찾는 요청·질문에 대한 AI 응답.
// OpenAI GPT 모델(기본 gpt-4o)을 서버에서 호출한다. 키는 클라이언트에 노출하지 않는다.
//
// 설계 원칙
//  1. 근거 없는 답을 만들지 않는다.
//     질문과 함께 '현재 화면의 실제 종목 목록'을 컨텍스트로 넘기고,
//     그 안에서만 종목을 인용하도록 지시한다.
//  2. 매수·매도를 권유하지 않는다.
//     아임차트 기술적분석 가이드라인과 같은 기조를 지킨다.
//  3. 모델명을 하드코딩하지 않는다.
//     OPENAI_MODEL 로 교체 가능하게 두어 상위 모델로 올릴 때 코드를 고치지 않는다.

import { json } from './_lib/http.js'
import { guard } from './_lib/guard.js'

const ENDPOINT = process.env.OPENAI_BASE_URL
  ? `${process.env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`
  : 'https://api.openai.com/v1/chat/completions'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const MAX_ITEMS = 40
const MAX_QUESTION = 500

const SYSTEM = `당신은 한국 투자자를 돕는 ETF 정보 안내자입니다. "ETF 브레인 파트너" 서비스 안에서 동작합니다.

[근거 규칙]
- 답변에 등장하는 모든 종목은 아래 <종목목록>에 있는 것만 사용합니다.
- 목록에 없는 종목명·종목코드·수치를 지어내지 않습니다.
- 목록에 근거가 없으면 "현재 조건에서는 확인되지 않습니다"라고 말하고, 어떤 조건을 바꾸면 되는지 제안합니다.
- 수치(현재가·보수·수익률)는 목록에 있는 값을 그대로 인용하고, 없으면 "—"로 둡니다.
- 수치에는 반드시 단위를 붙입니다. 보수와 등락률·수익률은 %, 현재가는 목록의 통화(KRW/USD)를 함께 씁니다.
- 기간수익률의 키는 w1=1주, m1=1개월, m3=3개월, m6=6개월, y1=1년 입니다. 이 이름 그대로 쓰지 말고 한국어로 풀어 씁니다.

[표현 규칙]
- 매수·매도를 권유하지 않습니다. "사세요", "지금이 기회" 같은 표현을 쓰지 않습니다.
- 미래 가격을 단정하지 않습니다. 조건부로 설명합니다.
- 특정인에게 맞춘 투자 자문이 아니라 일반적인 정보 제공임을 전제로 씁니다.
- 한국어로, 군더더기 없이 씁니다.

[형식]
- 400자 내외. 길어도 700자를 넘기지 않습니다.
- 머리기호는 ■ ㅇ - 만 사용합니다. 마크다운 * 나 # 는 쓰지 않습니다.
- 종목을 언급할 때는 "종목명(코드)" 형태로 씁니다.
- 마지막 줄에 한 문장으로 확인이 필요한 점이나 한계를 덧붙입니다.`

/**
 * 컨텍스트로 넘길 만큼만 추려 토큰을 아낀다.
 *
 * 키 이름에 단위를 박아둔다. 숫자만 넘기면 모델이 "보수: 0.35" 처럼 단위 없이
 * 인용해서, 0.35% 인지 0.35원인지 읽는 사람이 알 수 없게 된다.
 * 통화도 국내(원)와 해외(달러)가 섞이므로 종목마다 밝혀준다.
 */
function compact (items) {
  return items.slice(0, MAX_ITEMS).map(it => {
    const cur = it.market === 'US' ? 'USD' : 'KRW'
    return {
      명: it.name,
      코드: it.queryKey,
      구분: `${it.exposure}/${it.asset}`,
      섹터: (it.sectors || []).join(',') || undefined,
      테마: (it.themes || []).join(',') || undefined,
      전략: (it.strategy || []).join(',') || undefined,
      지수: it.benchmark || undefined,
      운용사: it.issuer || undefined,
      [`현재가(${cur})`]: it.close ?? undefined,
      '등락률(%)': it.changeRate ?? undefined,
      '총보수(연,%)': it.expenseRatio ?? undefined,
      연금계좌: it.pensionEligible ? '편입가능' : '편입불가',
      '기간수익률(%)': it.returns && Object.keys(it.returns).length
        ? it.returns
        : undefined
    }
  })
}

async function callOpenAI (body, apiKey) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 45000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* 비 JSON 오류 본문 */ }
    return { ok: res.ok, status: res.status, data: parsed, raw: text }
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST 만 허용됩니다' })

  // 이 호출은 우리 OpenAI 키로 과금된다. 인증 없는 공개 URL 이므로
  // 출처와 호출 빈도를 먼저 확인한다.
  const blocked = guard(req)
  if (blocked) return json(res, blocked.status, blocked.body)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return json(res, 503, {
      error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다',
      hint: 'AI 해설 기능은 OpenAI 키가 있어야 동작합니다. 나머지 기능은 키 없이도 정상입니다.'
    })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const question = String(body?.question || '').trim().slice(0, MAX_QUESTION)
  const items = Array.isArray(body?.items) ? body.items : []
  const summary = String(body?.summary || '').slice(0, 300)

  if (!question) return json(res, 400, { error: '질문이 비어 있습니다' })

  const userContent = [
    summary ? `현재 조건: ${summary}` : '현재 조건: 전체',
    `조건에 맞는 종목 ${items.length}건 중 상위 ${Math.min(items.length, MAX_ITEMS)}건입니다.`,
    '<종목목록>',
    JSON.stringify(compact(items), null, 0),
    '</종목목록>',
    '',
    `질문: ${question}`
  ].join('\n')

  const base = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userContent }
    ]
  }

  try {
    // 신형 모델은 max_tokens 대신 max_completion_tokens 를 요구한다.
    // 어느 쪽을 요구하는지 모델마다 다르므로 거부당하면 한 번 바꿔 재시도한다.
    let r = await callOpenAI({ ...base, max_completion_tokens: 900 }, apiKey)
    if (!r.ok && /max_completion_tokens|Unrecognized request argument/i.test(r.raw || '')) {
      r = await callOpenAI({ ...base, max_tokens: 900 }, apiKey)
    }

    if (!r.ok) {
      const msg = r.data?.error?.message || `OpenAI 오류 ${r.status}`
      return json(res, 502, {
        error: msg,
        model: MODEL,
        hint: /model/i.test(msg)
          ? `모델 "${MODEL}" 을 사용할 수 없습니다. OPENAI_MODEL 환경변수로 사용 가능한 모델을 지정하세요.`
          : undefined
      })
    }

    const answer = r.data?.choices?.[0]?.message?.content?.trim()
    if (!answer) return json(res, 502, { error: '빈 응답을 받았습니다', model: MODEL })

    return json(res, 200, {
      answer,
      model: r.data?.model || MODEL,
      usage: r.data?.usage || null,
      groundedOn: Math.min(items.length, MAX_ITEMS)
    })
  } catch (e) {
    return json(res, 502, { error: e.name === 'AbortError' ? '응답 시간이 초과되었습니다' : e.message })
  }
}
