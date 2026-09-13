<script setup>
import { computed } from 'vue'
import { fmtPrice, fmtPct, fmtMoney, fmtFee, fmtNum, fmtDate, RETURN_PERIODS } from '../lib/api.js'
import { SCORE_AXES } from '../lib/score.js'
import { SHORTCUTS } from '../lib/presets.js'
import KofiaPanel from './KofiaPanel.vue'

const props = defineProps({
  item: { type: Object, required: true },
  starred: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'go', 'tag', 'star'])

const dir = computed(() => {
  const r = props.item.changeRate
  return r == null ? 'flat' : r > 0 ? 'up' : r < 0 ? 'down' : 'flat'
})

const facts = computed(() => {
  const it = props.item
  const rows = [
    ['종목코드 / 심볼', it.queryKey],
    ['국내/해외', `${it.exposure} · ${it.listing}`],
    ['투자지역', it.region],
    ['주요자산', it.asset],
    ['주요섹터', (it.sectors || []).join(', ') || '—'],
    ['테마', (it.themes || []).join(', ') || '—'],
    ['전략·구조', (it.strategy || []).join(', ') || '—'],
    ['참조지수', it.benchmarkRaw || it.benchmark || '—'],
    ['운용사', it.issuer || '—'],
    ['총보수(연)', fmtFee(it.expenseRatio)],
    ['연금계좌(IRP/DC)', it.pensionEligible ? '편입 가능' : '편입 불가'],
    ['ISIN', it.isin || '—']
  ]
  return rows.filter(([, v]) => v != null)
})

const quotes = computed(() => {
  const it = props.item
  if (it.close == null) return null

  // 해외는 Yahoo 가 주는 항목이 다르다 (NAV·상장좌수 없음, 52주 범위 있음)
  if (it.market === 'US') {
    return [
      ['고가', fmtPrice(it.high)],
      ['저가', fmtPrice(it.low)],
      ['52주 최고', fmtPrice(it.week52High)],
      ['52주 최저', fmtPrice(it.week52Low)],
      ['거래량', fmtNum(it.volume)],
      ['거래대금', it.value == null ? '—' : `$${fmtNum(it.value)}`],
      ['통화', it.currency || 'USD'],
      ['거래소', it.exchange || '—']
    ]
  }

  return [
    ['시가', fmtPrice(it.open)],
    ['고가', fmtPrice(it.high)],
    ['저가', fmtPrice(it.low)],
    ['NAV', fmtPrice(it.nav)],
    ['거래량', fmtNum(it.volume)],
    ['거래대금', fmtMoney(it.value)],
    ['순자산총액', fmtMoney(it.netAssets)],
    ['상장좌수', fmtNum(it.shares)]
  ]
})

/** 기간별 수익률 — 값이 있는 기간만 */
const periodReturns = computed(() =>
  RETURN_PERIODS
    .map(p => ({ ...p, pct: props.item.returns?.[p.key] }))
    .filter(p => p.pct != null)
)

/** 클릭 가능한 태그 — 눌러서 같은 조건으로 다시 검색 */
const clickTags = computed(() => {
  const it = props.item
  return [
    ...(it.sectors || []).map(v => ({ facet: 'sectors', value: v })),
    ...(it.themes || []).map(v => ({ facet: 'themes', value: v })),
    ...(it.strategy || []).map(v => ({ facet: 'strategy', value: v }))
  ]
})
</script>

