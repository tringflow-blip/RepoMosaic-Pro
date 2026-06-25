"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { select } from "d3-selection";
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide, type Simulation } from "d3-force";

export type ForceGraphNode = {
  id: string;
  label: string;
  value: number;
  r: number;
  color: string;
  avatar?: string;
  type?: "person" | "skill";
  dimension?: string;
};

export type ForceGraphEdge = {
  source: string;
  target: string;
  weight: number;
};

type Props = {
  nodes: ForceGraphNode[];
  edges: ForceGraphEdge[];
  height?: number;
  showLabels?: boolean;
  emptyMessage?: string;
  onSelectNode?: (id: string) => void;
};

type SimNode = ForceGraphNode & { x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };
type SimEdge = { source: SimNode; target: SimNode; weight: number };

export function ForceGraph({
  nodes,
  edges,
  height = 480,
  showLabels = true,
  emptyMessage = "No data yet.",
  onSelectNode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: height });

  // Track container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(320, e.contentRect.width);
        setSize({ w, h: height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [height]);

  // Initialize / update simulation when data changes
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const idMap = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges: SimEdge[] = edges
      .map((e) => ({
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        weight: e.weight,
      }))
      .filter((e) => e.source && e.target);

    nodesRef.current = simNodes;
    edgesRef.current = simEdges;

    const sim = forceSimulation<SimNode>(simNodes)
      .force("charge", forceManyBody().strength(-90))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force(
        "link",
        forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => 60 + 30 / Math.max(1, d.weight))
          .strength(0.18)
      )
      .force("collide", forceCollide<SimNode>().radius((d) => d.r + 4).iterations(2))
      .alpha(1)
      .alphaDecay(0.025);

    sim.on("tick", () => drawRef.current());
    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [nodes, edges, size.w, size.h]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // Edges — base layer is faint, highlighted edges glow
    ctx.lineWidth = 1;
    for (const e of edgesRef.current) {
      if (!e.source.x || !e.source.y || !e.target.x || !e.target.y) continue;
      const isHi =
        hoverRef.current === e.source.id ||
        hoverRef.current === e.target.id ||
        selectedRef.current === e.source.id ||
        selectedRef.current === e.target.id;
      ctx.strokeStyle = isHi ? "oklch(0.5 0.10 75 / 0.65)" : "oklch(0.5 0 0 / 0.14)";
      ctx.lineWidth = isHi ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.stroke();
    }

    // Nodes — render with shadow for depth, full opacity for strong contrast
    for (const n of nodesRef.current) {
      if (!n.x || !n.y) continue;
      const isHi = hoverRef.current === n.id || selectedRef.current === n.id;
      const r = n.r + (isHi ? 2 : 0);

      // Soft outer glow on hover/selected
      if (isHi) {
        ctx.save();
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.restore();
      }

      // Subtle drop shadow for depth on every node
      ctx.save();
      ctx.shadowColor = "oklch(0.20 0 0 / 0.18)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = isHi ? 1 : 0.96;
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;

      // Crisp ring border
      ctx.lineWidth = isHi ? 2.5 : 1.2;
      ctx.strokeStyle = isHi ? "oklch(0.15 0 0 / 0.92)" : "oklch(1 0 0 / 0.85)";
      ctx.stroke();

      // Avatar initials for person nodes
      if (n.type === "person" && n.label) {
        ctx.fillStyle = "oklch(0.99 0 0)";
        ctx.font = `600 ${Math.max(9, Math.min(13, r * 0.7))}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.label[0]?.toUpperCase() ?? "?", n.x, n.y);
      }
    }

    // Labels — rounded pill background with proper padding
    if (showLabels) {
      ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const n of nodesRef.current) {
        if (!n.x || !n.y) continue;
        const isHi = hoverRef.current === n.id || selectedRef.current === n.id;
        // Only label skill nodes (person nodes are too many) or hovered/selected
        if (n.type === "skill" || isHi) {
          const text = n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label;
          const padX = 7;
          const w = ctx.measureText(text).width + padX * 2;
          const h = 17;
          const lx = n.x - w / 2;
          const ly = n.y + n.r + 5;

          // Rounded rect background
          const radius = 4;
          ctx.beginPath();
          ctx.moveTo(lx + radius, ly);
          ctx.lineTo(lx + w - radius, ly);
          ctx.quadraticCurveTo(lx + w, ly, lx + w, ly + radius);
          ctx.lineTo(lx + w, ly + h - radius);
          ctx.quadraticCurveTo(lx + w, ly + h, lx + w - radius, ly + h);
          ctx.lineTo(lx + radius, ly + h);
          ctx.quadraticCurveTo(lx, ly + h, lx, ly + h - radius);
          ctx.lineTo(lx, ly + radius);
          ctx.quadraticCurveTo(lx, ly, lx + radius, ly);
          ctx.closePath();

          if (isHi) {
            ctx.fillStyle = "oklch(0.15 0 0 / 0.95)";
            ctx.fill();
            ctx.fillStyle = "oklch(0.99 0 0)";
          } else {
            ctx.fillStyle = "oklch(0.20 0 0 / 0.82)";
            ctx.fill();
            ctx.fillStyle = "oklch(0.99 0 0)";
          }
          ctx.fillText(text, n.x, ly + h / 2 + 0.5);
        }
      }
    }
  }, [showLabels, size.w, size.h]);

  // Keep drawRef in sync with the latest draw closure
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Redraw on hover/selected change
  useEffect(() => {
    hoverRef.current = hovered;
    draw();
  }, [hovered, draw]);

  useEffect(() => {
    selectedRef.current = selected;
    draw();
  }, [selected, draw]);

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const findNode = (x: number, y: number) => {
      for (const n of nodesRef.current) {
        if (!n.x || !n.y) continue;
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= (n.r + 2) ** 2) return n;
      }
      return null;
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = getMouse(e);
      const hit = findNode(x, y);
      const id = hit?.id ?? null;
      if (id !== hoverRef.current) {
        setHovered(id);
      }
      canvas.style.cursor = hit ? "pointer" : "default";
      // Drag
      if (draggingRef.current && simRef.current) {
        const n = nodesRef.current.find((nn) => nn.id === draggingRef.current);
        if (n) {
          n.fx = x;
          n.fy = y;
          simRef.current.alphaTarget(0.3).restart();
        }
      }
    };

    const onDown = (e: MouseEvent) => {
      const { x, y } = getMouse(e);
      const hit = findNode(x, y);
      if (hit) {
        draggingRef.current = hit.id;
        hit.fx = x;
        hit.fy = y;
        if (simRef.current) simRef.current.alphaTarget(0.3).restart();
      }
    };

    const onUp = () => {
      if (draggingRef.current && simRef.current) {
        const n = nodesRef.current.find((nn) => nn.id === draggingRef.current);
        if (n) {
          n.fx = null;
          n.fy = null;
        }
        simRef.current.alphaTarget(0);
      }
      draggingRef.current = null;
    };

    const onClick = (e: MouseEvent) => {
      const { x, y } = getMouse(e);
      const hit = findNode(x, y);
      const id = hit?.id ?? null;
      setSelected(id);
      if (onSelectNode && hit) onSelectNode(hit.id);
    };

    const onLeave = () => {
      setHovered(null);
      canvas.style.cursor = "default";
    };

    const draggingRef: { current: string | null } = { current: null };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [onSelectNode]);

  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
    </div>
  );
}

// d3-selection is needed for some d3-force integrations; keep import to avoid tree-shake issues.
void select;
