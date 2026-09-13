<script setup>
import { computed, ref, onMounted } from 'vue'
import { fmtPrice, fmtPct, fmtFee } from '../lib/api.js'
import { readRecent } from '../lib/bridge.js'

const props = defineProps({
  all: { type: Array, required: true }
})
const emit = defineEmits(['open', 'go'])

const raw = ref('')
const STORE = 'etfp.holdings'

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORE)
    if (saved) raw.value = saved
    else {
      const recent = readRecent()
      if (recent.length) raw.value = recent.slice(0, 5).map(r => r.queryKey).join(', ')
    }
  } catch { /* 무시 */ }
})

function persist () {
  try { localStorage.setItem(STORE, raw.value) } catch { /* 무시 */ }
}

/** 쉼표·공백·줄바꿈 무엇으로 구분해도 받는다 */
const tokens = computed(() =>
  raw.value.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
)

const index = computed(() => {
  const m = new Map()
  for (const it of props.all) {
    m.set(String(it.code).toUpperCase(), it)
    if (it.symbol) m.set(String(it.symbol).toUpperCase(), it)
  }
  return m
})

const found = computed(() => {
  const seen = new Set()
  const out = []
  for (const t of tokens.value) {
    const it = index.value.get(t)
    if (it && !seen.has(it.code)) { seen.add(it.code); out.push(it) }
  }
  return out
})

const missing = computed(() => tokens.value.filter(t => !index.value.has(t)))

