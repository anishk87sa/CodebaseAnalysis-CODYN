import React, { useState } from 'react';
import { FileNode } from '../types/repository';
import LoadRepositoryButton from '../components/repository/LoadRepositoryButton';
import FileTree from '../components/repository/FileTree';
import FileDetails from '../components/repository/FileDetails';
import AnalysisSummary from '../components/repository/AnalysisSummary';
import GlobalGraphView from '../components/graph/GlobalGraphView';

export default function RepositoryPage() {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [showGlobalGraph, setShowGlobalGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [showAnalysisSummary, setShowAnalysisSummary] = useState(true);

  const handleAnalyze = async (path: string = fileTree?.path || '') => {
    if (!path) return;
    
    setIsAnalyzing(true);
    setShowAnalysisSummary(true);
    setAnalysisResult(null);
    try {
      const result = await window.codyn.repository.analyzeCST(path);
      // Wait for graph extraction to finish as well
      await window.codyn.graph.generate(path);
      
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      setError('An error occurred during analysis or graph generation.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadRepository = async () => {
    setError(null);
    try {
      const folderPath = await window.codyn.repository.selectFolder();
      if (!folderPath) {
        return; // User canceled
      }
      
      setIsLoading(true);
      const tree = await window.codyn.repository.getTree(folderPath);
      
      if (!tree) {
        setError('Unable to load repository. The selected folder could not be accessed.');
      } else {
        setFileTree(tree);
        setSelectedFile(null); // Reset selection
        setShowGlobalGraph(false);
        setAnalysisResult(null);
        // Automatically analyze
        handleAnalyze(tree.path);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading the repository.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (node: FileNode) => {
    setSelectedFile(node);
    setShowGlobalGraph(false);
  };

  const handleGlobalGraphSelect = () => {
    setSelectedFile(null);
    setShowGlobalGraph(true);
  };

  return (
    <div className="repository-page">
      <header className="repo-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="header-brand">CODYN</div>
          <div className="header-title">
            {fileTree ? fileTree.name : 'Repository'}
          </div>
        </div>
        {fileTree && (
          <div className="header-actions">
            <button 
              className="action-button primary" 
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Repository'}
            </button>
          </div>
        )}
      </header>

      {!fileTree && !isLoading && !error && (
        <div className="empty-state">
          <h2>Load a code repository</h2>
          <LoadRepositoryButton onClick={handleLoadRepository} />
        </div>
      )}

      {isLoading && (
        <div className="loading-state">
          <p>Reading repository structure...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
          <LoadRepositoryButton onClick={handleLoadRepository} />
        </div>
      )}

      {fileTree && (
        <div className="repo-workspace">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h3>REPOSITORY</h3>
              <button className="icon-button reload-button" onClick={handleLoadRepository} title="Load another repository">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
              </button>
            </div>
            
            <div className="sidebar-actions" style={{ padding: '0.5rem' }}>
              <button 
                onClick={handleGlobalGraphSelect}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: showGlobalGraph ? '#3b82f6' : 'transparent',
                  color: showGlobalGraph ? 'white' : '#cbd5e1',
                  border: showGlobalGraph ? 'none' : '1px solid #334155',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: showGlobalGraph ? 'bold' : 'normal'
                }}
              >
                🌍 View Global Call Graph
              </button>
            </div>

            <div className="sidebar-content">
              <FileTree 
                node={fileTree} 
                onSelect={handleFileSelect} 
                selectedPath={selectedFile?.path} 
              />
            </div>
          </aside>
          
          <main className="main-content">
            {showAnalysisSummary && (isAnalyzing || analysisResult) && (
              <AnalysisSummary 
                result={analysisResult} 
                isAnalyzing={isAnalyzing} 
                onClose={() => setShowAnalysisSummary(false)} 
              />
            )}
            
            {showGlobalGraph ? (
              <GlobalGraphView repoRoot={fileTree.path} />
            ) : selectedFile ? (
              <FileDetails node={selectedFile} repoRoot={fileTree.path} />
            ) : (
              <div className="details-empty">
                <p>Select a file to inspect, or view the Global Graph</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
