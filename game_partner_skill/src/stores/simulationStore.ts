import { create } from 'zustand';
import { SimulationConfig, AIEmployee, LivestreamConfig } from '../types/simulation';

interface SimulationStore {
  config: SimulationConfig;
  
  // 场景配置
  setSceneType: (type: SimulationConfig['sceneType']) => void;
  setLivestreamConfig: (config: Partial<LivestreamConfig>) => void;
  
  // AI 员工管理
  addEmployee: (employee: Omit<AIEmployee, 'id'>) => void;
  updateEmployee: (id: string, data: Partial<AIEmployee>) => void;
  removeEmployee: (id: string) => void;
  
  // 运行控制
  startSimulation: () => void;
  stopSimulation: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  config: {
    sceneType: 'livestream',
    livestream: {
      onlineUsers: 1000,
      roomName: '游戏陪玩直播间',
      roomDescription: '欢迎来到直播间！一起开心玩游戏~',
      danmakuFrequency: 'medium',
      giftFrequency: 'medium',
      allowMic: true,
    },
    employees: [],
    isRunning: false,
  },
  
  setSceneType: (type) => set((state) => ({
    config: { ...state.config, sceneType: type },
  })),
  
  setLivestreamConfig: (config) => set((state) => ({
    config: {
      ...state.config,
      livestream: { ...state.config.livestream!, ...config },
    },
  })),
  
  addEmployee: (employee) => set((state) => ({
    config: {
      ...state.config,
      employees: [
        ...state.config.employees,
        { ...employee, id: `emp_${Date.now()}` },
      ],
    },
  })),
  
  updateEmployee: (id, data) => set((state) => ({
    config: {
      ...state.config,
      employees: state.config.employees.map((emp) =>
        emp.id === id ? { ...emp, ...data } : emp
      ),
    },
  })),
  
  removeEmployee: (id) => set((state) => ({
    config: {
      ...state.config,
      employees: state.config.employees.filter((emp) => emp.id !== id),
    },
  })),
  
  startSimulation: () => set((state) => ({
    config: { ...state.config, isRunning: true },
  })),
  
  stopSimulation: () => set((state) => ({
    config: { ...state.config, isRunning: false },
  })),
}));
