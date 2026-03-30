import React, { useState } from 'react';
import rawRoadmap from './roadmapData.json';

// ==============================
// 1. Types & Structure
// ==============================
export type NodeType = 'main' | 'container' | 'leaf';
export type NodeStatus = 'done' | 'pending' | 'optional';

export interface RoadmapNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  status: NodeStatus;
}

export interface RoadmapEdge {
  from: string;
  to: string;
}

export const { nodes, edges, maxY } = (() => {
  const genNodes: RoadmapNode[] = [];
  const genEdges: RoadmapEdge[] = [];
  
  let currentY = 120;
  let currentRowBottom = currentY;
  
  rawRoadmap.forEach((topic: any, i: number) => {
    // 3 Columns per row approach
    const row = Math.floor(i / 3);
    const posInRow = i % 3;
    const isLeftToRight = row % 2 === 0;
    
    const col = isLeftToRight ? posInRow : (2 - posInRow);
    const mainX = 280 + col * 550; // columns at 280, 830, 1380
    
    if (posInRow === 0) {
      currentY = currentRowBottom + (i > 0 ? 120 : 0);
    }
    
    const mainId = `m_${i}`;
    
    genNodes.push({
      id: mainId,
      type: 'main',
      title: topic.title,
      description: "Core timeframe milestone.",
      x: mainX,
      y: currentY,
      w: 220,
      h: 56,
      status: i === 0 ? 'done' : 'pending'
    });
    
    if (i > 0) genEdges.push({ from: `m_${i-1}`, to: mainId });
    
    let leftSubY = currentY + 80;
    let rightSubY = currentY + 80;
    
    topic.subtopics.forEach((sub: any, j: number) => {
      const isLeft = j % 2 === 0;
      const boxWidth = 250; 
      const boxX = mainX + (isLeft ? -135 : 135);
      
      const titleHeight = 40;
      const itemSpacing = 36;
      const containerHeight = titleHeight + (sub.leaves.length * itemSpacing) + 12;
      
      let startY = isLeft ? leftSubY : rightSubY;
      const boxCenterY = startY + (containerHeight / 2);
      
      const subId = `s_${i}_${j}`;
      genNodes.push({
        id: subId,
        type: 'container',
        title: sub.title,
        x: boxX,
        y: boxCenterY,
        w: boxWidth,
        h: containerHeight,
        status: 'optional',
      });
      genEdges.push({ from: mainId, to: subId });
      
      let leafY = startY + 50; 
      sub.leaves.forEach((leafStr: string, k: number) => {
        genNodes.push({
          id: `l_${i}_${j}_${k}`,
          type: 'leaf',
          title: leafStr,
          x: boxX,
          y: leafY,
          w: boxWidth - 30,
          h: 28,
          status: 'pending'
        });
        leafY += itemSpacing;
      });
      
      if (isLeft) leftSubY += containerHeight + 24;
      else rightSubY += containerHeight + 24;
    });
    
    const treeBottom = Math.max(leftSubY, rightSubY);
    if (treeBottom > currentRowBottom) {
      currentRowBottom = treeBottom;
    }
  });
  
  return { nodes: genNodes, edges: genEdges, maxY: currentRowBottom };
})();

// ==============================
// 2. Components
// ==============================

interface NodeProps {
  node: RoadmapNode;
  onClick: (node: RoadmapNode) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

const RoadmapNodeComponent: React.FC<NodeProps> = ({ node, onClick, isHovered, onHover }) => {
  const w = node.w || 120;
  const h = node.h || 40;
  
  if (node.type === 'container') {
    return (
      <g transform={`translate(${node.x}, ${node.y})`}>
        <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w} height={h} rx={6} fill="#000" />
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill="#ffffff" stroke="#000" strokeWidth="2" />
        
        <path 
           d={`M ${-w/2} ${-h/2 + 6} A 6 6 0 0 1 ${-w/2 + 6} ${-h/2} L ${w/2 - 6} ${-h/2} A 6 6 0 0 1 ${w/2} ${-h/2 + 6} L ${w/2} ${-h/2 + 36} L ${-w/2} ${-h/2 + 36} Z`} 
           fill="#f8fafc" 
        />
        <line x1={-w / 2} y1={-h / 2 + 36} x2={w / 2} y2={-h / 2 + 36} stroke="#000" strokeWidth="2" />
        
        <text x={0} y={-h / 2 + 18} textAnchor="middle" dominantBaseline="middle" fill="#000" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
          {node.title.length > 30 ? node.title.substring(0,27)+'...' : node.title.toUpperCase()}
        </text>
      </g>
    );
  }

  if (node.type === 'main') {
    const shadowOffset = isHovered ? 2 : 5;
    const translation = isHovered ? 3 : 0;
    return (
      <g
        transform={`translate(${node.x}, ${node.y})`}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node)}
        className="cursor-pointer transition-all duration-200"
      >
        <rect x={-w / 2 + shadowOffset} y={-h / 2 + shadowOffset} width={w} height={h} rx={5} fill="#000" className="transition-all duration-200" />
        <rect x={-w / 2 + translation} y={-h / 2 + translation} width={w} height={h} rx={5} fill="#fbbf24" stroke="#000" strokeWidth="2" className="transition-all duration-200" />
        <text x={translation} y={translation + 1} textAnchor="middle" dominantBaseline="middle" fill="#000" fontSize="15" fontWeight="900" fontFamily="sans-serif">
          {node.title}
        </text>
      </g>
    );
  }

  const isLeafHover = isHovered;
  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node)}
      className="cursor-pointer group"
    >
      <rect 
        x={( -w / 2) + (isLeafHover ? 2 : 0)} y={( -h / 2) + (isLeafHover ? 2 : 0)} 
        width={w} height={h} rx={4} 
        fill={isLeafHover ? '#e0f2fe' : '#f1f5f9'} 
        stroke="#000" strokeWidth="1.5"
        className="transition-all duration-150"
      />
      <circle cx={-w / 2 + 14 + (isLeafHover ? 2 : 0)} cy={isLeafHover ? 2 : 0} r={3} fill="#000" className="transition-all duration-150" />
      <text
        x={-w / 2 + 25 + (isLeafHover ? 2 : 0)} y={isLeafHover ? 3 : 1}
        textAnchor="start" dominantBaseline="middle"
        fill="#0f172a" fontSize="12" fontWeight="600" fontFamily="sans-serif"
        className="transition-all pointer-events-none"
      >
        {node.title.length > 32 ? node.title.substring(0, 30) + "..." : node.title}
      </text>
    </g>
  );
};

