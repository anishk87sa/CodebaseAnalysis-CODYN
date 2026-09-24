import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalGraphData, GraphData, GraphNode, GraphEdge } from './graphTypes';

export async function getFileGraphData(repositoryRoot: string, filePath: string, depth: number = 1): Promise<GraphData | null> {
    const relativePath = path.relative(repositoryRoot, filePath).replace(/\\/g, '/');
    const analysisDir = path.join(repositoryRoot, '.codyn', 'analysis');
    const globalGraphPath = path.join(analysisDir, 'graph', 'global_graph.json');
    
    try {
        const graphRaw = await fs.readFile(globalGraphPath, 'utf8');
        const globalGraph: GlobalGraphData = JSON.parse(graphRaw);
        
        const nodesToReturn = new Map<string, GraphNode>();
        const edgesToReturn = new Map<string, GraphEdge>();

        // 1. Add the file node and all 'contains' descendants
        const fileNodeId = `file:${relativePath}`;
        const fileNode = globalGraph.nodes.find(n => n.id === fileNodeId);
        if (fileNode) {
            nodesToReturn.set(fileNodeId, fileNode);
        }

        // Get all nodes for this file
        const fileFunctions = globalGraph.functionsByFile[relativePath] || [];
        for (const fnId of fileFunctions) {
            const fnNode = globalGraph.nodes.find(n => n.id === fnId);
            if (fnNode) {
                nodesToReturn.set(fnId, fnNode);
            }
        }

        // Add 'contains' edges for these nodes
        for (const edge of globalGraph.edges) {
            if (edge.type === 'contains' && nodesToReturn.has(edge.source) && nodesToReturn.has(edge.target)) {
                edgesToReturn.set(edge.id, edge);
            }
        }

        // 2. Add 'calls' graph via BFS traversal up to `depth`
        let currentLevelIds = [...fileFunctions];
        const visitedNodes = new Set<string>(fileFunctions);
        const nodeMap = new Map<string, GraphNode>(globalGraph.nodes.map(n => [n.id, n]));

        for (let currentDepth = 0; currentDepth < depth; currentDepth++) {
            const nextLevelIds: string[] = [];

            for (const sourceId of currentLevelIds) {
                const targets = globalGraph.callsFrom[sourceId] || [];
                for (const targetId of targets) {
                    // Add edge
                    const edgeId = `${sourceId}->${targetId}:calls`;
                    const globalEdge = globalGraph.edges.find(e => e.id === edgeId);
                    if (globalEdge) {
                        edgesToReturn.set(edgeId, globalEdge);
                    }

                    // Add target node
                    if (!visitedNodes.has(targetId)) {
                        visitedNodes.add(targetId);
                        const targetNode = nodeMap.get(targetId);
                        if (targetNode) {
                            nodesToReturn.set(targetId, targetNode);
                            nextLevelIds.push(targetId);
                        }
                    }
                }
            }

            currentLevelIds = nextLevelIds;
            if (currentLevelIds.length === 0) break;
        }

        return {
            nodes: Array.from(nodesToReturn.values()),
            edges: Array.from(edgesToReturn.values())
        };
    } catch (e) {
        return null;
    }
}

export async function getGlobalGraphData(repositoryRoot: string): Promise<GraphData | null> {
    const analysisDir = path.join(repositoryRoot, '.codyn', 'analysis');
    const globalGraphPath = path.join(analysisDir, 'graph', 'global_graph.json');
    
    try {
        const graphRaw = await fs.readFile(globalGraphPath, 'utf8');
        const globalGraph: GlobalGraphData = JSON.parse(graphRaw);
        
        // We only want to return functions and calls for the global graph view, 
        // to avoid overwhelming it with "contains" edges and file/class nodes.
        const nodes = globalGraph.nodes.filter(n => n.type === 'function');
        const nodeIds = new Set(nodes.map(n => n.id));
        
        const edges = globalGraph.edges.filter(e => 
            e.type === 'calls' && nodeIds.has(e.source) && nodeIds.has(e.target)
        );

        return { nodes, edges };
    } catch (e) {
        return null;
    }
}
