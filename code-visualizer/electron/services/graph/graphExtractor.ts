import fs from 'node:fs/promises';
import path from 'node:path';
import { GraphNode, GraphEdge, GraphGenerationResult, GlobalGraphData } from './graphTypes';
import { saveGlobalGraphData } from './graphSerializer';
import { CSTNode, CSTIndex } from '../parser/types';
import { ProjectSymbolTable, SymbolInfo, ImportInfo } from './symbolTable';

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

    const symbolTable = new ProjectSymbolTable();
    const globalNodes: Map<string, GraphNode> = new Map();
    const globalEdges: Map<string, GraphEdge> = new Map();
    
    // Store loaded CSTs so we don't read them twice
    const cstCache: Map<string, CSTNode> = new Map();

    // Pass 1: Extract symbols, imports, nodes, and 'contains' edges
    for (const file of indexData.files) {
        if (!file.cstPath) continue;

        const cstFilePath = path.join(analysisDir, file.cstPath);
        let cstData: CSTNode;
        try {
            const cstRaw = await fs.readFile(cstFilePath, 'utf8');
            cstData = JSON.parse(cstRaw);
            cstCache.set(file.relativePath, cstData);
        } catch (e) {
            console.error(`Failed to read CST file: ${cstFilePath}`);
            continue;
        }

        const fileNodeId = `file:${file.relativePath}`;
        globalNodes.set(fileNodeId, {
            id: fileNodeId,
            type: 'file',
            label: path.basename(file.relativePath),
            file: file.relativePath
        });

        extractSymbolsAndContains(cstData, file.relativePath, fileNodeId, globalNodes, globalEdges, symbolTable);
        extractImports(cstData, file.relativePath, symbolTable);
    }

    // Pass 2: Extract 'calls' edges and resolve them globally
    for (const [relativePath, cstData] of cstCache.entries()) {
        const fileNodeId = `file:${relativePath}`;
        extractCalls(cstData, relativePath, fileNodeId, globalNodes, globalEdges, symbolTable);
    }

    // Build final GlobalGraphData
    const nodes = Array.from(globalNodes.values());
    const edges = Array.from(globalEdges.values());

    const functionsByFile: Record<string, string[]> = {};
    const callsFrom: Record<string, string[]> = {};
    const callsTo: Record<string, string[]> = {};

    for (const node of nodes) {
        if (node.file) {
            if (!functionsByFile[node.file]) functionsByFile[node.file] = [];
            functionsByFile[node.file].push(node.id);
        }
    }

    for (const edge of edges) {
        if (edge.type === 'calls') {
            if (!callsFrom[edge.source]) callsFrom[edge.source] = [];
            callsFrom[edge.source].push(edge.target);

            if (!callsTo[edge.target]) callsTo[edge.target] = [];
            callsTo[edge.target].push(edge.source);
        }
    }

    const globalGraph: GlobalGraphData = {
        nodes,
        edges,
        functionsByFile,
        callsFrom,
        callsTo
    };

    return await saveGlobalGraphData(repositoryRoot, globalGraph);
}

function extractSymbolsAndContains(
    node: CSTNode,
    relativePath: string,
    parentNodeId: string | null,
    globalNodes: Map<string, GraphNode>,
    globalEdges: Map<string, GraphEdge>,
    symbolTable: ProjectSymbolTable,
    isExportedContext: boolean = false
) {
    let currentMeaningfulNodeId = parentNodeId;
    let currentlyExported = isExportedContext;

    if (node.type === 'export_statement') {
        currentlyExported = true;
    }

    if (MEANINGFUL_NODE_TYPES.has(node.type)) {
        let label = getIdentifierLabel(node) || node.type;
        const nodeTypeCleaned = node.type.replace('_declaration', '').replace('_definition', '');
        const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
        
        if (!globalNodes.has(nodeId)) {
            globalNodes.set(nodeId, {
                id: nodeId,
                type: nodeTypeCleaned,
                label: label,
                file: relativePath
            });

            // Register symbol
            symbolTable.addSymbol(relativePath, {
                id: nodeId,
                name: label,
                type: nodeTypeCleaned,
                file: relativePath,
                isExported: currentlyExported
            });
        }

        if (parentNodeId && parentNodeId !== nodeId) {
            const edgeType = "contains";
            const edgeId = `${parentNodeId}->${nodeId}:${edgeType}`;
            if (!globalEdges.has(edgeId)) {
                globalEdges.set(edgeId, {
                    id: edgeId,
                    source: parentNodeId,
                    target: nodeId,
                    type: edgeType
                });
            }
        }
        currentMeaningfulNodeId = nodeId;
        currentlyExported = false; // Reset for children unless they have their own export
    }

    if (node.children) {
        for (const child of node.children) {
            extractSymbolsAndContains(child, relativePath, currentMeaningfulNodeId, globalNodes, globalEdges, symbolTable, currentlyExported);
        }
    }
}

