"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
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
        if (file === "node_modules" || file === ".git" || file === "dist" || file === ".DS_Store" || file === ".codyn") {
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
    __publicField(this, "rootPath");
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
  const fromElectron = path.resolve(__dirname, "../node_modules/tree-sitter-wasms/out");
  const fromVitest = path.resolve(__dirname, "../../../node_modules/tree-sitter-wasms/out");
  try {
    require("fs").accessSync(fromElectron);
    return fromElectron;
  } catch {
    return fromVitest;
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
    if (!tree) {
      return {
        status: "parse_error",
        file: { path: absolutePath, relativePath, language: langDef.id },
        errors: [{ message: "Parser returned null tree" }]
      };
    }
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
const GRAPH_SCHEMA_VERSION = "2.0";
const ANALYSIS_DIR_NAME = ".codyn";
async function saveGlobalGraphData(repositoryRoot, globalGraph) {
  const analysisDir = path.join(repositoryRoot, ANALYSIS_DIR_NAME, "analysis", "graph");
  const indexPath = path.join(analysisDir, "index.json");
  const globalGraphPath = path.join(analysisDir, "global_graph.json");
  await fs.mkdir(analysisDir, { recursive: true });
  const nodeIds = new Set(globalGraph.nodes.map((n) => n.id));
  const validEdges = globalGraph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  globalGraph.edges = validEdges;
  await fs.writeFile(globalGraphPath, JSON.stringify(globalGraph, null, 2), "utf8");
  const graphIndex = {
    version: GRAPH_SCHEMA_VERSION,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    nodeCount: globalGraph.nodes.length,
    edgeCount: globalGraph.edges.length,
    graphPath: "global_graph.json"
  };
  await fs.writeFile(indexPath, JSON.stringify(graphIndex, null, 2), "utf8");
  return {
    nodeCount: globalGraph.nodes.length,
    edgeCount: globalGraph.edges.length,
    outputPath: indexPath
  };
}
class ProjectSymbolTable {
  constructor() {
    // file path -> local symbols
    __publicField(this, "symbolsByFile", /* @__PURE__ */ new Map());
    // file path -> imported symbols
    __publicField(this, "importsByFile", /* @__PURE__ */ new Map());
  }
  addSymbol(file, symbol) {
    if (!this.symbolsByFile.has(file)) {
      this.symbolsByFile.set(file, /* @__PURE__ */ new Map());
    }
    this.symbolsByFile.get(file).set(symbol.name, symbol);
  }
  addImport(file, importInfo) {
    if (!this.importsByFile.has(file)) {
      this.importsByFile.set(file, /* @__PURE__ */ new Map());
    }
    this.importsByFile.get(file).set(importInfo.localName, importInfo);
  }
  // Resolves a relative import path to a repository-relative path
  // Assumes repositoryRoot is conceptually the root of our "relative" paths
  resolveModulePath(currentFile, modulePath) {
    if (!modulePath.startsWith(".")) {
      return modulePath;
    }
    const currentDir = path.dirname(currentFile);
    let resolvedPath = path.join(currentDir, modulePath).replace(/\\/g, "/");
    return resolvedPath;
  }
  resolveSymbol(currentFile, name) {
    const localSymbols = this.symbolsByFile.get(currentFile);
    if (localSymbols && localSymbols.has(name)) {
      return localSymbols.get(name);
    }
    const imports = this.importsByFile.get(currentFile);
    if (imports && imports.has(name)) {
      const imp = imports.get(name);
      const targetModule = this.resolveModulePath(currentFile, imp.sourceModule);
      let targetFile = targetModule;
      let foundTargetFile = Array.from(this.symbolsByFile.keys()).find(
        (f) => f === targetFile || f === targetFile + ".ts" || f === targetFile + ".tsx" || f === targetFile + ".js" || f === targetFile + "/index.ts" || f === targetFile + "/index.js"
      );
      if (foundTargetFile) {
        const targetSymbols = this.symbolsByFile.get(foundTargetFile);
        if (targetSymbols) {
          if (imp.importedName === "default") {
            const def = Array.from(targetSymbols.values()).find((s) => s.name === "default" || s.isExported);
            if (def) return def;
          } else if (imp.importedName === "*") {
            return { id: `module:${foundTargetFile}`, name: targetModule, type: "module", file: foundTargetFile, isExported: true };
          } else {
            if (targetSymbols.has(imp.importedName)) {
              return targetSymbols.get(imp.importedName);
            }
          }
        }
      }
    }
    return void 0;
  }
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
  const symbolTable = new ProjectSymbolTable();
  const globalNodes = /* @__PURE__ */ new Map();
  const globalEdges = /* @__PURE__ */ new Map();
  const cstCache = /* @__PURE__ */ new Map();
  for (const file of indexData.files) {
    if (!file.cstPath) continue;
    const cstFilePath = path.join(analysisDir, file.cstPath);
    let cstData;
    try {
      const cstRaw = await fs.readFile(cstFilePath, "utf8");
      cstData = JSON.parse(cstRaw);
      cstCache.set(file.relativePath, cstData);
    } catch (e) {
      console.error(`Failed to read CST file: ${cstFilePath}`);
      continue;
    }
    const fileNodeId = `file:${file.relativePath}`;
    globalNodes.set(fileNodeId, {
      id: fileNodeId,
      type: "file",
      label: path.basename(file.relativePath),
      file: file.relativePath
    });
    extractSymbolsAndContains(cstData, file.relativePath, fileNodeId, globalNodes, globalEdges, symbolTable);
    extractImports(cstData, file.relativePath, symbolTable);
  }
  for (const [relativePath, cstData] of cstCache.entries()) {
    const fileNodeId = `file:${relativePath}`;
    extractCalls(cstData, relativePath, fileNodeId, globalNodes, globalEdges, symbolTable);
  }
  const nodes = Array.from(globalNodes.values());
  const edges = Array.from(globalEdges.values());
  const functionsByFile = {};
  const callsFrom = {};
  const callsTo = {};
  for (const node of nodes) {
    if (node.file) {
      if (!functionsByFile[node.file]) functionsByFile[node.file] = [];
      functionsByFile[node.file].push(node.id);
    }
  }
  for (const edge of edges) {
    if (edge.type === "calls") {
      if (!callsFrom[edge.source]) callsFrom[edge.source] = [];
      callsFrom[edge.source].push(edge.target);
      if (!callsTo[edge.target]) callsTo[edge.target] = [];
      callsTo[edge.target].push(edge.source);
    }
  }
  const globalGraph = {
    nodes,
    edges,
    functionsByFile,
    callsFrom,
    callsTo
  };
  return await saveGlobalGraphData(repositoryRoot, globalGraph);
}
function extractSymbolsAndContains(node, relativePath, parentNodeId, globalNodes, globalEdges, symbolTable, isExportedContext = false) {
  let currentMeaningfulNodeId = parentNodeId;
  let currentlyExported = isExportedContext;
  if (node.type === "export_statement") {
    currentlyExported = true;
  }
  if (MEANINGFUL_NODE_TYPES.has(node.type)) {
    let label = getIdentifierLabel(node) || node.type;
    const nodeTypeCleaned = node.type.replace("_declaration", "").replace("_definition", "");
    const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
    if (!globalNodes.has(nodeId)) {
      globalNodes.set(nodeId, {
        id: nodeId,
        type: nodeTypeCleaned,
        label,
        file: relativePath
      });
      symbolTable.addSymbol(relativePath, {
        id: nodeId,
        name: label,
        type: nodeTypeCleaned,
        file: relativePath,
        isExported: currentlyExported
      });
    }
    if (parentNodeId && parentNodeId !== nodeId) {
      const edgeType = "contains";
      const edgeId = `${parentNodeId}->${nodeId}:${edgeType}`;
      if (!globalEdges.has(edgeId)) {
        globalEdges.set(edgeId, {
          id: edgeId,
          source: parentNodeId,
          target: nodeId,
          type: edgeType
        });
      }
    }
    currentMeaningfulNodeId = nodeId;
    currentlyExported = false;
  }
  if (node.children) {
    for (const child of node.children) {
      extractSymbolsAndContains(child, relativePath, currentMeaningfulNodeId, globalNodes, globalEdges, symbolTable, currentlyExported);
    }
  }
}
function extractImports(node, relativePath, symbolTable) {
  var _a, _b, _c, _d;
  if (node.type === "import_statement") {
    const sourceNode = (_a = node.children) == null ? void 0 : _a.find((c) => c.type === "string");
    const fragment = (_b = sourceNode == null ? void 0 : sourceNode.children) == null ? void 0 : _b.find((c) => c.type === "string_fragment");
    const sourceModule = fragment == null ? void 0 : fragment.text;
    if (sourceModule) {
      const importClause = (_c = node.children) == null ? void 0 : _c.find((c) => c.type === "import_clause");
      if (importClause && importClause.children) {
        const namedImports = importClause.children.find((c) => c.type === "named_imports");
        if (namedImports && namedImports.children) {
          for (const specifier of namedImports.children.filter((c) => c.type === "import_specifier")) {
            const ids = (_d = specifier.children) == null ? void 0 : _d.filter((c) => c.type === "identifier");
            if (ids && ids.length > 0) {
              const importedName = ids[0].text;
              const localName = ids.length > 1 ? ids[1].text : importedName;
              symbolTable.addImport(relativePath, { localName, importedName, sourceModule });
            }
          }
        }
        const idNode = importClause.children.find((c) => c.type === "identifier");
        if (idNode && idNode.text) {
          symbolTable.addImport(relativePath, { localName: idNode.text, importedName: "default", sourceModule });
        }
        const namespaceImport = importClause.children.find((c) => c.type === "namespace_import");
        if (namespaceImport && namespaceImport.children) {
          const nsId = namespaceImport.children.find((c) => c.type === "identifier");
          if (nsId && nsId.text) {
            symbolTable.addImport(relativePath, { localName: nsId.text, importedName: "*", sourceModule });
          }
        }
      }
    }
  }
  if (node.children) {
    for (const child of node.children) {
      extractImports(child, relativePath, symbolTable);
    }
  }
}
function extractCalls(node, relativePath, parentNodeId, globalNodes, globalEdges, symbolTable) {
  let currentMeaningfulNodeId = parentNodeId;
  if (MEANINGFUL_NODE_TYPES.has(node.type)) {
    let label = getIdentifierLabel(node) || node.type;
    const nodeTypeCleaned = node.type.replace("_declaration", "").replace("_definition", "");
    const nodeId = `${nodeTypeCleaned}:${relativePath}:${label}`;
    currentMeaningfulNodeId = nodeId;
  } else if (node.type === "call_expression" && currentMeaningfulNodeId) {
    const calledName = getCalledFunctionName(node);
    if (calledName) {
      let baseName = calledName;
      let memberName = void 0;
      if (calledName.includes(".")) {
        const parts = calledName.split(".");
        baseName = parts[0];
        memberName = parts[1];
      }
      const resolvedSymbol = symbolTable.resolveSymbol(relativePath, baseName);
      let targetNodeId;
      let targetResolution = "unresolved";
      if (resolvedSymbol) {
        if (memberName && resolvedSymbol.type === "module") {
          const targetSymbols = symbolTable.symbolsByFile.get(resolvedSymbol.file);
          if (targetSymbols && targetSymbols.has(memberName)) {
            targetNodeId = targetSymbols.get(memberName).id;
            targetResolution = "resolved";
          } else {
            targetNodeId = `function:unresolved:${calledName}`;
          }
        } else {
          targetNodeId = resolvedSymbol.id;
          targetResolution = "resolved";
        }
      } else {
        targetNodeId = `function:unresolved:${calledName}`;
      }
      if (!globalNodes.has(targetNodeId)) {
        globalNodes.set(targetNodeId, {
          id: targetNodeId,
          type: "function",
          label: calledName,
          file: "unknown",
          resolutionStatus: targetResolution
        });
      } else {
        const existing = globalNodes.get(targetNodeId);
        if (!existing.resolutionStatus) {
          existing.resolutionStatus = targetResolution;
        }
      }
      const edgeType = "calls";
      const edgeId = `${currentMeaningfulNodeId}->${targetNodeId}:${edgeType}`;
      if (!globalEdges.has(edgeId)) {
        globalEdges.set(edgeId, {
          id: edgeId,
          source: currentMeaningfulNodeId,
          target: targetNodeId,
          type: edgeType
        });
      }
    }
  }
  if (node.children) {
    for (const child of node.children) {
      extractCalls(child, relativePath, currentMeaningfulNodeId, globalNodes, globalEdges, symbolTable);
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
function getCalledFunctionName(node) {
  var _a, _b, _c;
  const target = (_a = node.children) == null ? void 0 : _a[0];
  if (!target) return void 0;
  if (target.type === "identifier" && target.text) return target.text;
  if (target.type === "member_expression") {
    const obj = (_b = target.children) == null ? void 0 : _b.find((c) => c.type === "identifier" || c.type === "this");
    const prop = (_c = target.children) == null ? void 0 : _c.find((c) => c.type === "property_identifier");
    if (obj && prop && obj.text && prop.text) return `${obj.text}.${prop.text}`;
    if (prop && prop.text) return prop.text;
  }
  return void 0;
}
async function getFileGraphData(repositoryRoot, filePath, depth = 1) {
  const relativePath = path.relative(repositoryRoot, filePath).replace(/\\/g, "/");
  const analysisDir = path.join(repositoryRoot, ".codyn", "analysis");
  const globalGraphPath = path.join(analysisDir, "graph", "global_graph.json");
  try {
    const graphRaw = await fs.readFile(globalGraphPath, "utf8");
    const globalGraph = JSON.parse(graphRaw);
    const nodesToReturn = /* @__PURE__ */ new Map();
    const edgesToReturn = /* @__PURE__ */ new Map();
    const fileNodeId = `file:${relativePath}`;
    const fileNode = globalGraph.nodes.find((n) => n.id === fileNodeId);
    if (fileNode) {
      nodesToReturn.set(fileNodeId, fileNode);
    }
    const fileFunctions = globalGraph.functionsByFile[relativePath] || [];
    for (const fnId of fileFunctions) {
      const fnNode = globalGraph.nodes.find((n) => n.id === fnId);
      if (fnNode) {
        nodesToReturn.set(fnId, fnNode);
      }
    }
    for (const edge of globalGraph.edges) {
      if (edge.type === "contains" && nodesToReturn.has(edge.source) && nodesToReturn.has(edge.target)) {
        edgesToReturn.set(edge.id, edge);
      }
    }
    let currentLevelIds = [...fileFunctions];
    const visitedNodes = new Set(fileFunctions);
    const nodeMap = new Map(globalGraph.nodes.map((n) => [n.id, n]));
    for (let currentDepth = 0; currentDepth < depth; currentDepth++) {
      const nextLevelIds = [];
      for (const sourceId of currentLevelIds) {
        const targets = globalGraph.callsFrom[sourceId] || [];
        for (const targetId of targets) {
          const edgeId = `${sourceId}->${targetId}:calls`;
          const globalEdge = globalGraph.edges.find((e) => e.id === edgeId);
          if (globalEdge) {
            edgesToReturn.set(edgeId, globalEdge);
          }
          if (!visitedNodes.has(targetId)) {
            visitedNodes.add(targetId);
            const targetNode = nodeMap.get(targetId);
            if (targetNode) {
              nodesToReturn.set(targetId, targetNode);
              nextLevelIds.push(targetId);
            }
          }
        }
      }
      currentLevelIds = nextLevelIds;
      if (currentLevelIds.length === 0) break;
    }
    return {
      nodes: Array.from(nodesToReturn.values()),
      edges: Array.from(edgesToReturn.values())
    };
  } catch (e) {
    return null;
  }
}
async function getGlobalGraphData(repositoryRoot) {
  const analysisDir = path.join(repositoryRoot, ".codyn", "analysis");
  const globalGraphPath = path.join(analysisDir, "graph", "global_graph.json");
  try {
    const graphRaw = await fs.readFile(globalGraphPath, "utf8");
    const globalGraph = JSON.parse(graphRaw);
    const nodes = globalGraph.nodes.filter((n) => n.type === "function");
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = globalGraph.edges.filter(
      (e) => e.type === "calls" && nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return { nodes, edges };
  } catch (e) {
    return null;
  }
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
  electron.ipcMain.handle("graph:getFile", async (_, repoRoot, filePath) => {
    try {
      const data = await getFileGraphData(repoRoot, filePath);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  });
  electron.ipcMain.handle("graph:getGlobal", async (_, repoRoot) => {
    try {
      const data = await getGlobalGraphData(repoRoot);
      return data;
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
