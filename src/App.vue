<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'

import TopBar from './components/TopBar.vue'
import HeroSearch from './components/HeroSearch.vue'
import PresetRail from './components/PresetRail.vue'
import FilterPanel from './components/FilterPanel.vue'
import ResultView from './components/ResultView.vue'
import DetailSheet from './components/DetailSheet.vue'
import KofiaSheet from './components/KofiaSheet.vue'
import BridgeDialog from './components/BridgeDialog.vue'
import PortfolioPanel from './components/PortfolioPanel.vue'
import HoldingsPanel from './components/HoldingsPanel.vue'
import SiteFooter from './components/SiteFooter.vue'
import QuickFind from './components/QuickFind.vue'
import SideDock from './components/SideDock.vue'
import AskPanel from './components/AskPanel.vue'

import { loadEtfs, loadReturns } from './lib/api.js'
import { buildIndex, splitBrand } from './lib/search.js'
import { emptyQuery, fromLocation, syncLocation, toUrl, describe, isActive } from './lib/query.js'
import { applyFilter, facetCounts } from './lib/filter.js'
import { rank } from './lib/score.js'
import { applyPreset, presetById, parseShortcut } from './lib/presets.js'
import { applySeo, applyItemSeo } from './lib/seo.js'
import {
  go as bridgeGo, copy, pushRecent, readRecent, clearRecent,
  readFavorites, toggleFavorite, clearFavorites, isFavorite
} from './lib/bridge.js'

// ── 상태 ──────────────────────────────────────────────
const all = ref([])
const meta = ref(null)
const source = ref(null)
const loading = ref(true)
const error = ref(null)

const query = reactive(emptyQuery())
const viewMode = ref('list')
const panel = ref(null)          // null | 'portfolio' | 'holdings'
const activePreset = ref(null)
const focusFacet = ref(null)
const compareCfg = ref(null)

const detail = ref(null)
const kofia = ref(null) // [전자공시] 로 연 종목
const bridge = ref(null)
const toastMsg = ref('')
const recent = ref([])
const favorites = ref([])
const quickOpen = ref(false)
const returns = ref(null)
const askSuggested = ref('')

let toastTimer = null
function toast (msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2400)
}

// ── 로딩 ──────────────────────────────────────────────
onMounted(async () => {
  Object.assign(query, fromLocation())
  if (query.preset) restorePreset(query.preset, { keepQuery: true })
  recent.value = readRecent()
  favorites.value = readFavorites()

  try {
    const data = await loadEtfs()
    all.value = data.items
    meta.value = data.meta
    source.value = data.source
    if (data.source === 'snapshot') {
      toast('실시간 연결에 실패해 저장된 스냅샷을 표시합니다')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }

  // 기간별 수익률은 무거운 보조 데이터 — 본 화면을 막지 않고 뒤따라 붙인다
  loadReturns().then(r => { returns.value = r })

  window.addEventListener('popstate', () => {
    Object.assign(query, fromLocation())
    activePreset.value = query.preset
  })

  // 어디서든 Ctrl+K / Cmd+K 로 빠른 찾기. "/" 는 입력 중이 아닐 때만.
  window.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      quickOpen.value = true
    } else if (e.key === '/' && !typing && !quickOpen.value) {
      e.preventDefault()
      quickOpen.value = true
    }
  })
})

// ── 파생 ──────────────────────────────────────────────

// 시세는 국내(금융위)와 해외(Yahoo)가 원천이 달라 한쪽만 살아 있을 수 있다.
// 한쪽이라도 시세가 있으면 시세 기반 조건·정렬을 열되,
// 비어 있는 쪽은 배너로 분명히 알린다.
const krxQuoted = computed(() => all.value.some(i => i.market !== 'US' && i.close != null))
const usQuoted = computed(() => all.value.some(i => i.market === 'US' && i.close != null))
const hasQuotes = computed(() => krxQuoted.value || usQuoted.value)

