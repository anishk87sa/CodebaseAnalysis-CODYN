import fs from 'node:fs/promises';
import path from 'node:path';
import { shouldIgnoreDirectory, shouldIgnoreFile } from './ignoreRules';

export interface ScannedFile {
    absolutePath: string;
    relativePath: string;
    name: string;
    extension: string;
    type: "file" | "directory";
    size: number;
}

export const MAX_SOURCE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class SourceScanner {
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Recursively walk the directory, identifying valid source files and ignoring irrelevant ones.
     */
    async scan(): Promise<ScannedFile[]> {
        return this.walkDirectory(this.rootPath, '');
    }

    private async walkDirectory(currentDir: string, relativeDir: string): Promise<ScannedFile[]> {
        const results: ScannedFile[] = [];

        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const entryName = entry.name;
                const absolutePath = path.join(currentDir, entryName);
                const relativePath = relativeDir ? `${relativeDir}/${entryName}` : entryName;

                if (entry.isDirectory()) {
                    if (shouldIgnoreDirectory(entryName)) {
                        continue; // Skip ignored directories
                    }
                    // Recursively scan subdirectory
                    const subResults = await this.walkDirectory(absolutePath, relativePath);
                    results.push(...subResults);
                } else if (entry.isFile()) {
                    const extension = path.extname(entryName);

                    if (shouldIgnoreFile(entryName, extension)) {
                        continue; // Skip ignored files
                    }

                    try {
                        const stats = await fs.stat(absolutePath);
                        results.push({
                            absolutePath,
                            relativePath,
                            name: entryName,
                            extension,
                            type: 'file',
                            size: stats.size,
                        });
                    } catch (statErr) {
                        console.error(`Could not stat file ${absolutePath}:`, statErr);
                        // Skip unreadable files gracefully
                    }
                }
            }
        } catch (dirErr) {
            console.error(`Could not read directory ${currentDir}:`, dirErr);
            // Skip unreadable directories gracefully
        }

        return results;
    }
}
