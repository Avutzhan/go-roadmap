import React, { useState, useEffect } from 'react';
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
  
  let currentRowY = 120;
  let maxBottomInRow = 120;
  
  rawRoadmap.forEach((topic: any, i: number) => {
    // 3 Columns per row approach
    const row = Math.floor(i / 3);
    const posInRow = i % 3;
    const isLeftToRight = row % 2 === 0;
    
    // Keep nodes tightly positioned in 3 columns
    const col = isLeftToRight ? posInRow : (2 - posInRow);
    const mainX = 280 + col * 550;
    
    // Jump row to safe margin below the deepest container of the PREVIOUS row
    if (posInRow === 0 && i > 0) {
      currentRowY = maxBottomInRow + 140;
    }
    
    const mainId = `m_${i}`;
    
    let displayTitle = topic.title;
    if (displayTitle === "Core Go Fundamentals") {
      displayTitle = "Go Fundamentals";
    }
    displayTitle = displayTitle.replace(/\s+and\s+/gi, ' & ');
    
    const calculatedWidth = Math.max(220, displayTitle.length * 10 + 40);
    
    genNodes.push({
      id: mainId,
      type: 'main',
      title: displayTitle,
      description: "Core timeframe milestone.",
      x: mainX,
      y: currentRowY,
      w: calculatedWidth,
      h: 56,
      status: i === 0 ? 'done' : 'pending'
    });
    
    if (i > 0) genEdges.push({ from: `m_${i-1}`, to: mainId });
    
    let leftSubY = currentRowY + 80;
    let rightSubY = currentRowY + 80;
    
    topic.subtopics.forEach((sub: any, j: number) => {
      const isLeft = j % 2 === 0;
      const boxWidth = 260; 
      const boxX = mainX + (isLeft ? -135 : 135);
      
      const titleHeight = 44;
      const itemSpacing = 40; // 32px height + 8px gap
      const bottomPadding = 20;
      const containerHeight = titleHeight + (sub.leaves.length * itemSpacing) + bottomPadding;
      
      let startY = isLeft ? leftSubY : rightSubY;
      const boxCenterY = startY + (containerHeight / 2);
      
      const subId = `s_${i}_${j}`;
      const displaySubTitle = sub.title.replace(/\s+and\s+/gi, ' & ');
      
      genNodes.push({
        id: subId,
        type: 'container',
        title: displaySubTitle,
        x: boxX,
        y: boxCenterY,
        w: boxWidth,
        h: containerHeight,
        status: 'optional',
      });
      
      // Smart edge routing: Main hub only branches to the TOP element in the left/right column.
      // Every subsequent container daisy-chains strictly vertically from the container above it!
      if (j < 2) {
        genEdges.push({ from: mainId, to: subId });
      } else {
        genEdges.push({ from: `s_${i}_${j-2}`, to: subId });
      }
      
      let leafY = startY + titleHeight + 16; 
      sub.leaves.forEach((leafStr: string, k: number) => {
        const displayLeaf = leafStr.replace(/\s+and\s+/gi, ' & ');
        
        genNodes.push({
          id: `l_${i}_${j}_${k}`,
          type: 'leaf',
          title: displayLeaf,
          x: boxX,
          y: leafY,
          w: boxWidth - 24, // Slight padding from edges
          h: 32, // Taller, meatier pill like the reference
          status: 'pending'
        });
        leafY += itemSpacing;
      });
      
      if (isLeft) leftSubY += containerHeight + 24;
      else rightSubY += containerHeight + 24;
    });
    
    const treeBottom = Math.max(leftSubY, rightSubY);
    if (treeBottom > maxBottomInRow) {
      maxBottomInRow = treeBottom;
    }
  });
  
  return { nodes: genNodes, edges: genEdges, maxY: maxBottomInRow };
})();

// ==============================
// 2. Components
// ==============================

interface NodeProps {
  node: RoadmapNode;
  onClick: (node: RoadmapNode) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isCompleted?: boolean;
  onToggleComplete?: (id: string, e: React.MouseEvent) => void;
}

