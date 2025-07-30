type ArgObjType='proxy'|'data'|null
class ArgObj{
    constructor(type:ArgObjType,data:object){
        this.type=type
        this.data=data
    }

    type:ArgObjType
    data:object
}
interface PlainProxy{
    id:string,
    hostId:string,
    members:Array<{type:'function'|'property',name:string}>
}
let hostId:string|null=null
export function setHostId(id:string){
    hostId=id
}
interface Message{
    id:string,
    idFor?:string,
    objectId:string,
    method:string,
    args:Array<ArgObj>,
    status?:number,
    trace?:string,
    data?:ArgObj
}
interface RunnableProxy{

}
class RunnableProxyManager{
    
    map:Map<string,WeakRef<RunnableProxy>>
    constructor(){
        this.map=new Map<string,WeakRef<RunnableProxy>>()
    }
    set(id:string,proxy:RunnableProxy){
        this.map.set(id,new WeakRef(proxy))
    }
    get(id:string){
        if(!this.map.has(id)){
            return null
        }
        let result=this.map.get(id).deref()
        if(result==null){
            this.map.delete(id)
            return null
        }
        return result
    }
}
let runnableProxyManager=new RunnableProxyManager()
class PlainProxyManager{
    proxyMap:Map<any,string> = new Map<any,string>()
    reverseProxyMap:Map<string,any> = new Map<string,any>()
    set(obj:object,id:string){
        this.proxyMap.set(obj,id)
        this.reverseProxyMap.set(id,obj)
    }
    getById(id:string){
        return this.reverseProxyMap.get(id)
    }
    get(obj:object):string{
        return this.proxyMap.get(obj) as string
    }
    has(obj:object):boolean{
        return this.proxyMap.has(obj)
    }
    delete(obj:object){ 
        this.reverseProxyMap.delete(this.proxyMap.get(obj) as string)
        this.proxyMap.delete(obj)
    }
}
let proxyManager=new PlainProxyManager()
export function asProxy(obj:object):ArgObj{
    if(! proxyManager.has(obj)){
        let id=getId()
        proxyManager.set(obj,id)
    }
    let id=proxyManager.get(obj) as string
    // if obj is a function
    let proxy=null
    if(typeof obj=='function'){
        proxy={
            id,
            hostId:hostId as string,
            members:[{type:'function',name:'__call__'}]
        }
    }else{
        proxy = {
            id,
            hostId:hostId as string,
            members:Object
                .keys(obj)
                .filter(k=>((typeof obj[k])=='function'))
                .map(k=>({name:k,type:'function'}))}
    }
    return new ArgObj('proxy',proxy)
}
export class Client{
    sender?:ISender;
    argsAutoWrapper:AutoWrapper=shallowAutoWrapper
    setArgsAutoWrapper(autoWrapper:AutoWrapper){
        this.argsAutoWrapper=autoWrapper
    }