const effectiveQuery = computed(() => {
  if (hasQuotes.value) return query
  const sortNeedsQuote = ['value', 'netAssets', 'changeRate'].includes(query.sort)
  return { ...query, minValue: 0, sort: sortNeedsQuote ? 'fit' : query.sort }
})

// 빠른 찾기용 인덱스 — 초성·브랜드 분리를 종목당 한 번만 계산한다
const searchIndex = computed(() => buildIndex(all.value))

const filtered = computed(() => applyFilter(all.value, effectiveQuery.value))
const ranked = computed(() => rank(filtered.value, effectiveQuery.value))
const counts = computed(() => (all.value.length ? facetCounts(all.value, effectiveQuery.value) : {}))
const summary = computed(() => describe(effectiveQuery.value))

/** 비교 모드 좌/우 그룹 */
const compareGroups = computed(() => {
  const cfg = compareCfg.value
  if (!cfg) return null
  const pool = ranked.value

  if (cfg.split === 'exposure') {
    return {
      leftLabel: cfg.leftLabel,
      rightLabel: cfg.rightLabel,
      left: pool.filter(i => i.exposure === '국내'),
      right: pool.filter(i => i.region === '미국')
    }
  }
  // popularity — 거래대금 기준 상·하위
  const withValue = pool.filter(i => i.value != null).sort((a, b) => b.value - a.value)
  const cut = Math.max(1, Math.floor(withValue.length * 0.2))
  return {
    leftLabel: cfg.leftLabel,
    rightLabel: cfg.rightLabel,
    left: withValue.slice(0, cut),
    right: withValue.slice(cut).filter(i => i.value > 0).reverse()
  }
})

// ── URL · SEO 동기화 ─────────────────────────────────
watch([() => JSON.stringify(query), ranked], () => {
  if (loading.value) return
  syncLocation(query)
  applySeo(query, ranked.value)
}, { flush: 'post' })

watch(detail, it => applyItemSeo(it))

// ── 조건 조작 ────────────────────────────────────────
function toggleFacet (facet, value) {
  const f = query.facets[facet]
  const i = f.values.indexOf(value)
  if (i >= 0) f.values.splice(i, 1)
  else f.values.push(value)
  clearPresetIfDiverged()
}

function setMode (facet, mode) { query.facets[facet].mode = mode }
function setJoin (join) { query.join = join }
function setPension (v) { query.pension = v; clearPresetIfDiverged() }
function setMinValue (v) { query.minValue = v; clearPresetIfDiverged() }
function setSort (v) { query.sort = v }

function resetQuery () {
  Object.assign(query, emptyQuery())
  activePreset.value = null
  panel.value = null
  compareCfg.value = null
  focusFacet.value = null
  viewMode.value = 'list'
}

/** 사용자가 조건을 직접 건드리면 프리셋 표시를 푼다 */
function clearPresetIfDiverged () {
  if (!activePreset.value) return
  activePreset.value = null
  query.preset = null
}

function onSearch (v) {
  query.q = v
  // 단축 문법(!!!005930)을 그대로 넣으면 기술적분석으로 바로 보낸다
  const sc = parseShortcut(v)
  if (sc && sc.prefix) {
    const hit = all.value.find(
      i => i.code === sc.code || String(i.symbol || '').toUpperCase() === sc.code
    )
    if (hit) {
      query.q = ''
      goTarget('ta', hit, sc.prefix)
      return
    }
  }
  clearPresetIfDiverged()
}

