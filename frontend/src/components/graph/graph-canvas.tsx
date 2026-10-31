"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import * as d3 from "d3-force-3d";

import {
  DOMAIN_CLUSTERS,
  getEntityVisual,
  getNodeCluster,
  hexToRgb,
} from "@/components/graph/graph-palette";
import { useTwinStore } from "@/lib/store";
import type { GraphData, GraphLink, GraphNode } from "@/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  reheat: () => void;
  focusNode: (nodeId: string) => void;
}

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

function endpointId(value: GraphLink["source"]): string {
  return typeof value === "string" ? value : (value as { id: string }).id;
}

function getNodeRadius(node: GraphNode): number {
  if (node.label === "User") return 8.5;
  if (node.label === "Project" || node.label === "Goal") return 6.0;
  return 4.5;
}

const HUB_NAMES = new Set([
  "taniksh anand",
  "python",
  "pytorch",
  "fastapi",
  "hackmait robotics",
  "omnilife",
  "neo4j",
  "react",
  "next.js",
  "ros",
  "rust",
  "c++",
  "docker",
  "authentic utility",
]);

export const GraphCanvas = forwardRef<
  GraphCanvasHandle,
  {
    data: GraphData;
    selectedId?: string | null;
    onNodeClick: (node: GraphNode) => void;
    onBackgroundClick?: () => void;
    showLabels?: boolean;
    searchQuery?: string;
  }
