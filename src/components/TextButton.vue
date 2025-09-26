<script setup lang="ts">
import { ref } from 'vue'

let props=defineProps({
  tooltip: {
    default: undefined
  }
})

</script>

<template>
  <span class="my-button" :title="tooltip"><slot></slot></span>
</template>

<style scoped>
.my-button {
  padding-top: 2px;
  background-color: #4caf50;
  width: 30px;
  height: 30px;
  display: inline-block;
}
.my-button:hover {
  background-color: #3e8e41;
}
</style>
