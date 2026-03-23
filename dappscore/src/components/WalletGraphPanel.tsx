'use client';

/**
 * WalletGraphPanel — force-directed SVG network of wallet relationships.
 *
 * Fetches the tx-graph from the backend (GET /api/v1/tx-graph/:address) and
 * renders an interactive, zero-dependency SVG graph:
 *   • Scroll to zoom   • Drag background to pan   • Click node to copy address
 *   • Hover node to see full address tooltip
 *   • Color-coded by wallet type (deployer / insider / exchange / burn / …)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network, Loader2, AlertCircle, RefreshCw, Copy, ExternalLink, ZoomIn, ZoomOut,
} from 'lucide-react';

// ── Types (mirrored from backend) ─────────────────────────────────────────────

type NodeType = 'contract' | 'deployer' | 'insider' | 'exchange' | 'burn' | 'unknown';

interface TxGraphNode {
  id:      string;
  address: string;
  label:   string;
  type:    NodeType;
  txCount: number;
}

interface TxGraphEdge {
  id:     string;
  source: string;
  target: string;
  count:  number;
  isMint: boolean;
}

interface TxGraphResponse {
  contract:     string;
  nodes:        TxGraphNode[];
  edges:        TxGraphEdge[];
  totalSampled: number;
  chain:        string;
}

// ── Visual config ─────────────────────────────────────────────────────────────

const NODE_RADIUS = 28;

const NODE_STYLE: Record<NodeType, { fill: string; stroke: string; text: string }> = {
  contract: { fill: '#1e293b', stroke: '#94a3b8', text: '#e2e8f0' },
  deployer: { fill: '#92400e', stroke: '#f59e0b', text: '#fef3c7' },
  insider:  { fill: '#713f12', stroke: '#eab308', text: '#fefce8' },
  exchange: { fill: '#1e3a5f', stroke: '#3b82f6', text: '#dbeafe' },
  burn:     { fill: '#450a0a', stroke: '#ef4444', text: '#fee2e2' },
  unknown:  { fill: '#1f2937', stroke: '#4b5563', text: '#9ca3af' },
};

const LEGEND: { type: NodeType; label: string }[] = [
  { type: 'contract', label: 'Token Contract' },
  { type: 'deployer', label: 'Deployer / Owner' },
  { type: 'insider',  label: 'Insider Wallet'  },
  { type: 'exchange', label: 'CEX / DEX'       },
  { type: 'burn',     label: 'Burn Address'    },
  { type: 'unknown',  label: 'Early Wallet'    },
];

// ── Force-directed layout ─────────────────────────────────────────────────────

interface LayoutNode extends TxGraphNode {
  x: number; y: number;
  vx: number; vy: number;
}

function computeLayout(
  nodes: TxGraphNode[],
  edges: TxGraphEdge[],
  width: number,
  height: number,
): Map<string, LayoutNode> {
  const cx = width  / 2;
  const cy = height / 2;
  const R  = Math.min(width, height) * 0.32;

  // Place nodes in a circle initially
  const pos = new Map<string, LayoutNode>();
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    pos.set(node.id, {
      ...node,
      x:  cx + R * Math.cos(angle),
      y:  cy + R * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });

  // Pin the contract node at center
  const contract = nodes.find(n => n.type === 'contract');
  if (contract) {
    const p = pos.get(contract.id)!;
    p.x = cx; p.y = cy;
  }

  // ── Simulate ─────────────────────────────────────────────────────────────
  const REPULSION  = 6_500;
  const ATTRACTION = 0.04;
  const CENTERING  = 0.008;
  const DAMPING    = 0.82;
  const ITERATIONS = 250;
  const MIN_DIST   = NODE_RADIUS * 2.4;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const force = new Map<string, { fx: number; fy: number }>();
    nodes.forEach(n => force.set(n.id, { fx: 0, fy: 0 }));

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = pos.get(nodes[i].id)!;
        const pj = pos.get(nodes[j].id)!;
        const dx = pj.x - pi.x;
        const dy = pj.y - pi.y;
        const d  = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DIST);
        const f  = REPULSION / (d * d);
        const fi = force.get(nodes[i].id)!;
        const fj = force.get(nodes[j].id)!;
        fi.fx -= f * dx / d;   fi.fy -= f * dy / d;
        fj.fx += f * dx / d;   fj.fy += f * dy / d;
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const ps = pos.get(edge.source);
      const pt = pos.get(edge.target);
      if (!ps || !pt) continue;
      const dx = pt.x - ps.x;
      const dy = pt.y - ps.y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const f  = d * ATTRACTION;
      const fs = force.get(edge.source)!;
      const ft = force.get(edge.target)!;
      fs.fx += f * dx / d;   fs.fy += f * dy / d;
      ft.fx -= f * dx / d;   ft.fy -= f * dy / d;
    }

    // Weak centering pull (skip the contract — it stays pinned)
    for (const node of nodes) {
      if (node.type === 'contract') continue;
      const p = pos.get(node.id)!;
      const f = force.get(node.id)!;
      f.fx += (cx - p.x) * CENTERING;
      f.fy += (cy - p.y) * CENTERING;
    }

    // Integrate (skip pinned contract)
    for (const node of nodes) {
      if (node.type === 'contract') continue;
      const p = pos.get(node.id)!;
      const f = force.get(node.id)!;
      p.vx = (p.vx + f.fx) * DAMPING;
      p.vy = (p.vy + f.fy) * DAMPING;
      p.x  = Math.max(NODE_RADIUS + 8, Math.min(width  - NODE_RADIUS - 8, p.x + p.vx));
      p.y  = Math.max(NODE_RADIUS + 8, Math.min(height - NODE_RADIUS - 8, p.y + p.vy));
    }
  }

  return pos;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function explorerUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: { chain: string; address: string }[];
}

export default function WalletGraphPanel({ contractAddresses }: Props) {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const [graph,     setGraph]     = useState<TxGraphResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [layout,    setLayout]    = useState<Map<string, LayoutNode>>(new Map());
  const [copied,    setCopied]    = useState<string | null>(null);
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [tooltip,   setTooltip]   = useState<{ x: number; y: number; node: TxGraphNode } | null>(null);

  // pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning                 = useRef(false);
  const lastMouse                 = useRef({ x: 0, y: 0 });
  const svgRef                    = useRef<SVGSVGElement>(null);

  const W = 760;
  const H = 500;

  // ── Fetch graph data ───────────────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);

    const evmContract = contractAddresses.find(c => c.address.startsWith('0x'));
    if (!evmContract) {
      setLoading(false);
      setError('No EVM contract address available');
      return;
    }

    try {
      const res  = await fetch(
        `${BACKEND}/api/v1/tx-graph/${evmContract.address}?chain=${evmContract.chain}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Unknown error');

      const data = json.data as TxGraphResponse;
      setGraph(data);
      setLayout(computeLayout(data.nodes, data.edges, W, H));
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [contractAddresses, BACKEND]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // ── Zoom / Pan handlers ────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.91;
    setTransform(t => ({
      ...t,
      scale: Math.max(0.3, Math.min(3, t.scale * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.graph-node')) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const stopPanning = useCallback(() => { isPanning.current = false; }, []);

  const zoom = (delta: number) =>
    setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * delta)) }));

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  // ── Copy address ───────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: TxGraphNode) => {
    navigator.clipboard.writeText(node.address).catch(() => {});
    setCopied(node.id);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 flex items-center justify-center gap-3 text-gray-400" style={{ height: 280 }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Tracing on-chain wallet relationships…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 flex flex-col items-center gap-3 text-gray-500" style={{ height: 280 }}>
        <AlertCircle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchGraph}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500" style={{ height: 280 }}>
        <Network className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No transfer relationships found for this contract.</p>
      </div>
    );
  }

  // Derive the set of edges connected to the hovered node (for highlight)
  const hoveredEdgeIds = hovered
    ? new Set(
        graph.edges
          .filter(e => e.source === hovered || e.target === hovered)
          .map(e => e.id),
      )
    : new Set<string>();

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Network className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-white">Wallet Graph</span>
          <span className="text-xs text-gray-600">
            {graph.nodes.length} wallets · {graph.edges.length} connections
            · sampled {graph.totalSampled} transfers
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => zoom(1.2)}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Zoom in"
          ><ZoomIn className="h-3.5 w-3.5" /></button>
          <button
            onClick={() => zoom(0.83)}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Zoom out"
          ><ZoomOut className="h-3.5 w-3.5" /></button>
          <button
            onClick={resetView}
            className="px-2 py-1 rounded text-xs text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >Reset</button>
          <button
            onClick={fetchGraph}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="Re-fetch"
          ><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* ── SVG canvas ──────────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: H }}>
        <svg
          ref={svgRef}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="cursor-grab active:cursor-grabbing select-none"
          style={{ background: '#0f172a' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopPanning}
          onMouseLeave={() => { stopPanning(); setTooltip(null); }}
        >
          <defs>
            {/* Arrow markers — one per color */}
            {(['mint', 'normal', 'dim'] as const).map(variant => {
              const color =
                variant === 'mint'   ? '#f59e0b' :
                variant === 'normal' ? '#4b5563' : '#1f2937';
              return (
                <marker
                  key={variant}
                  id={`arrow-${variant}`}
                  viewBox="0 0 10 10"
                  refX="9" refY="5"
                  markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              );
            })}
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

            {/* ── Edges ──────────────────────────────────────────────────── */}
            {graph.edges.map(edge => {
              const s = layout.get(edge.source);
              const t = layout.get(edge.target);
              if (!s || !t) return null;

              const isHighlighted = hoveredEdgeIds.has(edge.id);
              const isDimmed      = hovered !== null && !isHighlighted;
              const isMint        = edge.isMint;

              const dx   = t.x - s.x;
              const dy   = t.y - s.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              // Pull endpoints back to circle edge
              const sx = s.x + (dx / dist) * NODE_RADIUS;
              const sy = s.y + (dy / dist) * NODE_RADIUS;
              const ex = t.x - (dx / dist) * (NODE_RADIUS + 8);
              const ey = t.y - (dy / dist) * (NODE_RADIUS + 8);

              const variant = isMint ? 'mint' : isDimmed ? 'dim' : 'normal';
              const stroke  =
                isMint        ? '#f59e0b' :
                isHighlighted ? '#60a5fa' :
                isDimmed      ? '#1f2937' : '#374151';

              return (
                <line
                  key={edge.id}
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={stroke}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={isMint ? '6 3' : undefined}
                  markerEnd={`url(#arrow-${variant})`}
                  opacity={isDimmed ? 0.2 : 0.8}
                />
              );
            })}

            {/* ── Nodes ──────────────────────────────────────────────────── */}
            {graph.nodes.map(node => {
              const p = layout.get(node.id);
              if (!p) return null;

              const style       = NODE_STYLE[node.type];
              const isHovered   = hovered === node.id;
              const isCopied    = copied === node.id;
              const isDimmed    = hovered !== null && !isHovered && !hoveredEdgeIds.has(node.id)
                                  && !graph.edges.some(e => (e.source === hovered && e.target === node.id)
                                                         || (e.target === hovered && e.source === node.id));
              const r = node.type === 'contract' ? NODE_RADIUS + 6 : NODE_RADIUS;

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: 'pointer' }}
                  opacity={isDimmed ? 0.25 : 1}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={e => {
                    setHovered(node.id);
                    const svgRect = svgRef.current?.getBoundingClientRect();
                    if (svgRect) {
                      setTooltip({
                        x: e.clientX - svgRect.left,
                        y: e.clientY - svgRect.top,
                        node,
                      });
                    }
                  }}
                  onMouseLeave={() => { setHovered(null); setTooltip(null); }}
                >
                  {/* Glow ring on hover */}
                  {isHovered && (
                    <circle r={r + 7} fill="none" stroke={style.stroke} strokeWidth={1.5} opacity={0.35} />
                  )}

                  {/* Node circle */}
                  <circle
                    r={r}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={node.type === 'contract' ? 2.5 : 1.5}
                  />

                  {/* Label: first line = short label, second = truncated address */}
                  <text
                    textAnchor="middle"
                    dy="-4"
                    fontSize={node.type === 'contract' ? 9 : 8}
                    fontWeight={node.type === 'contract' ? '700' : '500'}
                    fill={isCopied ? '#86efac' : style.text}
                    fontFamily="monospace"
                  >
                    {isCopied ? '✓ Copied' : node.label}
                  </text>
                  <text
                    textAnchor="middle"
                    dy="8"
                    fontSize={6.5}
                    fill={style.text}
                    opacity={0.6}
                    fontFamily="monospace"
                  >
                    {truncate(node.address)}
                  </text>

                  {/* Transaction count badge */}
                  {node.txCount > 1 && (
                    <text
                      textAnchor="middle"
                      dy={r - 4}
                      fontSize={5.5}
                      fill={style.stroke}
                      opacity={0.8}
                    >
                      {node.txCount} txs
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── Tooltip ─────────────────────────────────────────────────────── */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{
              left: Math.min(tooltip.x + 14, W - 200),
              top:  Math.max(0, tooltip.y - 10),
              maxWidth: 220,
            }}
          >
            <div className="font-semibold text-white mb-0.5">{tooltip.node.label}</div>
            <div className="font-mono text-gray-400 break-all text-[10px]">{tooltip.node.address}</div>
            <div className="mt-1.5 flex items-center gap-2 text-gray-500">
              <span className="capitalize"
                style={{ color: NODE_STYLE[tooltip.node.type].stroke }}
              >● {tooltip.node.type}</span>
              <span>· {tooltip.node.txCount} tx{tooltip.node.txCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="mt-1 text-gray-600">Click to copy · Shift+click to open explorer</div>
          </div>
        )}
      </div>

      {/* ── Legend + footer ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND.map(({ type, label }) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  background:   NODE_STYLE[type].fill,
                  borderColor:  NODE_STYLE[type].stroke,
                }}
              />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs text-gray-600 shrink-0">
          <span>Scroll = zoom · Drag = pan · Click node = copy address</span>
          {graph.contract && (
            <a
              href={explorerUrl(graph.contract)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-blue-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              BaseScan
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
