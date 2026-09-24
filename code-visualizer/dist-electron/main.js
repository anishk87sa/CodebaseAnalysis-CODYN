"use strict";
const electron = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
async function getDirectoryTree(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    const node = {
      name: path.basename(dirPath) || dirPath,
      path: dirPath,
      type: stats.isDirectory() ? "directory" : "file"
    };
    if (stats.isDirectory()) {
      node.children = [];
      const files = await fs.readdir(dirPath);
      const childNodes = [];
      for (const file of files) {
        if (file === "node_modules" || file === ".git" || file === "dist" || file === ".DS_Store") {
          continue;
        }
        const fullPath = path.join(dirPath, file);
        try {
          const childNode = await getDirectoryTree(fullPath);
          if (childNode) {
            childNodes.push(childNode);
          }
        } catch (err) {
          console.error(`Could not read file: ${fullPath}`, err);
        }
      }
      childNodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === "directory" ? -1 : 1;
      });
      node.children = childNodes;
    }
    return node;
  } catch (err) {
    console.error(`Error generating tree for ${dirPath}`, err);
    return null;
  }
}
const DEFAULT_IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".cache",
  "tmp",
  "temp",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".vite",
  ".parcel-cache",
  "turbo",
  ".bazel",
  ".gradle",
  ".idea",
  ".vscode",
  "__pycache__",
  ".venv",
  "venv"
]);
const DEFAULT_IGNORED_FILES = /* @__PURE__ */ new Set([
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "composer.lock"
]);
const DEFAULT_IGNORED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp3",
  ".wav",
  ".mp4",
  ".mov",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".wasm",
  ".map",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);