const RoadmapNodeComponent: React.FC<NodeProps> = ({ node, onClick, isHovered, onHover, isCompleted, onToggleComplete }) => {
  const w = node.w || 120;
  const h = node.h || 40;
  
  if (node.type === 'container') {
    let containerBg = "#ffffff";
    let containerStroke = "#000";
    let titleColor = "#000";
    
    if (isCompleted) {
      containerBg = "#f0fdf4"; // green-50
      containerStroke = "#16a34a"; // green-600
      titleColor = "#15803d"; // green-700
    }

    return (
      <g transform={`translate(${node.x}, ${node.y})`}>
        <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w} height={h} rx={6} fill="#000" className="transition-all duration-300" />
        <rect id={`container_rect_${node.id}`} x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={containerBg} stroke={containerStroke} strokeWidth="2" className="transition-all duration-500" />
        
        {/* Simple crisp text matching the reference image */}
        <text 
          x={0} y={-h / 2 + 22} 
          textAnchor="middle" dominantBaseline="middle" 
          fill={titleColor} fontSize="14" fontWeight="600" fontFamily="sans-serif"
          className="transition-colors duration-500"
        >
          {node.title.length > 30 ? node.title.substring(0,27)+'...' : node.title}
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
  // Pale yellow styling mirroring the user's reference!
  let leafBg = isLeafHover ? '#fef08a' : '#fde68a';
  let leafStroke = "#000";
  let textColor = "#000";
  
  if (isCompleted) {
    leafBg = isLeafHover ? '#bbf7d0' : '#86efac'; // soft green when completed
    leafStroke = "#166534"; // dark green border
    textColor = "#14532d";
  }
  
  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node)}
      className="cursor-pointer group"
    >
      <rect 
        x={-w / 2} y={-h / 2} 
        width={w} height={h} rx={4} 
        fill={leafBg} 
        stroke={leafStroke} strokeWidth="1.5"
        className="transition-all duration-150"
      />
      
      {/* Interactive Checkbox with expanded invisible hit area */}
      <g 
        transform={`translate(${-w/2 + 16}, 0)`} 
        onClick={(e) => onToggleComplete && onToggleComplete(node.id, e)}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        {/* Invisible square spanning the full height to make clicking super easy */}
        <rect x={-16} y={-h/2} width={36} height={h} fill="transparent" />
        <circle cx={0} cy={0} r={8} fill={isCompleted ? "#22c55e" : "#fff"} stroke={leafStroke} strokeWidth="1.5" />
        {isCompleted && (
          <path d="M-3 0.5 L-1 2.5 L3 -2.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>

      <text
        x={8} y={1} // Shifted slightly right to balance the checkbox
        textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="13" fontWeight="500" fontFamily="sans-serif"
        className="transition-all pointer-events-none"
      >
        {node.title.length > 28 ? node.title.substring(0, 26) + "..." : node.title}
      </text>
    </g>
  );
};

