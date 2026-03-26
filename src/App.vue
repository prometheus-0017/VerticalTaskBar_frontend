<script setup lang="ts">
import { ref, computed, nextTick, reactive } from 'vue';
import TextButton from './components/TextButton.vue';
import Twin from './components/Twin.vue';
import nnode from './nnode.js';
import {getId} from './nnode.js'
import type { Ref } from 'vue';
import { type MessageReceiverOptions,PlainProxyManager,RunnableProxyManager,MessageReceiver,Client,asProxy,getMessageReceiver,setHostId,type ISender, type Message } from 'xuri-rpc'
import { WebSocketConnectionKeeper,WebSocketSender } from 'xuri-rpc'
import { config } from './components/config'

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
  if(config.nightMode){
    config.nightMode=false
  }else{
    config.nightMode=true
  }
}

function confirm(message: string): Promise<boolean> {

  return new Promise((resolve) => {
    const result = window.confirm(message);
    resolve(result);
  });
}
function prompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const result = window.prompt(message, defaultValue);
    resolve(result);
  });
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
const currentTaskList=computed(() => {
  return groups.value.find(t => t.id === currentTaskListShowing.value);
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
function toggleWidth() {
  isWideMode.value = !isWideMode.value;
  if(isWideMode.value){
    document.body.style.width='300px';
  }else{
    document.body.style.width='50px';
  }
}
function next(){
  return new Promise(resolve=>{
    nextTick(()=>resolve(null))
  })
}
let scrollContainer=ref<HTMLElement>(null);
// 点击标签切换
async function onTagClick(tag: Group) {
  let scroll=scrollContainer.value?.scrollTop
  currentTaskList.value.scrollStatus=scroll
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
async function onItemDelete(item: Task) {
  if(currentTaskListShowing.value=='main'){
    return
  }
  const confirmed = await confirm(`确定删除 ${item.modifiedName || item.originalName}?`);
  if (confirmed) {
    const taskList = getListById(currentTaskListShowing.value)
    if (taskList) {
      taskList.tasks = taskList.tasks.filter(i => i.id !== item.id);
    }
  }
}
import {onMounted, onBeforeUnmount}from 'vue';
import EditGroup from './components/editGroup.vue';
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
  const taskList:Array<Task>=getListById(currentTaskListShowing.value) as Array<Task>;
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
    const idx=list.findIndex(item=>item==itemDragging?.item)

    if(idx!==-1){
      itemDragging=null
      return 
    }

    list.push(itemDragging.item as Task)
    itemDragging=null

    return
  }

}
let taskMap=new Map()
async function sleep(ms:number){
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}
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
let version=0

interface WindowProxyDTO{
  processId:number
  id:number
  originalName:string
  modifiedName:string
  processName:string
  originalIcon:string
  modifiedIcon:string
}
interface WindowChangeInfo{
  type:'add'|'change'|'delete'
  data:WindowProxyDTO
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
    groups.value.push({id:getId(),name,tasks:[],searchQuery:''})
  })
}
let globalQueryCursor:Group={
  id:'',
  name:'',
  tasks:[],
  searchQuery:''
}
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

