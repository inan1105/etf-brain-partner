<script setup>
import { computed, ref } from 'vue'
import { fmtNum, fmtMoney, fmtPrice, fmtFee } from '../lib/api.js'

const props = defineProps({
  results: { type: Array, required: true },
  hasQuotes: { type: Boolean, default: true }
})
const emit = defineEmits(['open', 'go'])

const amount = ref(10000000) // 1,000만원
const slots = ref(5)
const style = ref('balanced')

const STYLES = {
  safe: { label: '안정', desc: '채권·저변동 비중을 높이고 균등에 가깝게', tilt: 0.15 },
  balanced: { label: '균형', desc: '적합도 순서를 완만하게 반영', tilt: 0.35 },
  growth: { label: '성장', desc: '상위 종목에 비중을 더 싣습니다', tilt: 0.6 }
}

const AMOUNTS = [1000000, 3000000, 5000000, 10000000, 30000000, 50000000]

/**
 * 후보 선정 — 같은 자산군이 한쪽으로 쏠리지 않도록 자산군별 상한을 둔다.
 * (집중 위험을 줄이는 것이 '포트폴리오 구성'의 최소 요건이다)
 */
const picks = computed(() => {
  const n = slots.value
  const perAsset = Math.max(1, Math.ceil(n / 2))
  const used = new Map()
  const out = []
  for (const it of props.results) {
    if (out.length >= n) break
    if (!it.close || it.close <= 0) continue // 시세 없는 종목 제외
    // 배분은 원화 기준이다. 달러 표시 종목을 섞으면 수량 계산이 통화를 오간다.
    if (it.market === 'US') continue
    const c = used.get(it.asset) || 0
    if (c >= perAsset) continue
    used.set(it.asset, c + 1)
    out.push(it)
  }
  return out
})

/** 순위 가중치 — tilt 가 클수록 상위 집중 */
const weights = computed(() => {
  const n = picks.value.length
  if (!n) return []
  const tilt = STYLES[style.value].tilt
  const raw = picks.value.map((_, i) => Math.pow(1 - tilt, i))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map(r => r / sum)
})

const plan = computed(() =>
  picks.value.map((it, i) => {
    const w = weights.value[i]
    const budget = amount.value * w
    const qty = Math.floor(budget / it.close)
    const cost = qty * it.close
    return { item: it, weight: w, budget, qty, cost }
  })
)

const invested = computed(() => plan.value.reduce((a, r) => a + r.cost, 0))
const cash = computed(() => amount.value - invested.value)

const avgFee = computed(() => {
  const rows = plan.value.filter(r => r.item.expenseRatio != null && r.cost > 0)
  if (!rows.length) return null
  const total = rows.reduce((a, r) => a + r.cost, 0)
  return rows.reduce((a, r) => a + r.item.expenseRatio * r.cost, 0) / total
})

/** 자산군 배분 — 집중도 점검용 */
const mix = computed(() => {
  const m = new Map()
  for (const r of plan.value) {
    if (!r.cost) continue
    m.set(r.item.asset, (m.get(r.item.asset) || 0) + r.cost)
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0) || 1
  return [...m.entries()]
    .map(([k, v]) => ({ label: k, pct: (v / total) * 100 }))
    .sort((a, b) => b.pct - a.pct)
})

const topWeight = computed(() => (plan.value.length ? plan.value[0].weight * 100 : 0))

const warning = computed(() => {
  if (!plan.value.length) return null
  if (topWeight.value > 45) return '단일 종목 비중이 45%를 넘습니다. 분산을 늘리는 편이 안전합니다.'
  if (mix.value.length === 1) return '한 가지 자산군에만 배분되어 있습니다. 조건을 넓혀 자산군을 섞어보세요.'
  if (plan.value.length < slots.value) return '조건에 맞는 종목이 부족해 요청한 종목 수를 채우지 못했습니다.'
  return null
})

const COLORS = ['#6C5CE7', '#3182F6', '#B4DE1E', '#E5484D', '#16A34A', '#F2994A']
</script>

