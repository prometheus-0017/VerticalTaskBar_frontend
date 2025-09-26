<script setup lang="ts">
import { ref, computed } from 'vue';
import TextButton from './components/TextButton.vue';
import Twin from './components/Twin.vue';
import nnode from './nnode.js';
import {getId} from './nnode.js'
import type { Ref } from 'vue';
import { type MessageReceiverOptions,PlainProxyManager,RunnableProxyManager,MessageReceiver,Client,asProxy,getMessageReceiver,setHostId,type ISender } from 'xuri-rpc'
import { WebSocketConnectionKeeper,WebSocketSender } from 'xuri-rpc'


let client=new Client()
let sender=new WebSocketSender(new WebSocketConnectionKeeper(window.location.hostname,18765,'/',client))
client.setSender(sender)
let rpc:any=null
async function prepareRpc(){
  rpc=await client.getObject('rpc')
}

let shouldTrim=ref(false)
function switchShouldTrim(){
  shouldTrim.value=!shouldTrim.value
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

// 数据模型
interface Task {
  id: number;
  processName: string;
  originalName: string;
  modifiedName?: string;
  originalIcon: string;
  modifiedIcon?: string;
}

interface TaskList {
  id: string;
  name: string;
  searchQuery: string;
  tasks: Task[];
}

const taskLists = ref<TaskList[]>([])

// 主标签和 raw 标签是隐藏的，但 mainItems 包含所有项目
// const mainItems = computed<Item[]>(() => {
//   return taskLists.value.flatMap(tag => tag.tasks);
// });
function getListById(tagId:string){

  const taskList = taskLists.value.find(t => t.id === tagId);
  if(taskList==null){
    return null
  }
  let res=taskList.tasks
  return res
}
const currentTaskList=computed(() => {
  return taskLists.value.find(t => t.id === currentTaskListShowing.value);
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

// 点击标签切换
function onTagClick(tag: TaskList) {
  currentItemClicked.value={type:'tag',item:tag}
  currentTaskListShowing.value = tag.id;
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
async function setTagName(item:TaskList) {
    let name=await prompt('请输入新名称', item.name)
    if(name===null){
      return
    }
    item.name=name;
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
    
    const idx=taskLists.value.findIndex(item=>item.id==currentTaskListShowing.value)
    if(idx===-1){
      throw new Error('未找到任务列表')
    }
    const list=taskLists.value
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
      setTagName(currentItemClicked.value.item as TaskList)
    }
    
  }
}
interface ItemProxy{
  item:Task|TaskList
  type:'list'|'tag'
}
let itemDragging:ItemProxy| null=null
// 拖拽逻辑（简化示例）
function onDragList(_event: DragEvent, item: Task) {
  itemDragging ={type:'list',item} 
  // event.dataTransfer?.setData('text/plain', JSON.stringify(item));
}
function onDragTag(_event: DragEvent, item: TaskList) {
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

function onDropTag(event: DragEvent, tag:TaskList){
  if(itemDragging==null){
    return
  }
  if(itemDragging.type=='tag'){
    let oldIndex=taskLists.value.findIndex(item=>item==itemDragging?.item)
    const idxTo=taskLists.value.findIndex(item=>item==tag)
    taskLists.value[oldIndex]=null
    taskLists.value.splice(idxTo,0,itemDragging.item as TaskList);
    oldIndex=taskLists.value.findIndex(item=>item==null)
    taskLists.value.splice(oldIndex,1);

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
let mainTaskMap=new Map()
async function sleep(ms:number){
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}
async function refreshLoop(){ 
    while(true){
      try{
        await refresh()
        await sleep(500)
      }catch(e){
        console.log(e)
      }
    }
}
let version=0
async function  refresh() {
  // let res=await nnode.rpc('queryHasUpdate',[version])
  // if(res.data==false){
  //   return;
  // }
  // version=res.data
  version=await rpc.queryHasUpdate(version)
  let windowsList=await rpc.queryList()
  // nnode.rpc('queryList',[])
  const newTaskMap=new Map()
  for (let item of windowsList){
    newTaskMap.set(item.id,item)
  }
  
  const removed=new Map()
  for (let [id,item] of mainTaskMap){
    if(!newTaskMap.has(id)){
      removed.set(id,item)
    }
  }

  for (let [id,item] of newTaskMap){
    if(mainTaskMap.has(id)){
      mainTaskMap.get(id).originalName=item.originalName
      mainTaskMap.get(id).originalIcon=item.originalIcon
    }
  }

  const added=[]
  for (let [id,item] of newTaskMap){
    if(!mainTaskMap.has(id)){
      added.push(item)
    }
  }

  for(let [_id,item] of removed){
    mainTaskMap.delete(item.id)
  }
  taskLists.value.forEach(tag=>{
      tag.tasks=tag.tasks.filter(originItem=>removed.has(originItem.id)==false)
  })

  for (let item of added){
    mainTaskMap.set(item.id,item)
    getListById('main')?.push(item)
  }
  console.log(mainTaskMap)

}
function addTaskList(){
  prompt('请输入标签名称', '').then(async name => {
    if (name === null) {
      return;
    }
    if (name.trim() === '') {
      return;
    }
    taskLists.value.push({id:getId(),name,tasks:[],searchQuery:''})
  })
}
let globalQueryCursor:TaskList={
  id:'',
  name:'',
  tasks:[],
  searchQuery:''
}
let globalQuery:Ref<boolean>=ref(false)
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
  globalQuery.value=!globalQuery.value
}

function onDropListOver(event,item:Task){
  event.preventDefault();
  if(event.dataTransfer.types.includes('Files')){
    // nnode.rpc('toTop',[item.id])
    rpc.toTop(item.id)
  }
}
function onDropTagOver(event,item:TaskList){
  event.preventDefault()
  if(event.dataTransfer.types.includes('Files')){
    onTagClick(item)
  }
}
let ready:Ref<boolean>=ref(false)
onMounted(async () => {
  await prepareRpc()
  // let res=await nnode.rpc('queryList',[])
  let windowList=await rpc.queryList()
  taskLists.value.push({id:'main',name:'main',tasks:windowList,searchQuery:''})
  mainTaskMap = new Map(windowList.map((item:Task) => [item.id, item]))
  ready.value=true

  setInterval(refresh,500)

  window.addEventListener('keydown', handleKeyDown);
});
async function onClickList(item){
  currentItemClicked.value={type:'list',item}
  rpc.toTop(item.id)
  // await nnode.rpc('toTop',[item.id])
}

function deleteItem(idx:number){
  if(currentTaskListShowing.value=='main'){
    return
  }
  const currentTaskList=taskLists.value.find(x=>x.id==currentTaskListShowing.value)
  currentTaskList?.tasks.splice(idx,1)
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
let pin:Ref<boolean>=ref(false)
const currentItemClicked:Ref<ItemProxy|null>=ref(null)
async function togglePin(){
  let pinValue=await rpc.pin(!pin.value)
  // let res=await nnode.rpc('pin',[!pin.value])
  pin.value=pinValue
}
async function collapse() {
  await rpc.collapse()
// 
  // await nnode.rpc('collapse',[])
}
async function expand() {
  await rpc.expand()
  // await nnode.rpc('expand',[])
}
</script>

<template>
  <div class="component-container" :class="{ narrow: !isWideMode }"  @drop.prevent="()=>{console.log('hhhh')}" v-if="ready">
    <!-- 第0行：按钮 -->
    <twin style="height: 30px;">
      <span>
        <text-button @click="collapse" :tooltip="'收回任务栏'"><</text-button>
        <text-button @click="togglePin" :tooltip="pin?'当前鼠标移出后任务栏不会自动收回':'当前鼠标移出后任务栏会自动收回'">{{ pin?'定':'动' }}</text-button>
        <text-button @click="switchGlobalSearchQuery" :tooltip="globalQuery?'当前任务栏共用一个搜索条件':'当前每个任务栏使用独立的搜索条件'">{{ globalQuery?'共':'单' }}</text-button>
        <text-button @click="switchShouldTrim" :tooltip="shouldTrim?'当前搜索会去掉首尾空格':'当前搜索不会去掉首尾空格'">{{ shouldTrim?'修':'留' }}</text-button>
      </span>

      <text-button @click="exit" v-if="isWideMode">x</text-button>
    </twin>

    <!-- 第1行：标签 -->
    <div class="row tags-row" style="height:30px">
      <div v-if="isWideMode" class="scrollable-tags">
        <span @click="addTaskList">+</span>
        <span
          v-for="tag in taskLists"
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
      <input
      style="width: 300px;"
        v-if="isWideMode"
        type="text"
        placeholder="Filter..."
        v-model="queryCursor!.searchQuery"
      />
    </div>

    <!-- 第3行：列表 -->
    <div class="row list-container" style="flex:1;display: flex;overflow: auto;">
      <ul class="item-list" :class="{ wide: isWideMode }" style="padding:0;flex:1">
        <li
          :class="{current: currentItemClicked?.item===item}"
          v-for="item,idx in currentTaskListToShow"
          :key="item.id"
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
          <text-button  v-if="isWideMode && currentTaskListShowing!=='main'"  class="delete-btn" @click.stop="deleteItem(idx)">x</text-button>
        </twin>
        </li>
      </ul>
    </div>
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
</style>