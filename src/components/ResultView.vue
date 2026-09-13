<script setup>
import { computed, ref, watch } from 'vue'
import EtfCard from './EtfCard.vue'
import { SORTS } from '../lib/query.js'
import { fmtPrice, fmtPct, fmtFee, fmtAmount } from '../lib/api.js'

const props = defineProps({
  results: { type: Array, required: true },
  query: { type: Object, required: true },
  mode: { type: String, default: 'list' },   // list | table | compare
  compare: { type: Object, default: null },  // { leftLabel, rightLabel, left, right }
  summary: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  hasQuotes: { type: Boolean, default: true },
  starredCodes: { type: Array, default: () => [] }
})
const emit = defineEmits(['open', 'go', 'sort', 'mode', 'share', 'star'])

const isStarred = code => props.starredCodes.includes(code)

const PAGE = 24
const shown = ref(PAGE)
watch(() => [props.results, props.query], () => { shown.value = PAGE })

const visible = computed(() => props.results.slice(0, shown.value))
const hasMore = computed(() => props.results.length > shown.value)

// 시세가 없으면 시세 기반 정렬은 의미가 없으므로 목록에서 뺀다
const QUOTE_SORTS = ['value', 'netAssets', 'changeRate']
const sortOptions = computed(() =>
  Object.entries(SORTS).filter(([k]) => props.hasQuotes || !QUOTE_SORTS.includes(k))
)

const dirOf = r => (r == null ? 'flat' : r > 0 ? 'up' : r < 0 ? 'down' : 'flat')
</script>

<template>
  <section class="results">
    <!-- 헤더 -->
    <div class="r-head">
      <div class="r-count">
        <b class="tnum">{{ results.length.toLocaleString('ko-KR') }}</b>
        <span>종목</span>
        <span v-if="summary" class="r-sum">{{ summary }}</span>
      </div>

      <div class="r-ctrl">
        <div class="view-tabs" role="tablist" aria-label="결과 보기 방식">
          <button :class="{ on: mode === 'list' }" @click="emit('mode', 'list')" role="tab">카드</button>
          <button :class="{ on: mode === 'table' }" @click="emit('mode', 'table')" role="tab">표</button>
        </div>
        <select class="sort" :value="query.sort" @change="emit('sort', $event.target.value)"
                aria-label="정렬 기준">
          <option v-for="[key, label] in sortOptions" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn btn-sm btn-ghost share" @click="emit('share')" title="현재 조건 링크 복사">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" />
          </svg>
          <span>공유</span>
        </button>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="grid">
      <div v-for="i in 6" :key="i" class="skeleton sk-card"></div>
    </div>

    <!-- 빈 결과 -->
    <div v-else-if="!results.length" class="empty card">
      <b>조건에 맞는 ETF가 없습니다</b>
      조건을 <b style="display:inline">OR</b>로 바꾸거나 일부 항목을 해제해 보세요.
    </div>

    <!-- 비교 -->
    <div v-else-if="mode === 'compare' && compare" class="cmp">
      <div class="cmp-col">
        <div class="cmp-h left">{{ compare.leftLabel }} <span class="tnum">{{ compare.left.length }}</span></div>
        <div class="cmp-list">
          <EtfCard v-for="(it, i) in compare.left.slice(0, 10)" :key="it.code"
                   :item="it" :rank="i + 1" :starred="isStarred(it.code)"
                   @open="emit('open', $event)" @go="(t, x) => emit('go', t, x)"
                   @star="emit('star', $event)" />
        </div>
      </div>
      <div class="cmp-col">
        <div class="cmp-h right">{{ compare.rightLabel }} <span class="tnum">{{ compare.right.length }}</span></div>
        <div class="cmp-list">
          <EtfCard v-for="(it, i) in compare.right.slice(0, 10)" :key="it.code"
                   :item="it" :rank="i + 1" :starred="isStarred(it.code)"
                   @open="emit('open', $event)" @go="(t, x) => emit('go', t, x)"
                   @star="emit('star', $event)" />
        </div>
      </div>
    </div>

    <!-- 표 -->
    <div v-else-if="mode === 'table'" class="card tbl">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>종목명</th><th>코드</th><th>구분</th><th>현재가</th><th>등락률</th>
              <th>거래대금</th><th>순자산</th><th>보수</th><th>적합도</th><th>이동</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in visible" :key="it.code">
              <td class="name">
                <button class="t-name" @click="emit('open', it)">{{ it.name }}</button>
              </td>
              <td class="tnum">{{ it.queryKey }}</td>
              <td>{{ it.exposure }} · {{ it.asset }}</td>
              <td class="tnum" :class="'v-' + dirOf(it.changeRate)">{{ fmtPrice(it.close) }}</td>
              <td class="tnum" :class="'v-' + dirOf(it.changeRate)">{{ fmtPct(it.changeRate) }}</td>
              <td class="tnum">{{ fmtAmount(it, it.value) }}</td>
              <td class="tnum">{{ fmtAmount(it, it.netAssets) }}</td>
              <td class="tnum">{{ fmtFee(it.expenseRatio) }}</td>
              <td class="tnum"><b style="color:var(--purple)">{{ it.score ? it.score.total.toFixed(0) : '—' }}</b></td>
              <td class="jump-cell">
                <button class="mini lime" @click="emit('go', 'ta', it)" title="기술적분석">TA</button>
                <button class="mini blue" @click="emit('go', 'stockr', it)" title="스토커 상담">상담</button>
                <button v-if="it.market !== 'US'" class="mini indigo" @click="emit('go', 'kofia', it)"
                        title="금융투자협회 전자공시">공시</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 카드 -->
    <div v-else class="grid">
      <EtfCard
        v-for="(it, i) in visible"
        :key="it.code"
        :item="it"
        :rank="query.sort === 'fit' ? i + 1 : null"
        :starred="isStarred(it.code)"
        @open="emit('open', $event)"
        @go="(t, x) => emit('go', t, x)"
        @star="emit('star', $event)"
      />
    </div>

    <button v-if="hasMore && mode !== 'compare'" class="btn btn-block btn-ghost more"
            @click="shown += PAGE">
      {{ Math.min(PAGE, results.length - shown) }}개 더 보기
      <span class="small">(전체 {{ results.length.toLocaleString('ko-KR') }})</span>
    </button>
  </section>
