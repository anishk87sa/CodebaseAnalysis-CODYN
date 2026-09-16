import { describe, it, expect } from 'vitest';
import { analyzeRepository, CST_SCHEMA_VERSION } from '../electron/services/storage/cstStorage';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Storage Service', () => {
    it('should generate analysis index and save CST files', async () => {
        // Create a fake repo
        const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codyn-repo-'));
        await fs.writeFile(path.join(repoDir, 'index.ts'), 'console.log("hello");');
        
        const result = await analyzeRepository(repoDir);
        
        expect(result.totalFiles).toBeGreaterThan(0);
        expect(result.parsedFiles).toBe(1);
        
        const indexPath = path.join(repoDir, '.codyn', 'analysis', 'cst', 'index.json');
        const indexExists = await fs.stat(indexPath).then(() => true).catch(() => false);
        expect(indexExists).toBe(true);

        const indexContent = JSON.parse(await fs.readFile(indexPath, 'utf8'));
        expect(indexContent.version).toBe(CST_SCHEMA_VERSION);
        expect(indexContent.files.length).toBe(1);
        expect(indexContent.files[0].status).toBe('success');
        expect(indexContent.files[0].cstPath).toBeDefined();
    });
});
