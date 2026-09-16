import React from 'react';
import { FileNode } from '../../types/repository';

interface FileDetailsProps {
  node: FileNode;
}

export default function FileDetails({ node }: FileDetailsProps) {
  const extension = node.type === 'file' ? node.name.split('.').pop()?.toUpperCase() || 'UNKNOWN' : 'FOLDER';

  return (
    <div className="file-details">
      <h2>File Details</h2>
      
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
      
      {node.type === 'file' && (
        <div className="details-placeholder">
          <p>Code analysis, AST parsing, and graph visualization will be implemented in future steps.</p>
        </div>
      )}
    </div>
  );
}
