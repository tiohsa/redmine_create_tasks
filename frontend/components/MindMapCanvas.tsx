import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { MindMapNode, Connection } from '../types';
import { t } from '../i18n';

export interface MindMapCanvasHandle {
  focusRoot: () => void;
  focusLeafNodes: () => void;
}

interface Props {
  data: MindMapNode;
  connections: Connection[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  criticalNodeIds?: Set<string>;
  criticalConnIds?: Set<string>;
  onSelectNode: (id: string | null) => void;
  onUpdateNodeData: (id: string, updates: Partial<MindMapNode>) => void;
  onAddNode: (parentId: string, direction?: 'left' | 'right') => void;
  onDeleteNode: (id: string) => void;
  onSetEditingId: (id: string | null) => void;
  onAddConnection: (fromId: string, toId: string) => void;
  onDeleteConnection: (connId: string) => void;
  onDetachNode: (id: string) => void;
  onMoveNode: (childId: string, newParentId: string) => void;
}

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const calculateEffort = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;

  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + 1);
};

const splitTextForDisplay = (text: string): string[] => {
  const maxLineLength = 13;
  if (text.length <= maxLineLength) return [text];

  const line1 = text.substring(0, maxLineLength);
  let line2 = text.substring(maxLineLength);

  if (line2.length > maxLineLength) {
    line2 = line2.substring(0, maxLineLength - 1) + '…';
  }
  return [line1, line2];
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

const buildTreeLayout = (data: MindMapNode) => {
  const treeLayout = d3.tree<MindMapNode>().nodeSize([120, 280]);

  const rightChildren = data.children.filter(c => c.direction !== 'left');
  const rightHierarchy = d3.hierarchy({ ...data, children: rightChildren });
  const rightRoot = treeLayout(rightHierarchy);
  const rightNodes = rightRoot.descendants();
  const rightLinks = rightRoot.links();

  const leftChildren = data.children.filter(c => c.direction === 'left');
  let leftNodes: d3.HierarchyPointNode<MindMapNode>[] = [];
  let leftLinks: d3.HierarchyPointLink<MindMapNode>[] = [];

  if (leftChildren.length > 0) {
    const leftHierarchy = d3.hierarchy({ ...data, children: leftChildren });
    const leftRoot = treeLayout(leftHierarchy);
    leftNodes = leftRoot.descendants();
    leftLinks = leftRoot.links();

    leftNodes.forEach(d => {
      if (d.data.id !== 'root') d.y = -d.y;
    });
  }

  const combinedNodes = [...rightNodes, ...leftNodes.filter(d => d.data.id !== 'root')];
  const combinedLinks = [...rightLinks, ...leftLinks];

  return { nodes: combinedNodes, links: combinedLinks };
};

const MindMapCanvas = forwardRef<MindMapCanvasHandle, Props>(({
  data,
  connections,
  selectedNodeId,
  editingNodeId,
  criticalNodeIds = new Set(),
  criticalConnIds = new Set(),
  onSelectNode,
  onUpdateNodeData,
  onAddNode,
  onDeleteNode,
  onSetEditingId,
  onAddConnection,
  onDeleteConnection,
  onDetachNode,
  onMoveNode
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomContainerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomState, setZoomState] = useState({ x: 0, y: 0, k: 1 });

  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'connection' | 'move' | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => buildTreeLayout(data), [data]);

  useEffect(() => {
    if (!svgRef.current || !zoomContainerRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(zoomContainerRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setZoomState(event.transform);
        g.attr('transform', event.transform);
      })
      .filter((event) => {
        const isHandle = event.target.getAttribute('data-handle') === 'true';
        const isNodeDrag = event.target.getAttribute('data-node-drag') === 'true';
        const isPath = event.target.tagName === 'path';
        return !isHandle && !isNodeDrag && !isPath && !event.button && !dragSourceId;
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.on("dblclick.zoom", null);

    // Initial positioning: Center the root node when SVG size is available - ONLY ON MOUNT
    if (zoomState.x === 0 && zoomState.y === 0 && zoomState.k === 1) {
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const initialTransform = d3.zoomIdentity.translate(rect.width / 2, rect.height * 0.25).scale(0.8);
        svg.call(zoom.transform, initialTransform);
      } else {
        // Retry later if size not yet available
        const timer = setTimeout(() => {
          if (svgRef.current) {
            const r = svgRef.current.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const transform = d3.zoomIdentity.translate(r.width / 2, r.height * 0.25).scale(0.8);
              svg.call(zoom.transform, transform);
            }
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [dragSourceId]);

  useImperativeHandle(ref, () => ({
    focusRoot: () => {
      if (!svgRef.current || !zoomRef.current || !zoomContainerRef.current) return;
      const svg = d3.select(svgRef.current);
      const g = d3.select(zoomContainerRef.current);
      const rect = svgRef.current.getBoundingClientRect();
      const rootNode = nodes.find(n => n.data.id === 'root');
      if (!rootNode) return;

      const transform = d3.zoomIdentity
        .translate(rect.width / 2, rect.height / 2)
        .scale(1.2)
        .translate(-rootNode.y, -rootNode.x);

      svg.transition().duration(750)
        .call(zoomRef.current.transform, transform)
        .on('end', () => {
          g.attr('transform', transform.toString());
          setZoomState({ x: transform.x, y: transform.y, k: transform.k });
        });
    },
    focusLeafNodes: () => {
      if (!svgRef.current || !zoomRef.current || !zoomContainerRef.current) return;
      const svg = d3.select(svgRef.current);
      const g = d3.select(zoomContainerRef.current);
      const rect = svgRef.current.getBoundingClientRect();

      // Find the "far end" node (most left node in the visual layout, corresponding to the start of the process)
      // Visual X coordinate is stored in node.y
      const leftMostNode = nodes.reduce((min, curr) => curr.y < min.y ? curr : min, nodes[0]);

      if (!leftMostNode) return;

      const scale = 1.2; // Zoom in to see the task clearly/up close

      const transform = d3.zoomIdentity
        .translate(rect.width / 2, rect.height / 2)
        .scale(scale)
        .translate(-leftMostNode.y, -leftMostNode.x);

      svg.transition().duration(750)
        .call(zoomRef.current.transform, transform)
        .on('end', () => {
          g.attr('transform', transform.toString());
          setZoomState({ x: transform.x, y: transform.y, k: transform.k });
        });
    }
  }), [nodes]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragSourceId || !zoomContainerRef.current) return;
    const pt = d3.pointer(e, zoomContainerRef.current);
    setMousePos({ x: pt[0], y: pt[1] });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragSourceId && hoveredNodeId && dragSourceId !== hoveredNodeId) {
      if (dragMode === 'connection') {
        onAddConnection(dragSourceId, hoveredNodeId);
      } else if (dragMode === 'move') {
        onMoveNode(dragSourceId, hoveredNodeId);
      }
    }
    setDragSourceId(null);
    setDragMode(null);
    setHoveredNodeId(null);
  };

  const getNodePos = (id: string) => {
    const node = nodes.find(n => n.data.id === id);
    return node ? { x: node.y, y: node.x } : { x: 0, y: 0 };
  };

  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full outline-none cursor-default"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => {
          onSelectNode(null);
          onSetEditingId(null);
        }}
      >
        <g ref={zoomContainerRef} className="zoom-container">
          {/* Hierarchy Links */}
          {links.map((link) => {
            const pathGen = d3.linkHorizontal<any, any>()
              .x((d: any) => d.y)
              .y((d: any) => d.x);

            const source = link.source.data;
            const target = link.target.data;
            const dPath = pathGen(link);

            const isCriticalPath = criticalNodeIds.has(source.id) &&
              criticalNodeIds.has(target.id) &&
              target.endDate && source.startDate &&
              addDays(target.endDate, 1) === source.startDate;

            return (
              <g key={`link-group-${source.id}-${target.id}`} className="group/link">
                {/* 判定用の太い透明な線 - onMouseDown で処理 */}
                <path
                  d={dPath || undefined}
                  fill="none"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth="24"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (window.confirm(
                      t(
                        'redmine_create_tasks.canvas.detach_confirm',
                        'Detach connection to "%{title}"?\\n(The node will move under the root.)',
                        { title: target.text }
                      )
                    )) {
                      onDetachNode(target.id);
                    }
                  }}
                />
                {/* 実際に表示される線 */}
                <path
                  d={dPath || undefined}
                  className={`mindmap-link transition-all duration-300 pointer-events-none stroke-[3px] group-hover/link:stroke-rose-500 group-hover/link:stroke-[4px] ${isCriticalPath ? 'stroke-orange-500 stroke-[4px] opacity-100' : 'stroke-slate-900 opacity-100'}`}
                />
              </g>
            );
          })}

          {/* Custom Connections */}
          {connections.map((conn) => {
            const from = getNodePos(conn.fromId);
            const to = getNodePos(conn.toId);
            const dx = to.x - from.x;
            const midX = from.x + dx / 2;
            const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
            const isCritical = criticalConnIds.has(conn.id);

            return (
              <g key={`conn-group-${conn.id}`} className="group/conn">
                {/* 判定用の太い透明な線 - onMouseDown で処理 */}
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth="24"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDeleteConnection(conn.id);
                  }}
                />
                {/* 実際に表示される線 */}
                <path
                  d={path}
                  className={`custom-connector transition-all duration-300 pointer-events-none stroke-[3px] group-hover/conn:stroke-rose-500 group-hover/conn:stroke-[4px] ${isCritical ? 'stroke-orange-500 stroke-[4.5px] opacity-100 shadow-[0_0_10px_orange]' : 'stroke-slate-900 opacity-100'}`}
                />
              </g>
            );
          })}

          {/* Draft Connection or Move Preview */}
          {dragSourceId && dragMode === 'connection' && (
            <path
              d={`M ${getNodePos(dragSourceId).x} ${getNodePos(dragSourceId).y} L ${mousePos.x} ${mousePos.y}`}
              className="stroke-slate-400 stroke-2 pointer-events-none fill-none opacity-60"
            />
          )}

          {dragSourceId && dragMode === 'move' && (
            <g className="pointer-events-none opacity-50" transform={`translate(${mousePos.x - NODE_WIDTH / 2}, ${mousePos.y - NODE_HEIGHT / 2})`}>
              <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" className="fill-slate-100 stroke-slate-400 stroke-2 border-dashed" />
            </g>
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.data.id;
            const isRoot = node.data.id === 'root';
            const isEditing = editingNodeId === node.data.id;
            const isHoveredTarget = hoveredNodeId === node.data.id;
            const isCritical = criticalNodeIds.has(node.data.id);
            const direction = node.data.direction;

            return (
              <g
                key={node.data.id}
                transform={`translate(${node.y}, ${node.x})`}
                className="mindmap-node cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.data.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSetEditingId(node.data.id);
                }}
                onMouseEnter={() => dragSourceId && dragSourceId !== node.data.id && setHoveredNodeId(node.data.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <rect
                  x={-NODE_WIDTH / 2}
                  y={-NODE_HEIGHT / 2 + 10}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="12"
                  className={`
                    transition-all duration-300
                    ${isRoot ? 'fill-purple-600 shadow-lg' : isSelected ? 'fill-white stroke-blue-500 stroke-2' : 'fill-white stroke-slate-200 stroke'}
                    ${isHoveredTarget ? 'stroke-slate-500 stroke-[3px] scale-105' : ''}
                    ${isCritical && !isRoot ? 'stroke-orange-500 stroke-[3.5px] shadow-[0_0_20px_rgba(249,115,22,0.5)]' : ''}
                    shadow-sm
                  `}
                  data-node-drag="true"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!zoomContainerRef.current) return;
                    // ノード移動ドラッグ開始
                    setDragSourceId(node.data.id);
                    setDragMode('move');
                    const pt = d3.pointer(e, zoomContainerRef.current);
                    setMousePos({ x: pt[0], y: pt[1] });
                  }}
                />

                {node.data.isAIExpanding && (
                  <rect
                    x={-NODE_WIDTH / 2}
                    y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="12"
                    className="fill-purple-500/10 animate-pulse pointer-events-none"
                  />
                )}

                {isEditing ? (
                  <foreignObject
                    x={-NODE_WIDTH / 2 + 5}
                    y={-NODE_HEIGHT / 2 + 12}
                    width={NODE_WIDTH - 10}
                    height={NODE_HEIGHT - 10}
                  >
                    <div className="flex flex-col gap-1.5 p-1 h-full bg-white rounded-lg">
                      <input
                        autoFocus
                        placeholder={t('redmine_create_tasks.canvas.task_name_placeholder', 'Task name')}
                        className="w-full text-sm font-bold border-b border-slate-100 outline-none bg-white text-slate-900"
                        style={{ colorScheme: 'light' }}
                        value={node.data.text}
                        onChange={(e) => onUpdateNodeData(node.data.id, { text: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {!isRoot && (
                        <div className="flex gap-1 items-center">
                          <input
                            type="date"
                            className="w-full text-xs text-slate-900 border-none outline-none bg-white cursor-pointer"
                            style={{ colorScheme: 'light' }}
                            value={node.data.startDate || ''}
                            max={node.data.endDate || undefined}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              const currentEnd = node.data.endDate;
                              const updates: any = { startDate: newStart };

                              if (newStart && currentEnd && newStart > currentEnd) {
                                updates.endDate = newStart;
                                updates.effort = 1;
                              } else if (newStart && currentEnd) {
                                const newEffort = calculateEffort(newStart, currentEnd);
                                if (newEffort > 0) updates.effort = newEffort;
                              }
                              onUpdateNodeData(node.data.id, updates);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              (e.target as any).showPicker?.();
                            }}
                          />
                        </div>
                      )}
                      <div className="flex gap-1 items-center">
                        <input
                          type="date"
                          className="w-full text-xs text-slate-900 border-none outline-none bg-white cursor-pointer"
                          style={{ colorScheme: 'light' }}
                          value={node.data.endDate || ''}
                          min={node.data.startDate || undefined}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            const currentStart = node.data.startDate;
                            const updates: any = { endDate: newEnd };

                            if (newEnd && currentStart && newEnd < currentStart) {
                              updates.startDate = newEnd;
                              updates.effort = 1;
                            } else if (currentStart && newEnd) {
                              const newEffort = calculateEffort(currentStart, newEnd);
                              if (newEffort > 0) updates.effort = newEffort;
                            }
                            onUpdateNodeData(node.data.id, updates);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            (e.target as any).showPicker?.();
                          }}
                        />
                      </div>
                      {!isRoot && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">
                            {t('redmine_create_tasks.canvas.effort_label', 'Effort:')}
                          </span>
                          <input
                            type="number"
                            min="0"
                            className="w-14 text-xs border-none outline-none bg-white text-slate-900 rounded px-1"
                            style={{ colorScheme: 'light' }}
                            value={node.data.effort || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              onUpdateNodeData(node.data.id, { effort: Math.max(0, value || 0) });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </foreignObject>
                ) : (
                  <g className="pointer-events-none select-none">

                    {(() => {
                      const lines = splitTextForDisplay(node.data.text);
                      const isMultiLine = lines.length > 1;

                      return (
                        <>
                          <text
                            dy={isRoot ? (isMultiLine ? -20 : -10) : (isMultiLine ? -45 : -35)}
                            textAnchor="middle"
                            className={`font-bold text-xs ${isRoot ? 'fill-white' : 'fill-slate-800'}`}
                          >
                            {lines.map((line, i) => (
                              <tspan
                                key={i}
                                x="0"
                                dy={i === 0 ? (isMultiLine ? "-0.6em" : "0") : "1.2em"}
                              >
                                {line}
                              </tspan>
                            ))}
                          </text>

                          {(node.data.startDate || node.data.endDate) && (
                            <g transform={`translate(0, ${isRoot ? 20 : 12})`}>
                              <text
                                dy={isRoot ? 0 : (isMultiLine ? 15 : 5)}
                                textAnchor="middle"
                                className={`font-bold text-[10px] ${isRoot ? 'fill-white/80' : 'fill-slate-500'}`}
                              >
                                {isRoot
                                  ? t('redmine_create_tasks.canvas.root_due', 'Due: %{date}', {
                                    date: node.data.endDate || t('redmine_create_tasks.canvas.date_unknown', 'TBD')
                                  })
                                  : t('redmine_create_tasks.canvas.date_range', '%{start} - %{end}', {
                                    start: node.data.startDate || t('redmine_create_tasks.canvas.date_unknown', 'TBD'),
                                    end: node.data.endDate || t('redmine_create_tasks.canvas.date_unknown', 'TBD')
                                  })}
                              </text>
                            </g>
                          )}
                        </>
                      );
                    })()}

                    {!isRoot && (
                      <g transform={`translate(0, 44)`}>
                        <rect
                          x="-30"
                          y="-8"
                          width="60"
                          height="16"
                          rx="8"
                          className={isCritical ? "fill-orange-50" : "fill-blue-50"}
                        />
                        <text dy="3.5" textAnchor="middle" className={`font-bold text-[9px] ${isCritical ? 'fill-orange-600' : 'fill-blue-600'}`}>
                          {node.data.effort || 0} {t('redmine_create_tasks.canvas.man_days', 'days')}
                        </text>
                      </g>
                    )}

                    {isCritical && !isRoot && (
                      <g transform={`translate(0, -40)`}>
                        <text textAnchor="middle" className="text-[8px] font-black fill-orange-600 uppercase tracking-tighter animate-pulse">
                          {t('redmine_create_tasks.canvas.critical_path_label', 'CRITICAL PATH')}
                        </text>
                      </g>
                    )}
                  </g>
                )}

                <g
                  transform={`translate(0, ${NODE_HEIGHT / 2 + 5})`}
                  className="group/handle opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <circle
                    r="6"
                    className="shake-on-hover fill-slate-400 stroke-white stroke-2 shadow-sm pointer-events-none"
                  />
                  <circle
                    r="15"
                    fill="transparent"
                    className="cursor-crosshair"
                    data-handle="true"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (!zoomContainerRef.current) return;
                      const pt = d3.pointer(e, zoomContainerRef.current);
                      setDragSourceId(node.data.id);
                      setDragMode('connection');
                      setMousePos({ x: pt[0], y: pt[1] });
                    }}
                  />
                </g>

                <g className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {(isRoot || direction === 'right') && (
                    <g transform={`translate(${NODE_WIDTH / 2 + 5}, 0)`} className="group/btn">
                      <g className="transition-transform duration-200 group-hover/btn:scale-125 pointer-events-none" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                        <circle r="10" className="fill-blue-500 stroke-white stroke-2 shadow-md" />
                        <line x1="-4" y1="0" x2="4" y2="0" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </g>
                      <circle
                        r="20"
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNode(node.data.id, 'right');
                        }}
                      />
                    </g>
                  )}

                  {(isRoot || direction === 'left') && (
                    <g transform={`translate(${-NODE_WIDTH / 2 - 5}, 0)`} className="group/btn">
                      <g className="transition-transform duration-200 group-hover/btn:scale-125 pointer-events-none" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                        <circle r="10" className="fill-blue-500 stroke-white stroke-2 shadow-md" />
                        <line x1="-4" y1="0" x2="4" y2="0" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </g>
                      <circle
                        r="20"
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNode(node.data.id, 'left');
                        }}
                      />
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Minimap */}
      {(() => {
        const MINIMAP_WIDTH = 180;
        const MINIMAP_HEIGHT = 120;
        const MINIMAP_PADDING = 10;

        // Calculate bounds of all nodes
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
          minX = Math.min(minX, n.y - NODE_WIDTH / 2);
          maxX = Math.max(maxX, n.y + NODE_WIDTH / 2);
          minY = Math.min(minY, n.x - NODE_HEIGHT / 2);
          maxY = Math.max(maxY, n.x + NODE_HEIGHT / 2);
        });

        const contentWidth = maxX - minX + MINIMAP_PADDING * 2;
        const contentHeight = maxY - minY + MINIMAP_PADDING * 2;
        const scale = Math.min(MINIMAP_WIDTH / contentWidth, MINIMAP_HEIGHT / contentHeight);
        const offsetX = (MINIMAP_WIDTH - contentWidth * scale) / 2 - minX * scale + MINIMAP_PADDING * scale;
        const offsetY = (MINIMAP_HEIGHT - contentHeight * scale) / 2 - minY * scale + MINIMAP_PADDING * scale;

        // Calculate viewport rectangle in minimap coordinates
        const svgRect = svgRef.current?.getBoundingClientRect();
        const viewportWidth = svgRect ? svgRect.width / zoomState.k : 800;
        const viewportHeight = svgRect ? svgRect.height / zoomState.k : 600;
        const viewportX = (-zoomState.x / zoomState.k);
        const viewportY = (-zoomState.y / zoomState.k);

        const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
          if (!svgRef.current || !zoomRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;

          // Convert minimap click to world coordinates
          const worldX = (clickX - offsetX) / scale;
          const worldY = (clickY - offsetY) / scale;

          // Navigate to clicked position
          const svg = d3.select(svgRef.current);
          const svgRect = svgRef.current.getBoundingClientRect();
          const transform = d3.zoomIdentity
            .translate(svgRect.width / 2, svgRect.height / 2)
            .scale(zoomState.k)
            .translate(-worldX, -worldY);

          svg.transition().duration(300)
            .call(zoomRef.current.transform, transform);
        };

        return (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-slate-200 p-1 pointer-events-auto">
            <svg
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              className="cursor-pointer"
              onClick={handleMinimapClick}
            >
              {/* Background */}
              <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="#f8fafc" rx="4" />

              {/* Links (simplified) */}
              <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
                {links.map((link, i) => (
                  <line
                    key={`minimap-link-${i}`}
                    x1={link.source.y}
                    y1={link.source.x}
                    x2={link.target.y}
                    y2={link.target.x}
                    stroke="#cbd5e1"
                    strokeWidth={1 / scale}
                  />
                ))}

                {/* Nodes (simplified) */}
                {nodes.map((n) => (
                  <rect
                    key={`minimap-node-${n.data.id}`}
                    x={n.y - NODE_WIDTH / 2}
                    y={n.x - NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={4}
                    fill={n.data.id === 'root' ? '#7c3aed' : criticalNodeIds.has(n.data.id) ? '#f97316' : '#e2e8f0'}
                    stroke={selectedNodeId === n.data.id ? '#3b82f6' : 'none'}
                    strokeWidth={2 / scale}
                  />
                ))}
              </g>

              {/* Viewport indicator */}
              <rect
                x={viewportX * scale + offsetX}
                y={viewportY * scale + offsetY}
                width={viewportWidth * scale}
                height={viewportHeight * scale}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth="1.5"
                rx="2"
              />
            </svg>
          </div>
        );
      })()}
    </div>
  );
});

export default MindMapCanvas;
