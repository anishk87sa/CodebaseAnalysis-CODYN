import path from 'node:path';

export interface SymbolInfo {
    id: string;          // e.g., "src/A.ts::foo"
    name: string;        // e.g., "foo"
    type: string;        // e.g., "function", "class"
    file: string;        // e.g., "src/A.ts"
    isExported: boolean;
}

export interface ImportInfo {
    localName: string;   // Name used in this file
    importedName: string | 'default' | '*'; // Name exported from the other file
    sourceModule: string; // The raw import string, e.g. "./utils"
}

export class ProjectSymbolTable {
    // file path -> local symbols
    public symbolsByFile: Map<string, Map<string, SymbolInfo>> = new Map();
    
    // file path -> imported symbols
    public importsByFile: Map<string, Map<string, ImportInfo>> = new Map();

    public addSymbol(file: string, symbol: SymbolInfo) {
        if (!this.symbolsByFile.has(file)) {
            this.symbolsByFile.set(file, new Map());
        }
        this.symbolsByFile.get(file)!.set(symbol.name, symbol);
    }

    public addImport(file: string, importInfo: ImportInfo) {
        if (!this.importsByFile.has(file)) {
            this.importsByFile.set(file, new Map());
        }
        this.importsByFile.get(file)!.set(importInfo.localName, importInfo);
    }

    // Resolves a relative import path to a repository-relative path
    // Assumes repositoryRoot is conceptually the root of our "relative" paths
    public resolveModulePath(currentFile: string, modulePath: string): string {
        if (!modulePath.startsWith('.')) {
            // It's a third-party or built-in module (e.g. "fs", "react")
            return modulePath;
        }

        const currentDir = path.dirname(currentFile);
        let resolvedPath = path.join(currentDir, modulePath).replace(/\\/g, '/');
        return resolvedPath;
    }

    public resolveSymbol(currentFile: string, name: string): SymbolInfo | undefined {
        // 1. Check local symbols
        const localSymbols = this.symbolsByFile.get(currentFile);
        if (localSymbols && localSymbols.has(name)) {
            return localSymbols.get(name);
        }

        // 2. Check imports
        const imports = this.importsByFile.get(currentFile);
        if (imports && imports.has(name)) {
            const imp = imports.get(name)!;
            const targetModule = this.resolveModulePath(currentFile, imp.sourceModule);
            
            // Try to find the exact file. It could be .ts, .js, .tsx etc.
            // We can search through all files in the symbol table that start with the targetModule
            let targetFile = targetModule;
            let foundTargetFile = Array.from(this.symbolsByFile.keys()).find(f => 
                f === targetFile || 
                f === targetFile + '.ts' || 
                f === targetFile + '.tsx' || 
                f === targetFile + '.js' ||
                f === targetFile + '/index.ts' ||
                f === targetFile + '/index.js'
            );

            if (foundTargetFile) {
                const targetSymbols = this.symbolsByFile.get(foundTargetFile);
                if (targetSymbols) {
                    if (imp.importedName === 'default') {
                        // Find a symbol that is exported as default. 
                        // Simplified: we might just return the first exported symbol if we didn't track 'default' perfectly, 
                        // but let's assume it's named 'default' or we just pick the main exported function.
                        const def = Array.from(targetSymbols.values()).find(s => s.name === 'default' || s.isExported);
                        if (def) return def;
                    } else if (imp.importedName === '*') {
                        // Namespace import. Returning a dummy namespace symbol.
                        return { id: `module:${foundTargetFile}`, name: targetModule, type: 'module', file: foundTargetFile, isExported: true };
                    } else {
                        // Named import
                        if (targetSymbols.has(imp.importedName)) {
                            return targetSymbols.get(imp.importedName);
                        }
                    }
                }
            }
        }

        return undefined;
    }
}
