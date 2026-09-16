export type NodeType =
    | "file"
    | "folder"
    | "function"
    | "class"
    | "variable"
    | "module";

export type EdgeType =
    | "calls"
    | "imports"
    | "contains"
    | "inherits"
    | "implements"
    | "references";

export interface GraphNode {
    id: string;
    type: NodeType;
    label: string;
    metadata?: Record<string, any>;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    metadata?: Record<string, any>;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
