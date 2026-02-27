
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
  pwd:string;
  processName: string;
  originalName: string;
  modifiedName?: string;
  originalIcon: string;
  modifiedIcon?: string;
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
