<script setup>
import { computed, ref, watch } from 'vue'
import { fmtPct, fmtPrice, fmtFee, RETURN_PERIODS } from '../lib/api.js'
import { splitBrand } from '../lib/search.js'

const props = defineProps({
  all: { type: Array, required: true },
  counts: { type: Object, required: true },
  query: { type: Object, required: true },
  recent: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] },
  returns: { type: Object, default: null },   // { meta, returns }
  hasQuotes: { type: Boolean, default: true }
})
const emit = defineEmits(['open', 'go', 'toggle', 'quickfind', 'clearRecent', 'clearFavorites'])

const TABS = [
  { key: 'keyword', label: '키워드', icon: 'tag' },
  { key: 'sector', label: '섹터', icon: 'grid' },
  { key: 'perf', label: '수익률', icon: 'chart' },
  { key: 'fav', label: '관심', icon: 'star' },
  { key: 'recent', label: '최근', icon: 'clock' }
]

const open = ref(null)
const period = ref('m1')

const toggleTab = k => { open.value = open.value === k ? null : k }

/** 키워드 — 테마·전략·자산을 건수순으로 섞어 노출 */
const keywords = computed(() => {
  const out = []
  for (const facet of ['themes', 'strategy', 'asset']) {
    const c = props.counts[facet]
    if (!c) continue
    for (const [value, n] of c.entries()) if (n > 0) out.push({ facet, value, n })
  }
  return out.sort((a, b) => b.n - a.n).slice(0, 40)
})