function shouldIgnoreDirectory(dirName) {
  return DEFAULT_IGNORED_DIRECTORIES.has(dirName);
}
function shouldIgnoreFile(fileName, extension) {
  if (DEFAULT_IGNORED_FILES.has(fileName)) {
    return true;
  }
  if (DEFAULT_IGNORED_EXTENSIONS.has(extension.toLowerCase())) {
    return true;
  }
  return false;
}
const MAX_SOURCE_FILE_SIZE = 5 * 1024 * 1024;
class SourceScanner {
  constructor(rootPath) {
    this.rootPath = rootPath;
  }
  /**
   * Recursively walk the directory, identifying valid source files and ignoring irrelevant ones.
   */
  async scan() {
    return this.walkDirectory(this.rootPath, "");
  }
  async walkDirectory(currentDir, relativeDir) {
    const results = [];
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryName = entry.name;
        const absolutePath = path.join(currentDir, entryName);
        const relativePath = relativeDir ? `${relativeDir}/${entryName}` : entryName;
        if (entry.isDirectory()) {
          if (shouldIgnoreDirectory(entryName)) {
            continue;
          }
          const subResults = await this.walkDirectory(absolutePath, relativePath);
          results.push(...subResults);
        } else if (entry.isFile()) {
          const extension = path.extname(entryName);
          if (shouldIgnoreFile(entryName, extension)) {
            continue;
          }
          try {
            const stats = await fs.stat(absolutePath);
            results.push({
              absolutePath,
              relativePath,
              name: entryName,
              extension,
              type: "file",
              size: stats.size
            });
          } catch (statErr) {
            console.error(`Could not stat file ${absolutePath}:`, statErr);
          }
        }
      }
    } catch (dirErr) {
      console.error(`Could not read directory ${currentDir}:`, dirErr);
    }
    return results;
  }
}
const SUPPORTED_LANGUAGES = [
  {
    id: "javascript",
    extensions: [".js", ".jsx", ".cjs", ".mjs"],
    wasmFilename: "tree-sitter-javascript.wasm"
  },
  {
    id: "typescript",
    extensions: [".ts", ".tsx"],
    wasmFilename: "tree-sitter-typescript.wasm"
    // Usually tree-sitter-typescript provides typescript and tsx wasms
  }
  // We can add more languages here as we get their .wasm files
];
function getLanguageForExtension(extension) {
  return SUPPORTED_LANGUAGES.find((lang) => lang.extensions.includes(extension.toLowerCase()));
}
function serializeCST(node) {
  const children = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      children.push(serializeCST(child));
    }
  }
  const text = children.length === 0 ? node.text : void 0;
  return {
    type: node.type,
    named: node.isNamed,
    startPosition: { row: node.startPosition.row, column: node.startPosition.column },
    endPosition: { row: node.endPosition.row, column: node.endPosition.column },
    startByte: node.startIndex,
    endByte: node.endIndex,
    text,
    children
  };
}
let _treeSitterModule = null;
function getTreeSitter() {
  if (!_treeSitterModule) {
    _treeSitterModule = require("web-tree-sitter");
  }
  return _treeSitterModule;
}
function resolveWasmDir() {
  const from2Up = path.resolve(__dirname, "../../node_modules/tree-sitter-wasms/out");
  const from3Up = path.resolve(__dirname, "../../../node_modules/tree-sitter-wasms/out");
  try {
    require("fs").accessSync(from2Up);
    return from2Up;
  } catch {
    return from3Up;
  }
}
const WASM_DIR = resolveWasmDir();
let isInitialized = false;
const loadedLanguages = /* @__PURE__ */ new Map();
async function initializeParser() {
  if (!isInitialized) {
    const { Parser } = getTreeSitter();
    await Parser.init();
    isInitialized = true;
  }
}
async function getLanguage(langDef) {
  if (loadedLanguages.has(langDef.id)) {
    return loadedLanguages.get(langDef.id);
  }
  try {
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
async function parseFile(absolutePath, relativePath) {
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
    const sourceCode = await fs.readFile(absolutePath, "utf8");
    const tree = parser.parse(sourceCode);
    const hasError = tree.rootNode.hasError;
    const cst = serializeCST(tree.rootNode);
    tree.delete();
    parser.delete();
    return {
      status: hasError ? "syntax_error" : "success",
      file: { path: absolutePath, relativePath, language: langDef.id },
      cst
    };
  } catch (err) {
    return {
      status: "parse_error",
      file: { path: absolutePath, relativePath, language: langDef == null ? void 0 : langDef.id },
      errors: [{ message: err.message || "Unknown parse error" }]
    };
  }
}
const CST_SCHEMA_VERSION = "1.0";
const ANALYSIS_DIR_NAME$1 = ".codyn";
function getStableId(relativePath) {
  return crypto.createHash("sha256").update(relativePath).digest("hex");
}
async function analyzeRepository(repositoryRoot) {
  const startTime = Date.now();
  const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME$1, "analysis", "cst");
  const filesDir = path.join(analysisDir, "files");
  const indexPath = path.join(analysisDir, "index.json");
  await fs.mkdir(filesDir, { recursive: true });
  const scanner = new SourceScanner(repositoryRoot);
  const scannedFiles = await scanner.scan();
  let parsedFiles = 0;
  let syntaxErrorFiles = 0;
  let unsupportedFiles = 0;
  let skippedFiles = 0;
  let failedFiles = 0;
  const indexFiles = [];
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
    let cstPath;
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
      await fs.writeFile(cstPath, JSON.stringify(parseResult.cst, null, 2), "utf8");
    }
    indexFiles.push({
      id: stableId,
      relativePath: file.relativePath,
      language: parseResult.file.language,
      status: parseResult.status,
      cstPath: cstPath ? path.relative(analysisDir, cstPath) : void 0
    });
  }
  const cstIndex = {
    repositoryRoot,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    version: CST_SCHEMA_VERSION,
    files: indexFiles
  };
  await fs.writeFile(indexPath, JSON.stringify(cstIndex, null, 2), "utf8");
  return {
    repositoryRoot,
    totalFiles: scannedFiles.length,
    sourceFiles: parsedFiles + syntaxErrorFiles,
    // Supported & parsed
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
const GRAPH_SCHEMA_VERSION = "1.0";
const ANALYSIS_DIR_NAME = ".codyn";
async function saveGraphData(repositoryRoot, filesGraphData) {
  const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME, "analysis", "graph");
  const filesDir = path.join(analysisDir, "files");
  const indexPath = path.join(analysisDir, "index.json");
  await fs.mkdir(filesDir, { recursive: true });
  let totalNodeCount = 0;
  let totalEdgeCount = 0;
  for (const fileGraph of filesGraphData) {
    const nodeIds = new Set(fileGraph.data.nodes.map((n) => n.id));
    const validEdges = fileGraph.data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    const finalGraphData = {
      nodes: fileGraph.data.nodes,
      edges: validEdges
    };
    totalNodeCount += finalGraphData.nodes.length;
    totalEdgeCount += finalGraphData.edges.length;
    const graphPath = path.join(filesDir, `${fileGraph.fileId}.json`);
    await fs.writeFile(graphPath, JSON.stringify(finalGraphData, null, 2), "utf8");
  }
  const graphIndex = {
    version: GRAPH_SCHEMA_VERSION,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    nodeCount: totalNodeCount,
    edgeCount: totalEdgeCount,
    graphPath: path.relative(analysisDir, filesDir)
  };
  await fs.writeFile(indexPath, JSON.stringify(graphIndex, null, 2), "utf8");
  return {
    nodeCount: totalNodeCount,
    edgeCount: totalEdgeCount,
    outputPath: indexPath
  };
}
const MEANINGFUL_NODE_TYPES = /* @__PURE__ */ new Set([
  "function_declaration",
  "method_definition",
  "class_declaration",
  "interface_declaration",
  "enum_declaration",
  "struct_declaration",
  "module_declaration",
  "file"
]);
async function generateGraph(repositoryRoot) {
  const analysisDir = path.join(repositoryRoot, ".codyn", "analysis", "cst");
  const indexPath = path.join(analysisDir, "index.json");
  let indexData;
  try {
    const indexRaw = await fs.readFile(indexPath, "utf8");
    indexData = JSON.parse(indexRaw);
  } catch (e) {
    throw new Error(`Failed to read CST index at ${indexPath}. Has analysis been run?`);
  }
  const filesGraphData = [];
  for (const file of indexData.files) {
    if (!file.cstPath) continue;
    const cstFilePath = path.join(analysisDir, file.cstPath);
    let cstData;
    try {
      const cstRaw = await fs.readFile(cstFilePath, "utf8");
      cstData = JSON.parse(cstRaw);
    } catch (e) {
      console.error(`Failed to read CST file: ${cstFilePath}`);
      continue;
    }
    const nodes = [];
    const edges = [];
    const fileNodeId = `file:${file.relativePath}`;
    nodes.push({
      id: fileNodeId,
      type: "file",
      label: path.basename(file.relativePath),
      file: file.relativePath
    });
    traverseCST(cstData, file.relativePath, fileNodeId, nodes, edges);
    filesGraphData.push({
      fileId: file.id,
      // Using the stable id from the CST index
      relativePath: file.relativePath,
      data: { nodes, edges }
    });
  }
  return await saveGraphData(repositoryRoot, filesGraphData);
}
function traverseCST(node, relativePath, parentNodeId, nodes, edges) {
  let currentMeaningfulNodeId = parentNodeId;
  if (MEANINGFUL_NODE_TYPES.has(node.type)) {
    let label = getIdentifierLabel(node) || node.type;
    const nodeTypeCleaned = node.type.replace("_declaration", "").replace("_definition", "");
    const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
    if (!nodes.some((n) => n.id === nodeId)) {
      nodes.push({
        id: nodeId,
        type: nodeTypeCleaned,
        label,
        file: relativePath
      });
    }
    if (parentNodeId && parentNodeId !== nodeId) {
      const edgeType = "contains";
      const edgeId = `${parentNodeId}->${nodeId}:${edgeType}`;
      if (!edges.some((e) => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: parentNodeId,
          target: nodeId,
          type: edgeType
        });
      }
    }
    currentMeaningfulNodeId = nodeId;
  }
  if (node.children) {
    for (const child of node.children) {
      traverseCST(child, relativePath, currentMeaningfulNodeId, nodes, edges);
    }
  }
}
function getIdentifierLabel(node) {
  if (node.children) {
    const idNode = node.children.find(
      (c) => c.type === "identifier" || c.type === "property_identifier" || c.type === "type_identifier" || c.type === "name"
    );
    if (idNode && idNode.text) {
      return idNode.text;
    }
  }
  return void 0;
}
function registerIpcHandlers(win2) {
  electron.ipcMain.handle("repository:selectFolder", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog(win2, {
      properties: ["openDirectory"]
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });
  electron.ipcMain.handle("repository:getTree", async (_, dirPath) => {
    try {
      const tree = await getDirectoryTree(dirPath);
      return tree;
    } catch (err) {
      console.error(err);
      return null;
    }
  });
  electron.ipcMain.handle("repository:analyzeCST", async (_, dirPath) => {
    try {
      const result = await analyzeRepository(dirPath);
      return result;
    } catch (err) {
      console.error(err);
      return null;
    }
  });
  electron.ipcMain.handle("graph:generate", async (_, dirPath) => {
    try {
      const result = await generateGraph(dirPath);
      return result;
    } catch (err) {
      console.error(err);
      return null;
    }
  });
}
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  win = new electron.BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    width: 1024,
    height: 768
  });
  registerIpcHandlers(win);
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
    win = null;
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.whenReady().then(createWindow);