function extractImports(node: CSTNode, relativePath: string, symbolTable: ProjectSymbolTable) {
    if (node.type === 'import_statement') {
        const sourceNode = node.children?.find(c => c.type === 'string');
        const fragment = sourceNode?.children?.find(c => c.type === 'string_fragment');
        const sourceModule = fragment?.text;

        if (sourceModule) {
            const importClause = node.children?.find(c => c.type === 'import_clause');
            if (importClause && importClause.children) {
                // Check for named imports: import { x, y as z } from ...
                const namedImports = importClause.children.find(c => c.type === 'named_imports');
                if (namedImports && namedImports.children) {
                    for (const specifier of namedImports.children.filter(c => c.type === 'import_specifier')) {
                        const ids = specifier.children?.filter(c => c.type === 'identifier');
                        if (ids && ids.length > 0) {
                            const importedName = ids[0].text!;
                            const localName = ids.length > 1 ? ids[1].text! : importedName;
                            symbolTable.addImport(relativePath, { localName, importedName, sourceModule });
                        }
                    }
                }

                // Check for default or namespace import
                const idNode = importClause.children.find(c => c.type === 'identifier');
                if (idNode && idNode.text) {
                    symbolTable.addImport(relativePath, { localName: idNode.text, importedName: 'default', sourceModule });
                }

                const namespaceImport = importClause.children.find(c => c.type === 'namespace_import');
                if (namespaceImport && namespaceImport.children) {
                    const nsId = namespaceImport.children.find(c => c.type === 'identifier');
                    if (nsId && nsId.text) {
                        symbolTable.addImport(relativePath, { localName: nsId.text, importedName: '*', sourceModule });
                    }
                }
            }
        }
    }

    if (node.children) {
        for (const child of node.children) {
            extractImports(child, relativePath, symbolTable);
        }
    }
}

function extractCalls(
    node: CSTNode,
    relativePath: string,
    parentNodeId: string | null,
    globalNodes: Map<string, GraphNode>,
    globalEdges: Map<string, GraphEdge>,
    symbolTable: ProjectSymbolTable
) {
    let currentMeaningfulNodeId = parentNodeId;

    if (MEANINGFUL_NODE_TYPES.has(node.type)) {
        let label = getIdentifierLabel(node) || node.type;
        const nodeTypeCleaned = node.type.replace('_declaration', '').replace('_definition', '');
        const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
        currentMeaningfulNodeId = nodeId;
    } else if (node.type === 'call_expression' && currentMeaningfulNodeId) {
        const calledName = getCalledFunctionName(node);
        if (calledName) {
            // Resolve the name
            // If it's a member expression like `a.b`, we'd just use `b` or `a`
            // For now, if we get `b`, we try to resolve `b`. If we get `a.b`, we might have trouble.
            // Let's resolve the base identifier first if possible.
            let baseName = calledName;
            let memberName = undefined;
            if (calledName.includes('.')) {
                const parts = calledName.split('.');
                baseName = parts[0];
                memberName = parts[1];
            }

            const resolvedSymbol = symbolTable.resolveSymbol(relativePath, baseName);
            
            let targetNodeId: string;
            let targetResolution: "resolved" | "unresolved" | "ambiguous" = "unresolved";
            
            if (resolvedSymbol) {
                if (memberName && resolvedSymbol.type === 'module') {
                    // Namespace import resolution: imported `* as utils`, calling `utils.foo`
                    // We need to resolve `foo` inside `utils`
                    const targetSymbols = symbolTable.symbolsByFile.get(resolvedSymbol.file);
                    if (targetSymbols && targetSymbols.has(memberName)) {
                        targetNodeId = targetSymbols.get(memberName)!.id;
                        targetResolution = "resolved";
                    } else {
                        targetNodeId = `function:unresolved:${calledName}`;
                    }
                } else {
                    // Directly resolved function/class
                    targetNodeId = resolvedSymbol.id;
                    targetResolution = "resolved";
                }
            } else {
                targetNodeId = `function:unresolved:${calledName}`;
            }

            // Create target node if it doesn't exist
            if (!globalNodes.has(targetNodeId)) {
                globalNodes.set(targetNodeId, {
                    id: targetNodeId,
                    type: 'function',
                    label: calledName,
                    file: 'unknown',
                    resolutionStatus: targetResolution
                });
            } else {
                const existing = globalNodes.get(targetNodeId)!;
                if (!existing.resolutionStatus) {
                    existing.resolutionStatus = targetResolution;
                }
            }

            const edgeType = "calls";
            const edgeId = `${currentMeaningfulNodeId}->${targetNodeId}:${edgeType}`;
            
            if (!globalEdges.has(edgeId)) {
                globalEdges.set(edgeId, {
                    id: edgeId,
                    source: currentMeaningfulNodeId,
                    target: targetNodeId,
                    type: edgeType
                });
            }
        }
    }

    if (node.children) {
        for (const child of node.children) {
            extractCalls(child, relativePath, currentMeaningfulNodeId, globalNodes, globalEdges, symbolTable);
        }
    }
}

function getIdentifierLabel(node: CSTNode): string | undefined {
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

function getCalledFunctionName(node: CSTNode): string | undefined {
    const target = node.children?.[0];
    if (!target) return undefined;
    if (target.type === 'identifier' && target.text) return target.text;
    if (target.type === 'member_expression') {
        const obj = target.children?.find(c => c.type === 'identifier' || c.type === 'this');
        const prop = target.children?.find(c => c.type === 'property_identifier');
        if (obj && prop && obj.text && prop.text) return `${obj.text}.${prop.text}`;
        if (prop && prop.text) return prop.text;
    }
    return undefined;
}