const sectors = computed(() => {
  const c = props.counts.sectors
  if (!c) return []
  return [...c.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
})

const regions = computed(() => {
  const c = props.counts.region
  if (!c) return []
  return [...c.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
})

const selected = (facet, value) => props.query.facets[facet]?.values.includes(value)

/**
 * 기간별 상위 수익률.
 * 수익률은 두 경로로 들어온다.
 *   · /api/returns 응답 테이블 (국내: 과거 기준일 비교 / 해외: Yahoo)
 *   · 종목에 실려온 item.returns (스냅샷에 구워진 해외 수익률)
 * 둘 다 없을 수 있으므로 테이블 → 종목 순으로 찾는다.
 */
function returnOf (it, key) {
  const table = props.returns?.returns
  const fromApi = table?.[it.code]?.[key] ?? table?.[it.symbol]?.[key]
  return fromApi ?? it.returns?.[key] ?? null
}

const topPerformers = computed(() => {
  const rows = []
  for (const it of props.all) {
    const r = returnOf(it, period.value)
    if (r == null) continue
    rows.push({ item: it, pct: r })
  }
  return rows.sort((a, b) => b.pct - a.pct).slice(0, 25)
})

const hasReturns = computed(() =>
  !!props.returns?.returns || props.all.some(i => i.returns && Object.keys(i.returns).length)
)

const availablePeriods = computed(() => {
  const meta = props.returns?.meta?.periods
  if (!meta) return RETURN_PERIODS
  const usable = meta.filter(p => p.available).map(p => ({ key: p.key, label: p.label }))
  return usable.length ? usable : RETURN_PERIODS
})

watch(availablePeriods, list => {
  if (list.length && !list.some(p => p.key === period.value)) period.value = list[0].key
})

/** 관심·최근 목록을 실제 종목 객체로 */
function resolve (list) {
  const byCode = new Map(props.all.map(i => [i.code, i]))
  return list.map(r => byCode.get(r.code) || r).filter(Boolean)
}
const favItems = computed(() => resolve(props.favorites))
const recentItems = computed(() => resolve(props.recent))

const dirOf = r => (r == null ? 'flat' : r > 0 ? 'up' : r < 0 ? 'down' : 'flat')
const short = n => splitBrand(n)
</script>

<template>
  <!-- 우측 탭 독 -->
  <nav class="dock" :class="{ shifted: open }" aria-label="빠른 접근">
    <button class="dock-btn find" @click="emit('quickfind')" title="빠른 찾기 (Ctrl+K)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
      </svg>
      <span>찾기</span>
    </button>

    <button
      v-for="t in TABS"
      :key="t.key"
      class="dock-btn"
      :class="{ on: open === t.key }"
      @click="toggleTab(t.key)"
      :aria-expanded="open === t.key"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round">
        <template v-if="t.icon === 'tag'">
          <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" />
        </template>
        <template v-else-if="t.icon === 'grid'">
          <rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" />
          <rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" />
        </template>
        <template v-else-if="t.icon === 'chart'">
          <path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" />
        </template>
        <template v-else-if="t.icon === 'star'">
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" />
        </template>
      </svg>
      <span>{{ t.label }}</span>
      <i v-if="t.key === 'fav' && favorites.length" class="dot">{{ favorites.length }}</i>
      <i v-else-if="t.key === 'recent' && recent.length" class="dot">{{ recent.length }}</i>
    </button>
  </nav>

  <!-- 드로어 -->
  <transition name="slide">
    <aside v-if="open" class="drawer" role="region" :aria-label="TABS.find(t => t.key === open)?.label">
      <div class="d-head">
        <b>{{ TABS.find(t => t.key === open)?.label }}</b>
        <button class="x" @click="open = null" aria-label="닫기">×</button>
      </div>

      <div class="d-body">
        <!-- 키워드 -->
        <template v-if="open === 'keyword'">
          <p class="d-note">자주 쓰는 조건을 한 번에 겁니다. 다시 누르면 해제됩니다.</p>
          <div class="chips">
            <button
              v-for="k in keywords"
              :key="k.facet + k.value"
              class="chip"
              :class="{ on: selected(k.facet, k.value) }"
              @click="emit('toggle', k.facet, k.value)"
            >{{ k.value }}<span class="n">{{ k.n }}</span></button>
          </div>
        </template>

        <!-- 섹터 -->
        <template v-else-if="open === 'sector'">
          <p class="d-note">주요섹터</p>
          <div class="chips">
            <button v-for="[v, n] in sectors" :key="v" class="chip"
                    :class="{ on: selected('sectors', v) }" @click="emit('toggle', 'sectors', v)">
              {{ v }}<span class="n">{{ n }}</span>
            </button>
          </div>
          <p class="d-note mt16">투자지역</p>
          <div class="chips">
            <button v-for="[v, n] in regions" :key="v" class="chip"
                    :class="{ on: selected('region', v) }" @click="emit('toggle', 'region', v)">
              {{ v }}<span class="n">{{ n }}</span>
            </button>
          </div>
        </template>

        <!-- 기간별 상위 수익률 -->
        <template v-else-if="open === 'perf'">
          <div class="chips">
            <button v-for="p in availablePeriods" :key="p.key" class="chip sm"
                    :class="{ on: period === p.key }" @click="period = p.key">{{ p.label }}</button>
          </div>

          <div v-if="!hasReturns" class="d-empty">
            <b>수익률 데이터가 없습니다</b>
            해외 ETF는 Yahoo Finance에서 자동으로 받아옵니다.
            국내 ETF 수익률에는 <code>KRX_AUTH_KEY</code>가 필요합니다.
          </div>

          <div v-else-if="!topPerformers.length" class="d-empty">
            <b>해당 기간 데이터가 없습니다</b>
            다른 기간을 선택해 보세요.
          </div>

          <ol v-else class="d-list">
            <li v-for="(r, i) in topPerformers" :key="r.item.code">
              <button class="d-row" @click="emit('open', r.item)">
                <span class="rk tnum">{{ i + 1 }}</span>
                <span class="d-l">
                  <span class="d-name">
                    <i v-if="short(r.item.name).brand" class="bd">{{ short(r.item.name).brand }}</i>
                    {{ short(r.item.name).rest }}
                  </span>
                  <span class="d-sub tnum">{{ r.item.queryKey }} · {{ r.item.exposure }}</span>
                </span>
                <b class="tnum" :class="'v-' + dirOf(r.pct)">{{ fmtPct(r.pct) }}</b>
              </button>
            </li>
          </ol>
          <p v-if="topPerformers.length" class="d-note mt12">
            종가 기준 가격 수익률입니다. 분배금(배당)은 반영하지 않으므로
            배당·커버드콜 ETF는 실제 총수익률보다 낮게 표시됩니다.
          </p>
        </template>

        <!-- 관심 -->
        <template v-else-if="open === 'fav'">
          <div v-if="!favItems.length" class="d-empty">
            <b>관심 종목이 없습니다</b>
            카드나 상세 화면의 ★ 를 누르면 여기에 고정됩니다.
          </div>
          <template v-else>
            <div class="row between">
              <p class="d-note" style="margin:0">{{ favItems.length }}종목</p>
              <button class="lnk" @click="emit('clearFavorites')">모두 지우기</button>
            </div>
            <ul class="d-list mt8">
              <li v-for="it in favItems" :key="it.code">
                <button class="d-row" @click="emit('open', it)">
                  <span class="d-l">
                    <span class="d-name">
                      <i v-if="short(it.name).brand" class="bd">{{ short(it.name).brand }}</i>
                      {{ short(it.name).rest }}
                    </span>
                    <span class="d-sub tnum">{{ it.queryKey }}
                      <template v-if="it.expenseRatio != null"> · 보수 {{ fmtFee(it.expenseRatio) }}</template>
                    </span>
                  </span>
                  <b v-if="it.close != null" class="tnum" :class="'v-' + dirOf(it.changeRate)">
                    {{ fmtPrice(it.close) }}
                  </b>
                </button>
                <span class="d-acts">
                  <button class="mini lime" @click="emit('go', 'ta', it)">TA</button>
                  <button class="mini blue" @click="emit('go', 'stockr', it)">상담</button>
                </span>
              </li>
            </ul>
          </template>
        </template>

        <!-- 최근 -->
        <template v-else-if="open === 'recent'">
          <div v-if="!recentItems.length" class="d-empty">
            <b>최근 본 종목이 없습니다</b>
            종목을 열어보면 여기에 시간순으로 쌓입니다.
          </div>
          <template v-else>
            <div class="row between">
              <p class="d-note" style="margin:0">최근 본 순서</p>
              <button class="lnk" @click="emit('clearRecent')">지우기</button>
            </div>
            <ul class="d-list mt8">
              <li v-for="it in recentItems" :key="it.code">
                <button class="d-row" @click="emit('open', it)">
                  <span class="d-l">
                    <span class="d-name">
                      <i v-if="short(it.name).brand" class="bd">{{ short(it.name).brand }}</i>
                      {{ short(it.name).rest }}
                    </span>
                    <span class="d-sub tnum">{{ it.queryKey }}</span>
                  </span>
                  <b v-if="it.close != null" class="tnum" :class="'v-' + dirOf(it.changeRate)">
                    {{ fmtPrice(it.close) }}
                  </b>
                </button>
                <span class="d-acts">
                  <button class="mini lime" @click="emit('go', 'ta', it)">TA</button>
                  <button class="mini blue" @click="emit('go', 'stockr', it)">상담</button>
                </span>
              </li>
            </ul>
          </template>
        </template>
      </div>
    </aside>
  </transition>

  <div v-if="open" class="d-scrim" @click="open = null"></div>
</template>

<style scoped>
/* ── 우측 탭 독 ── */
.dock {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  z-index: 90; display: flex; flex-direction: column; gap: 3px;
  background: rgba(255, 255, 255, .92); backdrop-filter: blur(10px);
  border: 1px solid var(--line-card); border-right: none;
  border-radius: var(--r-sm) 0 0 var(--r-sm);
  box-shadow: -6px 0 20px -12px rgba(44, 41, 96, .4);
  padding: 5px 3px; transition: transform .26s cubic-bezier(.2, .8, .2, 1);
  /* 가로 모드처럼 세로가 짧은 화면에서 독이 화면 밖으로 넘치지 않게 */
  max-height: 88vh; overflow-y: auto; overscroll-behavior: contain;
}
.dock.shifted { transform: translateY(-50%) translateX(-320px); }
@media (max-width: 560px) { .dock.shifted { transform: translateY(-50%) translateX(-86vw); } }

.dock-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  width: 50px; padding: 8px 2px; border-radius: 10px;
  color: var(--ink-soft); transition: .15s;
}
.dock-btn svg { width: 17px; height: 17px; }
.dock-btn span { font-size: 9.5px; font-weight: 800; letter-spacing: -.03em; }
.dock-btn:hover { background: var(--purple-soft); color: var(--purple); }
.dock-btn.on { background: var(--purple); color: #fff; }
.dock-btn.find { color: var(--indigo); border-bottom: 1px solid var(--line-card); border-radius: 10px 10px 0 0; }
.dock-btn.find:hover { background: var(--lime-soft); color: var(--indigo-deep); }

.dock-btn { position: relative; }
.dot {
  position: absolute; top: 3px; right: 5px;
  min-width: 14px; height: 14px; padding: 0 3px; border-radius: 999px;
  background: var(--up); color: #fff;
  font-size: 8.5px; font-weight: 800; font-style: normal;
  display: grid; place-items: center;
}
.dock-btn.on .dot { background: #fff; color: var(--purple); }

/* ── 드로어 ── */
.drawer {
  position: fixed; right: 0; top: 0; bottom: 0; z-index: 95;
  width: 320px; background: var(--card);
  border-left: 1px solid var(--line-card);
  box-shadow: -14px 0 40px -20px rgba(44, 41, 96, .45);
  display: flex; flex-direction: column;
}
@media (max-width: 560px) { .drawer { width: 86vw; } }

.d-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--line-card); flex: none;
  padding-top: max(14px, env(safe-area-inset-top));
}
.d-head b { font-size: 14px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }

.d-body {
  flex: 1; overflow-y: auto; padding: 14px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}

.d-note { margin: 0 0 10px; font-size: 11px; color: var(--muted); font-weight: 700; line-height: 1.6; }

.d-empty {
  padding: 32px 8px; text-align: center; font-size: 11.5px;
  color: var(--muted); line-height: 1.75;
}
.d-empty b { display: block; font-size: 13px; color: var(--ink); margin-bottom: 6px; }
.d-empty code {
  background: var(--surface); padding: 1px 5px; border-radius: 4px;
  font-size: 10.5px; font-weight: 700; color: var(--ink);
}

.d-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.d-list li { display: flex; align-items: center; gap: 5px; border-radius: 9px; }
.d-list li:hover { background: var(--surface-2); }

.d-row {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
  padding: 9px 8px; text-align: left;
}
.rk {
  flex: none; width: 18px; font-size: 10.5px; font-weight: 800;
  color: var(--muted-2); text-align: center;
}
.d-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.d-name {
  font-size: 12.5px; font-weight: 700; color: var(--ink); letter-spacing: -.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bd {
  font-style: normal; font-size: 9px; font-weight: 800; color: var(--ink-soft);
  background: var(--surface); padding: 1px 4px; border-radius: 3px; margin-right: 4px;
}
.d-sub { font-size: 10px; color: var(--muted); font-weight: 600; }
.d-row b { flex: none; font-size: 12px; font-weight: 800; }

.d-acts { display: flex; gap: 3px; flex: none; padding-right: 6px; }
.mini { padding: 3px 7px; border-radius: 6px; font-size: 9.5px; font-weight: 800; }
.mini.lime { background: var(--lime-soft); color: #5E7A05; }
.mini.blue { background: var(--blue-soft); color: var(--blue-deep); }

.lnk { font-size: 10.5px; font-weight: 800; color: var(--muted-2); text-decoration: underline; }
.lnk:hover { color: var(--up); }

.chip.sm { padding: 6px 11px; font-size: 11.5px; }

/* 좁은 화면에서는 독을 더 얇게 — 본문 폭이 더 중요하다 */
@media (max-width: 560px) {
  .dock-btn { width: 42px; padding: 7px 1px; }
  .dock-btn svg { width: 16px; height: 16px; }
  .dock-btn span { font-size: 9px; }
}

.d-scrim { position: fixed; inset: 0; z-index: 88; background: rgba(35, 32, 73, .28); }
@media (min-width: 1000px) { .d-scrim { display: none; } }

.slide-enter-active, .slide-leave-active { transition: transform .26s cubic-bezier(.2, .8, .2, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
