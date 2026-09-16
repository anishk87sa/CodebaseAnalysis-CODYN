import fs from 'node:fs/promises';
import path from 'node:path';

export type FileNodeType = "file" | "directory";

export interface FileNode {
    name: string;
    path: string;
    type: FileNodeType;
    children?: FileNode[];
}

export async function getDirectoryTree(dirPath: string): Promise<FileNode | null> {
    try {
        const stats = await fs.stat(dirPath);
        
        const node: FileNode = {
            name: path.basename(dirPath) || dirPath,
            path: dirPath,
            type: stats.isDirectory() ? "directory" : "file"
        };

        if (stats.isDirectory()) {
            node.children = [];
            const files = await fs.readdir(dirPath);
            
            // Sort to put directories first, then files
            const childNodes: FileNode[] = [];
            
            for (const file of files) {
                // Ignore common hidden folders to avoid massive trees for now
                if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.DS_Store') {
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
            
            // Sort: directories first, then alphabetical
            childNodes.sort((a, b) => {
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }
                return a.type === 'directory' ? -1 : 1;
            });
            
            node.children = childNodes;
        }

        return node;
    } catch (err) {
        console.error(`Error generating tree for ${dirPath}`, err);
        return null;
    }
}
