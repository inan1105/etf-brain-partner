<script setup>
import { ref, watch } from 'vue'
import { SHORTCUTS } from '../lib/presets.js'
import BrainField from './BrainField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  total: { type: Number, default: 0 },
  compact: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const local = ref(props.modelValue)
watch(() => props.modelValue, v => { local.value = v })

function submit () {
  emit('update:modelValue', local.value)
  emit('submit', local.value)
}

const EXAMPLES = ['반도체', '월배당', '미국나스닥100', '069500', 'SCHD', '국고채30년']

function pick (v) {
  local.value = v
  submit()
}
</script>

<template>
  <section class="hero" :class="{ compact }">
    <BrainField :opacity="compact ? 0.55 : 1" />

    <div class="hero-inner">
      <div v-if="!compact" class="hero-copy">
        <div class="eyebrow">ETF BRAIN · DISCOVERY</div>
        <h1>조건으로 찾고,<br>분석과 상담으로 잇습니다</h1>
        <p>
          국내외 ETF를 종목코드·종목명·심볼·국내/해외·주요섹터·주요자산·참조지수로
          묶어 찾습니다. 고른 종목은 기술적분석 계산기와 아임차트 스토커로 그대로 이어집니다.
        </p>
      </div>

      <div class="search-block">
        <div class="search">
          <div class="box">
            <svg class="mag" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
            </svg>
            <input
              v-model="local"
              type="search"
              inputmode="search"
              :placeholder="'종목코드 · 종목명 · 심볼 · 지수 (예: 반도체, 069500, SCHD)'"
              aria-label="ETF 통합검색"
              autocomplete="off"
              @keydown.enter="submit"
              @search="submit"
            >
            <button v-if="local" class="clear" aria-label="검색어 지우기"
                    @click="local = ''; submit()">×</button>
          </div>
          <button class="btn btn-purple search-go" @click="submit">검색</button>
        </div>

        <div v-if="!compact" class="hint">
          <span class="hint-l">예시</span>
          <button v-for="e in EXAMPLES" :key="e" class="ex" @click="pick(e)">{{ e }}</button>
        </div>

        <div v-if="!compact" class="shortcuts">
          <span class="sc-title">기술적분석 단축 문법</span>
          <span v-for="s in SHORTCUTS" :key="s.label" class="sc">
            <code>{{ s.prefix }}코드</code> {{ s.label }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="!compact && total" class="hero-stat">
      <b class="tnum">{{ total.toLocaleString('ko-KR') }}</b> 종목에서 탐색합니다
    </div>
  </section>
</template>

<style scoped>
.hero {
  border-radius: var(--r-lg); padding: 26px 22px; margin-bottom: 16px;
  position: relative; overflow: hidden;
  background:
    radial-gradient(120% 120% at 88% -10%, rgba(198, 234, 46, .30), transparent 55%),
    radial-gradient(120% 120% at 0% 110%, rgba(49, 130, 246, .20), transparent 50%),
    linear-gradient(160deg, #F6F2FF, #EFEAFB);
  border: 1px solid #ECE7FA; box-shadow: var(--shadow);
}
.hero.compact { padding: 16px; margin-bottom: 12px; }

/* 뉴럴 필드 위에 내용이 오도록 */
.hero-inner, .hero-stat { position: relative; z-index: 1; }

.eyebrow {
  font-size: 11px; font-weight: 800; letter-spacing: .12em;
  color: var(--purple); margin-bottom: 11px;
}
h1 {
  font-size: 26px; line-height: 1.28; font-weight: 800;
  letter-spacing: -.035em; margin: 0 0 12px; color: var(--indigo-deep);
}
.hero-copy p {
  font-size: 13px; color: var(--ink-soft); margin: 0 0 20px;
  max-width: 46ch; line-height: 1.7;
}

.search { display: flex; gap: 9px; align-items: stretch; }
.box {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
  background: #fff; border: 1.5px solid #E7E1F7; border-radius: 15px;
  padding: 0 12px 0 14px; transition: .18s;
  box-shadow: 0 4px 14px -10px rgba(44, 41, 96, .35);
}
.box:focus-within { border-color: var(--purple); box-shadow: 0 0 0 4px rgba(108, 92, 231, .12); }
.mag { width: 18px; height: 18px; flex: none; color: var(--muted); }
.box input {
  border: none; outline: none; flex: 1; min-width: 0;
  padding: 15px 0; font-size: 15px; font-weight: 600;
  background: transparent; color: var(--ink);
}
.box input::placeholder { color: #B7B2C4; font-weight: 500; }
.box input::-webkit-search-cancel-button { display: none; }
.clear {
  flex: none; width: 24px; height: 24px; border-radius: 50%;
  background: var(--surface); color: var(--muted-2);
  font-size: 16px; line-height: 1; display: grid; place-items: center;
}
.clear:hover { background: #E9ECEF; color: var(--ink); }
.search-go { flex: none; padding: 0 20px; border-radius: 15px; font-size: 14px; }

.hint {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  margin-top: 14px; font-size: 12px;
}
.hint-l { font-weight: 800; color: var(--muted); }
.ex {
  padding: 5px 11px; border-radius: 999px; background: rgba(255, 255, 255, .78);
  border: 1px solid rgba(108, 92, 231, .16);
  font-size: 12px; font-weight: 700; color: var(--purple); transition: .15s;
}
.ex:hover { background: #fff; border-color: var(--purple); }

.shortcuts {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-top: 14px; padding-top: 13px;
  border-top: 1px dashed rgba(108, 92, 231, .2);
  font-size: 11.5px; color: var(--ink-soft);
}
.sc-title { font-weight: 800; color: var(--muted); }
.sc code {
  background: rgba(255, 255, 255, .8); padding: 2px 6px; border-radius: 5px;
  font-size: 11px; font-weight: 700; color: var(--indigo); margin-right: 3px;
}

.hero-stat {
  margin-top: 16px; padding-top: 14px;
  border-top: 1px solid rgba(108, 92, 231, .14);
  font-size: 12px; color: var(--ink-soft);
}
.hero-stat b { font-size: 15px; color: var(--indigo-deep); font-weight: 800; }

/* 데스크톱 — 카피와 검색을 2열로 */
@media (min-width: 900px) {
  .hero { padding: 34px 30px; }
  .hero-inner { display: grid; grid-template-columns: 1fr 1.15fr; gap: 32px; align-items: center; }
  .hero.compact .hero-inner { display: block; }
  h1 { font-size: 32px; }
  .hero-copy p { margin-bottom: 0; }
}
@media (max-width: 480px) {
  .hero { padding: 22px 18px; }
  h1 { font-size: 23px; }
  .search-go { padding: 0 15px; }
}
</style>
