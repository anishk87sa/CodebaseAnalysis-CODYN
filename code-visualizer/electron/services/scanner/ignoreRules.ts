export const DEFAULT_IGNORED_DIRECTORIES = new Set([
    '.git',
    'node_modules',
    'vendor',
    'dist',
    'build',
    'out',
    'target',
    'coverage',
    '.cache',
    'tmp',
    'temp',
    '.next',
    '.nuxt',
    '.svelte-kit',
    '.vite',
    '.parcel-cache',
    'turbo',
    '.bazel',
    '.gradle',
    '.idea',
    '.vscode',
    '__pycache__',
    '.venv',
    'venv',
]);

export const DEFAULT_IGNORED_FILES = new Set([
    '.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'composer.lock',
]);

export const DEFAULT_IGNORED_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    '.mp3', '.wav', '.mp4', '.mov',
    '.zip', '.tar', '.gz', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.class', '.jar', '.wasm', '.map',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
]);

export function shouldIgnoreDirectory(dirName: string): boolean {
    return DEFAULT_IGNORED_DIRECTORIES.has(dirName);
}

export function shouldIgnoreFile(fileName: string, extension: string): boolean {
    if (DEFAULT_IGNORED_FILES.has(fileName)) {
        return true;
    }
    if (DEFAULT_IGNORED_EXTENSIONS.has(extension.toLowerCase())) {
        return true;
    }
    return false;
}
