<script setup lang="ts">
import { ref } from 'vue'
import { config } from './config'

let props=defineProps({
  tooltip: {
    type: String,
    default: undefined
  }
})

</script>

<template>
  <span class="new-button" :title="tooltip"><slot></slot></span>
</template>

<style scoped>
.my-button {
  padding-top: 2px;
  width: 30px;
  height: 30px;
  display: inline-block;
}

@font-face { 
  font-family: "SmileySans-Oblique";
  src: url("@/assets/fonts/SmileySans-Oblique.otf.woff2");
  font-weight: normal;
font-style: normal;
}

.new-button{
  padding-top: 2px;
  width: 30px;
  color:var(--text-color);
  height: 30px;
  background-color: #00000000;
  display: inline-block;
  border-radius: 5px;
  font-family: "SmilySans-Oblique";
}
.new-button:hover{
  background-color:var(--button-highlight-color);
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
