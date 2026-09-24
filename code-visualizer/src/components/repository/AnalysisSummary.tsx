import React, { useState } from 'react';

// Use any for the result to avoid cross-reference compilation errors with electron source directory
interface AnalysisSummaryProps {
  result: any;
  isAnalyzing: boolean;
  onClose?: () => void;
}


export default function AnalysisSummary({ result, isAnalyzing, onClose }: AnalysisSummaryProps) {
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [graphResult, setGraphResult] = useState<any | null>(null);

  const handleGenerateGraph = async () => {
    if (!result) return;
    setIsGeneratingGraph(true);
    try {
      const gResult = await window.codyn.graph.generate(result.repositoryRoot);
      setGraphResult(gResult);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingGraph(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="analysis-summary analyzing" style={{ position: 'relative' }}>
        <div className="spinner"></div>
        <p>Analyzing repository...</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="analysis-summary completed" style={{ position: 'relative' }}>
      {onClose && (
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '18px' }}
        >
          ✕
        </button>
      )}
      <h3>Analysis Complete</h3>
      
      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-value">{result.totalFiles}</span>
          <span className="stat-label">Files scanned</span>
        </div>
        <div className="stat-box highlight">
          <span className="stat-value">{result.sourceFiles}</span>
          <span className="stat-label">Source files</span>
        </div>
        <div className="stat-box success">
          <span className="stat-value">{result.parsedFiles}</span>
          <span className="stat-label">Parsed</span>
        </div>
        <div className="stat-box warning">
          <span className="stat-value">{result.syntaxErrorFiles}</span>
          <span className="stat-label">Syntax errors</span>
        </div>
        <div className="stat-box muted">
          <span className="stat-value">{result.unsupportedFiles}</span>
          <span className="stat-label">Unsupported</span>
        </div>
        <div className="stat-box muted">
          <span className="stat-value">{result.skippedFiles}</span>
          <span className="stat-label">Skipped (Size)</span>
        </div>
      </div>
      
      <div className="analysis-meta">
        <p>Duration: {(result.durationMs / 1000).toFixed(2)}s</p>
        <p>Output: {result.cstDirectory}</p>
      </div>

      <div className="graph-generation-section" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee', display: 'none' }}>
        <button 
          onClick={handleGenerateGraph} 
          disabled={isGeneratingGraph}
          className="btn btn-primary"
        >
          {isGeneratingGraph ? 'Generating Graph...' : 'Generate Graph JSON'}
        </button>

        {graphResult && (
          <div className="graph-result" style={{ marginTop: '15px' }}>
            <h4>Graph Generated Successfully</h4>
            <p>Nodes: {graphResult.nodeCount}</p>
            <p>Edges: {graphResult.edgeCount}</p>
            <p style={{ fontSize: '0.85em', color: '#666' }}>Saved to: {graphResult.outputPath}</p>
          </div>
        )}
      </div>
    </div>
  );
}
