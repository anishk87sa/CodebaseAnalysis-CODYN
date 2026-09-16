# Codyn — Offline Code Analyzer

Codyn is a desktop application for analyzing source-code repositories offline. It parses supported source files using [Tree-sitter](https://tree-sitter.github.io/) and generates a Concrete Syntax Tree (CST) for each file, stored persistently for future features like visualization and function-call graph extraction.

---

## Supported Languages

| Language   | Extensions                        | WASM File                        |
|------------|-----------------------------------|----------------------------------|
| JavaScript | `.js`, `.jsx`, `.cjs`, `.mjs`     | `tree-sitter-javascript.wasm`    |
| TypeScript | `.ts`, `.tsx`                     | `tree-sitter-typescript.wasm`    |

> **Adding more languages:** Edit `electron/services/parser/languageRegistry.ts` and add a new `LanguageDefinition` entry with the extension list and WASM filename. The WASM file must exist in `node_modules/tree-sitter-wasms/out/`. The package `tree-sitter-wasms` already bundles grammars for Go, Rust, Python, Java, C, C++, and many others — see the full list in `node_modules/tree-sitter-wasms/out/`.

---

## Ignored Directories

The following directories are never scanned:

```
.git, node_modules, vendor, dist, build, out, target, coverage, .cache,
tmp, temp, .next, .nuxt, .svelte-kit, .vite, .parcel-cache, turbo,
.bazel, .gradle, .idea, .vscode, __pycache__, .venv, venv
```

## Ignored Files

The following filenames are never parsed:

```
.gitignore, .gitattributes, .gitmodules, .env, .env.local, .env.production,
.env.development, package-lock.json, yarn.lock, pnpm-lock.yaml, Cargo.lock,
composer.lock
```

The following file extensions are ignored (binary, media, generated):

```
.png, .jpg, .jpeg, .gif, .webp, .svg, .ico, .mp3, .wav, .mp4, .mov,
.zip, .tar, .gz, .7z, .exe, .dll, .so, .dylib, .class, .jar, .wasm,
.map, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx
```

Files larger than **5 MB** are skipped and recorded as `too_large`.

---

## CST Storage Location

CST data is stored **inside the selected repository** under:

```
<repository-root>/
└── .codyn/
    └── analysis/
        └── cst/
            ├── index.json          <- Index of all files and their parse status
            └── files/
                ├── <sha256-id>.json  <- CST for each parsed file
                └── ...
```

> The `.codyn/` directory is separate from your source files and is safe to `.gitignore`.
> Existing source files are **never modified**.

---

## CST JSON Schema

### `index.json`

```json
{
  "repositoryRoot": "C:/Projects/my-app",
  "generatedAt": "2026-09-16T06:49:00.000Z",
  "version": "1.0",
  "files": [
    {
      "id": "a3f2...",
      "relativePath": "src/utils/parser.ts",
      "language": "typescript",
      "status": "success",
      "cstPath": "files/a3f2....json"
    }
  ]
}
```

**Possible `status` values:** `success`, `syntax_error`, `unsupported`, `too_large`, `read_error`, `parse_error`

### `files/<id>.json` (CST Node)

```json
{
  "type": "program",
  "named": true,
  "startPosition": { "row": 0, "column": 0 },
  "endPosition": { "row": 10, "column": 1 },
  "startByte": 0,
  "endByte": 210,
  "children": [
    {
      "type": "function_declaration",
      "named": true,
      "startPosition": { "row": 0, "column": 0 },
      "endPosition": { "row": 2, "column": 1 },
      "startByte": 0,
      "endByte": 60,
      "children": [...]
    }
  ]
}
```

Leaf nodes (no children) include a `text` field with the literal source text.

---

## How to Run the Analyzer

1. Start Codyn in development mode:
   ```bash
   cd code-visualizer
   npm run dev
   ```

2. Click **START** on the home screen.

3. Click **LOAD REPOSITORY** and select a folder.

4. Once the file tree appears, click **Analyze Repository** in the top-right header.

5. Codyn will scan the repository, parse supported files, and display a summary.

6. Inspect the generated files in `<repo>/.codyn/analysis/cst/`.

---

## Running Tests

```bash
cd code-visualizer
npm run test
```

Tests run with **Vitest** in a Node environment (no Electron needed).

| Test file              | What is covered                                      |
|------------------------|------------------------------------------------------|
| `tests/scanner.test.ts`| Directory/file ignore rules, valid source detection  |
| `tests/parser.test.ts` | Valid TypeScript parse, syntax-error handling, unsupported extensions |
| `tests/storage.test.ts`| Full analysis pipeline: index.json created, CST written, status correct |

---

## Adding Another Tree-sitter Grammar

1. Confirm the WASM file exists in `node_modules/tree-sitter-wasms/out/`.
   Example: `tree-sitter-go.wasm`

2. Open `electron/services/parser/languageRegistry.ts` and add:

   ```ts
   {
       id: 'go',
       extensions: ['.go'],
       wasmFilename: 'tree-sitter-go.wasm'
   },
   ```

3. Done. The scanner automatically detects `.go` files and persists their CSTs.

---

## Limitations

- **web-tree-sitter pinned to 0.25.x** — The `tree-sitter-wasms` prebuilt WASM files use the older ABI, incompatible with 0.26+. To upgrade, rebuild grammar WASMs from source with `tree-sitter build --wasm`.
- **Sequential processing** — Files are parsed one at a time. The architecture is ready for a parallel worker pool to be added later.
- **CST visualization not yet implemented** — The React Flow graph view will be added in a future stage.
