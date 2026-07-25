import { reactive } from 'vue'
export let config=reactive({
  buttonColor:'new',
  nightMode:'system',//'dark'|'light'|'system'
  shouldTrim:false,
  globalQuery:false,
  allowRemote:true,
  addToCurrentGroup:true,
  pin:false,
})