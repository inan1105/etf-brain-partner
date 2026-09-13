<script setup>
import { ref } from 'vue'
import { GROUPS } from '../lib/presets.js'

defineProps({
  active: { type: String, default: null }
})
const emit = defineEmits(['pick'])

const open = ref(true)
</script>

<template>
  <section class="rail card">
    <div class="card-t" :class="{ shut: !open }">
      <button class="fold" @click="open = !open" :aria-expanded="open">
        <span class="menu-tag">빠른 상담진입</span>
        <span class="badge purple">FAQ 20</span>
        <svg class="caret" :class="{ up: open }" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.6" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <span class="small" style="margin-left:auto">요건정의 항목을 그대로 조건으로 엽니다</span>
    </div>

    <div v-show="open" class="groups">
      <div v-for="g in GROUPS" :key="g.id" class="group">
        <div class="g-head" :class="g.accent">
          <span class="g-id">{{ g.id }}</span>
          <span class="g-title">{{ g.title }}</span>
          <span class="g-hint">{{ g.hint }}</span>
        </div>
        <div class="g-items">
          <button
            v-for="it in g.items"
            :key="it.id"
            class="p-item"
            :class="[g.accent, { on: active === it.id }]"
            @click="emit('pick', it)"
          >
            <span class="p-label">{{ it.label }}</span>
            <span class="p-desc">{{ it.desc }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card-t.shut { margin-bottom: 0; }
.fold { display: inline-flex; align-items: center; gap: 8px; }
.caret { width: 15px; height: 15px; transition: transform .2s; color: var(--muted); }
.caret.up { transform: rotate(180deg); }

.groups { display: grid; gap: 18px; }
@media (min-width: 760px) { .groups { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1100px) { .groups { grid-template-columns: repeat(3, 1fr); } }

.g-head {
  display: flex; align-items: center; gap: 7px; margin-bottom: 9px;
  padding-bottom: 7px; border-bottom: 2px solid var(--line-card);
}
.g-id {
  width: 19px; height: 19px; border-radius: 6px; flex: none;
  display: grid; place-items: center;
  font-size: 10.5px; font-weight: 800; color: #fff; background: var(--muted);
}
.g-head.purple { border-bottom-color: rgba(108, 92, 231, .3); }
.g-head.purple .g-id { background: var(--purple); }
.g-head.lime { border-bottom-color: rgba(180, 222, 30, .5); }
.g-head.lime .g-id { background: var(--lime-deep); color: var(--indigo-deep); }
.g-head.blue { border-bottom-color: rgba(49, 130, 246, .3); }
.g-head.blue .g-id { background: var(--blue); }
.g-head.indigo { border-bottom-color: rgba(44, 41, 96, .25); }
.g-head.indigo .g-id { background: var(--indigo); }

.g-title { font-size: 13px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.g-hint { font-size: 10.5px; font-weight: 700; color: var(--muted); margin-left: auto; }

.g-items { display: flex; flex-direction: column; gap: 6px; }

.p-item {
  display: flex; flex-direction: column; gap: 2px;
  text-align: left; padding: 10px 12px; border-radius: var(--r-xs);
  background: var(--surface-2); border: 1px solid transparent;
  transition: .15s;
}
.p-item:hover { background: #fff; border-color: var(--line-card); box-shadow: var(--shadow-sm); }
.p-label { font-size: 13px; font-weight: 700; color: var(--ink); letter-spacing: -.02em; }
.p-desc { font-size: 11px; color: var(--muted); line-height: 1.45; }

.p-item.on { background: var(--purple); border-color: var(--purple); }
.p-item.on .p-label, .p-item.on .p-desc { color: #fff; }
.p-item.on .p-desc { color: rgba(255, 255, 255, .8); }
.p-item.lime.on { background: var(--lime-deep); border-color: var(--lime-deep); }
.p-item.lime.on .p-label { color: var(--indigo-deep); }
.p-item.lime.on .p-desc { color: rgba(35, 32, 73, .68); }
.p-item.blue.on { background: var(--blue); border-color: var(--blue); }
.p-item.indigo.on { background: var(--indigo); border-color: var(--indigo); }
</style>
