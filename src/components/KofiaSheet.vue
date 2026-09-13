<script setup>
// 목록·카드의 [전자공시] — 그 종목의 금융투자협회 펀드요약정보만 바로 띄운다.
import { onMounted, onUnmounted } from 'vue'
import KofiaPanel from './KofiaPanel.vue'

defineProps({
  item: { type: Object, required: true }
})
const emit = defineEmits(['close', 'open'])

const onKey = e => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="sheet-back" @click.self="emit('close')" role="dialog" aria-modal="true"
       :aria-label="`${item.name} 전자공시`">
    <div class="sheet">
      <div class="sheet-head">
        <div class="grow">
          <h2>{{ item.name }}</h2>
          <div class="code tnum">{{ item.queryKey }}</div>
        </div>
        <div class="acts">
          <button class="to-detail" @click="emit('open', item)">종목 상세</button>
          <button class="x" @click="emit('close')" aria-label="닫기">×</button>
        </div>
      </div>
      <div class="sheet-body">
        <KofiaPanel class="in-sheet" :item="item" />
      </div>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 4px; font-size: 18px; font-weight: 800;
  letter-spacing: -.035em; color: var(--ink); line-height: 1.35; word-break: keep-all;
}
.code { font-size: 12px; font-weight: 700; color: var(--muted-2); }
.acts { display: flex; gap: 6px; flex: none; align-items: center; }
.to-detail {
  padding: 7px 11px; border-radius: 10px; font-size: 11.5px; font-weight: 800;
  background: var(--surface); color: var(--ink-soft);
}
.to-detail:hover { background: var(--purple-soft); color: var(--purple); }
.sheet-body .in-sheet { margin-top: 0; }
</style>
