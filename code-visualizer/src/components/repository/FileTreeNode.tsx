import React, { useState } from 'react';
import { FileNode } from '../../types/repository';

interface FileTreeNodeProps {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  selectedPath?: string;
  isRoot?: boolean;
}

export default function FileTreeNode({ node, onSelect, selectedPath, isRoot = false }: FileTreeNodeProps) {
  // Default to expanded if it's the root node, otherwise collapsed
  const [isExpanded, setIsExpanded] = useState(isRoot);

  const isSelected = selectedPath === node.path;
  const isDir = node.type === 'directory';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      setIsExpanded(!isExpanded);
    }
    onSelect(node);
  };

  return (
    <div className="tree-node-container">
      <div 
        className={`tree-node ${isSelected ? 'selected' : ''} ${isDir ? 'directory' : 'file'}`}
        onClick={handleClick}
      >
        {isDir && (
          <span className="expand-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!isDir && <span className="file-icon">📄</span>}
        <span className="node-name">{node.name}</span>
      </div>

      {isDir && isExpanded && node.children && node.children.length > 0 && (
        <div className="node-children">
          {node.children.map((child, index) => (
            <FileTreeNode 
              key={`${child.path}-${index}`} 
              node={child} 
              onSelect={onSelect} 
              selectedPath={selectedPath} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
