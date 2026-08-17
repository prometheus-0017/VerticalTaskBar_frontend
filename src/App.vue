<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue';
import TextButton from './components/TextButton.vue';
import Twin from './components/Twin.vue';
import {getId} from './nnode.js'
import type { Ref } from 'vue';
import { Client } from 'xuri-rpc'
import { config } from './components/config'
/*
let hostId='frontend-'+getId()
setHostId(hostId)

let client=new Client()
//这么写是不合适的，但是我不确定meta机制是否完善
class SenderDecorator implements ISender{
  sender:ISender
  constructor(sender:ISender){
    this.sender=sender
  }
  send(message: any) {
    if(!message.meta){
      message.meta={
      }
    }
    message.meta.hostId=hostId
    return this.sender.send(message)
  }
}
let sender:ISender=new WebSocketSender(new WebSocketConnectionKeeper(window.location.hostname,18765,'/',client))
sender=new SenderDecorator(sender)
client.setSender(sender)
let rpc:any=null
async function prepareRpc(){
  rpc=await client.getObject('rpc')
}
  */
let client:Client|null=null;
let rpc:any=null;
import { createMain } from '@xuri-rpc/websocket-sender';
const hostId='frontend-'+Math.random()
async function prepareRpc(){
  let _main=null;
  [client,_main]=await createMain(hostId,window.location.hostname,18765,'/')
  rpc=await client.getObject('rpc')
  // rpc=asProxy(client)
}

let shouldTrim=computed(() => {
  return config.shouldTrim;
});
function switchShouldTrim(){
  config.shouldTrim=!config.shouldTrim
}

function switchBtnColor(){
  if(config.buttonColor=='green'){
    config.buttonColor='blue'
  }else{
    config.buttonColor='green'
  }
}
function switchNightMode(){
  const seq=['light','dark','system']
  config.nightMode=seq[(seq.indexOf(config.nightMode)+1)%seq.length]
  applyTheme(config.nightMode)
}
function switchAddToCurrentGroup(){
  if(config.addToCurrentGroup){
    config.addToCurrentGroup=false
  }else{
    config.addToCurrentGroup=true
  }

}

// ConfirmDialog modal state
const showConfirmDialog = ref(false);
const confirmDialogProps = ref({ title: '' });
let confirmDialogResolve: ((value: boolean) => void) | null = null;
function confirm(message: string): Promise<boolean> {
  confirmDialogProps.value = { title: message };
  showConfirmDialog.value = true;
  return new Promise((resolve) => {
    confirmDialogResolve = resolve;
  });
}
const onConfirmCancel = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(false);
    confirmDialogResolve = null;
  }
  showConfirmDialog.value = false;
};
const onConfirmSubmit = () => {
  if (confirmDialogResolve) {
    confirmDialogResolve(true);
    confirmDialogResolve = null;
  }
  showConfirmDialog.value = false;
};
function prompt(message: string, defaultValue = ''): Promise<string | null> {
  return textInput(message, defaultValue);
}

// ===== 状态定义 ===== 
const isWideMode = ref(true);
const currentTaskListShowing = ref('main');
const searchQuery = ref('');

import { type Task,type Group, type editableGroup } from './components/group.js';
const groups = ref<Group[]>([])

// 主标签和 raw 标签是隐藏的，但 mainItems 包含所有项目
// const mainItems = computed<Item[]>(() => {
//   return taskLists.value.flatMap(tag => tag.tasks);
// });
function getListById(tagId:string):Task[]|null{

  const taskList = groups.value.find(t => t.id === tagId);
  if(taskList==null){
    return null
  }
  let res=taskList.tasks
  return res
}
const currentTaskList=computed<Group>(() => {
  let res=groups.value.find(t => t.id === currentTaskListShowing.value);
  if(!res){
    res=groups.value[0]
  }
  return res
});