// ── 프리셋 ────────────────────────────────────────────
function pickPreset (preset) {
  activePreset.value = preset.id
  focusFacet.value = preset.focusFacet || null
  compareCfg.value = null
  panel.value = null

  if (preset.mode === 'bridge') {
    if (preset.needsTarget) {
      const target = detail.value || recent.value[0]
      if (!target) {
        toast('먼저 종목을 선택하세요')
        activePreset.value = null
        return
      }
      goTarget(preset.bridge, target, '')
      return
    }
    goTarget(preset.bridge, null, '', preset.bridgeText)
    return
  }

  Object.assign(query, applyPreset(preset))

  // FAQ 항목 자체가 '자주 찾는 요청'이므로 그대로 AI 질문으로 제안한다
  askSuggested.value = preset.label ? `${preset.label} — ${preset.desc || ''}`.trim() : ''

  if (preset.mode === 'compare') {
    compareCfg.value = preset.compare
    viewMode.value = 'compare'
  } else if (preset.mode === 'table') {
    viewMode.value = 'table'
  } else if (preset.mode === 'portfolio') {
    panel.value = 'portfolio'
    viewMode.value = 'list'
  } else if (preset.mode === 'holdings') {
    panel.value = 'holdings'
  } else {
    viewMode.value = 'list'
  }

  scrollToResults()
}

function restorePreset (id, { keepQuery } = {}) {
  const p = presetById(id)
  if (!p) return
  activePreset.value = id
  focusFacet.value = p.focusFacet || null
  if (p.mode === 'compare') { compareCfg.value = p.compare; viewMode.value = 'compare' }
  if (p.mode === 'table') viewMode.value = 'table'
  if (p.mode === 'portfolio') panel.value = 'portfolio'
  if (p.mode === 'holdings') panel.value = 'holdings'
  if (!keepQuery) Object.assign(query, applyPreset(p))
}

