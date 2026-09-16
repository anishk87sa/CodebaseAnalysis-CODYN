// This is a placeholder for the future AST generation logic.
// No parsing happens in Step 1.

export interface Parser {
    parseFile(filePath: string, content: string): Promise<any>;
}

export class CodeParser implements Parser {
    async parseFile(filePath: string, content: string): Promise<any> {
        // TODO: Implement parsing logic (e.g. using Tree-sitter) in a later step.
        throw new Error("Not implemented: Parser is empty in Step 1.");
    }
}
