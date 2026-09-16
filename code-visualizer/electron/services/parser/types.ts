export interface CSTNode {
    type: string;
    named: boolean;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    startByte: number;
    endByte: number;
    text?: string;
    children: CSTNode[];
}

export interface ParseResult {
    status: "success" | "syntax_error" | "unsupported" | "too_large" | "read_error" | "parse_error";
    file: {
        path: string;
        relativePath: string;
        language?: string;
    };
    cst?: CSTNode;
    errors?: { message: string }[];
}

export interface CSTIndex {
    repositoryRoot: string;
    generatedAt: string;
    version: string;
    files: {
        id: string;
        relativePath: string;
        language?: string;
        status: string;
        cstPath?: string;
    }[];
}

export interface RepositoryAnalysisResult {
    repositoryRoot: string;
    totalFiles: number;
    sourceFiles: number;
    parsedFiles: number;
    syntaxErrorFiles: number;
    unsupportedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    cstDirectory: string;
    indexPath: string;
    durationMs: number;
}
