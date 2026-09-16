import * as Parser from 'web-tree-sitter';
import path from 'path';

async function test() {
    await Parser.default.init();
    console.log("Parser init success");
    const wasmPath = path.resolve('node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm');
    const lang = await Parser.default.Language.load(wasmPath);
    console.log("Language loaded");
    const parser = new Parser.default();
    parser.setLanguage(lang);
    const tree = parser.parse('console.log("hello");');
    console.log("Parsed tree root:", tree.rootNode.type);
}
test().catch(console.error);
