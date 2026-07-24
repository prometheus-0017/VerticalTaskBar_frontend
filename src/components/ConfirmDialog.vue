<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <h3 class="modal-title">{{ title }}</h3>

      <div class="modal-actions">
        <button @click="cancel" class="btn btn-cancel">取消</button>
        <button @click="submit" class="btn btn-submit">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{
  title?: string;
}>();

const emit = defineEmits<{
  submit: [];
  cancel: [];
}>();

const cancel = () => {
  emit('cancel');
};

const submit = () => {
  emit('submit');
};

onMounted(() => {
  // 聚焦到确定按钮
  const btn = document.querySelector('.btn-submit') as HTMLButtonElement;
  btn?.focus();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 10px;
  box-sizing: border-box;
}

.modal-content {
  background: var(--background-color);
  width: 100%;
  max-width: 280px;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.modal-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  flex: 1;
  max-width: 80px;
}

.btn-cancel {
  background: #f0f0f0;
  color: #666;
}

.btn-submit {
  background: #409eff;
  color: white;
}

.btn:hover {
  opacity: 0.9;
}
</style>