function scrollToResults () {
  requestAnimationFrame(() => {
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// ── 이동 ──────────────────────────────────────────────
async function goTarget (targetKey, item, prefix = '', text = '') {
  if (item) recent.value = pushRecent(item)
  // 전자공시는 외부로 넘기지 않고 앱 안에서 그 종목의 협회 공시를 띄운다
  if (targetKey === 'kofia') {
    if (item) kofia.value = item
    return
  }
  const res = await bridgeGo(targetKey, {
    key: item ? item.queryKey : '',
    prefix,
    text
  })
  bridge.value = { ...res, item }
}

function openDetail (item) {
  quickOpen.value = false
  detail.value = item
  recent.value = pushRecent(item)
}

// ── 관심 · 최근 ──────────────────────────────────────
function star (item) {
  favorites.value = toggleFavorite(item)
  toast(isFavorite(favorites.value, item.code) ? '관심 종목에 담았습니다' : '관심 종목에서 뺐습니다')
}

const starred = code => isFavorite(favorites.value, code)

function wipeRecent () {
  clearRecent()
  recent.value = []
}

function wipeFavorites () {
  favorites.value = clearFavorites()
}

function tagSearch (facet, value) {
  detail.value = null
  const f = query.facets[facet]
  if (!f.values.includes(value)) f.values.push(value)
  clearPresetIfDiverged()
  scrollToResults()
}

async function share () {
  const url = window.location.origin + toUrl(query, window.location.pathname)
  const ok = await copy(url)
  toast(ok ? '현재 조건 링크를 복사했습니다' : '링크 복사에 실패했습니다')
}

const showPresets = computed(() => !isActive(query) || !!activePreset.value)

/** 칩에는 브랜드를 뗀 이름만 — 긴 이름이 줄을 다 잡아먹지 않게 */
const shortName = name => splitBrand(name).rest
</script>

<template>
  <div class="app">
    <TopBar
      :as-of="meta?.asOf"
      :source="source"
      :count="all.length"
      @go="t => goTarget(t, detail || recent[0] || null)"
      @home="resetQuery"
    />

    <main class="view">
      <HeroSearch
        v-model="query.q"
        :total="all.length"
        :compact="isActive(query)"
        @submit="onSearch"
      />

      <!-- 관심·최근 — ETF 는 이름이 길고 비슷해서 '다시 찾기' 비용이 크다.
           한 번 본 종목으로 돌아오는 길을 항상 열어 둔다. -->
      <div v-if="favorites.length || recent.length" class="recent">
        <template v-if="favorites.length">
          <span class="r-l star">★ 관심</span>
          <button
            v-for="r in favorites.slice(0, 5)"
            :key="'f' + r.code"
            class="r-chip fav"
            @click="openDetail(all.find(i => i.code === r.code) || r)"
          >{{ shortName(r.name) }}</button>
        </template>

        <template v-if="recent.length">
          <span class="r-l">최근</span>
          <button
            v-for="r in recent.slice(0, 5)"
            :key="'r' + r.code"
            class="r-chip"
            @click="openDetail(all.find(i => i.code === r.code) || r)"
          >{{ shortName(r.name) }}</button>
        </template>

        <button class="r-find" @click="quickOpen = true" title="빠른 찾기 (Ctrl+K)">
          빠른 찾기 <kbd>Ctrl</kbd><kbd>K</kbd>
        </button>
      </div>

      <!-- 오류 -->
      <div v-if="error" class="card err">
        <b>데이터를 불러오지 못했습니다</b>
        <p>{{ error.message }}</p>
        <ul v-if="error.detail">
          <li>실시간: {{ error.detail.live }}</li>
          <li>스냅샷: {{ error.detail.snapshot }}</li>
        </ul>
        <p class="small">
          서버리스 함수에 <code>DATA_GO_KR_KEY</code>가 설정되어 있는지,
          또는 <code>public/data/etfs.snapshot.json</code>이 있는지 확인하세요.
        </p>
        <button class="btn btn-purple mt12" @click="$event, location.reload()">다시 시도</button>
      </div>

      <template v-else>
        <div v-if="!loading && !krxQuoted" class="card noquote">
          <b>국내 ETF 시세가 연결되지 않았습니다</b>
          <p>
            <template v-if="usQuoted">
              해외 ETF는 Yahoo Finance에서 정상 수신 중이며 시세·기간수익률이 모두 표시됩니다.
              국내 종목은 목록·분류·검색·연결만 동작하고 가격 정보가 비어 있습니다.
            </template>
            <template v-else>
              국내·해외 모두 시세를 받지 못해 목록만 표시하고 있습니다.
              조건검색·분류·기술적분석·스토커 연결은 정상입니다.
            </template>
          </p>
          <p class="small">
            해결: <b>data.krx.co.kr → 오픈API → 이용신청</b>에서 인증키를 발급받아
            <code>KRX_AUTH_KEY</code>에 설정한 뒤 <code>npm run snapshot</code> 재실행.
            (공공데이터포털 <code>DATA_GO_KR_KEY</code>는 대체 경로로 함께 쓸 수 있습니다.)
          </p>
        </div>

        <PresetRail v-if="showPresets" :active="activePreset" @pick="pickPreset" />

        <FilterPanel
          class="mt12"
          :query="query"
          :counts="counts"
          :focus-facet="focusFacet"
          :has-quotes="hasQuotes"
          @toggle="toggleFacet"
          @mode="setMode"
          @join="setJoin"
          @pension="setPension"
          @min-value="setMinValue"
          @reset="resetQuery"
        />

        <PortfolioPanel
          v-if="panel === 'portfolio'"
          class="mt12"
          :results="ranked"
          :has-quotes="hasQuotes"
          @open="openDetail"
          @go="(t, i) => goTarget(t, i)"
        />

        <HoldingsPanel
          v-if="panel === 'holdings'"
          class="mt12"
          :all="all"
          @open="openDetail"
          @go="(t, i) => goTarget(t, i)"
        />

        <AskPanel
          v-if="!loading && ranked.length"
          class="mt12"
          :results="ranked"
          :summary="summary"
          :suggested="askSuggested"
        />

        <div id="results">
          <ResultView
            v-if="panel !== 'holdings'"
            :results="ranked"
            :query="effectiveQuery"
            :mode="viewMode"
            :has-quotes="hasQuotes"
            :compare="compareGroups"
            :summary="summary"
            :loading="loading"
            :starred-codes="favorites.map(f => f.code)"
            @open="openDetail"
            @go="(t, i) => goTarget(t, i)"
            @sort="setSort"
            @mode="m => { viewMode = m; compareCfg = null }"
            @share="share"
            @star="star"
          />
        </div>
      </template>

      <SiteFooter :meta="meta" :source="source" @go="t => goTarget(t, detail || recent[0] || null)" />
    </main>

    <!-- 우측 탭 독: 키워드 · 섹터 · 기간별 상위 수익률 · 관심 · 최근 -->
    <SideDock
      v-if="!error && all.length"
      :all="all"
      :counts="counts"
      :query="query"
      :recent="recent"
      :favorites="favorites"
      :returns="returns"
      :has-quotes="hasQuotes"
      @open="openDetail"
      @go="(t, i) => goTarget(t, i)"
      @toggle="toggleFacet"
      @quickfind="quickOpen = true"
      @clear-recent="wipeRecent"
      @clear-favorites="wipeFavorites"
    />

    <QuickFind
      v-if="quickOpen"
      :index="searchIndex"
      :recent="recent"
      :favorites="favorites"
      @close="quickOpen = false"
      @pick="openDetail"
      @go="(t, i) => { quickOpen = false; goTarget(t, i) }"
    />

    <DetailSheet
      v-if="detail"
      :item="detail"
      :starred="starred(detail.code)"
      @close="detail = null"
      @go="(t, i, p) => goTarget(t, i, p)"
      @tag="tagSearch"
      @star="star"
    />

    <KofiaSheet
      v-if="kofia"
      :item="kofia"
      @close="kofia = null"
      @open="i => { kofia = null; openDetail(i) }"
    />

    <BridgeDialog v-if="bridge" :info="bridge" @close="bridge = null" />

    <div class="toast" :class="{ on: toastMsg }" role="status" aria-live="polite">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.recent {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-bottom: 12px; padding: 10px 13px;
  background: rgba(255, 255, 255, .7); border: 1px solid var(--line-card);
  border-radius: var(--r-sm);
}
.r-l { font-size: 10.5px; font-weight: 800; color: var(--muted); flex: none; }
.r-l.star { color: #E09600; }
.r-chip {
  padding: 5px 10px; border-radius: 999px; background: var(--surface);
  font-size: 11.5px; font-weight: 700; color: var(--ink-soft); transition: .15s;
  max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.r-chip:hover { background: var(--purple-soft); color: var(--purple); }
.r-chip.fav { background: #FFF6E3; color: #8A5200; }
.r-chip.fav:hover { background: #FFEFCC; }

.r-find {
  margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 999px;
  background: var(--indigo); color: #fff;
  font-size: 10.5px; font-weight: 800; transition: .15s;
}
.r-find:hover { background: var(--purple); }
.r-find kbd {
  font-family: inherit; font-size: 9px; font-weight: 800;
  background: rgba(255, 255, 255, .2); border-radius: 3px; padding: 1px 4px;
}
@media (max-width: 560px) { .r-find kbd { display: none; } }

.err { border-color: #FBD3D3; background: #FFF8F8; }
.err b { display: block; font-size: 15px; color: var(--up); margin-bottom: 8px; }
.err p { margin: 0 0 8px; font-size: 12.5px; color: var(--ink-soft); line-height: 1.6; }
.err ul { margin: 0 0 10px; padding-left: 18px; font-size: 11.5px; color: var(--muted); line-height: 1.7; }
.err code {
  background: var(--surface); padding: 1px 5px; border-radius: 4px;
  font-size: 11px; font-weight: 700; color: var(--ink);
}

.noquote { border-color: #FFE6C2; background: #FFF9F0; margin-bottom: 12px; }
.noquote b { display: block; font-size: 13.5px; color: #8A5200; margin-bottom: 6px; }
.noquote p { margin: 0 0 6px; font-size: 12px; color: #7A4E00; line-height: 1.65; }
.noquote p:last-child { margin-bottom: 0; }
.noquote code {
  background: rgba(255, 255, 255, .8); padding: 1px 5px; border-radius: 4px;
  font-size: 11px; font-weight: 700; color: #5C3A00;
}
</style>
