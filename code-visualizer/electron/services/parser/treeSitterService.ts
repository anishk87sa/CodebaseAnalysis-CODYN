// web-tree-sitter is a CommonJS module. We need to load it dynamically so this
// file works both when Vite bundles it as CJS for Electron AND when Vitest
// imports it as ESM. We delay the require to runtime to avoid bundler issues.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getLanguageForExtension, LanguageDefinition } from './languageRegistry';
import { serializeCST } from './cstSerializer';
import { ParseResult } from './types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
type TreeSitterModule = typeof import('web-tree-sitter');
let _treeSitterModule: TreeSitterModule | null = null;

function getTreeSitter(): TreeSitterModule {
    if (!_treeSitterModule) {
        // Works in CJS (Electron main bundle) and in Vitest Node environment
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _treeSitterModule = require('web-tree-sitter') as TreeSitterModule;
    }
    return _treeSitterModule!;
}

// Resolve the WASM grammar directory relative to the project root.
// In dev+Electron: __dirname = dist-electron/ → go up 1 level to project root
// In Vitest: __dirname = electron/services/parser/ → go up 3 levels to project root
function resolveWasmDir(): string {
    const fromElectron = path.resolve(__dirname, '../node_modules/tree-sitter-wasms/out');
    const fromVitest = path.resolve(__dirname, '../../../node_modules/tree-sitter-wasms/out');
    try {
        require('fs').accessSync(fromElectron);
        return fromElectron;
    } catch {
        return fromVitest;
    }
}
const WASM_DIR = resolveWasmDir();

let isInitialized = false;
// Use a plain any map to avoid depending on the Parser type before it's loaded
const loadedLanguages = new Map<string, any>();

export async function initializeParser() {
    if (!isInitialized) {
        const { Parser } = getTreeSitter();
        await Parser.init();
        isInitialized = true;
    }
}

async function getLanguage(langDef: LanguageDefinition): Promise<any | null> {
    if (loadedLanguages.has(langDef.id)) {
        return loadedLanguages.get(langDef.id);
    }
    try {
        // Language is a top-level export on the module, not Parser.Language
        const { Language } = getTreeSitter();
        const wasmPath = path.join(WASM_DIR, langDef.wasmFilename);
        const language = await Language.load(wasmPath);
        loadedLanguages.set(langDef.id, language);
        return language;
    } catch (err) {
        console.error(`Failed to load grammar for ${langDef.id}`, err);
        return null;
    }
}

export async function parseFile(absolutePath: string, relativePath: string): Promise<ParseResult> {
    const extension = path.extname(absolutePath);
    const langDef = getLanguageForExtension(extension);

    if (!langDef) {
        return {
            status: "unsupported",
            file: { path: absolutePath, relativePath }
        };
    }

    try {
        await initializeParser();
        const language = await getLanguage(langDef);
        
        if (!language) {
            return {
                status: "parse_error",
                file: { path: absolutePath, relativePath, language: langDef.id },
                errors: [{ message: `Could not load language grammar for ${langDef.id}` }]
            };
        }

        const { Parser } = getTreeSitter();
        const parser = new Parser();
        parser.setLanguage(language);

        const sourceCode = await fs.readFile(absolutePath, 'utf8');
        const tree = parser.parse(sourceCode);
        if (!tree) {
            return {
                status: "parse_error",
                file: { path: absolutePath, relativePath, language: langDef.id },
                errors: [{ message: 'Parser returned null tree' }]
            };
        }
        
        const hasError = tree.rootNode.hasError;
        const cst = serializeCST(tree.rootNode);
        
        tree.delete(); // Free up memory from WASM
        parser.delete();

        return {
            status: hasError ? "syntax_error" : "success",
            file: { path: absolutePath, relativePath, language: langDef.id },
            cst
        };

    } catch (err: any) {
        return {
            status: "parse_error",
            file: { path: absolutePath, relativePath, language: langDef?.id },
            errors: [{ message: err.message || 'Unknown parse error' }]
        };
    }
}