// 过滤当前标签下的项目
const currentTaskListToShow = computed(() => {
  const taskList=getListById(currentTaskListShowing.value)
  if(taskList==null){
    return []
  }

  let query = queryCursor.value!.searchQuery.toLowerCase()
  if(shouldTrim.value){
    query=query.trim()
  }
  // searchQuery.value.toLowerCase();
  
  return taskList.filter(item =>
    (item.modifiedName || item.originalName).toLowerCase().includes(query) || (item.processName)?.toLocaleLowerCase().includes(query)
  );
});

// 切换模式
// function toggleWidth() {
//   isWideMode.value = !isWideMode.value;
//   if(isWideMode.value){
//     document.body.style.width='300px';
//   }else{
//     document.body.style.width='50px';
//   }
// }
function next(){
  return new Promise(resolve=>{
    nextTick(()=>resolve(null))
  })
}
let scrollContainer=ref<HTMLElement|null>(null);
// 点击标签切换
async function onTagClick(tag: Group) {
  let scroll=scrollContainer.value?.scrollTop
  if(scroll!==undefined){
    currentTaskList.value!.scrollStatus=scroll
  }
  currentItemClicked.value={type:'tag',item:tag}
  currentTaskListShowing.value = tag.id;
  for(let item of tag.tasks){
    if(item.id in hoverState){
      continue
    }
    hoverState[item.id]=false
  }
  await next()
  scrollContainer.value!.scrollTop=currentTaskList.value.scrollStatus
}
function exit(){
  rpc.exit()
}
// 删除项
// async function onItemDelete(item: Task) {
//   if(currentTaskListShowing.value=='main'){
//     return
//   }
//   const confirmed = await confirm(`确定删除 ${item.modifiedName || item.originalName}?`);
//   if (confirmed) {
//     const taskList = getListById(currentTaskListShowing.value)
//     if (taskList) {
//       taskList.tasks = taskList.tasks.filter(i => i.id !== item.id);
//     }
//   }
// }
import {onMounted, onBeforeUnmount}from 'vue';
import EditGroup from './components/editGroup.vue';
import TextInput from './components/TextInput.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
async function onRightClick(item:Task,e:MouseEvent){
  if(e.shiftKey){
    removeAfter(item)
  }else{
    setTaskName(item)
  }
}
async function removeAfter(item:Task){
  if(currentTaskListShowing.value=='main'){
    return 
  }
  if(!await confirm('确定要删除所有后续项吗？')){
    return 
  }
  let idx=currentTaskList.value!.tasks.findIndex(i=>taskEqual(i,item))
  if(idx===-1){
    return
  }
  currentTaskList.value!.tasks.splice(idx+1,2147483647)
}
function taskEqual(a:Task|null|undefined,b:Task|null|undefined){
  if(a==null&&b==null){
    return true
  }
  if(a==null||b==null){
    return false
  }
  return mkFullId(a.id,a.system) == mkFullId(b.id,b.system)
}
async function setTaskName(item:Task) {
    let name=await prompt('请输入新名称', item.modifiedName || item.originalName)
    if(name===null){
      return
    }
    if(name.trim()===''){
      item.modifiedName=null;
    }else{
      item.modifiedName = name;
    }
}
async function setTagName(item:Group) {
    let result=await editGroup(item as editableGroup);
    //  prompt('请输入新名称', item.name)
    if(result==null){
      return
    }
    let name=result.name
    if(name===null||name===''){
      return
    }
    item.name=name;
    item.captureConditions=result.captureConditions
}
// 编辑名称（F2）
async function handleKeyDown(e: KeyboardEvent) {
  if(e.key=='w' && e.ctrlKey){

    if(currentTaskListShowing.value=='main'){
      return
    }

    let res=await confirm('确定要删除吗？')
    if(!res){
      return
    }
    
    const idx=groups.value.findIndex(item=>item.id==currentTaskListShowing.value)
    if(idx===-1){
      throw new Error('未找到任务列表')
    }
    const list=groups.value
    currentTaskListShowing.value=list[(idx-1+list.length)%list.length].id
    list.splice(idx,1)
  }
  if (e.key === 'F2') {
    
    if(currentItemClicked.value==null){
      return
    }
    if(currentItemClicked.value.type==='list'){
      setTaskName(currentItemClicked.value.item as Task)
    }else{
      setTagName(currentItemClicked.value.item as Group)
    }
    
  }
}
interface ItemProxy{
  item:Task|Group
  type:'list'|'tag'
}
let itemDragging:ItemProxy| null=null
// 拖拽逻辑（简化示例）
function onDragList(_event: DragEvent, item: Task) {
  itemDragging ={type:'list',item} 
  // event.dataTransfer?.setData('text/plain', JSON.stringify(item));
}
function onDragTag(_event: DragEvent, item: Group) {
  itemDragging ={type:'tag',item} 
  // event.dataTransfer?.setData('text/plain', JSON.stringify(item));
}

