<script setup>
import { TARGETS } from '../lib/bridge.js'
import { fmtDate } from '../lib/api.js'

defineProps({
  asOf: { type: String, default: null },
  source: { type: String, default: null },
  count: { type: Number, default: 0 }
})
const emit = defineEmits(['go', 'home'])
</script>

<template>
  <header class="topbar">
    <button class="brand" @click="emit('home')" aria-label="ETF 브레인 파트너 처음으로">
      <!-- 뉴럴 노드가 곧 상승 추세선이 되는 글리프 — '브레인'과 'ETF'를 한 형태로 읽는다 -->
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 17.5 9 12l4.2 3L20 6.5" />
          <path d="M9 12 8 6.2M13.2 15l5.2-1.2M9 12l3.4 5.6" opacity=".55" />
          <circle cx="4" cy="17.5" r="1.9" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="13.2" cy="15" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="20" cy="6.5" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="6.2" r="1.2" fill="currentColor" stroke="none" opacity=".6" />
          <circle cx="18.4" cy="13.8" r="1.2" fill="currentColor" stroke="none" opacity=".6" />
          <circle cx="12.4" cy="17.6" r="1.2" fill="currentColor" stroke="none" opacity=".6" />
        </svg>
      </span>
      <span class="brand-txt">
        <b>ETF 브레인 파트너</b>
        <em>V1.01</em>
      </span>
    </button>

    <div class="asof" v-if="asOf">
      <span class="dot" :class="{ warm: source === 'snapshot' }"></span>
      <span class="asof-txt">
        시세 {{ fmtDate(asOf) }}
        <i v-if="source === 'snapshot'">· 스냅샷</i>
      </span>
    </div>

    <nav class="jump" aria-label="연결 서비스">
      <button class="jump-btn lime" @click="emit('go', 'ta')" :title="TARGETS.ta.name">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
               stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20V8" /></svg>
        </span>
        <span class="lbl">기술적분석</span>
      </button>
      <button class="jump-btn blue" @click="emit('go', 'stockr')" :title="TARGETS.stockr.name">
        <span class="ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4.2-1L3 20l1.2-4.3A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
          </svg>
        </span>
        <span class="lbl">스토커 상담</span>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 40;
  background: rgba(243, 238, 230, .86);
  backdrop-filter: saturate(160%) blur(14px);
  -webkit-backdrop-filter: saturate(160%) blur(14px);
  border-bottom: 1px solid rgba(236, 231, 221, .8);
  padding: 11px var(--gutter);
  display: flex; align-items: center; gap: 10px;
}

.brand { display: flex; align-items: center; gap: 9px; min-width: 0; flex: none; }
.mark {
  width: 34px; height: 34px; border-radius: 11px; flex: none;
  background: linear-gradient(148deg, var(--purple), var(--indigo));
  color: #fff; display: grid; place-items: center;
  box-shadow: 0 6px 14px -7px rgba(44, 41, 96, .75);
}
.mark svg { width: 18px; height: 18px; }
.brand-txt { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.brand-txt b {
  font-size: 15.5px; font-weight: 800; letter-spacing: -.03em;
  color: var(--ink); white-space: nowrap;
}
.brand-txt em {
  font-style: normal; font-size: 10px; font-weight: 800;
  color: var(--purple); letter-spacing: .01em;
}

.asof {
  display: flex; align-items: center; gap: 6px; flex: 1;
  min-width: 0; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--muted);
}
.asof .dot {
  width: 7px; height: 7px; border-radius: 50%; flex: none;
  background: #16A34A; box-shadow: 0 0 0 3px rgba(22, 163, 74, .16);
}
.asof .dot.warm { background: #F2994A; box-shadow: 0 0 0 3px rgba(242, 153, 74, .18); }
.asof-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asof i { font-style: normal; color: #B36A00; }

.jump { display: flex; gap: 6px; flex: none; margin-left: auto; }
.jump-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 11px;
  font-size: 12px; font-weight: 800; letter-spacing: -.02em;
  transition: transform .12s, filter .16s, background .16s;
}
.jump-btn:active { transform: scale(.96); }
.jump-btn .ico { display: grid; place-items: center; }
.jump-btn .ico svg { width: 14px; height: 14px; }
.jump-btn.lime {
  background: linear-gradient(150deg, var(--lime), var(--lime-deep));
  color: var(--indigo-deep); box-shadow: 0 6px 14px -9px rgba(180, 222, 30, .9);
}
.jump-btn.blue {
  background: var(--blue); color: #fff;
  box-shadow: 0 6px 14px -9px rgba(49, 130, 246, .9);
}
.jump-btn.lime:hover { filter: brightness(1.05); }
.jump-btn.blue:hover { background: var(--blue-deep); }

/* 좁은 화면 — 기준일 숨기고 버튼은 아이콘만 */
@media (max-width: 640px) {
  .asof { display: none; }
  .jump-btn .lbl { display: none; }
  .jump-btn { padding: 9px 11px; }
  .jump-btn .ico svg { width: 16px; height: 16px; }
}
@media (max-width: 360px) {
  .brand-txt em { display: none; }
}
</style>
