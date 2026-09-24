import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, Node as RFNode, Edge as RFEdge, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

interface GlobalGraphViewProps {
  repoRoot: string;
}

const nodeWidth = 200;
const nodeHeight = 40;

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

export default function GlobalGraphView({ repoRoot }: GlobalGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGraphData() {
      setLoading(true);
      setError(null);
      try {
        const data = await window.codyn.graph.getGlobal(repoRoot);
        if (!data) {
          setError('No global graph data available. Please run analysis first.');
          setNodes([]);
          setEdges([]);
          return;
        }

        const rfNodes: RFNode[] = data.nodes.map((n: any) => ({
          id: n.id,
          data: { label: `${n.label}\n(${n.file || 'unknown'})` },
          position: { x: 0, y: 0 },
          style: {
            background: n.resolutionStatus === 'unresolved' ? '#ef4444' : '#f59e0b',
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

        const rfEdges: RFEdge[] = data.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          markerEnd: { type: MarkerType.ArrowClosed },
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

      } catch (err) {
        console.error(err);
        setError('Failed to load global graph data.');
      } finally {
        setLoading(false);
      }
    }

    fetchGraphData();
  }, [repoRoot, setNodes, setEdges]);

  if (loading) return <div style={{ padding: '2rem', color: '#fff' }}>Loading global graph...</div>;
  if (error) return <div style={{ padding: '2rem', color: '#ef4444' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '2rem', backgroundColor: '#0a0a0a' }}>
      <h2 style={{ color: '#fff', marginTop: 0 }}>Global Call Graph</h2>
      <div style={{ flex: 1, border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background color="#333" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