>(function GraphCanvas(
  {
    data,
    selectedId,
    onNodeClick,
    onBackgroundClick,
    showLabels = true,
    searchQuery = "",
  },
  ref
) {
  const theme = useTwinStore((state) => state.theme);
  const isDark = theme === "dark";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<any>(null);
  const hasFittedRef = useRef(false);

  const [size, setSize] = useState(() => {
    if (typeof window !== "undefined") {
      return {
        width: Math.max(600, window.innerWidth - 300),
        height: Math.max(500, window.innerHeight - 60),
      };
    }
    return { width: 1200, height: 800 };
  });

  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);

  // Resize handling: tracks exact container dimensions as side panels collapse or expand
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const w = Math.max(300, Math.floor(rect.width));
      const h = Math.max(300, Math.floor(rect.height));
      setSize({ width: w, height: h });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // When panel size changes (e.g. window resize, explorer collapse, inspector toggle),
  // smoothly re-fit the constellation to occupy the complete available canvas
  useEffect(() => {
    if (size.width > 0 && size.height > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit?.(300, 24);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [size.width, size.height]);

  // Compute incident links and neighbor nodes for selected and hovered nodes
  const activeFocusId = selectedId || hoveredNode?.id || null;

  const { neighborNodeIds, activeLinkKeys } = useMemo(() => {
    const neighbors = new Set<string>();
    const linkKeys = new Set<string>();
    if (!activeFocusId) return { neighborNodeIds: neighbors, activeLinkKeys: linkKeys };

    neighbors.add(activeFocusId);
    for (const link of data.links) {
      const src = endpointId(link.source);
      const tgt = endpointId(link.target);
      if (src === activeFocusId || tgt === activeFocusId) {
        neighbors.add(src);
        neighbors.add(tgt);
        linkKeys.add(`${src}-->${tgt}`);
        linkKeys.add(`${tgt}-->${src}`);
      }
    }
    return { neighborNodeIds: neighbors, activeLinkKeys: linkKeys };
  }, [activeFocusId, data.links]);

  // Seed nodes in an expansive, multi-ring radial distribution with hubs at center
  const preparedGraphData = useMemo(() => {
    const processedNodes = data.nodes.map((n) => ({ ...n } as ForceNode));
    const total = processedNodes.length || 1;

    processedNodes.forEach((node, idx) => {
      if (node.x == null || node.y == null || (node.x === 0 && node.y === 0)) {
        const isUser = node.label === "User" || node.name.toLowerCase().includes("taniksh");
        const isHub = HUB_NAMES.has(node.name.toLowerCase());

        if (isUser) {
          node.x = 0;
          node.y = 0;
        } else if (isHub) {
          const angle = (idx / 12) * Math.PI * 2;
          const r = 120 + (idx % 3) * 40;
          node.x = Math.cos(angle) * r;
          node.y = Math.sin(angle) * r;
        } else {
          // Golden angle phyllotaxis distribution spreading across the entire canvas
          const angle = idx * 2.399963;
          const r = 160 + Math.sqrt(idx) * 65;
          node.x = Math.cos(angle) * r;
          node.y = Math.sin(angle) * r;
        }
        node.vx = 0;
        node.vy = 0;
      }
    });

    return {
      nodes: processedNodes,
      links: data.links.map((l) => ({ ...l })),
    };
  }, [data]);

  // Configure D3 Force Simulation to distribute nodes broadly across the entire central canvas
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    try {
      hasFittedRef.current = false;

      // 1. Collision prevention with generous radius
      fg.d3Force(
        "collide",
        d3.forceCollide().radius((node: any) => getNodeRadius(node) + 16).iterations(2)
      );

      // 2. High many-body repulsion so nodes fill the available canvas space
      const charge = fg.d3Force("charge");
      if (charge) {
        charge.strength(-520).distanceMin(25).distanceMax(1800);
      }

      // 3. Link distance & cohesion
      const linkForce = fg.d3Force("link");
      if (linkForce) {
        linkForce.distance(110).strength(0.3);
      }

      // 4. Centering force keeping the network centered at (0, 0)
      fg.d3Force("center", d3.forceCenter(0, 0).strength(0.04));

      // Reheat simulation smoothly
      fg.d3ReheatSimulation();

      // Fit-to-view after initial simulation expansion
      const t1 = setTimeout(() => {
        fg.zoomToFit(400, 28);
      }, 300);

      const t2 = setTimeout(() => {
        fg.zoomToFit(300, 28);
      }, 750);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } catch (err) {
      console.warn("[GraphCanvas] D3 force setup notice:", err);
    }
  }, [preparedGraphData]);

  // Imperative handle for parent controls
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const fg = fgRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() * 1.35, 400);
      },
      zoomOut: () => {
        const fg = fgRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() / 1.35, 400);
      },
      zoomToFit: () => {
        fgRef.current?.zoomToFit?.(400, 28);
      },
      reheat: () => {
        fgRef.current?.d3ReheatSimulation?.();
      },
      focusNode: (nodeId: string) => {
        const fg = fgRef.current;
        if (!fg) return;
        const node = preparedGraphData.nodes.find((n) => n.id === nodeId) as
          | ForceNode
          | undefined;
        if (node && node.x != null && node.y != null) {
          fg.centerAt(node.x, node.y, 600);
          fg.zoom(2.5, 600);
        }
      },
    }),
    [preparedGraphData.nodes]
  );

  // Custom node drawing: luminous bloom glow matching node color, crisp jewel core & legible labels
  const drawNode = useCallback(
    (rawNode: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = rawNode as ForceNode;
      if (node.x == null || node.y == null) return;

      const radius = getNodeRadius(node);
      const isSelected = node.id === selectedId;
      const isHovered = hoveredNode?.id === node.id;
      const visual = getEntityVisual(node.label, isDark);
      const isHub = HUB_NAMES.has(node.name.toLowerCase());
      const isUser = node.label === "User";

      // Focus opacity logic
      let alpha = 1.0;
      if (activeFocusId) {
        if (neighborNodeIds.has(node.id)) {
          alpha = 1.0;
        } else {
          alpha = isDark ? 0.12 : 0.2;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Base node color
      const nodeColor = isSelected
        ? (isDark ? "#ffffff" : "#0284c7")
        : isHovered
        ? (isDark ? "#38bdf8" : "#0ea5e9")
        : isUser
        ? (isDark ? "#ffffff" : "#0f172a")
        : (visual.color || (isDark ? "#00f0ff" : "#0284c7"));

      // Compute matching glow color from this specific node's palette
      const glowRgb = isSelected
        ? (isDark ? "255, 255, 255" : "2, 132, 199")
        : isHovered
        ? (isDark ? "56, 189, 248" : "14, 165, 233")
        : isUser
        ? (isDark ? "255, 255, 255" : "15, 23, 42")
        : hexToRgb(visual.color || (isDark ? "#00f0ff" : "#0284c7"));

      // 1. Radiant Bloom Halo matching node's entity color
      const glowRadius = radius * (isSelected ? 4.2 : isHovered ? 3.8 : 3.0);
      const glowGrad = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        glowRadius
      );
      glowGrad.addColorStop(0, `rgba(${glowRgb}, ${isDark ? 0.7 : 0.45})`);
      glowGrad.addColorStop(0.35, `rgba(${glowRgb}, ${isDark ? 0.22 : 0.15})`);
      glowGrad.addColorStop(1, `rgba(${glowRgb}, 0)`);

      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // 2. Base Disc
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "#02050d" : "#ffffff";
      ctx.fill();

      // 3. Crisp Glowing Nucleus
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // 4. Subtle Rim Stroke
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected
        ? (isDark ? "#ffffff" : "#0284c7")
        : isHovered
        ? (isDark ? "#e0f2fe" : "#0ea5e9")
        : (isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(15, 23, 42, 0.35)");
      ctx.lineWidth = isSelected ? 2.0 : isHovered ? 1.6 : 0.8;
      ctx.stroke();

      // 5. Selected / Hovered Radiant Orbital Ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? "#ffffff" : "#0284c7";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${glowRgb}, 0.85)`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 6. Crisp, Legible Labels with high contrast in both dark and light modes
      const shouldDrawLabel =
        showLabels && (isHub || isSelected || isHovered || isUser || globalScale > 1.35);

      if (shouldDrawLabel) {
        const labelText =
          node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name;
        const fontSize = Math.max(8.5 / globalScale, 2.8);

        ctx.font = `${isHub || isSelected || isUser ? "600" : "500"} ${fontSize}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Text shadow for contrast against background space and edge lines
        ctx.shadowColor = isDark ? "#020408" : "#ffffff";
        ctx.shadowBlur = 4;
        ctx.fillStyle = isSelected
          ? (isDark ? "#ffffff" : "#0284c7")
          : isHovered
          ? (isDark ? "#38bdf8" : "#0369a1")
          : (isDark ? "#e2e8f0" : "#0f172a");

        ctx.fillText(labelText, node.x + radius + 4, node.y);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    },
    [
      selectedId,
      hoveredNode,
      activeFocusId,
      neighborNodeIds,
      isDark,
      showLabels,
    ]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-0 min-w-0 select-none overflow-hidden bg-slate-100/70 dark:bg-[#020409] transition-colors"
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onBackgroundClick?.();
        }
      }}
    >
      {/* Ambient Grid Layer: Blueprint in Light mode, Cyan Cosmic in Dark mode */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.22] transition-opacity"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.08) 0%, rgba(0, 150, 255, 0.02) 45%, transparent 75%), linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)"
            : "radial-gradient(circle at 50% 50%, rgba(2, 132, 199, 0.06) 0%, rgba(14, 165, 233, 0.02) 45%, transparent 75%), linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      />

      {size.width > 0 && size.height > 0 ? (
        <ForceGraph2D
          ref={fgRef}
          graphData={
            preparedGraphData as unknown as { nodes: object[]; links: object[] }
          }
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeVal="val"
          nodeRelSize={4}
          // Glowing Electric Cyan Links
          linkColor={(rawLink: object) => {
            const link = rawLink as GraphLink;
            const src = endpointId(link.source);
            const tgt = endpointId(link.target);
            const isActive = activeLinkKeys.has(`${src}-->${tgt}`);
            if (activeFocusId) {
              if (isActive) {
                return isDark
                  ? "rgba(0, 255, 255, 0.95)"
                  : "rgba(2, 132, 199, 0.95)";
              }
              return isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(0, 0, 0, 0.03)";
            }
            return isDark
              ? "rgba(0, 229, 255, 0.32)"
              : "rgba(2, 132, 199, 0.28)";
          }}
          linkWidth={(rawLink: object) => {
            const link = rawLink as GraphLink;
            const src = endpointId(link.source);
            const tgt = endpointId(link.target);
            const isActive = activeLinkKeys.has(`${src}-->${tgt}`);
            return isActive ? 2.2 : 0.85;
          }}
          linkDirectionalArrowLength={4.2}
          linkDirectionalArrowRelPos={0.93}
          linkDirectionalArrowColor={(rawLink: object) => {
            const link = rawLink as GraphLink;
            const src = endpointId(link.source);
            const tgt = endpointId(link.target);
            const isActive = activeLinkKeys.has(`${src}-->${tgt}`);
            if (activeFocusId) {
              if (isActive) return isDark ? "#00f0ff" : "#0284c7";
              return "transparent";
            }
            return isDark
              ? "rgba(0, 229, 255, 0.45)"
              : "rgba(2, 132, 199, 0.45)";
          }}
          linkDirectionalParticles={(rawLink: object) => {
            const link = rawLink as GraphLink;
            const src = endpointId(link.source);
            const tgt = endpointId(link.target);
            const isActive = activeLinkKeys.has(`${src}-->${tgt}`);
            return isActive ? 3 : 1;
          }}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() =>
            isDark ? "#00f0ff" : "#0284c7"
          }
          linkDirectionalParticleSpeed={(rawLink: object) => {
            const link = rawLink as GraphLink;
            const src = endpointId(link.source);
            const tgt = endpointId(link.target);
            const isActive = activeLinkKeys.has(`${src}-->${tgt}`);
            return isActive ? 0.008 : 0.004;
          }}
          cooldownTicks={140}
          d3VelocityDecay={0.34}
          d3AlphaDecay={0.016}
          minZoom={0.2}
          maxZoom={8}
          onEngineStop={() => {
            if (!hasFittedRef.current) {
              hasFittedRef.current = true;
              fgRef.current?.zoomToFit?.(350, 24);
            }
          }}
          onNodeClick={(node) => {
            onNodeClick(node as unknown as GraphNode);
          }}
          onNodeHover={(node) => {
            setHoveredNode((node as ForceNode) || null);
          }}
          onBackgroundClick={() => {
            onBackgroundClick?.();
          }}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(
            rawNode: object,
            color: string,
            ctx: CanvasRenderingContext2D
          ) => {
            const node = rawNode as ForceNode;
            if (node.x == null || node.y == null) return;
            const radius = getNodeRadius(node) + 6;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      ) : null}
    </div>
  );
});
