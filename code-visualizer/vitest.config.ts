import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Vitest config for backend/Electron service tests.
// We do NOT include the vite-plugin-electron-renderer here because that plugin
// rewrites node: imports for the browser renderer context, which breaks tests
// that run in Node and use real fs/path/crypto.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Provide a longer timeout for the tree-sitter WASM load
        testTimeout: 20000,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        }
    },
    // Tell Vite not to transform node_modules for our tests
    optimizeDeps: {
        exclude: ['web-tree-sitter'],
    }
});
