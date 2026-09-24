import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalGraphData, GraphIndex, GraphGenerationResult } from './graphTypes';

export const GRAPH_SCHEMA_VERSION = "2.0";
const ANALYSIS_DIR_NAME = ".codyn";

export async function saveGlobalGraphData(repositoryRoot: string, globalGraph: GlobalGraphData): Promise<GraphGenerationResult> {
    const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME, 'analysis', 'graph');
    const indexPath = path.join(analysisDir, 'index.json');
    const globalGraphPath = path.join(analysisDir, 'global_graph.json');

    // Create directories
    await fs.mkdir(analysisDir, { recursive: true });

    // Validate graph data (basic)
    const nodeIds = new Set(globalGraph.nodes.map(n => n.id));
    const validEdges = globalGraph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    
    globalGraph.edges = validEdges;

    // Save global graph
    await fs.writeFile(globalGraphPath, JSON.stringify(globalGraph, null, 2), 'utf8');

    const graphIndex: GraphIndex = {
        version: GRAPH_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        nodeCount: globalGraph.nodes.length,
        edgeCount: globalGraph.edges.length,
        graphPath: 'global_graph.json'
    };

    // Save index
    await fs.writeFile(indexPath, JSON.stringify(graphIndex, null, 2), 'utf8');

    return {
        nodeCount: globalGraph.nodes.length,
        edgeCount: globalGraph.edges.length,
        outputPath: indexPath
    };
}
