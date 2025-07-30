import { getMessageReceiver, type ISender,Client,setHostId } from "./rpc";
class DirectSender implements ISender{
    client:Client
    constructor(client:Client){
        this.client=client
    }
    async send(message:any){
        getMessageReceiver().onReceiveMessage(message,this.client)
        console.log('send',message)
    }
}
export async function main(){
    setHostId('frontJs');
    getMessageReceiver().setMain({
        'hello':(a:number,b:number,onResult)=>{
            onResult(a+b)
            return a+b
        }
    })
    let client=new Client(null)
    client.sender=new DirectSender(client)
    let rpc=await client.getMain()
    console.log(await rpc.hello(1,2,(a:number)=>console.log('callback',a)))
}
main()

