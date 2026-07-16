import { reactive } from 'vue'
export let config=reactive({
  buttonColor:'new',
  nightMode:'system',//'dark'|'light'|'system'
  shouldTrim:false,
  globalQuery:false,
  addToCurrentGroup:true,
  pin:false,
})