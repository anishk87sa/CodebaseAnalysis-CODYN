import { describe, it, expect } from 'vitest';
import { analyzeRepository } from '../electron/services/storage/cstStorage';
import { generateGraph } from '../electron/services/graph/graphExtractor';
import { GRAPH_SCHEMA_VERSION } from '../electron/services/graph/graphSerializer';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Graph Generation Service', () => {
    it('should extract nodes and edges from CST and save them globally', async () => {
        const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codyn-graph-repo-'));
        
        // Write file A
        const aCode = `
            import { bar } from './B';
            export function foo() {
                bar();
            }
        `;
        await fs.writeFile(path.join(repoDir, 'A.ts'), aCode);
        
        // Write file B
        const bCode = `
            import { baz } from './C';
            export function bar() {
                baz();
            }
        `;
        await fs.writeFile(path.join(repoDir, 'B.ts'), bCode);

        // Write file C
        const cCode = `
            export function baz() {
                console.log("Done");
            }
        `;
        await fs.writeFile(path.join(repoDir, 'C.ts'), cCode);
        
        // 1. Run CST analysis
        await analyzeRepository(repoDir);
        
        // 2. Run Graph generation
        const result = await generateGraph(repoDir);
        
        expect(result.nodeCount).toBeGreaterThan(0);
        expect(result.edgeCount).toBeGreaterThan(0);
        expect(result.outputPath).toBeDefined();

        // 3. Verify files
        const indexPath = path.join(repoDir, '.codyn', 'analysis', 'graph', 'index.json');
        const indexExists = await fs.stat(indexPath).then(() => true).catch(() => false);
        expect(indexExists).toBe(true);

        const indexContent = JSON.parse(await fs.readFile(indexPath, 'utf8'));
        expect(indexContent.version).toBe(GRAPH_SCHEMA_VERSION);
        expect(indexContent.nodeCount).toBe(result.nodeCount);
        
        const globalGraphPath = path.join(repoDir, '.codyn', 'analysis', 'graph', 'global_graph.json');
        const graphData = JSON.parse(await fs.readFile(globalGraphPath, 'utf8'));
        
        expect(graphData.nodes).toBeDefined();
        expect(graphData.edges).toBeDefined();
        
        // Ensure function nodes exist
        const fooNode = graphData.nodes.find((n: any) => n.type === 'function' && n.label === 'foo' && n.file === 'A.ts');
        const barNode = graphData.nodes.find((n: any) => n.type === 'function' && n.label === 'bar' && n.file === 'B.ts');
        const bazNode = graphData.nodes.find((n: any) => n.type === 'function' && n.label === 'baz' && n.file === 'C.ts');
        
        expect(fooNode).toBeDefined();
        expect(barNode).toBeDefined();
        expect(bazNode).toBeDefined();
        
        // Ensure cross-file call edges exist
        const call1 = graphData.edges.some((e: any) => e.source === fooNode.id && e.target === barNode.id && e.type === 'calls');
        const call2 = graphData.edges.some((e: any) => e.source === barNode.id && e.target === bazNode.id && e.type === 'calls');

        expect(call1).toBe(true);
        expect(call2).toBe(true);
    });
});
