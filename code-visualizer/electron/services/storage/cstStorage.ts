import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CSTIndex, ParseResult, RepositoryAnalysisResult } from '../parser/types';
import { SourceScanner, MAX_SOURCE_FILE_SIZE } from '../scanner/sourceScanner';
import { parseFile } from '../parser/treeSitterService';

export const CST_SCHEMA_VERSION = "1.0";
const ANALYSIS_DIR_NAME = ".codyn";

function getStableId(relativePath: string): string {
    return crypto.createHash('sha256').update(relativePath).digest('hex');
}

export async function analyzeRepository(repositoryRoot: string): Promise<RepositoryAnalysisResult> {
    const startTime = Date.now();
    
    const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME, 'analysis', 'cst');
    const filesDir = path.join(analysisDir, 'files');
    const indexPath = path.join(analysisDir, 'index.json');

    // Create directories
    await fs.mkdir(filesDir, { recursive: true });

    const scanner = new SourceScanner(repositoryRoot);
    const scannedFiles = await scanner.scan();

    let parsedFiles = 0;
    let syntaxErrorFiles = 0;
    let unsupportedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;

    const indexFiles: CSTIndex['files'] = [];

    // Process files sequentially for now as per requirements
    for (const file of scannedFiles) {
        if (file.size > MAX_SOURCE_FILE_SIZE) {
            skippedFiles++;
            indexFiles.push({
                id: getStableId(file.relativePath),
                relativePath: file.relativePath,
                status: "too_large"
            });
            continue;
        }

        const parseResult = await parseFile(file.absolutePath, file.relativePath);
        const stableId = getStableId(file.relativePath);

        let cstPath: string | undefined;

        switch (parseResult.status) {
            case "success":
                parsedFiles++;
                break;
            case "syntax_error":
                syntaxErrorFiles++;
                break;
            case "unsupported":
                unsupportedFiles++;
                break;
            case "read_error":
            case "parse_error":
                failedFiles++;
                break;
        }

        if (parseResult.cst) {
            cstPath = path.join(filesDir, `${stableId}.json`);
            await fs.writeFile(cstPath, JSON.stringify(parseResult.cst, null, 2), 'utf8');
        }

        indexFiles.push({
            id: stableId,
            relativePath: file.relativePath,
            language: parseResult.file.language,
            status: parseResult.status,
            cstPath: cstPath ? path.relative(analysisDir, cstPath) : undefined
        });
    }

    const cstIndex: CSTIndex = {
        repositoryRoot,
        generatedAt: new Date().toISOString(),
        version: CST_SCHEMA_VERSION,
        files: indexFiles
    };

    await fs.writeFile(indexPath, JSON.stringify(cstIndex, null, 2), 'utf8');

    return {
        repositoryRoot,
        totalFiles: scannedFiles.length,
        sourceFiles: parsedFiles + syntaxErrorFiles, // Supported & parsed
        parsedFiles,
        syntaxErrorFiles,
        unsupportedFiles,
        skippedFiles,
        failedFiles,
        cstDirectory: analysisDir,
        indexPath,
        durationMs: Date.now() - startTime
    };
}