function onDropListOver(event,item:Task){
  event.preventDefault();
  if(event.dataTransfer.types.includes('Files')){
    // nnode.rpc('toTop',[item.id])
    rpc.toTop(item.id,item.system)
  }
}
function onDropTagOver(event,item:Group){
  event.preventDefault()
  if(event.dataTransfer.types.includes('Files')){
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
    groups.value.push({id:'main',name:'main',tasks:windowList,searchQuery:''})
    taskMap = new Map(windowList.map((item:Task) => [item.id, item]))
  }else{
    const initMainCopy=(initData.taskLists as Group[]).filter(x=>x.id=='main')[0].tasks.concat([]);
    groups.value=initData.taskLists
    Object.assign(config,initData.config)
    let windowList=getListById('main')
    taskMap = new Map(windowList!.map((item:Task) => [item.id, item]))
    let syncData=await rpc.sync()
    let vis=new Map()
    for(let item of syncData){
      let id=item.id
      let localItem=taskMap.get(id)
      if(!localItem){
        taskMap.set(item.id,item)
        getListById('main')!.push(item)
      }else{
        taskMap.get(id).originalName=item.originalName
        taskMap.get(id).originalIcon=item.originalIcon
        // 先这么办但是我觉得不适这么给事情，chrome 插件重启systemid会变化，结果这里还没有判system按道理task的id应该就足够是唯一的但是totop机制又让id从外部生成可能后续接入的system应该改这个id来源
        taskMap.get(id).system=item.system
        vis.set(id,true)
      }
    }
    let removed=[];
    for(let item of initMainCopy){
      let id=item.id
      if(!vis.has(id)){
        taskMap.delete(id)
        removed.push(item.id)
      }
    }
    groups.value.forEach(tag=>{
      tag.tasks=tag.tasks.filter(originItem=>removed.includes(originItem.id)==false)
    })

    await rpc.pin(config.pin)
  }
  ready.value=true

  await rpc.setCallback(asProxy((updateInfos:Array<WindowChangeInfo>)=>{
    for(let updateInfo of updateInfos){
      switch(updateInfo.type){
        case 'add':
          taskMap.set(updateInfo.data.id,updateInfo.data)
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
          break
        case 'change':
          let id=updateInfo.data.id
          let item=updateInfo.data
          taskMap.get(id).originalName=item.originalName
          taskMap.get(id).originalIcon=item.originalIcon
          break
        case 'delete':
          taskMap.delete(updateInfo.data.id)
          // getListById('main')?.splice(getListById('main')?.findIndex(x=>x.id==updateInfo.data.id),1)
          break
      }
    }
    let removed=updateInfos.filter(x=>x.type=='delete').map(x=>x.data).map(x=>x.id)
    groups.value.forEach(tag=>{
      tag.tasks=tag.tasks.filter(originItem=>removed.includes(originItem.id)==false)
    })
    return '';// 返回undef不应该出发这么傻逼的报错
  }))

  // setInterval(refresh,500)

  window.addEventListener('keydown', handleKeyDown);
  setInterval(()=>{
    rpc.echo()
  },500)
});
async function onClickList(item){
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
const currentItemClicked:Ref<ItemProxy|null>=ref(null)
async function togglePin(){
  let pinValue=await rpc.pin(!pin.value)
  config.pin=pinValue 
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
</script>

<template>
  <div class="component-container" :class="{ narrow: !isWideMode,'background-night':config.nightMode,'background':!config.nightMode }"  @drop.prevent="()=>{console.log('hhhh')}" v-if="ready">
    <!-- 第0行：按钮 -->
    <twin style="height: 30px;">
      <span>
        <text-button @click="collapse" :tooltip="'收回任务栏'"><</text-button>
        <text-button @click="togglePin" :tooltip="pin?'当前鼠标移出后任务栏不会自动收回':'当前鼠标移出后任务栏会自动收回'">{{ pin?'定':'动' }}</text-button>
        <text-button @click="switchGlobalSearchQuery" :tooltip="globalQuery?'当前任务栏共用一个搜索条件':'当前每个任务栏使用独立的搜索条件'">{{ globalQuery?'共':'单' }}</text-button>
        <text-button @click="switchShouldTrim" :tooltip="shouldTrim?'当前搜索会去掉首尾空格':'当前搜索不会去掉首尾空格'">{{ shouldTrim?'修':'留' }}</text-button>
        <text-button @click="switchBtnColor" :tooltip="config.buttonColor=='green'?'当前按钮是绿色的':'当前按钮是蓝色的'">{{ config.buttonColor=='green'?'绿':'蓝' }}</text-button>
        <text-button @click="switchNightMode" :tooltip="!config.nightMode?'当前是亮色主题':'当前是暗色主题'">{{ !config.nightMode?'日':'夜' }}</text-button>
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
      <div style="width: 100%;height: 100%;position: relative;padding: 0;margin: 0;">
        <input
        style="width: 300px;"
          v-if="isWideMode"
          type="text"
          placeholder="Filter..."
          v-model="queryCursor!.searchQuery"
        />
        <span 
          class="small-button"
          @click="queryCursor!.searchQuery=''" > x </span>
      </div>
    </div>

    <!-- 第3行：列表 -->
    <div class="row list-container" style="flex:1;display: flex;overflow: auto;" ref="scrollContainer">
      <ul class="item-list" :class="{ wide: isWideMode }" style="padding:0;flex:1">
        <li
          :class="{current: currentItemClicked?.item===item}"
          v-for="item,idx in currentTaskListToShow"
          :key="item.id"
          @mouseenter="()=>hoverState[item.id]=true"
          @mouseleave="()=>hoverState[item.id]=false"
          draggable="true"
          @click="onClickList(item)"
          @dragstart="onDragList($event, item)"
          @drop="onDropList($event, item)"
          @contextmenu.prevent="setTaskName(item)"
          @dragover="onDropListOver($event, item)"
          style="width: 100%;"
          :data-item-id="item.id"
        >
        <twin style="width: 100%;">
          <span style="display: flex;flex:1">
            <img :src="item.modifiedIcon || item.originalIcon" alt="" style="width: 32px;height: 32px;" />
            <span :title="item.processName" v-if="isWideMode" style="flex: 1;text-overflow: ellipsis;text-align: left; word-wrap: break-word; overflow: hidden;height:28px;width:1px">{{ item.modifiedName || item.originalName }}</span>
          </span>
          <text-button  v-if="isWideMode && currentTaskListShowing!=='main'"  :class="{'delete-btn':!hoverState[item.id]}" @click.stop="deleteItem(idx)">x</text-button>
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
  border: 1px solid #ccc;
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
}

.item-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.delete-btn {
  visibility: hidden;
}

.item-list li:hover .delete-btn {
  display: inline-block;
  visibility: visible;
}
 
.current{
  background-color: rgb(199, 199, 199);
}
.list-container img {
  width: 20px;
  height: 20px;
}
.background{
  background-color: rgb(255, 255, 255);
  color:black;
}
.background-night{
  background-color: rgb(0, 0, 0);
  color:grey;
}
.small-button{
  display: none;
  position: absolute;
  right: 2px;
}
.small-button:hover{
  display: block;
}
</style>