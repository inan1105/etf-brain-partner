<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { quickSearch, highlight, splitBrand, isChoseongQuery } from '../lib/search.js'
import { fmtPrice, fmtPct, fmtFee } from '../lib/api.js'

const props = defineProps({
  index: { type: Array, required: true },   // buildIndex 결과
  recent: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'pick', 'go'])

const q = ref('')
const cursor = ref(0)
const input = ref(null)

const hits = computed(() => quickSearch(props.index, q.value, 14))

/** 입력이 없으면 관심 → 최근 순으로 보여준다 (다시 찾기 비용을 없애는 게 목적) */
const fallback = computed(() => {
  const byCode = new Map(props.index.map(e => [e.item.code, e]))
  const seen = new Set()
  const out = []
  for (const src of [props.favorites, props.recent]) {
    for (const r of src) {
      if (seen.has(r.code)) continue
      const e = byCode.get(r.code)
      if (e) { seen.add(r.code); out.push(e) }
    }
  }
  return out.slice(0, 12)
})

const rows = computed(() => (q.value.trim() ? hits.value : fallback.value))

watch(rows, () => { cursor.value = 0 })

function onKey (e) {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor.value = Math.min(cursor.value + 1, rows.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor.value = Math.max(cursor.value - 1, 0) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const r = rows.value[cursor.value]
    if (r) emit('pick', r.item)
  }
}