function onDropList(_event: DragEvent, target:Task) {
  if(!itemDragging){
    return
  }

  if(itemDragging.type=='tag'){
    itemDragging=null
    return
  }

  const source:Task=itemDragging.item as Task;
  const taskList:Array<Task|null>=getListById(currentTaskListShowing.value) as Array<Task>;
  if(taskList==null){
    throw 'impossible'
  }
  let idxOld=taskList?.findIndex(item=>item==source)
  const idxTo=taskList?.findIndex(item=>item==target)
  taskList[idxOld]=null
  taskList?.splice(idxTo,0,source);
  idxOld=taskList.findIndex(item=>item==null)
  taskList.splice(idxOld,1);

}
type NightMode='system'|'light'|'dark'
// 应用主题的核心函数
const applyTheme = (theme:NightMode) => {
  const root = document.documentElement;
  
  // 先清除可能存在的旧主题类
  root.classList.remove('dark', 'light');
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.add('light');
  }
  // 如果是 'system'，则不加任何类，让 CSS 的 @media 查询自动接管
  
  // currentTheme.value = theme;
  // localStorage.setItem('theme-preference', theme);
};

function onDropTag(event: DragEvent, tag:Group){
  if(itemDragging==null){
    return
  }
  if(itemDragging.type=='tag'){
    let oldIndex=groups.value.findIndex(item=>item==itemDragging?.item)
    const idxTo=groups.value.findIndex(item=>item==tag)
    groups.value[oldIndex]=null
    groups.value.splice(idxTo,0,itemDragging.item as Group);
    oldIndex=groups.value.findIndex(item=>item==null)
    groups.value.splice(oldIndex,1);

    itemDragging=null
    return
  }
  if(itemDragging.type=='list'){
    const list=tag.tasks
    const idx=list.findIndex(item=>taskEqual(item,itemDragging?.item as Task))

    if(idx!==-1){
      itemDragging=null
      return 
    }

    list.push(itemDragging.item as Task)
    itemDragging=null

    return
  }
}
type fullId=string
type taskId=number
function mkFullId(id:taskId,sys:string):fullId{
  return `${sys}%${id}`
}
let taskMap:Map<fullId,Task>=new Map()
// async function sleep(ms:number){
//   return new Promise(resolve=>{
//     setTimeout(resolve,ms)
//   })
// }
// async function refreshLoop(){ 
//     while(true){
//       try{
//         await refresh()
//         await sleep(500)
//       }catch(e){
//         console.log(e)
//       }
//     }
// }``
// let version=0

interface WindowChangeInfo{
  type:'add'|'change'|'delete'
  data:Task
}
// async function  refresh() {
//   version=await rpc.queryHasUpdate(version)
//   let windowsList=await rpc.queryList()
//   const newTaskMap=new Map()
//   for (let item of windowsList){
//     newTaskMap.set(item.id,item)
//   }
  
//   const removed=new Map()
//   for (let [id,item] of mainTaskMap){
//     if(!newTaskMap.has(id)){
//       removed.set(id,item)
//     }
//   }

//   for (let [id,item] of newTaskMap){
//     if(mainTaskMap.has(id)){
//       mainTaskMap.get(id).originalName=item.originalName
//       mainTaskMap.get(id).originalIcon=item.originalIcon
//     }
//   }