<template>
  <section class="card pf">
    <div class="card-t">
      내 투자금으로 포트폴리오 구성
      <span class="badge purple">D-15</span>
    </div>

    <!-- 입력 -->
    <div class="inputs">
      <div class="ipt">
        <label for="pf-amt">투자금액</label>
        <div class="amt-box">
          <input id="pf-amt" v-model.number="amount" type="number" min="100000" step="100000"
                 class="tnum" inputmode="numeric">
          <span>원</span>
        </div>
        <div class="chips mt8">
          <button v-for="a in AMOUNTS" :key="a" class="chip sm" :class="{ on: amount === a }"
                  @click="amount = a">{{ fmtMoney(a) }}</button>
        </div>
      </div>

      <div class="ipt">
        <label>종목 수</label>
        <div class="chips">
          <button v-for="n in [3, 4, 5, 6, 8, 10]" :key="n" class="chip sm"
                  :class="{ on: slots === n }" @click="slots = n">{{ n }}</button>
        </div>
      </div>

      <div class="ipt">
        <label>배분 성향</label>
        <div class="chips">
          <button v-for="(s, k) in STYLES" :key="k" class="chip sm" :class="{ on: style === k }"
                  @click="style = k" :title="s.desc">{{ s.label }}</button>
        </div>
        <p class="small mt8">{{ STYLES[style].desc }}</p>
      </div>
    </div>

    <div v-if="!plan.length" class="empty">
      <b>배분할 국내 상장 종목이 없습니다</b>
      배분은 원화 기준이라 국내 상장 ETF만 사용합니다.
      국내 시세에는 <code>KRX_AUTH_KEY</code> 연결이 필요하며,
      조건을 완화하거나 최소 거래대금을 낮춰도 좋습니다.
    </div>

    <template v-else-if="plan.length">
      <!-- 요약 -->
      <div class="summary">
        <div><dt>투자 실행액</dt><dd class="tnum">{{ fmtMoney(invested) }}</dd></div>
        <div><dt>남는 현금</dt><dd class="tnum">{{ fmtMoney(cash) }}</dd></div>
        <div><dt>가중평균 보수</dt><dd class="tnum">{{ avgFee == null ? '—' : fmtFee(avgFee) }}</dd></div>
        <div><dt>최대 종목 비중</dt><dd class="tnum">{{ topWeight.toFixed(1) }}%</dd></div>
      </div>

      <!-- 자산군 배분 막대 -->
      <div class="mix">
        <div class="mix-bar">
          <i v-for="(m, i) in mix" :key="m.label"
             :style="{ width: m.pct + '%', background: COLORS[i % COLORS.length] }"
             :title="`${m.label} ${m.pct.toFixed(1)}%`"></i>
        </div>
        <div class="mix-legend">
          <span v-for="(m, i) in mix" :key="m.label">
            <i :style="{ background: COLORS[i % COLORS.length] }"></i>{{ m.label }} {{ m.pct.toFixed(0) }}%
          </span>
        </div>
      </div>

      <p v-if="warning" class="warn">{{ warning }}</p>

      <!-- 배분표 -->
      <div class="table-wrap mt12">
        <table class="data">
          <thead>
            <tr><th>종목명</th><th>비중</th><th>현재가</th><th>수량</th><th>매수금액</th><th>보수</th><th>이동</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in plan" :key="r.item.code">
              <td class="name">
                <button class="t-name" @click="emit('open', r.item)">{{ r.item.name }}</button>
                <span class="t-sub">{{ r.item.queryKey }} · {{ r.item.asset }}</span>
              </td>
              <td class="tnum"><b>{{ (r.weight * 100).toFixed(1) }}%</b></td>
              <td class="tnum">{{ fmtPrice(r.item.close) }}</td>
              <td class="tnum">{{ fmtNum(r.qty) }}주</td>
              <td class="tnum">{{ fmtMoney(r.cost) }}</td>
              <td class="tnum">{{ fmtFee(r.item.expenseRatio) }}</td>
              <td class="jump-cell">
                <button class="mini lime" @click="emit('go', 'ta', r.item)">TA</button>
                <button class="mini blue" @click="emit('go', 'stockr', r.item)">상담</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="disclaimer">
        수량은 현재가 기준 정수 매수 가정이며 호가·수수료·세금·환율은 반영하지 않았습니다.
        배분안은 조건과 적합도에 따른 예시일 뿐 투자 권유가 아닙니다.
      </p>
    </template>
  </section>
</template>

<style scoped>
.inputs { display: grid; gap: 16px; margin-bottom: 16px; }
@media (min-width: 780px) { .inputs { grid-template-columns: 1.2fr 1fr 1fr; gap: 20px; } }

.ipt label { display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 7px; }

.amt-box {
  display: flex; align-items: center; gap: 7px;
  background: #fff; border: 1.5px solid var(--line-card); border-radius: 13px;
  padding: 0 14px; transition: .18s;
}
.amt-box:focus-within { border-color: var(--purple); box-shadow: 0 0 0 4px rgba(108, 92, 231, .12); }
.amt-box input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  padding: 12px 0; font-size: 16px; font-weight: 800; color: var(--ink);
}
.amt-box span { font-size: 13px; font-weight: 700; color: var(--muted); flex: none; }
.chip.sm { padding: 6px 11px; font-size: 11.5px; }

.summary {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px;
  background: var(--surface); border-radius: var(--r-sm); padding: 14px; margin-bottom: 13px;
}
@media (min-width: 620px) { .summary { grid-template-columns: repeat(4, 1fr); } }
.summary div { display: flex; flex-direction: column; gap: 2px; }
.summary dt { font-size: 10.5px; font-weight: 700; color: var(--muted-2); }
.summary dd { margin: 0; font-size: 15px; font-weight: 800; color: var(--ink-data); letter-spacing: -.02em; }

.mix-bar {
  display: flex; height: 9px; border-radius: 999px; overflow: hidden;
  background: var(--surface); margin-bottom: 8px;
}
.mix-bar i { display: block; height: 100%; }
.mix-legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--ink-soft); font-weight: 700; }
.mix-legend span { display: inline-flex; align-items: center; gap: 5px; }
.mix-legend i { width: 8px; height: 8px; border-radius: 3px; display: block; }

.warn {
  margin: 12px 0 0; padding: 10px 13px; border-radius: 10px;
  background: #FFF4E5; color: #8A5200; font-size: 11.5px; font-weight: 700; line-height: 1.6;
}

.t-name { font-weight: 700; color: var(--ink); font-size: 12.5px; text-align: left; display: block; }
.t-name:hover { color: var(--purple); text-decoration: underline; }
.t-sub { display: block; font-size: 10.5px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.jump-cell { display: flex; gap: 4px; justify-content: flex-end; }
.mini { padding: 4px 9px; border-radius: 7px; font-size: 10.5px; font-weight: 800; }
.mini.lime { background: var(--lime-soft); color: #5E7A05; }
.mini.blue { background: var(--blue-soft); color: var(--blue-deep); }

.disclaimer { margin: 14px 0 0; font-size: 11px; color: var(--muted); line-height: 1.7; }
</style>
