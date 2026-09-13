<script setup>
import { ref } from 'vue'
import { copy } from '../lib/bridge.js'

const props = defineProps({
  // { target, payload, copied, opened, item }
  info: { type: Object, required: true }
})
const emit = defineEmits(['close'])

const recopied = ref(false)

async function again () {
  recopied.value = await copy(props.info.payload)
  setTimeout(() => { recopied.value = false }, 1800)
}

function openAgain () {
  window.open(props.info.target.url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="sheet-back" @click.self="emit('close')" role="dialog" aria-modal="true">
    <div class="sheet narrow">
      <div class="sheet-head">
        <div class="grow">
          <span class="badge" :class="info.target.accent === 'lime' ? 'lime' : 'blue'">
            {{ info.target.name }}
          </span>
          <h2>{{ info.opened ? '새 탭이 열렸습니다' : '탭을 열지 못했습니다' }}</h2>
        </div>
        <button class="x" @click="emit('close')" aria-label="닫기">×</button>
      </div>

      <div class="sheet-body">
        <ol class="steps">
          <li :class="{ done: info.opened }">
            <span class="n">1</span>
            <div>
              <b>{{ info.target.name }} 열기</b>
              <p v-if="info.opened">새 탭에서 열렸습니다.</p>
              <p v-else>
                팝업이 차단된 것 같습니다.
                <button class="link" @click="openAgain">직접 열기</button>
              </p>
            </div>
          </li>
          <li :class="{ done: info.copied }">
            <span class="n">2</span>
            <div>
              <b>입력값 복사</b>
              <p v-if="info.copied">클립보드에 복사했습니다.</p>
              <p v-else>자동 복사에 실패했습니다. 아래 값을 직접 복사하세요.</p>
            </div>
          </li>
          <li>
            <span class="n">3</span>
            <div>
              <b>{{ info.target.placeholder }}에 붙여넣기</b>
              <p>{{ info.target.guide }}</p>
            </div>
          </li>
        </ol>

        <div class="payload">
          <code>{{ info.payload }}</code>
          <button class="btn btn-sm btn-ghost" @click="again">
            {{ recopied ? '복사됨' : '다시 복사' }}
          </button>
        </div>

        <p class="why">
          두 서비스는 현재 주소로 종목을 전달받는 기능이 없어 붙여넣기 방식으로 연결합니다.
          추후 파라미터 수신이 추가되면 이 단계 없이 바로 이동합니다.
        </p>

        <button class="btn btn-block btn-ghost mt12" @click="emit('close')">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet.narrow { max-width: 440px; }
h2 { margin: 7px 0 0; font-size: 17px; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }

.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.steps li { display: flex; gap: 11px; align-items: flex-start; }
.steps .n {
  flex: none; width: 22px; height: 22px; border-radius: 50%;
  background: var(--surface); color: var(--muted-2);
  font-size: 11px; font-weight: 800; display: grid; place-items: center;
  transition: .2s;
}
.steps li.done .n { background: #16A34A; color: #fff; }
.steps b { font-size: 13px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
.steps p { margin: 2px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.6; }

.link {
  color: var(--purple); font-weight: 800; text-decoration: underline;
  font-size: 11.5px; padding: 0;
}

.payload {
  display: flex; align-items: center; gap: 10px; margin-top: 16px;
  background: var(--surface); border-radius: var(--r-sm); padding: 11px 13px;
}
.payload code {
  flex: 1; min-width: 0; font-size: 14px; font-weight: 800;
  color: var(--ink-data); letter-spacing: .02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.why {
  margin: 13px 0 0; font-size: 11px; color: var(--muted); line-height: 1.65;
}
</style>
