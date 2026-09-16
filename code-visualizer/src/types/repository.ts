export type FileNodeType = "file" | "directory";

export interface FileNode {
    name: string;
    path: string;
    type: FileNodeType;
    children?: FileNode[];
}

export interface Repository {
    rootPath: string;
    name: string;
}
