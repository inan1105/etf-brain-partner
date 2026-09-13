<script setup>
// 국내 ETF 한 종목의 금융투자협회 전자공시(dis.kofia.or.kr) '펀드요약정보'.
// 협회 화면의 탭 구성을 그대로 따른다 — 상담 중 원문과 대조하기 쉽도록.
import { computed, ref, watch } from 'vue'
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtPrice } from '../lib/api.js'
import TrendChart from './TrendChart.vue'

const props = defineProps({
  item: { type: Object, required: true }
})

const TABS = [
  { key: 'basic', label: '펀드기본정보' },
  { key: 'returns', label: '수익률 추이차트' },
  { key: 'price', label: '가격변동 추이' },
  { key: 'assets', label: '자산구성내역' },
  { key: 'settle', label: '결산 및 상환' }
]

const tab = ref('basic')
const data = ref(null)
const busy = ref(false)
const error = ref(null)

async function load () {
  busy.value = true
  error.value = null
  data.value = null
  const it = props.item
  const q = new URLSearchParams({ name: it.name, code: it.code || it.queryKey || '' })
  try {
    const res = await fetch(`/api/fund?${q}`)
    const raw = await res.text()
    let body
    try { body = JSON.parse(raw) } catch {
      throw Object.assign(new Error('협회 조회 서버에 연결할 수 없습니다'),
        { hint: '/api/fund 서버리스 함수가 배포되어 있어야 합니다.' })
    }
    if (!res.ok) throw Object.assign(new Error(body.error || `오류 ${res.status}`), { hint: body.hint, url: body.kofiaUrl })
    data.value = body
  } catch (e) {
    error.value = { message: e.message, hint: e.hint, url: e.url }
  } finally {
    busy.value = false
  }
}
watch(() => props.item.queryKey, () => { tab.value = 'basic'; load() }, { immediate: true })

// ── 표시 도우미 ──
const pctPlain = v => (v == null ? '—' : `${v.toFixed(2)}%`)
const pctAxis = v => `${Number(v.toFixed(1))}%`
const priceAxis = v => fmtNum(v)
const feePct = v => (v == null ? '—' : `${Number(v.toFixed(4))}%`)
const signed = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${fmtPrice(v)}`)
const dirClass = v => (v == null || v === 0 ? 'v-flat' : v > 0 ? 'v-up' : 'v-down')
const period = (a, b) => `${fmtDate(a)} ~ ${fmtDate(b)}`

const basic = computed(() => data.value?.basic)

const basicRows = computed(() => {
  const b = basic.value
  if (!b) return []
  return [
    ['운용상태', b.status],
    ['펀드종류', b.fundKind],
    ['펀드유형', b.fundType],
    ['특성분류', b.trait],
    ['공모/사모', b.offering],
    ['추가/단위', b.additional],
    ['설정일', fmtDate(b.estDt)],
    ['최초설정기준가격', b.initialNav == null ? null : `${fmtPrice(b.initialNav)}원`],
    ['투자지역', b.investRegion],
    ['판매지역', b.saleRegion],
    ['운용실적공시분류', b.profitType],
    ['협회 단축코드', b.shortCd]
  ].filter(([, v]) => v)
})

const feeRows = computed(() => {
  const f = basic.value?.fees
  if (!f) return []
  return [
    ['운용보수', f.manage, f.avg.manage],
    ['판매보수', f.sale, f.avg.sale],
    ['수탁보수', f.trust, f.avg.trust],
    ['일반사무관리보수', f.office, f.avg.office],
    ['보수합계', f.total, f.avg.total],
    ['TER(총보수비용)', f.ter, f.avg.ter]
  ]
})

// 수익률: 누적 수익률 계열에서 기간별 수익률을 뽑는다 — (1+끝)/(1+시작)-1
const RET_SERIES = [
  { key: 'fund', label: '운용수익률', color: '#6C5CE7' },
  { key: 'kospi', label: 'KOSPI', color: '#C77A1A' }
]
const retRows = computed(() => data.value?.returns?.rows || [])

const periodTable = computed(() => {
  const rows = retRows.value
  if (rows.length < 2) return []
  const end = rows[rows.length - 1]
  const endDate = new Date(+end.d.slice(0, 4), +end.d.slice(4, 6) - 1, +end.d.slice(6, 8))
  const keys = ['fund', 'kospi', 'kosdaq', 'bond3y', 'corp3y']
  return [['1개월', 1], ['3개월', 3], ['6개월', 6], ['1년', 12]].map(([label, m]) => {
    const t = new Date(endDate)
    t.setMonth(t.getMonth() - m)
    const target = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`
    // 목표일 이전의 마지막 거래일 (없으면 첫날 — 1년은 조회 시작일)
    let start = rows[0]
    for (const r of rows) { if (r.d <= target) start = r; else break }
    const out = { label, from: start.d }
    for (const k of keys) {
      out[k] = end[k] == null || start[k] == null
        ? null
        : ((1 + end[k] / 100) / (1 + start[k] / 100) - 1) * 100
    }
    return out
  })
})