// Localized SVG Fireworks Effect (Intense, Bright Colors)
const SvgConfetti = ({ x, y }: { x: number, y: number }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <style>
        {`
          @keyframes confetti-burst {
            0% { transform: translate(0px, 0px) scale(0.5); opacity: 1; }
            100% { transform: translate(var(--dx), var(--dy)) scale(1.5); opacity: 0; }
          }
        `}
      </style>
      {Array.from({ length: 60 }).map((_, i) => {
        const angle = (i * 360) / 60; 
        const rad = angle * Math.PI / 180;
        const dist = 50 + Math.random() * 90; // Localized radius
        const dx = Math.cos(rad) * dist;
        const dy = Math.sin(rad) * dist;
        
        // 100% maximum saturation/brightness neon colors for explosive visual impact
        const colors = ['#FF0000', '#00FF00', '#0044FF', '#FF00FF', '#FFB800', '#00FFFF'];
        const color = colors[i % colors.length];
        
        return (
          <circle
            key={i}
            cx={0} cy={0} r={3.5 + Math.random() * 4.5} fill={color}
            style={{
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              animation: `confetti-burst 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards`
            } as any}
          />
        );
      })}
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
      
      // We push the control points massively wide (480px) to form a very rounded loop
      // that avoids ALL sub-topics like 'Garbage Collector' which reach up to ~270px out.
      const dropMargin = isRightEdge ? 480 : -480; 
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
export default function RoadmapApp() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const [activeConfetti, setActiveConfetti] = useState<{ id: string, x: number, y: number } | null>(null);

  // Load MVP state from SQLite via Laravel
  useEffect(() => {
    fetch('/api/progress')
      .then(res => res.json())
      .then((data: string[]) => {
        setCompletedNodes(new Set(data));
      })
      .catch(err => console.error("Could not load backend progress", err));
  }, []);

  const toggleNodeCompletion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedNodes(prev => {
      const newSet = new Set(prev);
      const isCompletedNow = !newSet.has(id);
      
      if (isCompletedNow) newSet.add(id);
      else newSet.delete(id);
      
      // Check if this action completed an entire container block!
      if (isCompletedNow && id.startsWith('l_')) {
        const match = id.match(/^l_(\d+)_(\d+)_/);
        if (match) {
          const i = parseInt(match[1]);
          const j = parseInt(match[2]);
          const leafCount = rawRoadmap[i].subtopics[j].leaves.length;
          
          let allDoneNow = true;
          for(let k=0; k<leafCount; k++) {
            if (!newSet.has(`l_${i}_${j}_${k}`)) {
              allDoneNow = false;
              break;
            }
          }
          
          if (allDoneNow) {
            // Revert back to precise localized SVG burst, but brighter!
            const cNode = nodes.find(n => n.id === `s_${i}_${j}`);
            if (cNode) {
              setActiveConfetti({ id: Date.now().toString(), x: cNode.x, y: cNode.y - (cNode.h!/2) + 20 });
              setTimeout(() => setActiveConfetti(null), 1500); // clear after 1.5s
            }
          }
        }
      }

      // Persist to SQLite MVP Backend
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: id, completed: isCompletedNow })
      }).catch(err => console.error("Could not save backend progress", err));
      
      return newSet;
    });
  };

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
      
      <div className="flex-1 w-full max-w-[2000px] mx-auto overflow-x-auto overflow-y-hidden px-4 md:px-8">
        <div className="min-w-[1400px] w-full">
          <svg
            className="w-full h-auto mx-auto outline-none block drop-shadow-sm"
            viewBox={`-200 50 2050 ${contentHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              <g className="edges-layer pointer-events-none">
                {edges.map((edge, idx) => (
                  <RoadmapEdgeComponent key={idx} edge={edge} nodes={nodes} />
                ))}
              </g>

              <g className="nodes-layer">
                {nodes.map(node => {
                  let isDone = completedNodes.has(node.id);
                  
                  // For containers, determine completion based on if all leaves are checked
                  if (node.type === 'container') {
                    const match = node.id.match(/^s_(\d+)_(\d+)$/);
                    if (match) {
                      const i = parseInt(match[1]);
                      const j = parseInt(match[2]);
                      const leafCount = rawRoadmap[i].subtopics[j].leaves.length;
                      isDone = true;
                      for(let k=0; k<leafCount; k++) {
                        if (!completedNodes.has(`l_${i}_${j}_${k}`)) {
                          isDone = false;
                          break;
                        }
                      }
                    }
                  }

                  return (
                    <RoadmapNodeComponent 
                      key={node.id} 
                      node={node} 
                      onClick={setSelectedNode}
                      isHovered={hoveredNode === node.id}
                      onHover={setHoveredNode}
                      isCompleted={isDone}
                      onToggleComplete={toggleNodeCompletion}
                    />
                  );
                })}
              </g>
              
              {/* Overlay localized vibrant fireworks on top */}
              {activeConfetti && (
                <SvgConfetti key={activeConfetti.id} x={activeConfetti.x} y={activeConfetti.y} />
              )}
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