</template>

<style scoped>
.results { margin-top: 16px; }

.r-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 13px;
}
.r-count { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; min-width: 0; }
.r-count b { font-size: 20px; font-weight: 800; color: var(--indigo-deep); letter-spacing: -.03em; }
.r-count span { font-size: 12.5px; font-weight: 700; color: var(--ink-soft); }
.r-sum {
  font-size: 11.5px !important; font-weight: 600 !important; color: var(--muted) !important;
  padding-left: 8px; margin-left: 3px; border-left: 1px solid var(--line-card);
}

.r-ctrl { display: flex; align-items: center; gap: 7px; margin-left: auto; flex: none; }

.view-tabs {
  display: flex; background: #fff; border-radius: 999px; padding: 3px;
  border: 1px solid var(--line-card); box-shadow: var(--shadow-sm);
}
.view-tabs button {
  padding: 6px 13px; border-radius: 999px;
  font-size: 12px; font-weight: 800; color: var(--muted-2); transition: .15s;
}
.view-tabs button.on { background: var(--indigo); color: #fff; }

.sort {
  padding: 8px 11px; border-radius: 11px; border: 1px solid var(--line-card);
  background: #fff; font-size: 12px; font-weight: 700; color: var(--ink-soft);
  cursor: pointer; box-shadow: var(--shadow-sm);
}
.share svg { width: 13px; height: 13px; }

.grid { display: grid; gap: 12px; }
@media (min-width: 700px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1080px) { .grid { grid-template-columns: repeat(3, 1fr); } }

.sk-card { height: 196px; border-radius: var(--r-md); }

/* 비교 */
.cmp { display: grid; gap: 14px; }
@media (min-width: 820px) { .cmp { grid-template-columns: 1fr 1fr; gap: 18px; } }
.cmp-h {
  font-size: 12.5px; font-weight: 800; color: var(--ink);
  padding: 9px 13px; border-radius: 11px; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.cmp-h span { font-size: 11px; font-weight: 800; opacity: .7; }
.cmp-h.left { background: var(--purple-soft); color: var(--purple); }
.cmp-h.right { background: var(--blue-soft); color: var(--blue-deep); }
.cmp-list { display: flex; flex-direction: column; gap: 10px; }

/* 표 */
.tbl { padding: 6px; }
.t-name {
  font-weight: 700; color: var(--ink); text-align: left;
  font-size: 12.5px; letter-spacing: -.02em; line-height: 1.4;
}
.t-name:hover { color: var(--purple); text-decoration: underline; }
.jump-cell { display: flex; gap: 4px; justify-content: flex-end; }
.mini {
  padding: 4px 9px; border-radius: 7px; font-size: 10.5px; font-weight: 800;
  transition: .15s;
}
.mini.lime { background: var(--lime-soft); color: #5E7A05; }
.mini.lime:hover { background: var(--lime); color: var(--indigo-deep); }
.mini.blue { background: var(--blue-soft); color: var(--blue-deep); }
.mini.blue:hover { background: var(--blue); color: #fff; }
.mini.indigo { background: #ECEBF5; color: var(--indigo); }
.mini.indigo:hover { background: var(--indigo); color: #fff; }

.more { margin-top: 14px; padding: 14px; gap: 7px; }

@media (max-width: 560px) {
  .r-ctrl { width: 100%; margin-left: 0; }
  .sort { flex: 1; }
}
</style>
