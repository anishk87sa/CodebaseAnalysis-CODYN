import React, { useEffect, useState, useMemo } from 'react';
import ReactFlow, { Background, Controls, Node as RFNode, Edge as RFEdge, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { FileNode } from '../../types/repository';

interface GraphViewProps {
  fileNode: FileNode;
  repoRoot: string;
}

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: RFNode[], edges: RFEdge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' as any : 'top' as any;
    node.sourcePosition = isHorizontal ? 'right' as any : 'bottom' as any;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export default function GraphView({ fileNode, repoRoot }: GraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [rawData, setRawData] = useState<any>(null);
  const [mode, setMode] = useState<'contains' | 'calls'>('contains');

  useEffect(() => {
    async function fetchGraphData() {
      setLoading(true);
      setError(null);
      try {
        const data = await window.codyn.graph.getFile(repoRoot, fileNode.path);
        if (!data) {
          setError('No graph data available for this file. Please run analysis first.');
          setRawData(null);
          return;
        }
        setRawData(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load graph data.');
      } finally {
        setLoading(false);
      }
    }

    fetchGraphData();
  }, [fileNode.path, repoRoot]);

  useEffect(() => {
    if (!rawData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const filteredEdges: RFEdge[] = rawData.edges
      .filter((e: any) => e.type === mode)
      .map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));

    const edgeNodeIds = new Set(filteredEdges.flatMap(e => [e.source, e.target]));
    
    const filteredNodes: RFNode[] = rawData.nodes
      .filter((n: any) => edgeNodeIds.has(n.id) || n.type === 'file')
      .map((n: any) => ({
        id: n.id,
        data: { label: `${n.type}: ${n.label}\n(${n.file || 'unknown'})` },
        position: { x: 0, y: 0 },
        style: {
          background: n.type === 'file' ? '#3b82f6' : (n.type === 'class' ? '#10b981' : (n.resolutionStatus === 'unresolved' ? '#ef4444' : '#f59e0b')),
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'pre-wrap',
          textAlign: 'center'
        }
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(filteredNodes, filteredEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawData, mode, setNodes, setEdges]);

  if (loading) return <div>Loading graph...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', border: '1px solid #ccc', borderRadius: '4px' }}>
      <div style={{ display: 'flex', gap: '10px', padding: '10px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333' }}>
        <button
          onClick={() => setMode('contains')}
          style={{
            padding: '6px 12px',
            backgroundColor: mode === 'contains' ? '#5c6bc0' : 'transparent',
            color: '#fff',
            border: '1px solid #5c6bc0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Contains
        </button>
        <button
          onClick={() => setMode('calls')}
          style={{
            padding: '6px 12px',
            backgroundColor: mode === 'calls' ? '#5c6bc0' : 'transparent',
            color: '#fff',
            border: '1px solid #5c6bc0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Calls
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
