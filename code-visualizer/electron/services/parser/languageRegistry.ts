import path from 'node:path';

export interface LanguageDefinition {
    id: string;
    extensions: string[];
    wasmFilename: string;
}

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
    {
        id: 'javascript',
        extensions: ['.js', '.jsx', '.cjs', '.mjs'],
        wasmFilename: 'tree-sitter-javascript.wasm'
    },
    {
        id: 'typescript',
        extensions: ['.ts', '.tsx'],
        wasmFilename: 'tree-sitter-typescript.wasm' // Usually tree-sitter-typescript provides typescript and tsx wasms
    },
    // We can add more languages here as we get their .wasm files
];

export function getLanguageForExtension(extension: string): LanguageDefinition | undefined {
    return SUPPORTED_LANGUAGES.find(lang => lang.extensions.includes(extension.toLowerCase()));
}
