import React from 'react';
import { FileNode } from '../../types/repository';
import FileTreeNode from './FileTreeNode';

interface FileTreeProps {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  selectedPath?: string;
}

export default function FileTree({ node, onSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="file-tree">
      <FileTreeNode 
        node={node} 
        onSelect={onSelect} 
        selectedPath={selectedPath} 
        isRoot={true}
      />
    </div>
  );
}