<template>
  <div class="sheet-back" @click.self="emit('close')" role="dialog" aria-modal="true">
    <div class="sheet">
      <div class="sheet-head">
        <div class="grow">
          <div class="h-tags">
            <span class="badge" :class="item.exposure === '국내' ? 'purple' : 'blue'">{{ item.exposure }}</span>
            <span class="badge">{{ item.asset }}</span>
            <span v-if="item.pensionEligible" class="badge lime">연금 가능</span>
            <span v-if="item.market === 'US'" class="badge blue">해외상장 · {{ item.exchange || 'US' }}</span>
            <span v-if="item.close == null" class="badge warn">시세 미수신</span>
          </div>
          <h2>{{ item.name }}</h2>
          <div class="h-code tnum">{{ item.queryKey }}<span v-if="item.basDt"> · {{ fmtDate(item.basDt) }} 기준</span></div>
        </div>
        <div class="h-acts">
          <button class="star" :class="{ on: starred }" @click="emit('star', item)"
                  :aria-pressed="starred" :aria-label="starred ? '관심 해제' : '관심 등록'">
            <svg viewBox="0 0 24 24" :fill="starred ? 'currentColor' : 'none'" stroke="currentColor"
                 stroke-width="2" stroke-linejoin="round">
              <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" />
            </svg>
          </button>
          <button class="x" @click="emit('close')" aria-label="닫기">×</button>
        </div>
      </div>

      <div class="sheet-body">
        <!-- 이동 -->
        <div class="jump-card">
          <div class="jump-t">이 종목으로 이어가기</div>
          <div class="jump-grid">
            <button class="jump lime" @click="emit('go', 'ta', item, '')">
              <b>기술적분석</b>
              <span>10개 축 시그널 계산</span>
            </button>
            <button class="jump blue" @click="emit('go', 'stockr', item, '')">
              <b>스토커 상담</b>
              <span>대화로 종목 질문</span>
            </button>
          </div>
          <div class="sc-row">
            <span class="sc-l">계산기 단축 문법</span>
            <button
              v-for="s in SHORTCUTS"
              :key="s.label"
              class="sc-btn"
              @click="emit('go', 'ta', item, s.prefix)"
              :title="s.desc"
            >
              <code>{{ s.prefix || '—' }}</code>{{ s.label }}
            </button>
          </div>
        </div>

        <!-- 시세 -->
        <div v-if="quotes" class="q-card">
          <div class="q-main">
            <b class="tnum" :class="'v-' + dir">{{ fmtPrice(item.close) }}</b>
            <span class="tnum" :class="'v-' + dir">
              {{ item.change > 0 ? '+' : '' }}{{ fmtPrice(item.change) }} ({{ fmtPct(item.changeRate) }})
            </span>
          </div>
          <dl class="q-grid">
            <div v-for="[k, v] in quotes" :key="k"><dt>{{ k }}</dt><dd class="tnum">{{ v }}</dd></div>
          </dl>

          <div v-if="periodReturns.length" class="ret">
            <span class="ret-t">기간 수익률</span>
            <span v-for="r in periodReturns" :key="r.key" class="ret-i">
              <i>{{ r.label }}</i>
              <b class="tnum" :class="r.pct > 0 ? 'v-up' : r.pct < 0 ? 'v-down' : 'v-flat'">{{ fmtPct(r.pct) }}</b>
            </span>
          </div>
        </div>
        <p v-if="!quotes" class="us-note">
          <template v-if="item.market === 'US'">
            Yahoo Finance에서 <b>{{ item.symbol }}</b> 시세를 받지 못했습니다.
          </template>
          <template v-else>
            국내 시세 원천이 연결되지 않아 가격 정보가 비어 있습니다.
          </template>
          지표는 기술적분석 계산기 또는 스토커에서 <b>{{ item.queryKey }}</b> 로 확인하세요.
        </p>

        <!-- 국내 ETF: 금융투자협회 전자공시 펀드요약정보 -->
        <KofiaPanel v-if="item.market !== 'US'" :item="item" />

        <!-- 적합도 -->
        <div v-if="item.score" class="s-card">
          <div class="s-head">
            <span>적합도 <b class="tnum">{{ item.score.total.toFixed(1) }}</b> / 100</span>
            <span class="small">현재 조건 기준</span>
          </div>
          <div v-for="ax in SCORE_AXES" :key="ax.key" class="s-row">
            <span class="s-l">{{ ax.label }}</span>
            <div class="s-bar">
              <i :style="{ width: (item.score.breakdown[ax.key] / ax.max * 100) + '%' }"></i>
            </div>
            <span class="s-v tnum">{{ item.score.breakdown[ax.key].toFixed(0) }}/{{ ax.max }}</span>
          </div>
        </div>

        <!-- 속성 -->
        <div class="f-card">
          <div class="card-t">종목 속성</div>
          <dl class="f-grid">
            <div v-for="[k, v] in facts" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></div>
          </dl>
        </div>

        <!-- 같은 조건으로 -->
        <div v-if="clickTags.length" class="t-card">
          <div class="card-t">같은 속성으로 다시 찾기</div>
          <div class="chips">
            <button v-for="t in clickTags" :key="t.facet + t.value" class="chip"
                    @click="emit('tag', t.facet, t.value)">{{ t.value }}</button>
          </div>
        </div>

        <p class="disclaimer">
          본 화면은 공개 데이터에 기반한 정보 제공용이며 특정 종목의 매수·매도를 권유하지 않습니다.
          총보수는 참고값이므로 정확한 수치는 운용사 공시를 확인하세요.
          투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.h-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
h2 {
  margin: 0 0 5px; font-size: 18px; font-weight: 800;
  letter-spacing: -.035em; color: var(--ink); line-height: 1.35; word-break: keep-all;
}
.h-code { font-size: 12px; font-weight: 700; color: var(--muted-2); }

