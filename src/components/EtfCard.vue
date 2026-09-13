<script setup>
import { computed } from 'vue'
import { fmtPrice, fmtPct, fmtMoney, fmtFee, fmtAmount } from '../lib/api.js'
import { splitBrand } from '../lib/search.js'

const props = defineProps({
  item: { type: Object, required: true },
  rank: { type: Number, default: null },
  showScore: { type: Boolean, default: true },
  starred: { type: Boolean, default: false }
})
const emit = defineEmits(['open', 'go', 'star'])

// 종목명이 길고 서로 비슷하다. 운용사 브랜드를 칩으로 떼어내면
// 구별되는 부분이 맨 앞에 오고, 같은 지수 상품끼리 눈으로 비교하기 쉬워진다.
const parts = computed(() => splitBrand(props.item.name))

const dir = computed(() => {
  const r = props.item.changeRate
  if (r == null) return 'flat'
  return r > 0 ? 'up' : r < 0 ? 'down' : 'flat'
})

/** 카드에 노출할 대표 태그 — 섹터·테마·전략에서 최대 3개 */
const tags = computed(() => {
  const it = props.item
  return [...(it.sectors || []), ...(it.themes || []), ...(it.strategy || [])]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
})
</script>

<template>
  <article class="etf" :class="{ us: item.market === 'US' }">
    <button class="star" :class="{ on: starred }" @click.stop="emit('star', item)"
            :aria-label="starred ? '관심 해제' : '관심 등록'" :aria-pressed="starred">
      <svg viewBox="0 0 24 24" :fill="starred ? 'currentColor' : 'none'" stroke="currentColor"
           stroke-width="2" stroke-linejoin="round">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
      </svg>
    </button>

    <button class="body" @click="emit('open', item)">
      <div class="line1">
        <span v-if="rank" class="rank tnum">{{ rank }}</span>
        <span class="name">
          <span v-if="parts.brand" class="brand">{{ parts.brand }}</span>{{ parts.rest }}
        </span>
      </div>

      <div class="line2">
        <span class="code tnum">{{ item.queryKey }}</span>
        <span class="badge" :class="item.exposure === '국내' ? 'purple' : 'blue'">{{ item.exposure }}</span>
        <span class="badge">{{ item.asset }}</span>
        <span v-if="item.pensionEligible" class="badge lime">연금</span>
        <span v-if="item.market === 'US'" class="badge warn">해외상장</span>
      </div>

      <div class="line3" v-if="tags.length || item.benchmark">
        <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
        <span v-if="item.benchmark" class="bm" :title="item.benchmarkRaw || ''">
          지수 {{ item.benchmark }}
        </span>
      </div>

      <div class="line4">
        <div class="price">
          <b class="tnum" :class="'v-' + dir">{{ fmtPrice(item.close) }}</b>
          <span class="tnum" :class="'v-' + dir">{{ fmtPct(item.changeRate) }}</span>
        </div>
        <dl class="stats">
          <div><dt>거래대금</dt><dd class="tnum">{{ fmtAmount(item, item.value) }}</dd></div>
          <div><dt>순자산</dt><dd class="tnum">{{ fmtAmount(item, item.netAssets) }}</dd></div>
          <div><dt>보수</dt><dd class="tnum">{{ fmtFee(item.expenseRatio) }}</dd></div>
        </dl>
      </div>

      <div v-if="showScore && item.score" class="score">
        <div class="bar"><i :style="{ width: item.score.total + '%' }"></i></div>
        <span class="sv tnum">적합도 {{ item.score.total.toFixed(0) }}</span>
      </div>
    </button>

    <div class="acts">
      <button class="btn btn-sm btn-lime" @click.stop="emit('go', 'ta', item)">기술적분석</button>
      <button class="btn btn-sm btn-blue" @click.stop="emit('go', 'stockr', item)">스토커 상담</button>
      <!-- 협회 공시는 국내 설정 펀드만 있다 -->
      <button v-if="item.market !== 'US'" class="btn btn-sm btn-indigo"
              @click.stop="emit('go', 'kofia', item)">전자공시</button>
    </div>
  </article>
</template>

<style scoped>
.etf {
  background: var(--card); border: 1px solid var(--line-card);
  border-radius: var(--r-md); box-shadow: var(--shadow-sm);
  overflow: hidden; transition: box-shadow .18s, transform .12s, border-color .18s;
  display: flex; flex-direction: column;
}
.etf:hover { box-shadow: var(--shadow); border-color: #E2DCF4; }
.etf { position: relative; }

.star {
  position: absolute; top: 11px; right: 11px; z-index: 2;
  width: 26px; height: 26px; border-radius: 8px;
  display: grid; place-items: center; color: #CFCBDA; transition: .15s;
}
.star svg { width: 15px; height: 15px; }
.star:hover { background: var(--surface); color: var(--purple); }
.star.on { color: #F5A623; }
.star.on:hover { color: #E08E00; }

.body {
  display: block; width: 100%; text-align: left;
  padding: 15px 42px 13px 16px; flex: 1;
}

.brand {
  display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .02em;
  color: var(--ink-soft); background: var(--surface);
  padding: 2px 5px; border-radius: 4px; margin-right: 5px; vertical-align: 2px;
}

.line1 { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 7px; }
.rank {
  flex: none; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px;
  background: var(--indigo); color: #fff;
  font-size: 11px; font-weight: 800; display: grid; place-items: center;
  margin-top: 2px;
}
.name {
  font-size: 14.5px; font-weight: 800; color: var(--ink);
  letter-spacing: -.03em; line-height: 1.38; word-break: keep-all;
}

.line2 { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
.code {
  font-size: 11.5px; font-weight: 800; color: var(--muted-2);
  letter-spacing: .02em; margin-right: 2px;
}

.line3 { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-bottom: 11px; }
.tag {
  font-size: 10.5px; font-weight: 700; color: var(--purple);
  background: var(--purple-soft); padding: 3px 7px; border-radius: 6px;
}
.bm {
  font-size: 10.5px; font-weight: 600; color: var(--muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}

.line4 {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 12px; padding-top: 11px; border-top: 1px solid var(--line-data);
}
.price { display: flex; align-items: baseline; gap: 7px; flex: none; }
.price b { font-size: 17px; font-weight: 800; letter-spacing: -.02em; }
.price span { font-size: 12px; font-weight: 800; }

.stats { display: flex; gap: 13px; margin: 0; }
.stats div { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.stats dt { font-size: 10px; color: var(--muted); font-weight: 700; }
.stats dd { margin: 0; font-size: 11.5px; font-weight: 800; color: var(--ink-data); }

.score { display: flex; align-items: center; gap: 9px; margin-top: 11px; }
.bar { flex: 1; height: 4px; border-radius: 999px; background: var(--surface); overflow: hidden; }
.bar i {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--purple-2), var(--purple));
}
.sv { font-size: 10.5px; font-weight: 800; color: var(--purple); flex: none; }

.acts {
  display: flex; gap: 7px; padding: 0 16px 14px;
}
.acts .btn { flex: 1; padding-left: 8px; padding-right: 8px; white-space: nowrap; }

@media (max-width: 420px) {
  .stats { gap: 10px; }
  .stats div:nth-child(2) { display: none; }
}
</style>
