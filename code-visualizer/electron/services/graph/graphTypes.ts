export interface GraphNode {
    id: string;
    type: string;
    label: string;
    file?: string;
    resolutionStatus?: "resolved" | "unresolved" | "ambiguous";
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

export interface GlobalGraphData extends GraphData {
    functionsByFile: Record<string, string[]>;
    callsFrom: Record<string, string[]>;
    callsTo: Record<string, string[]>;
}

export interface GraphIndex {
    version: string;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    graphPath: string; // Will point to global_graph.json
}

export interface GraphGenerationResult {
    nodeCount: number;
    edgeCount: number;
    outputPath: string;
}
