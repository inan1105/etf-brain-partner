<script setup>
// ── 뉴럴 필드 (장식) ──
//
// "ETF 브레인 파트너"의 배경 결. 노드와 시냅스가 느슨하게 이어지다가
// 오른쪽 위로 올라가는 형태 — 뇌의 연결망이면서 동시에 상승 추세선으로 읽힌다.
//
// 좌표는 고정값으로 둔다. 매번 난수로 그리면 새로고침마다 배경이 달라져
// 브랜드로 기억되지 않는다.

defineProps({
  opacity: { type: Number, default: 1 }
})

// 좌표계는 히어로의 가로세로 비율(대략 10:3)에 맞춰 400×120 으로 둔다.
// 정사각 뷰박스를 slice 로 채우면 배율이 과해져 노드가 거대한 원이 된다.
// [x, y, r]
const NODES = [
  [14, 96, 4.0], [42, 70, 2.6], [30, 110, 2.0], [70, 86, 5.0], [64, 44, 2.2],
  [98, 62, 3.0], [92, 104, 2.0], [128, 76, 4.2], [118, 32, 2.4], [152, 52, 2.2],
  [146, 98, 2.6], [182, 66, 5.0], [172, 26, 2.0], [210, 42, 3.0], [200, 88, 2.0],
  [238, 56, 2.4], [246, 22, 3.6], [228, 104, 1.8], [272, 70, 2.0], [84, 18, 1.8],
  [286, 38, 2.6], [300, 84, 2.0], [318, 54, 3.4], [340, 26, 2.2], [352, 72, 2.0],
  [372, 44, 4.0], [386, 92, 1.8], [356, 106, 1.6], [396, 18, 2.4]
]

// 시냅스 — [from, to] 인덱스
const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 5], [3, 6], [4, 5], [5, 7],
  [6, 7], [4, 8], [5, 9], [7, 9], [7, 10], [8, 9], [9, 11], [10, 11],
  [8, 12], [11, 13], [11, 14], [12, 13], [13, 15], [14, 15], [13, 16],
  [15, 18], [14, 17], [16, 18], [4, 19], [19, 8], [16, 20], [18, 21],
  [20, 22], [21, 22], [20, 23], [22, 24], [22, 25], [23, 25], [24, 26],
  [25, 26], [24, 27], [23, 28], [25, 28]
]

// 이 경로만 굵게 — 배경 속에 상승 추세가 한 줄 지나가는 인상
const TREND = [0, 3, 7, 11, 13, 20, 25, 28]
const trendPath = TREND.map((i, k) => `${k ? 'L' : 'M'}${NODES[i][0]} ${NODES[i][1]}`).join(' ')
</script>

<template>
  <!-- slice 로 비율을 지켜야 노드가 원형을 유지한다.
       none 으로 늘리면 넓은 히어로에서 타원 덩어리가 되어 글자를 가린다. -->
  <svg class="field" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice"
       aria-hidden="true" focusable="false" :style="{ opacity }">
    <defs>
      <!-- SVG 프레젠테이션 속성에서는 CSS 변수가 해석되지 않으므로 토큰 값을 직접 쓴다 -->
      <linearGradient id="bf-trend" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stop-color="#6C5CE7" stop-opacity=".45" />
        <stop offset="55%" stop-color="#3182F6" stop-opacity=".38" />
        <stop offset="100%" stop-color="#B4DE1E" stop-opacity=".62" />
      </linearGradient>
    </defs>

    <g class="edges">
      <line v-for="([a, b], i) in EDGES" :key="i"
            :x1="NODES[a][0]" :y1="NODES[a][1]"
            :x2="NODES[b][0]" :y2="NODES[b][1]" />
    </g>

    <path class="trend" :d="trendPath" />

    <g class="nodes">
      <circle v-for="([x, y, r], i) in NODES" :key="i"
              :cx="x" :cy="y" :r="r"
              :class="{ hub: r >= 3, pulse: TREND.includes(i) }"
              :style="{ animationDelay: (TREND.indexOf(i) * 0.45) + 's' }" />
    </g>
  </svg>
</template>

<style scoped>
/* 배경은 '텍스처'여야지 '그래픽'이면 안 된다.
   글자 위에 올라오는 순간 읽기를 방해하므로 전체 톤을 크게 낮춘다. */
.field {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 0;
  mix-blend-mode: multiply;
  /* 본문 카피가 놓이는 왼쪽은 비우고 오른쪽으로 갈수록 짙어지게 —
     배경이 글자 뒤에서 경쟁하지 않도록 한다. */
  -webkit-mask-image: linear-gradient(100deg, transparent 4%, rgba(0, 0, 0, .3) 30%, #000 68%);
  mask-image: linear-gradient(100deg, transparent 4%, rgba(0, 0, 0, .3) 30%, #000 68%);
}

.edges line {
  stroke: #6C5CE7;
  stroke-width: 1;
  opacity: .10;
  vector-effect: non-scaling-stroke;
}

.trend {
  fill: none;
  stroke: url(#bf-trend);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  opacity: .34;
}

.nodes circle {
  fill: #6C5CE7;
  opacity: .13;
}
.nodes circle.hub { opacity: .2; }
.nodes circle.pulse { animation: syn 5s ease-in-out infinite; }

/* 시냅스가 순차로 밝아지며 왼쪽 아래 → 오른쪽 위로 신호가 흐른다 */
@keyframes syn {
  0%, 100% { opacity: .16; }
  42% { opacity: .42; }
}

@media (prefers-reduced-motion: reduce) {
  .nodes circle.pulse { animation: none; opacity: .4; }
}
</style>
