import React from 'react';
import { RepositoryAnalysisResult } from '../../../electron/services/parser/types';

interface AnalysisSummaryProps {
  result: RepositoryAnalysisResult | null;
  isAnalyzing: boolean;
}

export default function AnalysisSummary({ result, isAnalyzing }: AnalysisSummaryProps) {
  if (isAnalyzing) {
    return (
      <div className="analysis-summary analyzing">
        <div className="spinner"></div>
        <p>Analyzing repository...</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="analysis-summary completed">
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
    </div>
  );
}
