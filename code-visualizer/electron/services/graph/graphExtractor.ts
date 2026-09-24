import fs from 'node:fs/promises';
import path from 'node:path';
import { GraphNode, GraphEdge, GraphGenerationResult } from './graphTypes';
import { saveGraphData, FileGraphData } from './graphSerializer';
import { CSTNode, CSTIndex } from '../parser/types';

const MEANINGFUL_NODE_TYPES = new Set([
    'function_declaration',
    'method_definition',
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'struct_declaration',
    'module_declaration',
    'file'
]);

export async function generateGraph(repositoryRoot: string): Promise<GraphGenerationResult> {
    const analysisDir = path.join(repositoryRoot, '.codyn', 'analysis', 'cst');
    const indexPath = path.join(analysisDir, 'index.json');

    let indexData: CSTIndex;
    try {
        const indexRaw = await fs.readFile(indexPath, 'utf8');
        indexData = JSON.parse(indexRaw);
    } catch (e) {
        throw new Error(`Failed to read CST index at ${indexPath}. Has analysis been run?`);
    }

    const filesGraphData: FileGraphData[] = [];
    
    // Process files incrementally
    for (const file of indexData.files) {
        if (!file.cstPath) continue;

        const cstFilePath = path.join(analysisDir, file.cstPath);
        let cstData: CSTNode;
        try {
            const cstRaw = await fs.readFile(cstFilePath, 'utf8');
            cstData = JSON.parse(cstRaw);
        } catch (e) {
            console.error(`Failed to read CST file: ${cstFilePath}`);
            continue;
        }

        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // The root node often represents the file itself
        const fileNodeId = `file:${file.relativePath}`;
        nodes.push({
            id: fileNodeId,
            type: 'file',
            label: path.basename(file.relativePath),
            file: file.relativePath
        });

        // Traverse CST recursively for this file
        traverseCST(cstData, file.relativePath, fileNodeId, nodes, edges);

        filesGraphData.push({
            fileId: file.id, // Using the stable id from the CST index
            relativePath: file.relativePath,
            data: { nodes, edges }
        });
    }

    return await saveGraphData(repositoryRoot, filesGraphData);
}

function traverseCST(
    node: CSTNode,
    relativePath: string,
    parentNodeId: string | null,
    nodes: GraphNode[],
    edges: GraphEdge[]
) {
    let currentMeaningfulNodeId = parentNodeId;

    if (MEANINGFUL_NODE_TYPES.has(node.type)) {
        // Extract a label. If node has a text property (identifier child usually), use it.
        // As a heuristic for standard tree-sitter, we look for a named 'identifier' or 'property_identifier' or 'name' node.
        let label = getIdentifierLabel(node) || node.type;
        
        const nodeTypeCleaned = node.type.replace('_declaration', '').replace('_definition', '');
        const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
        
        // Prevent exact duplicates in nodes
        if (!nodes.some(n => n.id === nodeId)) {
            nodes.push({
                id: nodeId,
                type: nodeTypeCleaned,
                label: label,
                file: relativePath
            });
        }

        if (parentNodeId && parentNodeId !== nodeId) {
            const edgeType = "contains";
            const edgeId = `${parentNodeId}->${nodeId}:${edgeType}`;
            
            if (!edges.some(e => e.id === edgeId)) {
                edges.push({
                    id: edgeId,
                    source: parentNodeId,
                    target: nodeId,
                    type: edgeType
                });
            }
        }

        currentMeaningfulNodeId = nodeId;
    }

    if (node.children) {
        for (const child of node.children) {
            traverseCST(child, relativePath, currentMeaningfulNodeId, nodes, edges);
        }
    }
}

function getIdentifierLabel(node: CSTNode): string | undefined {
    // Basic heuristic to find the name of a class/function
    if (node.children) {
        const idNode = node.children.find(c => 
            c.type === 'identifier' || 
            c.type === 'property_identifier' || 
            c.type === 'type_identifier' ||
            c.type === 'name'
        );
        if (idNode && idNode.text) {
            return idNode.text;
        }
    }
    return undefined;
}
