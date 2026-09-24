import fs from 'node:fs/promises';
import path from 'node:path';
import { GraphData, GraphIndex, GraphGenerationResult } from './graphTypes';

export const GRAPH_SCHEMA_VERSION = "1.0";
const ANALYSIS_DIR_NAME = ".codyn";

export interface FileGraphData {
    fileId: string;
    relativePath: string;
    data: GraphData;
}

export async function saveGraphData(repositoryRoot: string, filesGraphData: FileGraphData[]): Promise<GraphGenerationResult> {
    const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME, 'analysis', 'graph');
    const filesDir = path.join(analysisDir, 'files');
    const indexPath = path.join(analysisDir, 'index.json');

    // Create directories
    await fs.mkdir(filesDir, { recursive: true });

    let totalNodeCount = 0;
    let totalEdgeCount = 0;

    // Save each file's graph data
    for (const fileGraph of filesGraphData) {
        // Validate graph data (basic)
        const nodeIds = new Set(fileGraph.data.nodes.map(n => n.id));
        const validEdges = fileGraph.data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        
        const finalGraphData: GraphData = {
            nodes: fileGraph.data.nodes,
            edges: validEdges
        };

        totalNodeCount += finalGraphData.nodes.length;
        totalEdgeCount += finalGraphData.edges.length;

        // Use the fileId which matches the CST's stable ID
        const graphPath = path.join(filesDir, `${fileGraph.fileId}.json`);
        await fs.writeFile(graphPath, JSON.stringify(finalGraphData, null, 2), 'utf8');
    }

    const graphIndex: GraphIndex = {
        version: GRAPH_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        nodeCount: totalNodeCount,
        edgeCount: totalEdgeCount,
        graphPath: path.relative(analysisDir, filesDir)
    };

    // Save index
    await fs.writeFile(indexPath, JSON.stringify(graphIndex, null, 2), 'utf8');

    return {
        nodeCount: totalNodeCount,
        edgeCount: totalEdgeCount,
        outputPath: indexPath
    };
}
