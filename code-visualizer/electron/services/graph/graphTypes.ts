export interface GraphNode {
    id: string;
    type: string;
    label: string;
    file?: string;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface GraphIndex {
    version: string;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    graphPath: string;
}

export interface GraphGenerationResult {
    nodeCount: number;
    edgeCount: number;
    outputPath: string;
}

