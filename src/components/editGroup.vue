<template>
  <div class="modal-overlay" >
    <div class="modal-content">
      <h3 class="modal-title">编辑窗口组</h3>
      
      <!-- 名称输入 -->
      <div class="form-group">
        <label class="form-label" style="text-align: left;">名称</label>
        <input 
          v-model="formData.name" 
          type="text" 
          class="form-input" 
          placeholder="请输入名称"
        />
      </div>

      <div class="list-header">
        <label class="form-label" style="text-align: left;">列表项</label>
        <text-button tooltip="添加列表项" @click="addItem">+</text-button>
      </div>
      <div style="max-height: 200px;overflow:auto">
          <div v-for="(item, index) in formData.captureConditions" :key="index" class="list-item">
            <select v-model="item.type" class="form-select">
              <option value="pwd">pwd</option>
              <option value="name">name</option>
              <option value="originName">originName</option>
            </select>
            <input 
              v-model="item.value" 
              type="text" 
              class="form-input" 
              placeholder="值"
            />
            <text-button 
              tooltip="删除"
              @click="removeItem(index)"
            >x</text-button> 
          </div>
      </div>
      <!-- 列表面板 -->
      <div class="list-section">
        
      </div>

      <!-- 操作按钮 -->
      <div class="modal-actions">
        <button @click="close" class="btn btn-cancel">取消</button>
        <button @click="submit" class="btn btn-submit">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import TextButton from './TextButton.vue';


import { type editableGroup as EditableGroup } from './group';

// Props & Emits
const props = defineProps<{
  // visible: boolean;
  initialData?: EditableGroup;
}>();

const emit = defineEmits<{
  submit: [data: EditableGroup];
  cancel: [];
}>();

// 响应式数据
const formData = ref<EditableGroup>({
  name: props.initialData?.name || '',
  captureConditions: props.initialData?.captureConditions?.length 
    ? JSON.parse(JSON.stringify(props.initialData.captureConditions)) 
    : [{ type: 'name', value: '' }]
});

// 方法
const close = () => {
    emit('cancel')
};

const submit = () => {
    let result={...formData.value}
    result.captureConditions=result.captureConditions!.filter(x=>x.value!=='')
    emit('submit',result);
};

const addItem = () => {
  formData.value.captureConditions.push({ type: 'name', value: '' });
};
onMounted(()=>{
  formData.value={
    name: props.initialData?.name || '',
    captureConditions: JSON.parse(JSON.stringify(props.initialData!.captureConditions||[]))
  }
});

const removeItem = (index: number) => {
  formData.value.captureConditions.splice(index, 1);
};
</script>

<style scoped>
/* 遮罩层 */
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

/* 弹窗内容 */
.modal-content {
  background: #fff;
  width: 100%;
  max-width: 280px; /* 适配300px容器 */
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.modal-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

/* 表单组 */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.form-input, .form-select {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  outline: none;
}

.form-input:focus, .form-select:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

/* 列表区域 */
.list-section {
  margin-bottom: 16px;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px;
  background: #fafafa;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.list-title {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.list-item {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  align-items: center;
}

.list-item:last-child {
  margin-bottom: 0;
}

.form-select {
  width: 70px; /* 固定下拉框宽度 */
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  min-width: 0; /* 防止flex子项溢出 */
}

/* 底部按钮 */
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