interface EdgeProps {
  edge: RoadmapEdge;
  nodes: RoadmapNode[];
}

const RoadmapEdgeComponent: React.FC<EdgeProps> = ({ edge, nodes }) => {
  const fromNode = nodes.find(n => n.id === edge.from);
  const toNode = nodes.find(n => n.id === edge.to);

  if (!fromNode || !toNode) return null;

  const isMainLine = fromNode.type === 'main' && toNode.type === 'main';
  let pathData = "";

  if (isMainLine) {
    if (fromNode.y === toNode.y) {
      // Horizontal snake line across the row
      const isLR = toNode.x > fromNode.x;
      const startX = fromNode.x + (isLR ? fromNode.w!/2 : -fromNode.w!/2);
      const endX = toNode.x + (isLR ? -toNode.w!/2 : toNode.w!/2);
      pathData = `M ${startX} ${fromNode.y} L ${endX} ${toNode.y}`;
    } else {
      // Dropping down a row at the far edges!
      const isRightEdge = fromNode.x > 1000;
      const startX = fromNode.x + (isRightEdge ? fromNode.w!/2 : -fromNode.w!/2);
      const dropMargin = isRightEdge ? 360 : -360; 
      const outX = fromNode.x + dropMargin;
      const endX = toNode.x + (isRightEdge ? toNode.w!/2 : -toNode.w!/2);
      
      pathData = `M ${startX} ${fromNode.y} C ${outX} ${fromNode.y}, ${outX} ${toNode.y}, ${endX} ${toNode.y}`;
    }
  } else {
    // Top-to-Bottom beautiful Organic branch from Main Hub down to Container boxes
    const startX = fromNode.x;
    const startY = fromNode.y + (fromNode.h! / 2); // Exits from bottom of Hub
    
    const endX = toNode.x;
    const endY = toNode.y - (toNode.h! / 2); // Enters top of Container
    
    // Y-Offset calculation to stretch the cubic curve nicely
    const curveOffsetY = (endY - startY) * 0.4;
    pathData = `M ${startX} ${startY} C ${startX} ${startY + curveOffsetY}, ${endX} ${endY - curveOffsetY}, ${endX} ${endY}`;
  }

  return (
    <path
      d={pathData}
      stroke="#2563eb"
      strokeWidth={isMainLine ? "4" : "2.5"}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="6 6"
    />
  );
};

interface ModalProps {
  node: RoadmapNode | null;
  onClose: () => void;
}

const RoadmapModal: React.FC<ModalProps> = ({ node, onClose }) => {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 transition-opacity"
        onClick={onClose}
      />
      <div 
        className="relative bg-white rounded-xl p-8 w-full max-w-md m-4 border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        role="dialog"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 transition-colors focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{node.title}</h3>
        </div>
        
        <div className="bg-slate-50 rounded-lg p-5 border-2 border-slate-200 mt-6">
          <p className="text-slate-700 text-base leading-relaxed font-medium">
            {node.description}
          </p>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(251,191,36,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,0)]"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// 3. Main Export
// ==============================
export default function Roadmap() {
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const contentHeight = maxY + 150;

  return (
    <div className="w-full h-full min-h-screen bg-[#f8fafc] relative flex flex-col font-sans text-slate-900 pt-16 pb-32">
      <div className="text-center mb-10 z-10 px-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">
          <span className="bg-[#fbbf24] px-3 py-1 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[-2deg] inline-block">Go Backend</span> Roadmap
        </h1>
        <p className="text-slate-600 mt-6 font-bold text-lg max-w-xl mx-auto border-b-2 border-slate-900 pb-4 inline-block">
          Complete path to Senior Level (150+ Deep Topics & Hand-crafted files)
        </p>
      </div>
      
      <div className="flex-1 w-full max-w-[1800px] mx-auto overflow-x-auto overflow-y-hidden px-4 md:px-8">
        <div className="min-w-[1200px] w-full">
          <svg
            className="w-full h-auto mx-auto outline-none block drop-shadow-sm"
            viewBox={`-100 50 1900 ${contentHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              <g className="edges-layer">
                {edges.map((edge, i) => (
                  <RoadmapEdgeComponent key={`edge-${i}`} edge={edge} nodes={nodes} />
                ))}
              </g>

              <g className="nodes-layer">
                {nodes.map(node => (
                  <RoadmapNodeComponent
                    key={node.id}
                    node={node}
                    onClick={setSelectedNode}
                    isHovered={hoveredNodeId === node.id}
                    onHover={setHoveredNodeId}
                  />
                ))}
              </g>
            </g>
          </svg>
        </div>
      </div>

      <RoadmapModal 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
      />
    </div>
  );
}