//   const added=[]
//   for (let [id,item] of newTaskMap){
//     if(!mainTaskMap.has(id)){
//       added.push(item)
//     }
//   }

//   for(let [_id,item] of removed){
//     mainTaskMap.delete(item.id)
//   }
//   taskLists.value.forEach(tag=>{
//       tag.tasks=tag.tasks.filter(originItem=>removed.has(originItem.id)==false)
//   })

//   for (let item of added){
//     mainTaskMap.set(item.id,item)
//     getListById('main')?.push(item)
//   }
  
//   console.log(mainTaskMap)

// }
function addTaskList(){
  prompt('请输入标签名称', '').then(async name => {
    if (name === null) {
      return;
    }
    if (name.trim() === '') {
      return;
    }
    groups.value.push({
      id:getId(),
      name,
      tasks:[],
      searchQuery:'',
      scrollStatus:0,
      captureConditions:[]
    })
  })
}
let globalQueryCursor=reactive<Group>({
  id:'',
  name:'',
  tasks:[],
  scrollStatus:0,
  captureConditions:[],
  searchQuery:''
})
let saveInterval:number|null=null;
let saveFinSign=ref('存')
async function saveStatus(){
  let status={
    config:config,
    taskLists:groups.value
  }
  if(saveInterval!==null){
    clearInterval(saveInterval)
  }
  saveFinSign.value='〇'  
  await rpc.saveStatus(status)
  saveFinSign.value='√'
  saveInterval=setInterval(()=>saveFinSign.value='存',500)
}
let globalQuery=computed(()=>{
  return config.globalQuery
})
let queryCursor=computed(()=>{
  if(globalQuery.value){
    return globalQueryCursor
  }
  return currentTaskList.value
})
function switchGlobalSearchQuery(){
  if(!globalQuery.value){
    globalQueryCursor.searchQuery=currentTaskList.value!.searchQuery
  }
  config.globalQuery=!globalQuery.value
}

