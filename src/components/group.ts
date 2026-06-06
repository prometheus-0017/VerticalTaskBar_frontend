
export interface Group {
  id: string;
  name: string;
  scrollStatus:number;
  searchQuery: string;
    captureConditions: CaptureCondition[];
  tasks: Task[];
}
// 数据模型
export interface Task {
  id: number;
  system:string;
  pwd:string;
  processId?:number
  processName: string;
  originalName: string;
  modifiedName: string|null;
  originalIcon: string;
  modifiedIcon: string|null;
}
// 类型定义
interface CaptureCondition {
  type: 'pwd' | 'name' | 'originName';
  value: string;
}
export interface editableGroup{
    name:string
    captureConditions: CaptureCondition[];
}
