import { describe, it, expect } from 'vitest';
import { shouldIgnoreDirectory, shouldIgnoreFile } from '../electron/services/scanner/ignoreRules';

describe('Scanner Ignore Rules', () => {
    it('should ignore node_modules and .git', () => {
        expect(shouldIgnoreDirectory('node_modules')).toBe(true);
        expect(shouldIgnoreDirectory('.git')).toBe(true);
        expect(shouldIgnoreDirectory('src')).toBe(false);
    });

    it('should ignore binary files and lock files', () => {
        expect(shouldIgnoreFile('image.png', '.png')).toBe(true);
        expect(shouldIgnoreFile('package-lock.json', '.json')).toBe(true);
        expect(shouldIgnoreFile('app.exe', '.exe')).toBe(true);
    });

    it('should not ignore valid source files', () => {
        expect(shouldIgnoreFile('index.ts', '.ts')).toBe(false);
        expect(shouldIgnoreFile('main.js', '.js')).toBe(false);
        expect(shouldIgnoreFile('package.json', '.json')).toBe(false); // package.json itself is not ignored
    });
});