function onDropListOver(event:DragEvent,item:Task){
  event.preventDefault();
  if(event.dataTransfer?.types.includes('Files')){
    // nnode.rpc('toTop',[item.id])
    rpc.toTop(item.id,item.system)
  }
}
function onDropListGap(event:DragEvent){
  if(event.target !== event.currentTarget) return
  if(!itemDragging) return
  if(itemDragging.type !== 'list') return
  const source = itemDragging.item as Task
  const taskList = getListById(currentTaskListShowing.value)
  if(taskList == null) return

  const ul = event.currentTarget as HTMLElement
  const lis = Array.from(ul.children).filter(el => el.tagName === 'LI') as HTMLElement[]
  if(lis.length === 0) return

  const mouseY = event.clientY
  let insertBeforeVisibleIdx = lis.length
  for(let i = 0; i < lis.length; i++){
    const rect = lis[i].getBoundingClientRect()
    if(mouseY < rect.top){
      insertBeforeVisibleIdx = i
      break
    }
  }

  const visibleList = currentTaskListToShow.value
  if(insertBeforeVisibleIdx >= visibleList.length){
    // 在所有可见项之后，直接从原列表删除并追加到末尾
    const idxOld = taskList.findIndex(item => item === source)
    if(idxOld === -1) return
    taskList.splice(idxOld, 1)
    taskList.push(source)
  } else {
    const nextVisible = visibleList[insertBeforeVisibleIdx]
    if(nextVisible === source) return // 缝隙就在自己后面，无需移动
    const nextVisibleIdx = taskList.findIndex(item => item === nextVisible)
    if(nextVisibleIdx === -1) return
    const idxOld = taskList.findIndex(item => item === source)
    if(idxOld === -1) return
    // 先从原位置删除
    taskList.splice(idxOld, 1)
    // 删除后 nextVisible 在新数组中的索引
    const adjustedIdx = idxOld < nextVisibleIdx ? nextVisibleIdx - 1 : nextVisibleIdx
    taskList.splice(adjustedIdx, 0, source)
  }
  itemDragging = null
}
function onDropTagOver(event:DragEvent,item:Group){
  event.preventDefault()
  if(event.dataTransfer?.types.includes('Files')){
    onTagClick(item)
  }
}
let ready:Ref<boolean>=ref(false)
onMounted(async () => {
  await prepareRpc()
  // let res=await nnode.rpc('queryList',[])
  const initData=await rpc.loadStatus()
  if(initData==null){
    // let windowList=await rpc.queryList()
    let windowList=await rpc.sync()
    groups.value.push({
      id:'main',
      name:'main',
      tasks:windowList,
      searchQuery:'',
      scrollStatus:0,
      captureConditions:[]
    })
    taskMap = new Map(windowList.map((item:Task) => [item.id, item]))
  }else{
    const initMainCopy=(initData.taskLists as Group[]).filter(x=>x.id=='main')[0].tasks.concat([]);
    groups.value=initData.taskLists
    Object.assign(config,initData.config)
    let windowList=getListById('main')
    taskMap = new Map(windowList!.map((item:Task) => [mkFullId(item.id,item.system), item]))
    let syncData=await rpc.sync()
    let vis:Map<fullId,boolean>=new Map()
    for(let _item of syncData){
      let item:Task=_item
      let id=item.id
      let localItem=taskMap.get(mkFullId(id,item.system))
      if(!localItem){
        taskMap.set(mkFullId(id,item.system),item)
        getListById('main')!.push(item)
      }else{
        localItem.originalName=item.originalName
        localItem.originalIcon=item.originalIcon
        //先这样吧,正常应该icon持久化,但是好像realtime的icon会变化
        localItem.modifiedIcon=item.originalIcon
        // 先这么办但是我觉得不适这么给事情，chrome 插件重启systemid会变化，结果这里还没有判system按道理task的id应该就足够是唯一的但是totop机制又让id从外部生成可能后续接入的system应该改这个id来源
        localItem.system=item.system
        vis.set(mkFullId(id,localItem.system),true)
      }
    }
    let removed=[];
    for(let item of initMainCopy){
      let id=mkFullId(item.id,item.system)
      if(!vis.has(id)){
        taskMap.delete(id)
        removed.push(item.id)
      }
    }
    //byd 反序列化之前这个item其实是有引用构成的一个有向无环图的，但是序列化的时候把它完全展开了。导致tag里的item变成了一个副本。
    groups.value.forEach(tag=>{
      const originTask=tag.tasks
      tag.tasks=[]
      for(let item of originTask){
        const localItem=taskMap.get(mkFullId(item.id,item.system))
        if(localItem){
          tag.tasks.push(localItem)
        }
      }
      // tag.tasks=tag.tasks.filter(originItem=>removed.includes(originItem.id)==false)
    })

    await rpc.pin(config.pin)
    await rpc.setAllowRemote(config.allowRemote)
  }
  ready.value=true

  

  // setInterval(refresh,500)

  window.addEventListener('keydown', handleKeyDown);
  setInterval(async ()=>{
    if(!await rpc.checkLogin(hostId)){
      await rpc.setCallback(hostId,(updateInfos:Array<WindowChangeInfo>)=>{
      for(let updateInfo of updateInfos){
        switch(updateInfo.type){
          case 'add':
            taskMap.set(mkFullId(updateInfo.data.id,updateInfo.data.system),updateInfo.data)
            getListById('main')?.push(updateInfo.data)
            for(let group of groups.value){
              if(group.id=='main'){
                continue
              }
              for(let condition of group.captureConditions||[]){
                let val=null
                if(condition.type=='name'){
                  //todo 你他妈的远程哪有modify？
                  val=updateInfo.data.modifiedName
                }else if(condition.type=='originName'){
                  val=updateInfo.data.originalName
                }else if(condition.type=='pwd'){
                  val=updateInfo.data.pwd
                }else{
                  console.warn('未知的condition.type')
                }
                if(val!=null && 
                    condition.value!='' &&
                    val.toLowerCase().includes(condition.value.toLowerCase())){
                  group.tasks.push(updateInfo.data)
                  break;
                }
              }

            }
            for(let group of groups.value){
              if(group.id==currentTaskListShowing.value){
                let found=false
                for(let task of group.tasks){
                  if(task.id==updateInfo.data.id){
                    found=true
                    break
                  }
                }
                if(!found && config.addToCurrentGroup){
                  group.tasks.push(updateInfo.data)
                }
              }
            }
            break
          case 'change':
            let id=updateInfo.data.id
            let item=updateInfo.data
            let task=taskMap.get(mkFullId(id,updateInfo.data.system))
            if(!task){
              console.warn('taskMap.get(id)==null')
            }else{
              task.originalName=item.originalName
              task.originalIcon=item.originalIcon
            }
            break
          case 'delete':
            taskMap.delete(mkFullId(updateInfo.data.id,updateInfo.data.system))
            // getListById('main')?.splice(getListById('main')?.findIndex(x=>x.id==updateInfo.data.id),1)
            break
        }
      }
      let removed=updateInfos.filter(x=>x.type=='delete').map(x=>x.data).map(x=>x.id)
      groups.value.forEach(tag=>{
        tag.tasks=tag.tasks.filter(originItem=>removed.includes(originItem.id)==false)
      })
      return '';// 返回undef不应该出发这么傻逼的报错
    })
        
      }
    },500)
});
async function onClickList(item:Task){
  currentItemClicked.value={type:'list',item}
  rpc.toTop(item.id,item.system)
  // await nnode.rpc('toTop',[item.id])
}
//tmd li:hover btn not effiect
let hoverState:Record<string,boolean>={}

