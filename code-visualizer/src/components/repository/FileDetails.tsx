import React from 'react';
import { FileNode } from '../../types/repository';
import GraphView from '../graph/GraphView';

interface FileDetailsProps {
  node: FileNode;
  repoRoot: string;
}

export default function FileDetails({ node, repoRoot }: FileDetailsProps) {
  const extension = node.type === 'file' ? node.name.split('.').pop()?.toUpperCase() || 'UNKNOWN' : 'FOLDER';

  return (
    <div className="file-details">
      <h2>File Details</h2>
      
      {node.type === 'file' && (
        <div style={{ height: '500px', width: '100%', marginBottom: '20px' }}>
          <GraphView fileNode={node} repoRoot={repoRoot} />
        </div>
      )}

      <div className="details-card">
        <h3 className="details-filename">{node.name}</h3>
        
        <div className="details-row">
          <span className="details-label">Path</span>
          <span className="details-value path-value">{node.path}</span>
        </div>
        
        <div className="details-row">
          <span className="details-label">Type</span>
          <span className="details-value">{node.type === 'directory' ? 'Directory' : `File (${extension})`}</span>
        </div>
      </div>
    </div>
  );
}
