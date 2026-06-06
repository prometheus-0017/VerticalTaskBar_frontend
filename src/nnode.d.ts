export function getId(): string;
export function addExecMessageHandler(id: string, handler: (data: any) => void): void;
export function removeExecMessageHandler(id: string): void;

declare const nnode: {
  ls(nodeId: string): Promise<any>;
  rpc(func: string, args: any[]): Promise<any>;
  batchRpc(funcArgList: Array<{func: string, args: any[]}>): Promise<any>;
  setName(name: string): Promise<any>;
  remoteExec(name: string, cmdName: string, argList: any[]): Promise<any>;
  setRemoteCmd(cmdName: string, func: Function): void;
  removeRemoteCmd(cmdName: string): void;
};

export default nnode;