function deleteItem(idx:number){
  if(currentTaskListShowing.value=='main'){
    return
  }
  const currentTaskList=groups.value.find(x=>x.id==currentTaskListShowing.value)
  currentTaskList?.tasks.splice(idx,1)
}


onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
let pin=computed(()=>{
  return config.pin
})
let allowRemote=computed(()=>{
  return config.allowRemote
})
const currentItemClicked:Ref<ItemProxy|null>=ref(null)
async function togglePin(){
  let pinValue=await rpc.pin(!pin.value)
  config.pin=pinValue 
}
async function toggleAllowRemote(){ 
  let allowRemoteValue=await rpc.setAllowRemote(!allowRemote.value)
  config.allowRemote=allowRemoteValue
}
async function collapse() {
  await rpc.collapse()
}
async function expand() {
  await rpc.expand()
}

const showModal = ref(false);
const editData = ref<editableGroup>({name:'',captureConditions:[]});
const onGroupCancel = () => { 
  if(editGroupReject){
    editGroupReject()
  }else{
    console.log("?")
  }
}
const onGroupSubmit = (data: editableGroup) => {
  if(editGtoupResolve){
    editGtoupResolve(data)
  }else{
    console.log("?")
  }
}
let editGtoupResolve:((g:editableGroup)=>void)|null=null;
let editGroupReject:(()=>void)|null=null;

// TextInput modal state
const showTextInput = ref(false);
const textInputProps = ref({ title: '', defaultValue: '', placeholder: '' });
let textInputResolve: ((value: string | null) => void) | null = null;
function textInput(title: string, defaultValue = '', placeholder = '请输入'): Promise<string | null> {
  textInputProps.value = { title, defaultValue, placeholder };
  showTextInput.value = true;
  return new Promise((resolve) => {
    textInputResolve = resolve;
  });
}
const onTextInputCancel = () => {
  if (textInputResolve) {
    textInputResolve(null);
    textInputResolve = null;
  }
  showTextInput.value = false;
};
const onTextInputSubmit = (value: string) => {
  if (textInputResolve) {
    textInputResolve(value);
    textInputResolve = null;
  }
  showTextInput.value = false;
};
async function editGroup(oldData?:editableGroup){
  if(oldData==null){
    oldData={
      name:'',
      captureConditions:[]
    }
  }
  editData.value=oldData
  showModal.value = true;
  let editGroupPromise:Promise<editableGroup>=new Promise((resolve,reject)=>{
    editGtoupResolve=resolve
    editGroupReject=reject
  })
  
  try{
    let result=await editGroupPromise;
    return result
  }catch(e){
    return null
  }finally{
    showModal.value=false;
  }
}
function refresh(){
  location.reload()
}
</script>

