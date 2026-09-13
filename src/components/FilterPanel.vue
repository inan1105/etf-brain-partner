<script setup>
import { computed, ref } from 'vue'
import { FACET_KEYS, FACET_LABELS, MULTI_VALUED, activeFacets } from '../lib/query.js'

const props = defineProps({
  query: { type: Object, required: true },
  counts: { type: Object, required: true },
  focusFacet: { type: String, default: null },
  hasQuotes: { type: Boolean, default: true }
})
const emit = defineEmits(['toggle', 'mode', 'join', 'pension', 'minValue', 'reset'])

// 좁은 화면에서는 접어 두고, 조건이 걸리면 자동으로 펼친다
const open = ref(false)

/** 실제 데이터에 존재하는 값만, 건수 많은 순으로 */
function optionsFor (facet) {
  const counter = props.counts[facet]
  if (!counter) return []
  const selected = props.query.facets[facet].values
  return [...counter.entries()]
    .filter(([v, n]) => n > 0 || selected.includes(v))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    // 섹터·테마는 종류가 많아 상위만 노출하고 나머지는 펼치기로
    .map(([value, n]) => ({ value, n }))
}

const expanded = ref({})
const LIMIT = 10

function shown (facet) {
  const all = optionsFor(facet)
  if (expanded.value[facet] || all.length <= LIMIT + 2) return all
  const sel = props.query.facets[facet].values
  const head = all.slice(0, LIMIT)
  const missing = all.filter(o => sel.includes(o.value) && !head.includes(o))
  return [...head, ...missing]
}

const hiddenCount = facet => Math.max(0, optionsFor(facet).length - shown(facet).length)

const visibleFacets = computed(() =>
  FACET_KEYS.filter(k => optionsFor(k).length > 1 || props.query.facets[k].values.length)
)

const activeCount = computed(() => activeFacets(props.query).length)

const MIN_VALUE_STEPS = [
  { v: 0, label: '전체' },
  { v: 1e8, label: '1억↑' },
  { v: 1e9, label: '10억↑' },
  { v: 1e10, label: '100억↑' },
  { v: 5e10, label: '500억↑' }
]

const isOpen = computed(() => open.value || activeCount.value > 0 || !!props.focusFacet)
</script>

<template>
  <section class="card filter">
    <div class="card-t">
      <button class="fold" @click="open = !isOpen ? true : !open" :aria-expanded="isOpen">
        <span class="menu-tag">빠른 조건검색</span>
        <span class="badge purple" v-if="activeCount">{{ activeCount }}개 적용</span>
        <svg class="caret" :class="{ up: isOpen }" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.6" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div class="right">
        <div class="join-wrap" v-if="activeCount > 1">
          <span class="join-l">조건 묶음</span>
          <div class="logic lg">
            <button :class="{ on: query.join === 'and' }" @click="emit('join', 'and')"
                    title="모든 조건을 동시에 만족">AND</button>
            <button :class="{ on: query.join === 'or' }" @click="emit('join', 'or')"
                    title="조건 중 하나라도 만족">OR</button>
          </div>
        </div>

        <button class="reset" :disabled="!(activeCount || query.pension || query.minValue)"
                @click="emit('reset')">초기화</button>
      </div>
    </div>

    <p class="join-note" v-if="activeCount > 1">
      <template v-if="query.join === 'and'">
        선택한 <b>{{ activeCount }}개 항목을 모두</b> 만족하는 종목만 봅니다.
      </template>
      <template v-else>
        선택한 항목 <b>중 하나라도</b> 맞으면 결과에 포함합니다.
      </template>
    </p>

    <div v-show="isOpen" class="facets">
      <div
        v-for="facet in visibleFacets"
        :key="facet"
        class="facet"
        :class="{ focused: focusFacet === facet }"
      >
        <div class="f-head">
          <span class="f-label">{{ FACET_LABELS[facet] }}</span>
          <div class="logic" v-if="MULTI_VALUED.has(facet) && query.facets[facet].values.length > 1">
            <button :class="{ on: query.facets[facet].mode === 'or' }"
                    @click="emit('mode', facet, 'or')">또는</button>
            <button :class="{ on: query.facets[facet].mode === 'and' }"
                    @click="emit('mode', facet, 'and')">모두</button>
          </div>
        </div>
        <div class="chips">
          <button
            v-for="o in shown(facet)"
            :key="o.value"
            class="chip"
            :class="{ on: query.facets[facet].values.includes(o.value) }"
            :disabled="o.n === 0 && !query.facets[facet].values.includes(o.value)"
            @click="emit('toggle', facet, o.value)"
          >
            {{ o.value }}<span class="n">{{ o.n }}</span>
          </button>
          <button v-if="hiddenCount(facet)" class="chip more"
                  @click="expanded[facet] = true">
            +{{ hiddenCount(facet) }} 더보기
          </button>
        </div>
      </div>

      <div class="facet extra">
        <div class="f-head"><span class="f-label">추가 조건</span></div>
        <div class="chips">
          <button class="chip" :class="{ on: query.pension }" @click="emit('pension', !query.pension)">
            연금계좌(IRP/DC) 가능
          </button>
          <template v-if="hasQuotes">
            <span class="sep" aria-hidden="true"></span>
            <span class="mv-label">최소 거래대금</span>
            <button
              v-for="s in MIN_VALUE_STEPS"
              :key="s.v"
              class="chip sm"
              :class="{ on: query.minValue === s.v }"
              @click="emit('minValue', s.v)"
            >{{ s.label }}</button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.filter .card-t { margin-bottom: 0; }

.fold {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 800; color: var(--ink-soft); letter-spacing: -.01em;
}
.caret { width: 15px; height: 15px; transition: transform .2s; color: var(--muted); }
.caret.up { transform: rotate(180deg); }

.right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.join-wrap { display: flex; align-items: center; gap: 8px; }
.join-l { font-size: 11px; font-weight: 800; color: var(--muted); }

.reset {
  font-size: 11.5px; font-weight: 800; color: var(--up);
  padding: 5px 10px; border-radius: 8px; background: var(--surface);
}
.reset:hover:not(:disabled) { background: var(--up-soft); color: var(--up); }
.reset:disabled { opacity: .45; cursor: default; }

.join-note {
  margin: 10px 0 0; font-size: 11.5px; color: var(--ink-soft);
  background: var(--purple-soft); padding: 8px 11px; border-radius: 9px; line-height: 1.5;
}
.join-note b { color: var(--purple); }

.facets { margin-top: 14px; display: grid; gap: 15px; }
@media (min-width: 1000px) { .facets { grid-template-columns: repeat(2, 1fr); gap: 15px 24px; } }

.facet { min-width: 0; }
.facet.focused {
  outline: 2px solid var(--purple); outline-offset: 8px; border-radius: 8px;
}
.facet.extra { grid-column: 1 / -1; padding-top: 13px; border-top: 1px dashed var(--line-card); }

.f-head { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
.f-label { font-size: 11.5px; font-weight: 800; color: var(--muted); letter-spacing: .01em; }

.chip.more { color: var(--purple); border-style: dashed; }
.chip.sm { padding: 6px 11px; font-size: 11.5px; }

.sep { width: 1px; height: 20px; background: var(--line-card); margin: 0 3px; }
.mv-label { font-size: 11.5px; font-weight: 700; color: var(--muted); align-self: center; }
</style>
