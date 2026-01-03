import axios from 'axios'
function hostname(){
    return window.location.hostname
}
const domain=hostname()+':7499'

let url=`ws://${hostname()}:18765`
let socket = new WebSocket(url);
let execMessageHandlers={}
export function addExecMessageHandler(id,handler){ 
    execMessageHandlers[id]=handler
}
export function removeExecMessageHandler(id){ 
    delete execMessageHandlers[id]
}
let lastTryTime=0
async function getSocket(){

    if(socket!=null && socket.readyState==WebSocket.OPEN){
        return socket
    }

    while(socket.readyState!=WebSocket.OPEN){
        if(socket.readyState==WebSocket.CLOSED){
            //如果上一次尝试在30秒之前，允许重新尝试
            if(Date.now()-lastTryTime<30000){
                tryCount=0;
            }
           if(tryCount<3){
            socket=new WebSocket(url)
            tryCount++
            lastTimeTried=Date.now()
           }else{
            throw  "socket is disconnected";
           }
        }
        await wait();
    }

    socket.onopen = function() {
        console.log('hello')
    };
    socket.onmessage = function(event) {
        let data=event.data;
        let obj=JSON.parse(data);
        if(obj.cmdName){
            if(remoteCmdSet[obj.cmdName]!=undefined){
                remoteCmdSet[obj.cmdName](... obj.argList)
            }
            return
        }
        if(obj.meta){
            let type=obj.meta.type
            if(type=='execMessage'){
                let data=obj.data;
                let nodeId=data.id;
                execMessageHandlers[nodeId](data)
            }
        }
        let id_for=obj.id_for;
        if(reqPending[id_for]==undefined){
            return
        }
        let req=reqPending[id_for];
        delete reqPending[id_for];
        if(obj.status=="success"){
            obj.data=JSON.parse(obj.data)
            req.resolve(obj);
        }else{
            req.reject(obj);
        }
    };
    socket.onclose = function(event) {
    };
    socket.onerror = function(event) {
        console.log(event);
    };
    
    return socket;
}

async function wait(){
    await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), 500)
    });
}
let tryCount=0;
let lastTimeTried=0;
async function sureSend(data){
    let socket=await getSocket()
    socket.send(data)
}

let remoteCmdSet={}
function setRemoteCmd(cmdName,func){
    if(remoteCmdSet[cmdName]!=undefined){
        throw "cmdName is already set"
    }
    remoteCmdSet[cmdName]=func
}
function removeRemoteCmd(cmdName){
    delete remoteCmdSet[cmdName]
}

// import { getId } from './components/node';
let idCOunt=new Date().getTime();
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
export function getId(){
    return generateUUID()
    // return ''+(idCOunt++)
}
let reqPending={}
async function request(path,data){
    let id=getId()
    let req={
        id:id,
        data:data,
        app:path
    }
    let promise=new Promise((resolve,reject)=>{
        reqPending[id]={
            req:req,
            resolve:resolve,
            reject:reject
        }
        sureSend(JSON.stringify(req))
    })
    return await promise
}


export default {
    async ls(nodeId){
        return axios.post('http://'+domain+'/nnode/ls',{id:nodeId})
    },
    async rpc(func,args){
        return request('rpc',{
            func:func,
            args:args
        })
        // return axios.post('http://'+domain+'/nnode/rpc',{func:func,args:args})
    },
    async batchRpc(funcArgList){
        return request('batchRpc',{
            funcArgList:funcArgList
        })
        // return axios.post('http://'+domain+'/nnode/batchRpc',{funcArgList:funcArgList})
    }
    ,
    async setName(name){
        return request('setName',{
            name:name
        })
    },
    async remoteExec(name,cmdName,argList){
        debugger
        return request('remoteExec',{
            cmdName:cmdName,
            name:name,
            argList:argList
        })
    },setRemoteCmd,
    removeRemoteCmd
}