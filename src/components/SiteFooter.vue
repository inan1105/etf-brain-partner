<script setup>
import { TARGETS } from '../lib/bridge.js'
import { fmtDate } from '../lib/api.js'

defineProps({
  meta: { type: Object, default: null },
  source: { type: String, default: null }
})
const emit = defineEmits(['go'])
</script>

<template>
  <footer class="foot">
    <div class="foot-top">
      <button class="foot-link lime" @click="emit('go', 'ta')">
        <b>AI 기술적분석 계산기</b>
        <span>파동·추세·모멘텀 10개 축 시그널</span>
      </button>
      <button class="foot-link blue" @click="emit('go', 'stockr')">
        <b>아임차트 스토커(Stockr)</b>
        <span>AI 기반 대화형 종목분석</span>
      </button>
      <a class="foot-link tg" href="https://t.me/+jbRp0VqY6qIyMDk1"
         target="_blank" rel="noopener noreferrer">
        <b>지니Q브리프s</b>
        <span>텔레그램 투자정보 채널</span>
      </a>
    </div>

    <div v-if="meta" class="sources">
      <div class="src-t">데이터 출처</div>
      <ul>
        <li v-for="s in meta.sources" :key="s.name">
          <b>{{ s.name }}</b>
          <span>{{ s.scope }}</span>
          <em v-if="!s.live">참고값</em>
        </li>
      </ul>
      <p class="src-note">
        시세 기준일 {{ fmtDate(meta.asOf) }}
        <template v-if="source === 'snapshot'"> · 실시간 연결 실패로 저장된 스냅샷을 표시 중입니다.</template>
        <template v-if="meta.feesUpdatedAt"> · 총보수 갱신 {{ meta.feesUpdatedAt }}</template>
      </p>
    </div>

    <p class="notice">
      본 서비스는 공개 데이터에 기반한 정보 제공용이며, 특정 금융상품의 매수·매도를 권유하지 않습니다.
      분류(섹터·테마·자산군)는 종목명과 기초지수명을 바탕으로 자동 추론한 값으로 운용사 공식 분류와 다를 수 있습니다.
      투자 판단과 그 결과·책임은 이용자 본인에게 귀속됩니다.
    </p>

    <div class="corp">
      <div class="corp-name">이에스플랜잇(주)</div>
      <p>대표 : 황인환 | 서울 영등포구 국제금융로6길 30, 4F, 5F (여의도동, 백상빌딩) | 사업자등록번호 : 207-87-01125</p>
      <p>통신판매업 : 제2020-서울영등포-0316호 | TEL : <a href="tel:1661-3165">1661-3165</a> (평일 10시~17시)</p>
      <p>개인정보책임관리자 : 이현철 | <a href="mailto:iamchart@esplanit.com">iamchart@esplanit.com</a></p>
      <p class="copy">Copyright 2021 이에스플랜잇 All Rights Reserved. · ETF 브레인 파트너 V1.01</p>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  margin-top: 32px; padding-top: 24px;
  border-top: 1px solid var(--line);
}

.foot-top { display: grid; gap: 9px; margin-bottom: 22px; }
@media (min-width: 760px) { .foot-top { grid-template-columns: repeat(3, 1fr); } }

.foot-link {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
  padding: 14px 16px; border-radius: var(--r-sm); text-align: left;
  text-decoration: none; transition: .16s;
}
.foot-link b { font-size: 13.5px; font-weight: 800; letter-spacing: -.025em; }
.foot-link span { font-size: 11px; opacity: .78; }
.foot-link:active { transform: scale(.99); }
.foot-link.lime {
  background: linear-gradient(150deg, var(--lime), var(--lime-deep));
  color: var(--indigo-deep); box-shadow: 0 8px 18px -11px rgba(180, 222, 30, .9);
}
.foot-link.blue { background: var(--blue); color: #fff; box-shadow: 0 8px 18px -11px rgba(49, 130, 246, .9); }
.foot-link.tg { background: var(--indigo); color: #fff; }
.foot-link:hover { filter: brightness(1.05); }

.sources { margin-bottom: 18px; }
.src-t { font-size: 11px; font-weight: 800; color: var(--muted); margin-bottom: 8px; }
.sources ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.sources li {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  font-size: 11.5px; color: var(--ink-soft);
}
.sources li b { font-weight: 800; color: var(--ink); }
.sources li span { color: var(--muted); }
.sources li em {
  font-style: normal; font-size: 10px; font-weight: 800;
  background: #FFF4E5; color: #B36A00; padding: 2px 6px; border-radius: 5px;
}
.src-note { margin: 9px 0 0; font-size: 11px; color: var(--muted); line-height: 1.6; }

.notice {
  margin: 0 0 20px; padding: 13px 15px; border-radius: var(--r-sm);
  background: var(--bg-warm); font-size: 11px; color: var(--ink-soft); line-height: 1.75;
}

.corp { font-size: 10.5px; color: var(--muted); line-height: 1.75; }
.corp-name { font-size: 12px; font-weight: 800; color: var(--ink-soft); margin-bottom: 5px; }
.corp p { margin: 0; }
.corp a { color: var(--ink-soft); }
.copy { margin-top: 9px !important; opacity: .8; }
</style>
