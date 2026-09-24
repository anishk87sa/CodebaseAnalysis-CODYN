import type { Node as SyntaxNode } from 'web-tree-sitter';
import { CSTNode } from './types';

export function serializeCST(node: SyntaxNode): CSTNode {
    const children: CSTNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            children.push(serializeCST(child));
        }
    }

    // Only include text for leaf nodes to save space
    const text = children.length === 0 ? node.text : undefined;

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
