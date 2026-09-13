<script setup>
// 기간 추이 선 그래프 — 협회 탭(수익률·기준가격)에서 쓴다.
// 한 축만 쓴다 (단위가 다른 값을 한 그림에 겹치지 않는다).
// 포인터를 올리면 세로 보조선이 가까운 날짜에 붙고, 그 날의 모든 계열 값을 보여준다.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  rows: { type: Array, required: true },          // [{ d:'YYYYMMDD', [key]: number }]
  series: { type: Array, required: true },        // [{ key, label, color }]
  format: { type: Function, required: true },     // 값 → 표시 문자열 (범례·툴팁)
  axisFormat: { type: Function, default: null },  // 눈금 전용 (없으면 format)
  zeroLine: { type: Boolean, default: false },    // 0 기준선을 강조 (수익률)
  height: { type: Number, default: 190 },
  label: { type: String, default: '추이 차트' }
})

const box = ref(null)
const width = ref(560)
let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => { width.value = Math.max(260, Math.round(e.contentRect.width)) })
  ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())

const PAD = { t: 10, r: 12, b: 24, l: 52 }
const plotW = computed(() => width.value - PAD.l - PAD.r)
const plotH = computed(() => props.height - PAD.t - PAD.b)

const extent = computed(() => {
  let lo = Infinity
  let hi = -Infinity
  for (const r of props.rows) {
    for (const s of props.series) {
      const v = r[s.key]
      if (v == null) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (!isFinite(lo)) return [0, 1]
  if (props.zeroLine) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08
  return [lo - pad, hi + pad]
})

const x = i => PAD.l + (props.rows.length < 2 ? 0 : (i / (props.rows.length - 1)) * plotW.value)
const y = v => {
  const [lo, hi] = extent.value
  return PAD.t + (1 - (v - lo) / (hi - lo)) * plotH.value
}

/** 보기 좋은 눈금 간격 */
const ticks = computed(() => {
  const [lo, hi] = extent.value
  const raw = (hi - lo) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
})

const xTicks = computed(() => {
  const n = props.rows.length
  if (n < 2) return []
  const count = width.value < 420 ? 3 : 5
  return Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)))
    .map(i => ({ i, text: `${props.rows[i].d.slice(2, 4)}.${props.rows[i].d.slice(4, 6)}` }))
})

const paths = computed(() => props.series.map(s => {
  let d = ''
  let pen = false
  props.rows.forEach((r, i) => {
    const v = r[s.key]
    if (v == null) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return { ...s, d }
}))

const last = computed(() => props.rows[props.rows.length - 1] || {})

// ── 포인터 · 키보드 ──
const hover = ref(null)
function onMove (e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const px = e.clientX - rect.left - PAD.l
  const n = props.rows.length
  if (n < 2) return
  hover.value = Math.min(n - 1, Math.max(0, Math.round((px / plotW.value) * (n - 1))))
}
function onKey (e) {
  const n = props.rows.length
  if (!n) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const cur = hover.value ?? n - 1
    hover.value = Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)))
  } else if (e.key === 'Escape') hover.value = null
}

const tip = computed(() => {
  if (hover.value == null) return null
  const r = props.rows[hover.value]
  const left = x(hover.value)
  return {
    left,
    flip: left > width.value * 0.62,
    date: `${r.d.slice(0, 4)}.${r.d.slice(4, 6)}.${r.d.slice(6, 8)}`,
    items: props.series.map(s => ({ ...s, v: r[s.key] }))
  }
})
</script>

<template>
  <div class="tc" ref="box">
    <div v-if="series.length > 1" class="legend">
      <span v-for="s in series" :key="s.key" class="lg">
        <i :style="{ background: s.color }"></i>{{ s.label }}
        <b class="tnum">{{ last[s.key] == null ? '—' : format(last[s.key]) }}</b>
      </span>
    </div>

    <svg
      :width="width" :height="height" role="img" :aria-label="label"
      tabindex="0" @pointermove="onMove" @pointerleave="hover = null"
      @keydown="onKey" @blur="hover = null"
    >
      <g class="grid">
        <g v-for="t in ticks" :key="t">
          <line :x1="PAD.l" :x2="width - PAD.r" :y1="y(t)" :y2="y(t)"
                :class="{ zero: zeroLine && t === 0 }" />
          <text :x="PAD.l - 7" :y="y(t) + 3.5" text-anchor="end">{{ (axisFormat || format)(t) }}</text>
        </g>
        <text v-for="t in xTicks" :key="'x' + t.i" :x="x(t.i)" :y="height - 6"
              :text-anchor="t.i === 0 ? 'start' : t.i === rows.length - 1 ? 'end' : 'middle'">{{ t.text }}</text>
      </g>

      <path v-for="p in paths" :key="p.key" :d="p.d" :stroke="p.color" class="ln" />

      <g v-if="tip">
        <line class="cross" :x1="tip.left" :x2="tip.left" :y1="PAD.t" :y2="height - PAD.b" />
        <template v-for="it in tip.items" :key="it.key">
          <circle v-if="it.v != null" :cx="tip.left" :cy="y(it.v)" r="4.5" :fill="it.color" class="dot" />
        </template>
      </g>
      <!-- 포인터 판정 영역: 선이 아니라 그림 전체 -->
      <rect :x="PAD.l" :y="PAD.t" :width="plotW" :height="plotH" fill="transparent" />
    </svg>

    <div v-if="tip" class="tip" :style="{ left: tip.left + 'px' }" :class="{ flip: tip.flip }">
      <div class="tip-d">{{ tip.date }}</div>
      <div v-for="it in tip.items" :key="it.key" class="tip-r">
        <i :style="{ background: it.color }"></i>
        <b class="tnum">{{ it.v == null ? '—' : format(it.v) }}</b>
        <span>{{ it.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tc { position: relative; width: 100%; }
svg { display: block; overflow: visible; touch-action: pan-y; }
svg:focus-visible { outline: 3px solid rgba(108, 92, 231, .45); outline-offset: 4px; border-radius: 8px; }

.legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
.lg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink-soft); }
.lg i { width: 14px; height: 2px; border-radius: 2px; }
.lg b { color: var(--ink-data); font-weight: 800; }

.grid line { stroke: var(--line-data); stroke-width: 1; }
.grid line.zero { stroke: #B9BEC6; }
.grid text { font-size: 10px; fill: var(--muted-2); font-weight: 600; }

.ln { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.cross { stroke: var(--ink-soft); stroke-width: 1; stroke-dasharray: 3 3; }
.dot { stroke: #fff; stroke-width: 2; }

.tip {
  position: absolute; top: 34px; transform: translateX(12px);
  background: #fff; border: 1px solid var(--line-card); border-radius: 10px;
  box-shadow: var(--shadow-sm); padding: 8px 10px; pointer-events: none;
  min-width: 128px; z-index: 3;
}
.tip.flip { transform: translateX(calc(-100% - 12px)); }
.tip-d { font-size: 10.5px; font-weight: 700; color: var(--muted-2); margin-bottom: 4px; }
.tip-r { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); line-height: 1.7; white-space: nowrap; }
.tip-r i { width: 12px; height: 2px; border-radius: 2px; flex: none; }
.tip-r b { font-size: 12.5px; font-weight: 800; color: var(--ink-data); }
</style>
