import { FileNode } from './repository';

export interface IElectronAPI {
  repository: {
    selectFolder: () => Promise<string | null>;
    getTree: (path: string) => Promise<FileNode | null>;
    analyzeCST: (path: string) => Promise<any>;
  },
  graph: {
    generate: (path: string) => Promise<any>;
  }
}

declare global {
  interface Window {
    codyn: IElectronAPI
  }
}
