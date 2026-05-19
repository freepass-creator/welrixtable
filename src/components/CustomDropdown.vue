<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  options: { type: Array, default: () => [] },  // [{ value, label, iconUrl?, swatch? }]
  modelValue: { type: [String, Number, null], default: null },
  placeholder: { type: String, default: '선택' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const rootEl = ref(null);

const current = computed(() => {
  if (props.modelValue == null || props.modelValue === '') return null;
  return props.options.find((o) => String(o.value) === String(props.modelValue));
});

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}
function close() { open.value = false; }
function select(opt) {
  emit('update:modelValue', opt.value);
  emit('change', opt.value);
  close();
}
// 다른 곳 클릭 시 닫기 — capture phase 로 등록해야
// 다른 드롭다운 버튼의 @click.stop 도 통과해서 받음
function onDocClick(e) {
  if (!open.value) return;
  if (rootEl.value && rootEl.value.contains(e.target)) return;
  close();
}
onMounted(() => {
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onEsc);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onEsc);
});
function onEsc(e) {
  if (e.key === 'Escape' && open.value) close();
}
</script>

<template>
  <div ref="rootEl" class="cdd" :class="{ 'cdd--open': open, 'cdd--disabled': disabled }">
    <button type="button" class="cdd__btn" @click.stop="toggle" :disabled="disabled">
      <span class="cdd__current">
        <template v-if="current">
          <span v-if="current.iconUrl" class="cdd__icon" :style="{ backgroundImage: `url('${current.iconUrl}')` }"></span>
          <span v-else-if="current.swatch" class="cdd__icon" :style="{ background: current.swatch }"></span>
          <span class="cdd__text">{{ current.label }}</span>
          <span v-if="current.sub" class="cdd__sub" :class="{ 'cdd__sub--accent': current.subAccent }">{{ current.sub }}</span>
        </template>
        <template v-else>
          <span class="cdd__text cdd__text--placeholder">{{ placeholder }}</span>
        </template>
      </span>
      <span class="cdd__chev"></span>
    </button>
    <div v-if="open" class="cdd__menu">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="cdd__opt"
        :class="{ 'cdd__opt--sel': String(opt.value) === String(modelValue) }"
        @click.stop="select(opt)"
      >
        <span v-if="opt.iconUrl" class="cdd__icon" :style="{ backgroundImage: `url('${opt.iconUrl}')` }"></span>
        <span v-else-if="opt.swatch" class="cdd__icon" :style="{ background: opt.swatch }"></span>
        <span class="cdd__opt-label">{{ opt.label }}</span>
        <span v-if="opt.sub" class="cdd__opt-sub" :class="{ 'cdd__opt-sub--accent': opt.subAccent }">{{ opt.sub }}</span>
      </button>
    </div>
  </div>
</template>