.h-acts { display: flex; gap: 6px; flex: none; }
.star {
  width: 32px; height: 32px; border-radius: 10px;
  background: var(--surface); color: #BDB9C9;
  display: grid; place-items: center; transition: .15s;
}
.star svg { width: 16px; height: 16px; }
.star:hover { background: var(--purple-soft); color: var(--purple); }
.star.on { background: #FFF6E3; color: #F5A623; }

/* 이동 */
.jump-card {
  background: linear-gradient(155deg, #F8F5FF, #F1F6FF);
  border: 1px solid #EAE4FA; border-radius: var(--r-md); padding: 15px;
}
.jump-t { font-size: 11.5px; font-weight: 800; color: var(--ink-soft); margin-bottom: 10px; }
.jump-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.jump {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
  padding: 13px 15px; border-radius: 14px; text-align: left; transition: .15s;
}
.jump:active { transform: scale(.98); }
.jump b { font-size: 14px; font-weight: 800; letter-spacing: -.02em; }
.jump span { font-size: 11px; opacity: .82; }
.jump.lime {
  background: linear-gradient(150deg, var(--lime), var(--lime-deep));
  color: var(--indigo-deep); box-shadow: 0 8px 18px -10px rgba(180, 222, 30, .9);
}
.jump.blue { background: var(--blue); color: #fff; box-shadow: 0 8px 18px -10px rgba(49, 130, 246, .9); }

.sc-row {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  margin-top: 12px; padding-top: 11px; border-top: 1px dashed rgba(108, 92, 231, .2);
}
.sc-l { font-size: 10.5px; font-weight: 800; color: var(--muted); }
.sc-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, .85);
  border: 1px solid rgba(108, 92, 231, .16);
  font-size: 11px; font-weight: 700; color: var(--ink-soft); transition: .15s;
}
.sc-btn:hover { border-color: var(--purple); color: var(--purple); }
.sc-btn code {
  font-size: 10.5px; font-weight: 800; color: var(--indigo);
  background: var(--surface); padding: 1px 4px; border-radius: 4px;
}

/* 시세 */
.q-card { margin-top: 14px; background: var(--surface); border-radius: var(--r-md); padding: 15px; }
.q-main { display: flex; align-items: baseline; gap: 9px; margin-bottom: 13px; flex-wrap: wrap; }
.q-main b { font-size: 26px; font-weight: 800; letter-spacing: -.03em; }
.q-main span { font-size: 13px; font-weight: 800; }
.q-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px 16px; margin: 0; }
@media (min-width: 520px) { .q-grid { grid-template-columns: repeat(4, 1fr); } }
.q-grid div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.q-grid dt { font-size: 10.5px; color: var(--muted-2); font-weight: 700; }
.q-grid dd { margin: 0; font-size: 12.5px; font-weight: 800; color: var(--ink-data); }

.ret {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--line-data);
}
.ret-t { font-size: 10.5px; font-weight: 800; color: var(--muted-2); }
.ret-i { display: flex; flex-direction: column; gap: 1px; }
.ret-i i { font-style: normal; font-size: 10px; color: var(--muted); font-weight: 700; }
.ret-i b { font-size: 12.5px; font-weight: 800; }

.us-note {
  margin: 14px 0 0; padding: 13px 15px; border-radius: var(--r-sm);
  background: #FFF7EC; border: 1px solid #FFE6C2;
  font-size: 12px; color: #7A4E00; line-height: 1.65;
}

/* 적합도 */
.s-card { margin-top: 14px; border: 1px solid var(--line-card); border-radius: var(--r-md); padding: 15px; }
.s-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin-bottom: 11px; font-size: 12px; font-weight: 700; color: var(--ink-soft);
}
.s-head b { font-size: 18px; color: var(--purple); font-weight: 800; }
.s-row { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
.s-l { flex: none; width: 62px; font-size: 11px; font-weight: 700; color: var(--muted); }
.s-bar { flex: 1; height: 5px; background: var(--surface); border-radius: 999px; overflow: hidden; }
.s-bar i { display: block; height: 100%; background: var(--purple-2); border-radius: 999px; }
.s-v { flex: none; width: 44px; text-align: right; font-size: 10.5px; font-weight: 800; color: var(--muted-2); }

/* 속성 */
.f-card, .t-card { margin-top: 14px; }
.f-grid { display: grid; gap: 0; margin: 0; border-top: 1px solid var(--line-data); }
.f-grid div {
  display: flex; gap: 12px; padding: 9px 2px;
  border-bottom: 1px solid var(--line-data);
}
.f-grid dt { flex: none; width: 116px; font-size: 11.5px; color: var(--muted-2); font-weight: 700; }
.f-grid dd {
  margin: 0; flex: 1; font-size: 12.5px; font-weight: 600;
  color: var(--ink-data); word-break: break-word;
}

.disclaimer {
  margin: 18px 0 0; font-size: 11px; color: var(--muted);
  line-height: 1.7; padding-top: 14px; border-top: 1px solid var(--line-card);
}
</style>
