<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  // 현재 조건으로 걸러진 결과 (AI 답변의 근거로 넘긴다)
  results: { type: Array, required: true },
  summary: { type: String, default: '' },
  // FAQ 프리셋에서 넘어온 기본 질문
  suggested: { type: String, default: '' }
})

const question = ref('')
const answer = ref('')
const model = ref('')
const grounded = ref(0)
const busy = ref(false)
const error = ref(null)
const open = ref(false)

// 자주 찾는 요청 — FAQ 요건의 문장을 그대로 쓴다
const QUICK = [
  '이 조건에서 서로 어떻게 다른지 정리해줘',
  '보수·유동성 기준으로 무엇을 먼저 봐야 할까',
  '연금계좌에 넣을 수 있는 것만 추려줘',
  '같은 지수를 따르는 종목들의 차이는?',
  '지금 이 테마에서 주의할 점은?'
]

watch(() => props.suggested, v => {
  if (v) { question.value = v; open.value = true }
})

async function ask (q) {
  const asked = String(q ?? question.value).trim()
  if (!asked || busy.value) return
  question.value = asked
  busy.value = true
  error.value = null
  answer.value = ''

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: asked,
        summary: props.summary,
        // 근거는 상위 결과만 — 전체를 보내면 토큰만 늘고 답이 흐려진다
        items: props.results.slice(0, 40)
      })
    })
    // 정적 호스팅·프리뷰처럼 /api 가 없는 환경에서는 HTML 이 돌아온다.
    // 그대로 json() 하면 파싱 오류가 나므로 먼저 구분한다.
    const raw = await res.text()
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      throw Object.assign(
        new Error('AI 응답 서버에 연결할 수 없습니다'),
        { hint: '/api/ask 서버리스 함수가 배포되어 있어야 합니다. (vercel dev 또는 배포 환경)' }
      )
    }
    if (!res.ok) throw Object.assign(new Error(data.error || `오류 ${res.status}`), { hint: data.hint })
    answer.value = data.answer
    model.value = data.model
    grounded.value = data.groundedOn
  } catch (e) {
    error.value = { message: e.message, hint: e.hint }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card ask">
    <button class="ask-head" @click="open = !open" :aria-expanded="open">
      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 17.5 9 12l4.2 3L20 6.5" />
          <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="6.5" r="2" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span class="grow">
        <b>자주 찾는 요청 · AI 해설</b>
        <i>현재 조건의 결과를 근거로 답합니다</i>
      </span>
      <svg class="caret" :class="{ up: open }" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <div v-show="open" class="ask-body">
      <!-- 상담용 영역: 서체·배경·괘선 테두리로 화면의 다른 정보와 구분한다 -->
      <div class="consult">
        <div class="c-sec c-q">
          <div class="c-label"><span class="c-tag q">질문</span>상담 고객의 질문을 입력하거나 자주 찾는 요청을 고르세요</div>
          <div class="chips">
            <button v-for="q in QUICK" :key="q" class="chip sm" :disabled="busy" @click="ask(q)">{{ q }}</button>
          </div>

          <div class="ask-row">
            <input
              v-model="question"
              type="text"
              placeholder="ETF에 대해 궁금한 점을 물어보세요"
              aria-label="AI 질문 입력"
              :disabled="busy"
              @keydown.enter="ask()"
            >
            <button class="btn btn-purple" :disabled="busy || !question.trim()" @click="ask()">
              <span v-if="busy" class="spin"></span>
              <span v-else>질문</span>
            </button>
          </div>
        </div>

        <div class="c-sec c-a" aria-live="polite">
          <div class="c-label"><span class="c-tag a">AI 응답</span>생성형 AI의 답변 · 상담 참고용</div>

          <div v-if="error" class="ask-err">
            <b>답변을 받지 못했습니다</b>
            <p>{{ error.message }}</p>
            <p v-if="error.hint" class="small">{{ error.hint }}</p>
          </div>

          <div v-else-if="busy" class="ask-wait">
            <span class="skeleton l1"></span>
            <span class="skeleton l2"></span>
            <span class="skeleton l3"></span>
          </div>

          <div v-else-if="answer" class="ask-out">
            <pre>{{ answer }}</pre>
            <div class="ask-foot">
              <span class="badge purple">AI 생성</span>
              <span>{{ model }}</span>
              <span>근거 {{ grounded }}종목</span>
            </div>
            <p class="ask-note">
              AI가 생성한 참고 정보이며 특정 종목의 매수·매도를 권유하지 않습니다.
              수치는 위 목록 기준이므로 실제 체결가·최신 공시와 다를 수 있습니다.
            </p>
          </div>

          <p v-else class="c-empty">
            현재 조건에 맞는 {{ results.length }}종목 중 상위 40건을 근거로 답합니다.
            조건을 좁힐수록 답이 정확해집니다.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ask { padding: 0; overflow: hidden; }

.ask-head {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 14px 16px; text-align: left;
  background: linear-gradient(120deg, #F8F5FF, #F2F6FF);
}
.ask-head:hover { filter: brightness(.99); }
.ico {
  flex: none; width: 30px; height: 30px; border-radius: 9px;
  background: linear-gradient(148deg, var(--purple), var(--indigo));
  color: #fff; display: grid; place-items: center;
}
.ico svg { width: 16px; height: 16px; }
.ask-head b { display: block; font-size: 13px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.ask-head i { font-style: normal; font-size: 11px; color: var(--muted); }
.caret { width: 16px; height: 16px; flex: none; color: var(--muted); transition: transform .2s; }
.caret.up { transform: rotate(180deg); }

.ask-body { padding: 14px 16px 16px; border-top: 1px solid var(--line-card); }
.chip.sm { padding: 6px 11px; font-size: 11.5px; }

/* ── 상담 영역 ─────────────────────────────────────────
   서체: 명조(Noto Serif KR)로 앱의 고딕 본문과 구분
   배경: 질문 = 옅은 베이지, 응답 = 괘선이 그어진 상담지
   테두리: 이중 괘선 */
.consult {
  --c-ink: #3A2F1E;
  --c-rule: #E4D6BA;
  --c-frame: #8A6D3B;
  --serif: "Noto Serif KR", "Nanum Myeongjo", "Batang", "AppleMyungjo", serif;
  border: 4px double var(--c-frame); border-radius: 12px; overflow: hidden;
}
.c-sec { padding: 13px 14px 15px; }
.c-q { background: #F7EEDC; border-bottom: 1.5px solid var(--c-frame); }
.c-a { background: #FFFCF4; }

.c-label {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 11.5px; font-weight: 700; color: #7A6440; margin-bottom: 10px;
}
.c-tag {
  padding: 3px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 800; color: #fff;
  letter-spacing: -.01em;
}
.c-tag.q { background: var(--c-frame); }
.c-tag.a { background: var(--indigo); }

.c-q .chip.sm { background: #FFFBF2; border-color: var(--c-rule); }
.c-q .chip.sm:hover { border-color: var(--c-frame); color: var(--c-ink); }

.ask-row { display: flex; gap: 8px; margin-top: 12px; }
.ask-row input {
  flex: 1; min-width: 0; border: 1.5px solid var(--c-frame); border-radius: 10px;
  padding: 11px 13px; font-family: var(--serif); font-size: 15px; font-weight: 500; color: var(--c-ink);
  outline: none; background: #FBF6EC; transition: .18s;
}
.ask-row input::placeholder { color: #A8977A; }
.ask-row input:focus { border-color: var(--indigo); box-shadow: 0 0 0 4px rgba(138, 109, 59, .16); }
.ask-row .btn { flex: none; min-width: 68px; }

.ask-wait { display: flex; flex-direction: column; gap: 7px; }
.ask-wait span { height: 12px; border-radius: 6px; }
.l1 { width: 92%; } .l2 { width: 78%; } .l3 { width: 60%; }

/* 응답 본문 — 줄마다 괘선 (줄 높이 30px 에 맞춘다) */
.ask-out pre {
  margin: 0; white-space: pre-wrap; word-break: break-word;
  font-family: var(--serif); font-size: 15px; font-weight: 500; line-height: 30px; color: var(--c-ink);
  padding: 2px 14px 4px; border: 1px solid var(--c-rule); border-radius: 8px;
  background-color: #FFFEF9;
  background-image: repeating-linear-gradient(to bottom, transparent 0 29px, var(--c-rule) 29px 30px);
  background-position: 0 2px;
}
.ask-foot {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 9px;
  font-size: 10.5px; color: var(--muted); font-weight: 700;
}
.ask-note { margin: 9px 0 0; font-size: 10.5px; color: var(--muted); line-height: 1.65; }
.c-empty { margin: 0; font-family: var(--serif); font-size: 13px; color: #7A6440; line-height: 1.8; }

.ask-err {
  padding: 12px 14px; border-radius: var(--r-sm);
  background: #FFF8F8; border: 1px solid #FBD3D3;
}
.ask-err b { display: block; font-size: 12.5px; color: var(--up); margin-bottom: 5px; }
.ask-err p { margin: 0; font-size: 11.5px; color: var(--ink-soft); line-height: 1.6; }
</style>