<template>
  <div class="component-container" :class="{ narrow: !isWideMode,'background':true }"  @drop.prevent="()=>{console.log('hhhh')}" v-if="ready">
    <!-- 第0行：按钮 -->
    <twin style="height: 30px;">
      <span>
        <text-button @click="collapse" :tooltip="'收回任务栏'"><</text-button>
        <text-button @click="refresh" :tooltip="'刷新'">刷</text-button>
        <text-button @click="togglePin" :tooltip="pin?'当前鼠标移出后任务栏不会自动收回':'当前鼠标移出后任务栏会自动收回'">{{ pin?'定':'动' }}</text-button>
        <text-button @click="toggleAllowRemote" :tooltip="allowRemote?'当前允许远程控制':'当前不允许远程控制'">{{ allowRemote?'远':'关' }}</text-button>
        <text-button @click="switchGlobalSearchQuery" :tooltip="globalQuery?'当前任务栏共用一个搜索条件':'当前每个任务栏使用独立的搜索条件'">{{ globalQuery?'共':'单' }}</text-button>
        <text-button @click="switchShouldTrim" :tooltip="shouldTrim?'当前搜索会去掉首尾空格':'当前搜索不会去掉首尾空格'">{{ shouldTrim?'修':'留' }}</text-button>
        <text-button @click="switchNightMode" :tooltip="{light:'当前是亮色主题',dark:'当前是暗色主题',system:'主题当前跟随系统'}[config.nightMode]">{{ {light:'日',dark:'夜',system:'随'}[config.nightMode] }}</text-button>
        <text-button @click="switchAddToCurrentGroup" :tooltip="config.addToCurrentGroup?'当前会追加到当前目录':'当前不追加到当前目录'">{{ config.addToCurrentGroup?'追':'无' }}</text-button>

        <text-button @click="saveStatus" :tooltip="'保存当前配置'">{{ saveFinSign }}</text-button>
      </span>

      <text-button @click="exit" v-if="isWideMode">x</text-button>
    </twin>

    <!-- 第1行：标签 -->
    <div class="row tags-row" style="height:30px">
      <div v-if="isWideMode" class="scrollable-tags">
        <span @click="addTaskList">+</span>
        <span
          v-for="tag in groups"
          :key="tag.id"
          :class="{ active: tag.id === currentTaskListShowing }"
          @click="onTagClick(tag)"
          draggable="true"
          @dragstart="onDragTag($event, tag)"
          @drop="onDropTag($event, tag)"
          @dragover="onDropTagOver($event,tag)"
        >{{ tag.name }}</span>
      </div>
      <div v-else class="current-tag">
        {{ currentTaskListShowing }}
      </div>
    </div>

    <!-- 第2行：搜索框 -->
    <div class="row search-box" style="height: 30px;">
      <div class="input-wrapper" v-if="isWideMode">
        <input
          type="text"
          placeholder="Filter..."
          v-model="queryCursor!.searchQuery"
        />
        <span 
          v-if="queryCursor?.searchQuery"
          class="clear-button"
          @click="queryCursor!.searchQuery=''" >×</span>
      </div>
    </div>

    <!-- 第3行：列表 -->
    <div class="row list-container" style="flex:1;display: flex;overflow-x: hidden;overflow-y: auto;" ref="scrollContainer">
      <ul class="item-list" :class="{ wide: isWideMode }" style="padding:0;flex:1" @dragover.prevent @drop="onDropListGap">
        <li
          :class="{current: taskEqual(currentItemClicked?.item as Task,item)}"
          v-for="item,idx in currentTaskListToShow"
          :key="mkFullId(item.id,item.system)"
          @mouseenter="()=>hoverState[item.id]=true"
          @mouseleave="()=>hoverState[item.id]=false"
          draggable="true"
          @click="onClickList(item)"
          @dragstart="onDragList($event, item)"
          @drop="onDropList($event, item)"
          @contextmenu.prevent="onRightClick(item,$event)"
          @dragover="onDropListOver($event, item)"
          style="width: 100%;"
          :data-item-id="item.id"
        >
        <twin style="width: 100%; gap: 8px; align-items: center;">
          <img v-if="isWideMode" :src="item.modifiedIcon || item.originalIcon" alt="" style="width: 24px;height: 24px;flex-shrink: 0;" />
          <span :title="item.processName" v-if="isWideMode" style="flex: 1;text-overflow: ellipsis;text-align: left; word-wrap: break-word; overflow: hidden;height:28px;width:1px">{{ item.modifiedName || item.originalName }}</span>
          <text-button  v-show="isWideMode && currentTaskListShowing!=='main'"  :class="{'delete-btn':!hoverState[item.id]}" @click.stop="deleteItem(idx)">x</text-button>
        </twin>
        </li>
      </ul>
    </div>
    <EditGroup 
      v-if="showModal"
      :initial-data="editData"
      @cancel="onGroupCancel"
      @submit="onGroupSubmit"
    />
    <TextInput
      v-if="showTextInput"
      :title="textInputProps.title"
      :default-value="textInputProps.defaultValue"
      :placeholder="textInputProps.placeholder"
      @cancel="onTextInputCancel"
      @submit="onTextInputSubmit"
    />
    <ConfirmDialog
      v-if="showConfirmDialog"
      :title="confirmDialogProps.title"
      @cancel="onConfirmCancel"
      @submit="onConfirmSubmit"
    />
  </div>