/** 보유 구성 점검 — 단순 균등 가정(금액 미입력)이므로 '분포'만 본다 */
function distribution (key) {
  const m = new Map()
  for (const it of found.value) {
    const vals = Array.isArray(it[key]) ? it[key] : [it[key]]
    for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

const byExposure = computed(() => distribution('exposure'))
const byAsset = computed(() => distribution('asset'))
const bySector = computed(() => distribution('sectors'))

const checks = computed(() => {
  const n = found.value.length
  if (!n) return []
  const out = []

  const top = byAsset.value[0]
  if (top && top[1] / n >= 0.8 && n > 1) {
    out.push({ level: 'warn', text: `보유 종목의 ${Math.round(top[1] / n * 100)}%가 '${top[0]}' 한 자산군에 몰려 있습니다.` })
  }
  const dom = byExposure.value[0]
  if (dom && dom[1] === n && n > 2) {
    out.push({ level: 'warn', text: `전부 ${dom[0]} 투자입니다. 지역 분산을 검토해 보세요.` })
  }
  const lev = found.value.filter(it => (it.strategy || []).some(s => s === '레버리지' || s === '인버스'))
  if (lev.length) {
    out.push({ level: 'warn', text: `레버리지·인버스 ${lev.length}종목이 있습니다. 장기 보유 시 복리 손실에 유의하세요.` })
  }
  const noPension = found.value.filter(it => !it.pensionEligible)
  if (noPension.length && noPension.length < n) {
    out.push({ level: 'info', text: `${noPension.length}종목은 연금계좌(IRP/DC)에 편입할 수 없습니다.` })
  }
  const fees = found.value.filter(it => it.expenseRatio != null)
  if (fees.length) {
    const avg = fees.reduce((a, it) => a + it.expenseRatio, 0) / fees.length
    out.push({ level: 'info', text: `보수 확인 가능한 ${fees.length}종목의 단순평균 보수는 ${fmtFee(avg)}입니다.` })
  }
  if (!out.length) out.push({ level: 'ok', text: '자산군·지역 분산에서 특별히 눈에 띄는 쏠림은 없습니다.' })
  return out
})

const dirOf = r => (r == null ? 'flat' : r > 0 ? 'up' : r < 0 ? 'down' : 'flat')
</script>

<template>
  <section class="card hold">
    <div class="card-t">
      지금 내 보유 ETF 점검하기
      <span class="badge purple">D-18</span>
    </div>

    <label class="lb" for="hold-in">보유 종목코드 · 심볼 (쉼표·공백·줄바꿈 구분)</label>
    <textarea
      id="hold-in"
      v-model="raw"
      rows="3"
      placeholder="예) 069500, 360750, SCHD, 133690"
      @blur="persist"
    ></textarea>

    <div class="row wrap mt8">
      <span class="small">{{ found.length }}종목 인식</span>
      <span v-if="missing.length" class="small miss">
        찾지 못함: {{ missing.join(', ') }}
      </span>
    </div>

    <div v-if="!found.length" class="empty">
      <b>보유 종목을 입력해 주세요</b>
      입력하면 구성 쏠림을 점검하고, 각 종목을 기술적분석·스토커로 바로 연결합니다.
    </div>

    <template v-else>
      <!-- 점검 -->
      <div class="checks">
        <div v-for="(c, i) in checks" :key="i" class="chk" :class="c.level">{{ c.text }}</div>
      </div>

      <!-- 분포 -->
      <div class="dist">
        <div class="d-col">
          <span class="d-t">국내/해외</span>
          <span v-for="[k, n] in byExposure" :key="k" class="d-row">{{ k }} <b>{{ n }}</b></span>
        </div>
        <div class="d-col">
          <span class="d-t">자산군</span>
          <span v-for="[k, n] in byAsset" :key="k" class="d-row">{{ k }} <b>{{ n }}</b></span>
        </div>
        <div class="d-col">
          <span class="d-t">섹터</span>
          <span v-if="!bySector.length" class="d-row muted">분류 없음</span>
          <span v-for="[k, n] in bySector.slice(0, 5)" :key="k" class="d-row">{{ k }} <b>{{ n }}</b></span>
        </div>
      </div>

      <!-- 목록 -->
      <div class="table-wrap mt12">
        <table class="data">
          <thead>
            <tr><th>종목명</th><th>구분</th><th>현재가</th><th>등락률</th><th>보수</th><th>연금</th><th>이동</th></tr>
          </thead>
          <tbody>
            <tr v-for="it in found" :key="it.code">
              <td class="name">
                <button class="t-name" @click="emit('open', it)">{{ it.name }}</button>
                <span class="t-sub">{{ it.queryKey }}</span>
              </td>
              <td>{{ it.exposure }} · {{ it.asset }}</td>
              <td class="tnum" :class="'v-' + dirOf(it.changeRate)">{{ fmtPrice(it.close) }}</td>
              <td class="tnum" :class="'v-' + dirOf(it.changeRate)">{{ fmtPct(it.changeRate) }}</td>
              <td class="tnum">{{ fmtFee(it.expenseRatio) }}</td>
              <td>{{ it.pensionEligible ? '가능' : '불가' }}</td>
              <td class="jump-cell">
                <button class="mini lime" @click="emit('go', 'ta', it)">TA</button>
                <button class="mini blue" @click="emit('go', 'stockr', it)">상담</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="disclaimer">
        보유 수량·매입가를 입력받지 않으므로 종목 수 기준의 단순 분포 점검입니다.
        손익과 비중을 반영한 판단은 스토커 상담에서 이어가세요.
      </p>
    </template>
  </section>
</template>

<style scoped>
.lb { display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 7px; }
textarea {
  width: 100%; border: 1.5px solid var(--line-card); border-radius: 13px;
  padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--ink);
  resize: vertical; outline: none; transition: .18s; background: #fff; line-height: 1.6;
}
textarea:focus { border-color: var(--purple); box-shadow: 0 0 0 4px rgba(108, 92, 231, .12); }
.miss { color: #B36A00 !important; font-weight: 700; }

.checks { display: flex; flex-direction: column; gap: 7px; margin-top: 14px; }
.chk {
  padding: 10px 13px; border-radius: 10px;
  font-size: 12px; font-weight: 700; line-height: 1.55;
}
.chk.warn { background: #FFF4E5; color: #8A5200; }
.chk.info { background: var(--blue-soft); color: var(--blue-deep); }
.chk.ok { background: #ECFDF3; color: #15803D; }

.dist {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  background: var(--surface); border-radius: var(--r-sm); padding: 13px; margin-top: 12px;
}
@media (max-width: 520px) { .dist { grid-template-columns: 1fr; gap: 14px; } }
.d-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.d-t { font-size: 10.5px; font-weight: 800; color: var(--muted-2); margin-bottom: 2px; }
.d-row {
  font-size: 11.5px; font-weight: 700; color: var(--ink-data);
  display: flex; justify-content: space-between; gap: 8px;
}
.d-row.muted { color: var(--muted); font-weight: 600; }
.d-row b { color: var(--purple); }

.t-name { font-weight: 700; color: var(--ink); font-size: 12.5px; text-align: left; display: block; }
.t-name:hover { color: var(--purple); text-decoration: underline; }
.t-sub { display: block; font-size: 10.5px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.jump-cell { display: flex; gap: 4px; justify-content: flex-end; }
.mini { padding: 4px 9px; border-radius: 7px; font-size: 10.5px; font-weight: 800; }
.mini.lime { background: var(--lime-soft); color: #5E7A05; }
.mini.blue { background: var(--blue-soft); color: var(--blue-deep); }

.disclaimer { margin: 14px 0 0; font-size: 11px; color: var(--muted); line-height: 1.7; }
</style>