// 가격변동: 그래프는 1년, 표는 최근 15거래일
const PRICE_SERIES = [{ key: 'nav', label: '기준가격', color: '#6C5CE7' }]
const priceRows = computed(() => data.value?.price?.rows || [])
const priceRecent = computed(() => priceRows.value.slice(-15).reverse())

const assets = computed(() => data.value?.assets)
const settle = computed(() => data.value?.settle || [])

const tabError = computed(() => data.value?.errors?.[tab.value])
</script>

<template>
  <section class="kf">
    <div class="kf-head">
      <div class="grow">
        <div class="kf-t">
          <span class="kf-src">금융투자협회 전자공시</span>
          펀드요약정보
        </div>
        <div v-if="data" class="kf-fund">
          <b>{{ data.fund.name }}</b>
          <span class="tnum">[{{ data.fund.standardCd }}]</span>
          <span v-if="data.fund.matchedBy === 'partial'" class="badge warn"
                title="종목명과 협회 공식 펀드명의 표기가 달라 유사 명칭으로 찾았습니다">명칭 확인 필요</span>
        </div>
      </div>
      <a v-if="data?.sourceUrl" class="kf-link" :href="data.sourceUrl" target="_blank" rel="noopener">
        협회 원문 ↗
      </a>
    </div>

    <div v-if="busy" class="kf-wait">
      <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton short"></span>
      <p class="small">dis.kofia.or.kr 에서 불러오는 중…</p>
    </div>

    <div v-else-if="error" class="kf-err">
      <b>{{ error.message }}</b>
      <p v-if="error.hint">{{ error.hint }}</p>
      <div class="kf-err-acts">
        <button class="kf-retry" @click="load">다시 시도</button>
        <a v-if="error.url" :href="error.url" target="_blank" rel="noopener">협회 사이트에서 찾기 ↗</a>
      </div>
    </div>

    <template v-else-if="data">
      <div class="kf-tabs" role="tablist">
        <button
          v-for="t in TABS" :key="t.key" role="tab"
          :aria-selected="tab === t.key" :class="{ on: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <div class="kf-body" role="tabpanel">
        <p v-if="tabError" class="kf-miss">이 항목은 협회에서 받지 못했습니다. ({{ tabError }})</p>

        <!-- 펀드기본정보 -->
        <template v-else-if="tab === 'basic' && basic">
          <div v-if="basic.nav" class="nav-card">
            <div class="nav-main">
              <span class="nav-l">기준가</span>
              <b class="tnum">{{ fmtPrice(basic.nav.value) }}</b>
              <span class="nav-d">{{ fmtDate(basic.nav.asOf) }}</span>
            </div>
            <dl class="nav-grid">
              <div><dt>전일대비</dt><dd class="tnum" :class="dirClass(basic.nav.dayChg)">
                {{ signed(basic.nav.dayChg) }} ({{ fmtPct(basic.nav.dayChgRt) }})</dd></div>
              <div><dt>전주대비</dt><dd class="tnum" :class="dirClass(basic.nav.weekChg)">
                {{ signed(basic.nav.weekChg) }} ({{ fmtPct(basic.nav.weekChgRt) }})</dd></div>
              <div><dt>설정원본</dt><dd class="tnum">{{ fmtMoney(basic.nav.originalAmt) }}</dd></div>
              <div><dt>순자산총액</dt><dd class="tnum">{{ fmtMoney(basic.nav.netAssets) }}</dd></div>
            </dl>
          </div>

          <dl class="kv">
            <div v-for="[k, v] in basicRows" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></div>
          </dl>

          <div class="sub-t">관련보수 <span class="small">연 % · 유형평균은 {{ basic.fundType || '같은 유형' }} 펀드 평균</span></div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>구분</th><th>이 펀드</th><th>유형평균</th></tr></thead>
              <tbody>
                <tr v-for="[k, v, avg] in feeRows" :key="k" :class="{ strong: k === '보수합계' || k.startsWith('TER') }">
                  <th>{{ k }}</th><td class="tnum">{{ feePct(v) }}</td><td class="tnum muted">{{ feePct(avg) }}</td>
                </tr>
                <tr>
                  <th>선취/후취 수수료</th>
                  <td class="tnum" colspan="2">{{ feePct(basic.fees.frontLoad) }} / {{ feePct(basic.fees.backLoad) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="sub-t">관련회사</div>
          <dl class="kv">
            <div><dt>운용회사</dt><dd>{{ basic.companies.manager || '—' }}</dd></div>
            <div><dt>수탁회사</dt><dd>{{ basic.companies.trustee || '—' }}</dd></div>
            <div><dt>일반사무관리회사</dt><dd>{{ basic.companies.office || '—' }}</dd></div>
          </dl>
        </template>

        <!-- 수익률 추이차트 -->
        <template v-else-if="tab === 'returns'">
          <p v-if="retRows.length < 2" class="kf-miss">수익률 추이 자료가 없습니다.</p>
          <template v-else>
            <div class="cap">
              {{ period(retRows[0].d, retRows[retRows.length - 1].d) }} · 조회 시작일 대비 누적 수익률
            </div>
            <TrendChart :rows="retRows" :series="RET_SERIES" :format="pctPlain" :axis-format="pctAxis" zero-line
                        label="운용수익률과 KOSPI 누적 수익률 추이" />
            <div class="sub-t">기간별 수익률</div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>기간</th><th>운용수익률</th><th>KOSPI</th><th>KOSDAQ</th><th>국공채</th><th>회사채</th></tr></thead>
                <tbody>
                  <tr v-for="r in periodTable" :key="r.label">
                    <th>{{ r.label }}</th>
                    <td class="tnum strong-c" :class="dirClass(r.fund)">{{ fmtPct(r.fund) }}</td>
                    <td class="tnum">{{ fmtPct(r.kospi) }}</td>
                    <td class="tnum">{{ fmtPct(r.kosdaq) }}</td>
                    <td class="tnum">{{ fmtPct(r.bond3y) }}</td>
                    <td class="tnum">{{ fmtPct(r.corp3y) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="note">
              운용수익률은 협회가 공시하는 펀드 수익률(분배금 반영)이며, 기준가격은 통상 전 영업일 종가로 계산됩니다.
            </p>
          </template>
        </template>

        <!-- 가격변동 추이 -->
        <template v-else-if="tab === 'price'">
          <p v-if="priceRows.length < 2" class="kf-miss">가격변동 자료가 없습니다.</p>
          <template v-else>
            <div class="cap">{{ period(priceRows[0].d, priceRows[priceRows.length - 1].d) }} · 기준가격(원)</div>
            <TrendChart :rows="priceRows" :series="PRICE_SERIES" :format="fmtPrice" :axis-format="priceAxis"
                        label="기준가격 추이" />
            <div class="sub-t">최근 15거래일</div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>기준일자</th><th>기준가격</th><th>전일대비</th><th>과표기준가격</th><th>설정원본</th><th>KOSPI200</th></tr></thead>
                <tbody>
                  <tr v-for="r in priceRecent" :key="r.d">
                    <th class="tnum">{{ fmtDate(r.d) }}</th>
                    <td class="tnum">{{ fmtPrice(r.nav) }}</td>
                    <td class="tnum" :class="dirClass(r.chg)">{{ signed(r.chg) }}</td>
                    <td class="tnum">{{ fmtPrice(r.taxNav) }}</td>
                    <td class="tnum">{{ fmtMoney(r.originalAmt) }}</td>
                    <td class="tnum">{{ fmtPrice(r.kospi200) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <!-- 자산구성내역 -->
        <template v-else-if="tab === 'assets'">
          <p v-if="!assets" class="kf-miss">자산구성 자료가 없습니다.</p>
          <template v-else>
            <div class="cap">{{ fmtDate(assets.asOf) }} 기준 · 순자산 대비 비중</div>
            <div class="bars">
              <div v-for="g in assets.groups" :key="g.key" class="bar-row">
                <span class="bar-l">{{ g.label }}</span>
                <div class="bar-track"><i :style="{ width: Math.min(100, g.pct) + '%' }"></i></div>
                <b class="bar-v tnum">{{ pctPlain(g.pct) }}</b>
                <span v-if="g.detail.some(([, v]) => v > 0)" class="bar-d">
                  <template v-for="([k, v], i) in g.detail.filter(([, v]) => v > 0)" :key="k">
                    <template v-if="i"> · </template>{{ k }} {{ pctPlain(v) }}
                  </template>
                </span>
              </div>
            </div>
            <p class="note">세부 항목(KSE·국고채·예금 등)은 해당 자산군 안에서의 비율입니다.</p>
          </template>
        </template>

        <!-- 결산 및 상환 -->
        <template v-else-if="tab === 'settle'">
          <p v-if="!settle.length" class="kf-miss">결산·상환 내역이 없습니다.</p>
          <div v-else class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>신탁회계기간</th><th>경과일수</th><th>기준가격</th><th>과표</th><th>설정원본</th><th>구분</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in settle" :key="r.from + r.to">
                  <th class="tnum">{{ period(r.from, r.to) }}</th>
                  <td class="tnum">{{ fmtNum(r.days) }}일</td>
                  <td class="tnum">{{ fmtPrice(r.nav) }}</td>
                  <td class="tnum">{{ fmtPrice(r.taxNav) }}</td>
                  <td class="tnum">{{ fmtMoney(r.originalAmt) }}</td>
                  <td>{{ r.kind || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <p class="kf-foot">
        출처: 금융투자협회 전자공시(dis.kofia.or.kr). 협회 공시 기준값이므로 거래소 시세·NAV와 다를 수 있습니다.
      </p>
    </template>
  </section>
</template>

<style scoped>
.kf { margin-top: 14px; border: 1px solid var(--line-card); border-radius: var(--r-md); overflow: hidden; }
/* 등락 색 — 표·목록의 기본 글자색보다 우선 (국내 관행: 상승 적색 / 하락 청색) */
.kf .v-up { color: var(--up); }
.kf .v-down { color: var(--down); }

.kf-head {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 13px 15px; background: #F6F8FB; border-bottom: 1px solid var(--line-data);
}
.kf-t { font-size: 13px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.kf-src {
  display: inline-block; margin-right: 6px; padding: 2px 7px; border-radius: 6px;
  background: var(--indigo); color: #fff; font-size: 10.5px; font-weight: 800; vertical-align: 1px;
}
.kf-fund { margin-top: 5px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted-2); }
.kf-fund b { color: var(--ink-soft); font-weight: 700; }
.kf-link {
  flex: none; font-size: 11.5px; font-weight: 800; color: var(--indigo); text-decoration: none;
  padding: 6px 10px; border-radius: 8px; background: #fff; border: 1px solid var(--line-data);
}
.kf-link:hover { border-color: var(--indigo); }

.kf-wait { padding: 16px 15px; display: flex; flex-direction: column; gap: 8px; }
.kf-wait .skeleton { height: 12px; }
.kf-wait .short { width: 60%; }
.kf-wait .small { margin: 2px 0 0; }

.kf-err { padding: 14px 15px; background: #FFF8F8; }
.kf-err b { display: block; font-size: 12.5px; color: var(--up); }
.kf-err p { margin: 5px 0 0; font-size: 11.5px; color: var(--ink-soft); line-height: 1.6; }
.kf-err-acts { display: flex; gap: 10px; align-items: center; margin-top: 9px; font-size: 11.5px; font-weight: 700; }
.kf-retry { padding: 5px 10px; border-radius: 8px; background: #fff; border: 1px solid #FBD3D3; color: var(--up); font-weight: 800; font-size: 11.5px; }
.kf-err-acts a { color: var(--indigo); }

.kf-tabs {
  display: flex; gap: 2px; overflow-x: auto; padding: 0 8px;
  border-bottom: 1px solid var(--line-data); scrollbar-width: none;
}
.kf-tabs::-webkit-scrollbar { display: none; }
.kf-tabs button {
  flex: none; padding: 11px 10px 10px; font-size: 12.5px; font-weight: 700; color: var(--muted-2);
  border-bottom: 2.5px solid transparent; margin-bottom: -1px; white-space: nowrap;
}
.kf-tabs button:hover { color: var(--ink); }
.kf-tabs button.on { color: var(--indigo); font-weight: 800; border-bottom-color: var(--indigo); }

.kf-body { padding: 14px 15px 6px; }
.kf-miss { margin: 4px 0 10px; font-size: 12px; color: var(--muted); }

.cap { font-size: 11px; font-weight: 700; color: var(--muted-2); margin-bottom: 10px; }
.sub-t { margin: 16px 0 8px; font-size: 12px; font-weight: 800; color: var(--ink-soft); display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.sub-t .small { font-weight: 600; font-size: 10.5px; }
.note { margin: 9px 0 6px; font-size: 10.5px; color: var(--muted); line-height: 1.6; }

/* 기준가 */
.nav-card { background: var(--surface); border-radius: var(--r-sm); padding: 13px 14px; margin-bottom: 12px; }
.nav-main { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.nav-l { font-size: 11px; font-weight: 800; color: var(--muted-2); }
.nav-main b { font-size: 22px; font-weight: 800; color: var(--ink-data); letter-spacing: -.02em; }
.nav-d { font-size: 11px; color: var(--muted); font-weight: 600; }
.nav-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 14px; margin: 0; }
@media (min-width: 520px) { .nav-grid { grid-template-columns: repeat(4, 1fr); } }
.nav-grid div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nav-grid dt { font-size: 10.5px; color: var(--muted-2); font-weight: 700; }
.nav-grid dd { margin: 0; font-size: 12px; font-weight: 800; color: var(--ink-data); }

/* 항목 목록 */
.kv { display: grid; grid-template-columns: 1fr; margin: 0; border-top: 1px solid var(--line-data); }
@media (min-width: 520px) { .kv { grid-template-columns: 1fr 1fr; column-gap: 18px; } }
.kv div { display: flex; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--line-data); min-width: 0; }
.kv dt { flex: none; width: 104px; font-size: 11.5px; color: var(--muted-2); font-weight: 700; }
.kv dd { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--ink-data); word-break: break-word; }

/* 표 */
.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.tbl th, .tbl td { padding: 7px 8px; border-bottom: 1px solid var(--line-data); text-align: right; }
.tbl thead th { font-size: 11px; font-weight: 800; color: var(--muted-2); background: var(--surface-2); border-top: 1px solid var(--line-data); }
.tbl tbody th { text-align: left; font-weight: 700; color: var(--ink-soft); }
.tbl thead th:first-child { text-align: left; }
.tbl td { color: var(--ink-data); font-weight: 600; }
.tbl td:last-child:not(.tnum) { text-align: center; }
.tbl .muted { color: var(--muted-2); }
.tbl tr.strong th, .tbl tr.strong td, .tbl .strong-c { font-weight: 800; }

/* 자산구성 */
.bars { display: flex; flex-direction: column; gap: 12px; }
.bar-row { display: grid; grid-template-columns: 52px 1fr 58px; align-items: center; gap: 4px 10px; }
.bar-l { font-size: 12px; font-weight: 800; color: var(--ink-soft); }
.bar-track { height: 10px; background: var(--surface); border-radius: 999px; overflow: hidden; }
.bar-track i { display: block; height: 100%; background: var(--purple); border-radius: 0 4px 4px 0; }
.bar-v { text-align: right; font-size: 12.5px; font-weight: 800; color: var(--ink-data); }
.bar-d { grid-column: 2 / -1; font-size: 11px; color: var(--muted); }

.kf-foot {
  margin: 0; padding: 10px 15px 12px; font-size: 10.5px; color: var(--muted); line-height: 1.6;
  border-top: 1px dashed var(--line-data);
}
</style>