</template>

<style scoped>
.component-container {
  margin: 0 auto;
  width: 300px;
  height: 95vh;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  border: 0px solid #ccc;
  padding: 10px;
}

.component-container.narrow {
  width: 50px;
}

.row {
  margin-bottom: 10px;
}

.scrollable-tags {
  display: flex;
  overflow-x: auto;
}

.scrollable-tags span {
  cursor: pointer;
  margin-right: 10px;
}

.scrollable-tags .active {
  font-weight: bold;
}

.item-list.wide {
  display: flex;
  width: 100%;
  flex-direction: column;
  border-radius: 5px;
  gap: 4px;
}

.item-list li {
  display: flex;
  align-items: center;
  height:34px;
  justify-content: space-between;
  cursor: default;
  padding: 1px 8px;
  margin: 0;
  border-radius: 8px;
  box-sizing: border-box;
}

.item-list.wide li {
  cursor: pointer;
}

.delete-btn {
  visibility: hidden;
}

.item-list li:hover .delete-btn {
  display: inline-block;
  visibility: visible;
}
.item-list li:hover {
  background-color: var(--highlight-color);
}
.current{
  background-color: var(--highlight-color);
}

.list-container img {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  object-fit: contain;
}
.background{
  background-color: var(--background-color);
  color:var(--text-color);
}
.input-wrapper {
  position: relative;
  width: 300px;
  height: 100%;
}

.input-wrapper input {
  width: 100%;
  height: 100%;
  padding: 0 24px 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-color);
  color: var(--text-color);
  font-size: 13px;
  box-sizing: border-box;
  outline: none;
}

/* .input-wrapper input:focus {
  border-color: #409eff;
} */

.clear-button {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color);
  opacity: 0;
  /* line-height: 1; */
  padding: 2px;
  /* transition: opacity 0.2s; */
  pointer-events: none;
}

.clear-button:hover {
  opacity: 1;
}

.input-wrapper:hover .clear-button,
.input-wrapper input:focus + .clear-button {
  opacity: 1;
  pointer-events: auto;
}
</style>