    constructor(){

    }
    setSender(sender:ISender){
        if(this.sender!=null){
            throw new Error('sender already set')
        }
        this.sender=sender
    }
    async waitForRequest(request:Message){
        const sender=this.sender
        return new Promise((resolve,reject)=>{
            getMessageReceiver().putAwait(request.id,resolve,reject)
            if(sender==null){
                throw new Error('sender not set')
            }
            sender?.send(request)
        });

    }
    toArgObj(obj:any):ArgObj{
        if(obj instanceof ArgObj){
            return obj
        }else {
            return new ArgObj('data',obj)
        }
    }
    reverseToArgObj(argObj:ArgObj):any{
        if(argObj.type=='data'){
            return argObj.data
        }else{
            let result:Record<string,any>={}
            let data:PlainProxy=argObj.data as PlainProxy

            if(data.hostId==hostId){
                return proxyManager.getById(data.id)
            }

            let object=runnableProxyManager.get(data.id)
            if(object!=null){
                return object
            }
            for(let member of data.members){
                const key=member.type
                if(key=='property'){
                    console.warn('not implemented')
                }else if (key=='function'){
                    result[member.name]=async (...args:any[])=>{ 
                        let argsTransformed=args.map(x=>this.argsAutoWrapper(x)).map(arg=>{ 
                            return this.toArgObj(arg)
                        })
                        let request:Message={
                            objectId:data.id,
                            id:getId(),
                            method:member.name,
                            args:argsTransformed
                        }
                        let res:Message=await this.waitForRequest(request) as Message
                        if(res.status===200){
                            return this.reverseToArgObj(res.data)
                        }else{
                            throw new Error(res.trace)
                        }
                    }
                }else{
                    throw new Error('no such function')
                } 
            }
            runnableProxyManager.set(data.id,result)
            return result
        }
    }
    async getMain(){
        let request:Message={
            id:getId(),
            objectId:'main0',
            method:'getMain',
            args:[]
        }
        let res:RunnableProxy= await this.waitForRequest(request) as Message
        return res;
    }
}
let messageReceiver:MessageReceiver|null;
export function getMessageReceiver(){
    if(messageReceiver==null){
        messageReceiver=new MessageReceiver();
    }
    return messageReceiver;
}
type RpcContext=Record<string,any>
type NextGenerator=()=>NextFunction
type Interceptor=(context:RpcContext,message:Message,client:Client,nextGenerator:NextGenerator)=>any;
type NextFunction=()=>any;
type AutoWrapper=(any)=>any
const shallowAutoWrapper:AutoWrapper=(obj)=>{
    if(typeof obj=='function'){
        return asProxy(obj)
    }else if(Array.isArray(obj)){
        let notPureData=false
        for(let item of obj){
            if(typeof item=='function'){
                notPureData=true
                break
            }
        }
        if(notPureData){
            return asProxy(obj)
        }else{
            return obj
        }
    }else if(typeof obj=='object'){
        let notPureData=false
        for(let key of Object.keys(obj)){
            if(typeof obj[key]=='function'){
                notPureData=true
                break
            }
        }
        if(notPureData){
            return asProxy(obj)
        }else{
            return obj
        }
    }else{
        return obj
    }
}
class MessageReceiver{
    reqPending:{[id:string]:{resolve:(result:any)=>void,reject:(error:any)=>void}}={}
    rpcServer?:Record<string,Function>
    interceptors:Interceptor[]=[]
    objectWithContext:Set<string>=new Set()
    resultAutoWrapper:AutoWrapper=shallowAutoWrapper
    setResultAutoWrapper(autoWrapper:AutoWrapper){
        this.resultAutoWrapper=autoWrapper
    }
    async withContext(message:Message,client:Client,args:any[],func:Function):any{
        let constThis=this
        const context:RpcContext={}
        let result:any={}
        function generateNext(id:number):NextFunction{
            if(id<constThis.interceptors.length){
                async function next(){
                    let interceptor=await constThis.interceptors[id]
                    interceptor(context,message,client,()=>generateNext(id+1))
                }
                return next
            }else{
                const next=async ()=>{
                    result.value=await func(context,...args)
                }
                return next
            }
        }
        let ansycNextFunction=generateNext(0)
        await ansycNextFunction()
        return result.value
    }
    constructor(){
        this.objectWithContext=new Set()
        proxyManager.set({'getMain':()=>{
            return asProxy(proxyManager.getById('main'))
        }},'main0')
    }
    setMain(obj:Record<string,Function>){
        this.rpcServer=obj
        this.setObject('main',this.rpcServer,false)
    }
    setObject(id:string,obj:Record<string,Function>,withContext:boolean){
        proxyManager.set(obj,id)
        if(withContext){
            this.objectWithContext.add(id)
        }
    }
    addInterceptor(interceptor:Interceptor){
        this.interceptors.push(interceptor)
    }
    putAwait(id:string,resolve:any,reject:any){
        this.reqPending[id]={resolve,reject}
    }
    onReceiveMessage(message:Message,client:Client){
        let id_for=message.idFor;
        if(id_for==null){
            if(this.rpcServer!=null){
                let args=message.args.map(x=>client.reverseToArgObj(x))
                try{
                    let object=proxyManager.getById(message.objectId)
                    let result=null
                    const shouldWithContext=this.objectWithContext.has(message.objectId)
                    if(message.method=='__call__'){
                        if(shouldWithContext){
                            result=this.withContext(message,client,args,object)
                        }else{
                            result=object(...args)
                        }
                    }else{
                        if(shouldWithContext){
                            result=this.withContext(message,client,args,object[message.method])
                        }else{
                            result=object[message.method](...args)
                        }
                    }
                    result=this.resultAutoWrapper(result)
                    let wrappedResult:ArgObj=client.toArgObj(result)
                    client.sender.send({
                        id:getId(),
                        objectId:'',
                        method:'',
                        args:[],
                        idFor:message.id,
                        data:wrappedResult,
                        status:200
                    })
                }catch(e){
                    let exception=e as Error
                    let trace=exception.stack
                    let traceStr=trace?.split('\n').map(x=>x.trim()).join('\n')
                    client.sender.send({
                        id:getId(),
                        objectId:'',
                        method:'',
                        args:[],
                        idFor:message.id,
                        data:'',
                        trace:traceStr,
                        status:-1
                    })
                    console.error(e)

                }
            }
            
        }else{
            const reqPending=this.reqPending;
            if(reqPending[id_for]==undefined){
                return
            }
            let req=reqPending[id_for];
            delete reqPending[id_for];
            if(message.status==200){
                req.resolve(client.reverseToArgObj(message.data))
            }else{
                req.reject(message);
            }
            
        }

    }

}
export interface ISender{
    send(message:Message):void
}
export class WebSocketSender implements ISender{
    wsConnection:WebSocketConnectionKeeper
    constructor(wsConnection:WebSocketConnectionKeeper){
        this.wsConnection=wsConnection
    }
    async send(message:Message){
        let connection=await this.wsConnection.getConnection()
        connection.send(JSON.stringify(message))
    }
}
export class WebSocketConnectionKeeper{
    host:string
    port:number
    path:string
    socket?:WebSocket
    lastTime=0;
    tryCount=0;
    client:Client
    
    constructor(host:string,port:number,path:string,client:Client){
        this.host=host
        this.port=port
        this.path=path
        this.client=client
    }
    url(){
        return `ws://${this.host}:${this.port}${this.path}`
    }
    async getConnection():Promise<WebSocket>{
        let socket=this.socket as WebSocket

        if(socket!=null && socket.readyState==WebSocket.OPEN){
            return socket
        }

        while(socket.readyState!=WebSocket.OPEN){
            if(socket.readyState==WebSocket.CLOSED){
                if(Date.now()-this.lastTime>5000){
                    this.tryCount=0
                }
                if(this.tryCount<3){
                    socket=new WebSocket(this.url())
                    this.socket=socket
                    this.tryCount++
                }else{
                    throw  "socket is disconnected";
                }
            }
            await wait();
        }

        socket.onopen = function() {
            console.log("socket is open")
        };
        socket.onmessage = (event) =>{
            let data=event.data;
            let obj=JSON.parse(data);
            getMessageReceiver().onReceiveMessage(obj,this.client)
        };
        socket.onclose = function(event) {
        };
        socket.onerror = function(event) {
            console.log(event);
        };
        return socket;
    }
}

async function wait(){
    await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), 500)
    });
}

let idCOunt=0;
function getId(){
    return ''+(idCOunt++)
}