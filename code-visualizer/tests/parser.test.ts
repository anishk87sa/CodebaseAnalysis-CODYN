import { describe, it, expect, beforeAll } from 'vitest';
import { parseFile, initializeParser } from '../electron/services/parser/treeSitterService';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Parser Service', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codyn-test-'));
        await initializeParser();
    });

    it('should parse a valid typescript file', async () => {
        const filePath = path.join(tempDir, 'valid.ts');
        await fs.writeFile(filePath, 'function hello(name: string) { console.log(name); }');

        const result = await parseFile(filePath, 'valid.ts');
        expect(result.status).toBe('success');
        expect(result.cst).toBeDefined();
        expect(result.cst?.type).toBe('program');
        expect(result.cst?.children.length).toBeGreaterThan(0);
    });

    it('should report syntax error for invalid code', async () => {
        const filePath = path.join(tempDir, 'invalid.ts');
        // Missing closing brace
        await fs.writeFile(filePath, 'function broken() { console.log("broken"');

        const result = await parseFile(filePath, 'invalid.ts');
        expect(result.status).toBe('syntax_error');
        expect(result.cst).toBeDefined(); // CST still generated
        expect(result.cst?.type).toBe('program');
    });

    it('should return unsupported for unknown extensions', async () => {
        const filePath = path.join(tempDir, 'unknown.xyz');
        await fs.writeFile(filePath, 'some content');

        const result = await parseFile(filePath, 'unknown.xyz');
        expect(result.status).toBe('unsupported');
        expect(result.cst).toBeUndefined();
    });
});