onMounted(() => {
  nextTick(() => input.value?.focus())
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

const dirOf = r => (r == null ? 'flat' : r > 0 ? 'up' : r < 0 ? 'down' : 'flat')
const parts = name => highlight(splitBrand(name).rest, q.value)
</script>

<template>
  <div class="qf-back" @click.self="emit('close')" role="dialog" aria-modal="true" aria-label="빠른 찾기">
    <div class="qf">
      <div class="qf-head">
        <svg class="mag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
             stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
        </svg>
        <input
          ref="input"
          v-model="q"
          type="text"
          placeholder="종목명 · 코드 · 심볼 · 초성 (예: ㅁㄱㄴㅅㄷ, 069500, 나스닥)"
          aria-label="빠른 찾기 입력"
          autocomplete="off"
        >
        <kbd>ESC</kbd>
        <button class="x" @click="emit('close')" aria-label="닫기">×</button>
      </div>

      <div class="qf-hint">
        <template v-if="isChoseongQuery(q)">초성으로 찾는 중 — <b>{{ q }}</b></template>
        <template v-else-if="q.trim()">{{ rows.length }}건</template>
        <template v-else-if="rows.length">관심·최근 종목</template>
        <template v-else>초성만 입력해도 찾습니다. <b>ㅁㄱㄴㅅㄷ</b> → 미국나스닥</template>
      </div>

      <ul class="qf-list" role="listbox">
        <li
          v-for="(e, i) in rows"
          :key="e.item.code"
          :class="{ on: i === cursor }"
          role="option"
          :aria-selected="i === cursor"
          @mouseenter="cursor = i"
        >
          <button class="qf-row" @click="emit('pick', e.item)">
            <span class="qf-l">
              <span class="qf-name">
                <span v-if="e.brand" class="qf-brand">{{ e.brand }}</span>
                <span class="qf-rest">
                  <span>{{ parts(e.item.name)[0] }}</span><mark>{{ parts(e.item.name)[1] }}</mark><span>{{ parts(e.item.name)[2] }}</span>
                </span>
              </span>
              <span class="qf-meta">
                <span class="tnum">{{ e.item.queryKey }}</span>
                <span>{{ e.item.exposure }} · {{ e.item.asset }}</span>
                <span v-if="e.item.expenseRatio != null">보수 {{ fmtFee(e.item.expenseRatio) }}</span>
              </span>
            </span>
            <span class="qf-r" v-if="e.item.close != null">
              <b class="tnum" :class="'v-' + dirOf(e.item.changeRate)">{{ fmtPrice(e.item.close) }}</b>
              <span class="tnum" :class="'v-' + dirOf(e.item.changeRate)">{{ fmtPct(e.item.changeRate) }}</span>
            </span>
          </button>
          <span class="qf-acts">
            <button class="mini lime" @click.stop="emit('go', 'ta', e.item)" title="기술적분석">TA</button>
            <button class="mini blue" @click.stop="emit('go', 'stockr', e.item)" title="스토커 상담">상담</button>
          </span>
        </li>
      </ul>

      <div v-if="q.trim() && !rows.length" class="qf-empty">
        <b>찾는 종목이 없습니다</b>
        브랜드(KODEX·TIGER)를 빼고 핵심 단어만 넣어보세요. 초성도 됩니다.
      </div>

      <div class="qf-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> 이동</span>
        <span><kbd>Enter</kbd> 열기</span>
        <span><kbd>Ctrl</kbd>+<kbd>K</kbd> 다시 열기</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qf-back {
  position: fixed; inset: 0; z-index: 180;
  background: rgba(35, 32, 73, .42); backdrop-filter: blur(3px);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 10vh 16px 16px; animation: fadeIn .16s ease;
}
@media (max-width: 620px) { .qf-back { padding: 0; align-items: stretch; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.qf {
  width: 100%; max-width: 600px; background: var(--card);
  border-radius: var(--r-md); box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; max-height: 76vh; overflow: hidden;
  animation: up .2s cubic-bezier(.2, .8, .2, 1);
}
@media (max-width: 620px) {
  .qf { max-width: none; border-radius: 0; max-height: 100vh; height: 100dvh; }
}
@keyframes up { from { transform: translateY(-10px); opacity: .5; } to { transform: none; opacity: 1; } }

.qf-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 14px 12px; border-bottom: 1px solid var(--line-card); flex: none;
  padding-top: max(14px, env(safe-area-inset-top));
}
.mag { width: 19px; height: 19px; flex: none; color: var(--muted); }
.qf-head input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 16px; font-weight: 600; color: var(--ink); padding: 4px 0;
}
.qf-head input::placeholder { color: #B7B2C4; font-weight: 500; font-size: 14px; }
kbd {
  font-family: inherit; font-size: 10px; font-weight: 800; color: var(--muted-2);
  background: var(--surface); border: 1px solid var(--line-data);
  border-radius: 5px; padding: 2px 5px; flex: none;
}
@media (max-width: 620px) { .qf-head kbd { display: none; } }

.qf-hint {
  padding: 8px 16px; font-size: 11px; color: var(--muted); flex: none;
  background: var(--surface-2); border-bottom: 1px solid var(--line-card);
}
.qf-hint b { color: var(--purple); }

.qf-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; }
.qf-list li {
  display: flex; align-items: center; gap: 6px;
  border-radius: var(--r-xs); padding-right: 8px; transition: background .12s;
}
.qf-list li.on { background: var(--purple-soft); }

.qf-row {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px;
  padding: 10px 10px; text-align: left;
}
.qf-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.qf-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.qf-brand {
  flex: none; font-size: 9.5px; font-weight: 800; letter-spacing: .02em;
  color: var(--ink-soft); background: var(--surface);
  padding: 2px 5px; border-radius: 4px;
}
.qf-rest {
  font-size: 13.5px; font-weight: 700; color: var(--ink); letter-spacing: -.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.qf-rest mark { background: rgba(198, 234, 46, .55); color: inherit; border-radius: 3px; padding: 0 1px; }
.qf-meta { display: flex; gap: 8px; font-size: 10.5px; color: var(--muted); font-weight: 600; }

.qf-r { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.qf-r b { font-size: 13px; font-weight: 800; }
.qf-r span { font-size: 10.5px; font-weight: 700; }

.qf-acts { display: flex; gap: 4px; flex: none; }
.mini { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
.mini.lime { background: var(--lime-soft); color: #5E7A05; }
.mini.lime:hover { background: var(--lime); color: var(--indigo-deep); }
.mini.blue { background: var(--blue-soft); color: var(--blue-deep); }
.mini.blue:hover { background: var(--blue); color: #fff; }

.qf-empty { padding: 34px 20px; text-align: center; font-size: 12.5px; color: var(--muted); line-height: 1.7; }
.qf-empty b { display: block; font-size: 14px; color: var(--ink); margin-bottom: 6px; }

.qf-foot {
  display: flex; gap: 14px; padding: 9px 16px; flex: none;
  border-top: 1px solid var(--line-card); background: var(--surface-2);
  font-size: 10.5px; color: var(--muted); font-weight: 600;
  padding-bottom: max(9px, env(safe-area-inset-bottom));
}
.qf-foot span { display: inline-flex; align-items: center; gap: 3px; }
@media (max-width: 620px) { .qf-foot { display: none; } }
</style>
