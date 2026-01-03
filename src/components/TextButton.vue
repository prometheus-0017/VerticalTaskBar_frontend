<script setup lang="ts">
import { ref } from 'vue'
import { config } from './config'

let props=defineProps({
  tooltip: {
    default: undefined
  }
})

</script>

<template>
  <span class="my-button" :class="{green:config.buttonColor=='green',blue:config.buttonColor=='blue'}" :title="tooltip"><slot></slot></span>
</template>

<style scoped>
.my-button {
  padding-top: 2px;
  width: 30px;
  height: 30px;
  display: inline-block;
}
.blue{
  color: white;
  background-color: #3955a3;
}
.green{
  color: black;
  background-color: #4caf50;
}

.blue:hover {
  background-color: #192d65;
}
.green:hover {
  background-color: #3e8e41;
}
</style>
