"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  LayoutGrid,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Network,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Folder,
  FolderOpen,
  Link2,
  Loader2,
  Info,
} from "lucide-react";

import {
  DOMAIN_CLUSTERS,
  getEntityVisual,
} from "@/components/graph/graph-palette";
import {
  GraphCanvas,
  type GraphCanvasHandle,
} from "@/components/graph/graph-canvas";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { apiErrorMessage, graphApi } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import type {
  GraphData,
  GraphLink,
  GraphNode,
  GraphNodeDetails,
} from "@/types";
import { cn } from "@/lib/utils";

const NODE_LABELS = [
  "Skill",
  "Project",
  "Goal",
  "Topic",
  "Person",
  "Fact",
  "Preference",
  "Institution",
];

function endpointId(value: GraphLink["source"]): string {
  return typeof value === "string" ? value : (value as { id: string }).id;
}

export default function KnowledgeGraphPage() {
  const theme = useTwinStore((state) => state.theme);
  const isDark = theme === "dark";
  const toggleTheme = useTwinStore((state) => state.toggleTheme);
  const setSidebarOpen = useTwinStore((state) => state.setSidebarOpen);
  const presentationMode = useTwinStore((state) => state.presentationMode);
  const togglePresentationMode = useTwinStore(
    (state) => state.togglePresentationMode
  );

  const canvasRef = useRef<GraphCanvasHandle | null>(null);

  // Layout Panels state (Collapsible left explorer and right inspector)
  const [leftExplorerOpen, setLeftExplorerOpen] = useState(true);
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);

  // Fullscreen Presentation Mode handler with Fullscreen API
  const handleTogglePresentation = useCallback(async () => {
    togglePresentationMode();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Browser permissions fallback
    }
  }, [togglePresentationMode]);

  useEffect(() => {
    const onFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      if (!isFs && presentationMode) {
        togglePresentationMode();
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [presentationMode, togglePresentationMode]);

  // Graph Data
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [showLabels, setShowLabels] = useState(true);

  // Tree category disclosure state (start with large Skill category collapsed so Project, Goal, User are immediately visible)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(["Skill"])
  );

  // Selection & Details
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [details, setDetails] = useState<GraphNodeDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("Skill");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [connectOpen, setConnectOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [relLabel, setRelLabel] = useState("RELATED_TO");
  const [connecting, setConnecting] = useState(false);

  // Load graph data
  const loadGraph = useCallback(async (nextDepth: number) => {
    setLoading(true);
    setError(null);
    try {
      const graph = await graphApi.subgraph({ depth: nextDepth, limit: 350 });
      setData(graph);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph(depth);
  }, [depth, loadGraph]);

  // Open node & fetch details
  const openNode = useCallback(async (node: GraphNode) => {
    setSelected(node);
    setRightInspectorOpen(true);
    setDetailLoading(true);
    setDetails(null);
    try {
      const nodeDetails = await graphApi.node(node.id);
      setDetails(nodeDetails);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleSelectSearchMatch(node: GraphNode) {
    setSearchQuery("");
    setSearchFocused(false);
    openNode(node);
    canvasRef.current?.focusNode(node.id);
  }

  // Toggle category in left explorer
  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  // Filtered graph data based on top filter chips
  const filtered = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    if (activeFilter === "all") return data;

    const matchedNodes = data.nodes.filter((n) => {
      if (activeFilter === "Skill") return n.label === "Skill";
      if (activeFilter === "Project") return n.label === "Project";
      if (activeFilter === "Goal") return n.label === "Goal";
      if (activeFilter === "Topic") return n.label === "Topic";
      if (activeFilter === "AI_ML") {
        const name = n.name.toLowerCase();
        return (
          name.includes("pytorch") ||
          name.includes("transformer") ||
          name.includes("llm") ||
          name.includes("rag") ||
          name.includes("machine learning") ||
          name.includes("triton")
        );
      }
      if (activeFilter === "Systems") {
        const name = n.name.toLowerCase();
        return (
          name.includes("python") ||
          name.includes("rust") ||
          name.includes("c++") ||
          name.includes("fastapi") ||
          name.includes("docker") ||
          name.includes("neo4j")
        );
      }
      return true;
    });

    const nodeIds = new Set(matchedNodes.map((n) => n.id));
    const matchedLinks = data.links.filter(
      (l) => nodeIds.has(endpointId(l.source)) && nodeIds.has(endpointId(l.target))
    );

    return { nodes: matchedNodes, links: matchedLinks };
  }, [data, activeFilter]);

  // Group all nodes by Label for the Left Entity Explorer
  const groupedNodes = useMemo(() => {
    if (!data) return {};
    const groups: Record<string, GraphNode[]> = {};
    for (const label of NODE_LABELS) {
      groups[label] = [];
    }

    const q = explorerSearch.trim().toLowerCase();
    for (const node of data.nodes) {
      if (q && !node.name.toLowerCase().includes(q)) continue;
      const groupKey = groups[node.label] ? node.label : "Other";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(node);
    }

    // Sort nodes in each category alphabetically
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }, [data, explorerSearch]);

  // Compute degree (number of relationships) for each node
  const nodeDegrees = useMemo(() => {
    const deg: Record<string, number> = {};
    if (!data) return deg;
    for (const link of data.links) {
      const src = endpointId(link.source);
      const tgt = endpointId(link.target);
      deg[src] = (deg[src] || 0) + 1;
      deg[tgt] = (deg[tgt] || 0) + 1;
    }
    return deg;
  }, [data]);

  // Top Search Matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !data) return [];
    const q = searchQuery.toLowerCase();
    return data.nodes
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, data]);

  // Node Deletion
  async function handleDeleteNode(node: GraphNode) {
    if (
      !window.confirm(
        `Permanently remove "${node.name}" (${node.label}) from your Knowledge Graph?`
      )
    ) {
      return;
    }
    try {
      await graphApi.deleteNode(node.id);
      setSelected(null);
      setDetails(null);
      void loadGraph(depth);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  // Relationship Deletion
  async function handleDeleteRelationship(
    sourceId: string,
    targetId: string,
    label: string
  ) {
    try {
      await graphApi.deleteRelationship(sourceId, targetId, label);
      if (selected) {
        const updated = await graphApi.node(selected.id);
        setDetails(updated);
      }
      void loadGraph(depth);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  // Relationship Creation
  async function handleAddRelationship() {
    if (!selected || !targetId) return;
    setConnecting(true);
    try {
      await graphApi.createRelationship({
        source_id: selected.id,
        target_id: targetId,
        label: relLabel,
      });
      setConnectOpen(false);
      setTargetId("");
      const updated = await graphApi.node(selected.id);
      setDetails(updated);
      void loadGraph(depth);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }

  // Node Creation
  async function handleCreateNode() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await graphApi.createNode({
        label: newLabel,
        name: newName.trim(),
        properties: newDescription.trim()
          ? { description: newDescription.trim() }
          : undefined,
      });
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      void loadGraph(depth);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative flex h-full max-h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors">
      {/* =========================================================================
          SLIM TOP TOOLBAR (MATCHING EXACT REFERENCE SCREENSHOT)
          ========================================================================= */}
      {!presentationMode ? (
        <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0a0a0a]/95 px-3 backdrop-blur-md sm:px-4 transition-colors">
          {/* Left: Mobile Nav Button, Brand & Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-800 dark:hover:text-white lg:hidden transition"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:text-cyan-400 shadow-xs dark:shadow-[0_0_10px_rgba(0,229,255,0.25)]">
                <BrainCircuit className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                <span>Knowledge Graph</span>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">OmniLife Brain</span>
                <span className="ml-1 hidden sm:inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-700 font-semibold dark:bg-cyan-500/10 dark:border-cyan-500/20 dark:text-cyan-400">
                  Live Twin
                </span>
              </div>
            </div>
          </div>

          {/* Center: Filter Pills */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 dark:border-neutral-800/80 dark:bg-neutral-900/60 transition-colors">
            {[
              { id: "all", label: "All Entities" },
              { id: "Skill", label: "Skills" },
              { id: "Project", label: "Projects" },
              { id: "Goal", label: "Goals" },
              { id: "AI_ML", label: "AI & ML" },
              { id: "Systems", label: "Systems" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
                  activeFilter === f.id
                    ? "bg-white text-slate-900 font-semibold border border-slate-200/80 shadow-xs dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Right: Quick Search, Counters, Fit, Reheat, Add Entity & Fullscreen */}
          <div className="flex items-center gap-1.5">
            {/* Quick Search */}
            <div className="relative w-36 sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search graph..."
                className="h-7.5 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-white dark:placeholder-neutral-500 dark:focus:border-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Autocomplete Popup */}
              {searchFocused && searchMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-[#0a0a0a] dark:shadow-2xl">
                  <div className="p-1">
                    {searchMatches.map((n) => {
                      const vis = getEntityVisual(n.label, isDark);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onMouseDown={() => handleSelectSearchMatch(n)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-neutral-900"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: vis.color }}
                          />
                          <span className="truncate font-medium text-slate-900 dark:text-white">
                            {n.name}
                          </span>
                          <span className="ml-auto text-[10px] text-slate-500 dark:text-neutral-500">
                            {n.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Count Pill */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 px-2 py-1 text-[11px] font-mono text-slate-600 dark:border-neutral-800/80 dark:bg-neutral-900/50 dark:text-slate-400">
              <span className="text-slate-900 dark:text-cyan-400 font-semibold">{data?.nodes.length || 0}</span>
              <span>nodes</span>
              <span>·</span>
              <span className="text-slate-700 dark:text-teal-400 font-semibold">{data?.links.length || 0}</span>
              <span>links</span>
            </div>

            {/* Left Explorer Toggle */}
            <Button
              size="icon"
              variant="outline"
              className={cn(
                "h-7.5 w-7.5 border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:text-white",
                leftExplorerOpen && "bg-slate-100 text-slate-900 border-slate-300 dark:bg-neutral-800/80 dark:text-cyan-400"
              )}
              onClick={() => setLeftExplorerOpen((prev) => !prev)}
              title={leftExplorerOpen ? "Hide Explorer" : "Show Explorer"}
            >
              {leftExplorerOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeft className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Right Inspector Toggle */}
            <Button
              size="icon"
              variant="outline"
              className={cn(
                "h-7.5 w-7.5 border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:text-white",
                rightInspectorOpen && "bg-slate-100 text-slate-900 border-slate-300 dark:bg-neutral-800/80 dark:text-cyan-400"
              )}
              onClick={() => setRightInspectorOpen((prev) => !prev)}
              title={rightInspectorOpen ? "Hide Details Panel" : "Show Details Panel"}
            >
              {rightInspectorOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRight className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Fit to View */}
            <Button
              size="icon"
              variant="outline"
              className="h-7.5 w-7.5 border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:text-white"
              onClick={() => canvasRef.current?.zoomToFit()}
              title="Fit to view (center galaxy)"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>

            {/* Add Entity Button */}
            <Button
              size="sm"
              className="h-7.5 gap-1 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 font-semibold shadow-xs dark:shadow-[0_0_12px_rgba(0,229,255,0.3)]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>

            {/* Fullscreen Presentation Toggle */}
            <Button
              size="icon"
              variant="outline"
              className="h-7.5 w-7.5 border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:text-white"
              onClick={handleTogglePresentation}
              title="Full-Screen presentation mode"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>
      ) : (
        /* Floating Presentation Mode Pill */
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-1.5 shadow-lg backdrop-blur-md dark:border-neutral-800/90 dark:bg-[#0a0a0a]/90 dark:shadow-2xl">
          <BrainCircuit className="h-4 w-4 text-slate-900 dark:text-cyan-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Presentation Mode</span>
          <span className="text-[10px] font-mono text-slate-600 dark:text-cyan-400">({data?.nodes.length || 0} entities)</span>
          <div className="h-3 w-[1px] bg-slate-200 dark:bg-neutral-800 mx-1" />
          <button
            type="button"
            onClick={handleTogglePresentation}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 transition"
          >
            <Minimize2 className="h-3 w-3" />
            <span>Exit Fullscreen</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN THREE-PANEL WORKSPACE (MATCHING EXACT REFERENCE SCREENSHOT)
          ========================================================================= */}
      <div className="relative flex flex-1 w-full h-full min-h-0 min-w-0 overflow-hidden">
        {/* =========================================================================
            PANEL 1: COMPACT LEFT ENTITY EXPLORER (TREE HIERARCHY)
            ========================================================================= */}
        {!presentationMode && leftExplorerOpen && (
          <aside className="z-10 flex h-full max-h-full min-h-0 w-64 shrink-0 flex-col border-r border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md transition-all duration-300">
            {/* Explorer Header & Instant Search Filter */}
            <div className="shrink-0 p-3 border-b border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0a0a0a]/95">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                  Taxonomy & Entities
                </span>
                <span className="text-[10px] font-mono text-slate-600 dark:text-cyan-400 font-semibold">
                  {data?.nodes.length || 0}
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  placeholder="Filter taxonomy..."
                  className="h-6.5 w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 text-[11px] text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-white dark:placeholder-neutral-500 dark:focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Tree View by Category - Independently vertically scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1 scrollbar-thin text-xs">
              {Object.entries(groupedNodes).map(([label, nodes]) => {
                if (nodes.length === 0) return null;
                const isCollapsed = collapsedCategories.has(label);
                const vis = getEntityVisual(label, isDark);

                return (
                  <div key={label} className="select-none">
                    {/* Category Folder Row */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(label)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-neutral-900/80 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: vis.color }}
                        />
                        <span className="font-semibold truncate text-[11px]">
                          {label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {nodes.length}
                      </span>
                    </button>

                    {/* Nodes under Category */}
                    {!isCollapsed && (
                      <div className="ml-4 pl-1.5 border-l border-slate-200 dark:border-neutral-800/80 space-y-0.5 mt-0.5">
                        {nodes.map((node) => {
                          const isNodeSelected = selected?.id === node.id;
                          const deg = nodeDegrees[node.id] || 0;

                          return (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() => {
                                openNode(node);
                                canvasRef.current?.focusNode(node.id);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] transition",
                                isNodeSelected
                                  ? "bg-slate-100 text-slate-900 font-semibold dark:bg-cyan-500/15 dark:text-cyan-300"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                              )}
                              title={node.name}
                            >
                              <span className="truncate pr-1">{node.name}</span>
                              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                                {deg}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* =========================================================================
            PANEL 2: MASSIVE CENTRAL GRAPH CANVAS (100% WIDTH & HEIGHT)
            ========================================================================= */}
        <div className="relative flex-1 min-w-0 min-h-0 h-full w-full overflow-hidden bg-slate-100/60 dark:bg-[#020409] transition-colors">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-40 max-w-xl">
              <Alert variant="danger">
                <span className="font-semibold">Notice: </span>
                {error}
              </Alert>
            </div>
          )}

          {/* Core ForceGraph2D Canvas */}
          <div className="h-full w-full min-h-0 min-w-0">
            <GraphCanvas
              ref={canvasRef}
              data={filtered}
              selectedId={selected?.id}
              onNodeClick={openNode}
              onBackgroundClick={() => setSelected(null)}
              showLabels={showLabels}
              searchQuery={searchQuery}
            />
          </div>

          {/* Floating Bottom-Right Toolbar */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/90 p-1 shadow-lg backdrop-blur-md dark:border-neutral-800/90 dark:bg-[#0a0a0a]/90 dark:shadow-2xl">
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomIn()}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomOut()}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomToFit()}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title="Fit network to canvas"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((prev) => !prev)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title={showLabels ? "Hide node labels" : "Show node labels"}
              aria-label="Toggle node labels"
            >
              {showLabels ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.reheat()}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              title="Reheat simulation physics"
              aria-label="Reheat simulation physics"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            PANEL 3: COMPACT RIGHT CONTEXTUAL INFORMATION PANEL
            ========================================================================= */}
        {!presentationMode && rightInspectorOpen && (
          <aside className="z-10 flex h-full max-h-full min-h-0 w-80 shrink-0 flex-col border-l border-slate-200 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md transition-all duration-300">
            {selected ? (
              /* Selected Entity Details */
              <div className="flex h-full min-h-0 flex-1 flex-col">
                {/* Header - Fixed at top */}
                <div className="shrink-0 p-4 border-b border-slate-200 dark:border-neutral-800/80 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: getEntityVisual(selected.label, isDark).color,
                        }}
                      />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {selected.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-800 font-semibold dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400">
                        {selected.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {nodeDegrees[selected.id] || 0} connections
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-neutral-800 dark:hover:text-white transition"
                    title="Close selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Content - Independently scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 scrollbar-thin text-xs">
                  {/* Knowledge Description */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Twin Intelligence
                    </p>
                    <p className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-[11px] leading-relaxed text-slate-700 dark:border-neutral-800/80 dark:bg-neutral-900/40 dark:text-slate-300">
                      {((selected.properties as any)?.description ||
                        details?.node?.properties?.description) ||
                        (selected.label === "User"
                          ? "Your primary digital twin knowledge identity."
                          : selected.label === "Skill"
                          ? `Indexed technical skill and proficiency in ${selected.name}.`
                          : selected.label === "Project"
                          ? `Development project tracking active architecture and deliverables.`
                          : `Knowledge graph node indexed in personal twin.`)}
                    </p>
                  </div>

                  {/* Incident Relationships */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Connected Entities ({details?.links?.length || 0})
                      </p>
                      <button
                        type="button"
                        onClick={() => setConnectOpen(true)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        <Plus className="h-3 w-3" /> Connect
                      </button>
                    </div>

                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading relationships...</span>
                      </div>
                    ) : (details?.links || []).length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-2">
                        No explicit links found for this node.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto overscroll-contain scrollbar-thin">
                        {(details?.links || []).map((link, idx) => {
                          const src = endpointId(link.source);
                          const tgt = endpointId(link.target);
                          const isOutgoing = src === selected.id;
                          const neighborId = isOutgoing ? tgt : src;
                          const neighborNode =
                            details?.neighbors?.find((n) => n.id === neighborId) ||
                            data?.nodes.find((n) => n.id === neighborId);
                          const neighborVis = getEntityVisual(
                            neighborNode?.label || "Skill",
                            isDark
                          );

                          return (
                            <div
                              key={`${src}-${tgt}-${idx}`}
                              className="group flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 p-2 text-[11px] transition hover:bg-slate-100 hover:border-slate-300 dark:border-neutral-800/80 dark:bg-neutral-900/50 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (neighborNode) {
                                    openNode(neighborNode);
                                    canvasRef.current?.focusNode(neighborNode.id);
                                  }
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: neighborVis.color }}
                                />
                                <div className="min-w-0 flex-1 truncate">
                                  <p className="truncate font-medium text-slate-900 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-cyan-400 transition">
                                    {neighborNode?.name || neighborId}
                                  </p>
                                  <p className="text-[9px] font-mono text-slate-500">
                                    {isOutgoing ? "→" : "←"} {link.label}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteRelationship(src, tgt, link.label)
                                }
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition"
                                title="Delete relationship"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions - Fixed at bottom */}
                <div className="shrink-0 p-3 border-t border-slate-200 dark:border-neutral-800/80 space-y-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-slate-300 dark:hover:text-white"
                    onClick={() => canvasRef.current?.focusNode(selected.id)}
                  >
                    Center on Canvas
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs h-7.5"
                    onClick={() => handleDeleteNode(selected)}
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" /> Delete Entity
                  </Button>
                </div>
              </div>
            ) : (
              /* Graph Intelligence Overview when no node is selected */
              <div className="flex h-full min-h-0 flex-1 flex-col p-4 text-xs">
                {/* Header */}
                <div className="shrink-0 pb-3 border-b border-slate-200 dark:border-neutral-800/80">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-900 dark:text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      Twin Intelligence
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time GraphRAG neural constellation
                  </p>
                </div>

                {/* Metrics */}
                <div className="shrink-0 grid grid-cols-2 gap-2 my-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
                    <p className="text-[10px] text-slate-500 uppercase font-medium">
                      Entities
                    </p>
                    <p className="text-base font-bold font-mono text-slate-900 dark:text-cyan-400 mt-0.5">
                      {data?.nodes.length || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
                    <p className="text-[10px] text-slate-500 uppercase font-medium">
                      Edges
                    </p>
                    <p className="text-base font-bold font-mono text-slate-900 dark:text-teal-400 mt-0.5">
                      {data?.links.length || 0}
                    </p>
                  </div>
                </div>

                {/* Central Hubs List - Independently scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 scrollbar-thin">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Key Central Hubs
                  </p>
                  <div className="space-y-1">
                    {(data?.nodes || [])
                      .filter((n) => (nodeDegrees[n.id] || 0) >= 6)
                      .slice(0, 8)
                      .map((hub) => (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => {
                            openNode(hub);
                            canvasRef.current?.focusNode(hub.id);
                          }}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-1.5 text-left transition hover:border-slate-300 hover:bg-slate-100 dark:border-neutral-800/60 dark:bg-neutral-900/40 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                        >
                          <span className="font-medium text-slate-900 dark:text-white truncate text-[11px]">
                            {hub.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-600 dark:text-cyan-400 shrink-0">
                            {nodeDegrees[hub.id] || 0} links
                          </span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Action - Fixed at bottom */}
                <div className="shrink-0 pt-3 border-t border-slate-200 dark:border-neutral-800/80">
                  <Button
                    size="sm"
                    className="w-full text-xs h-8 bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 font-semibold shadow-xs"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Entity
                  </Button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* =========================================================================
          CREATE ENTITY MODAL DIALOG
          ========================================================================= */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Knowledge Entity"
        description="Insert a verified node into your digital twin knowledge graph."
      >
        <div className="space-y-4 py-2">
          <div>
            <Label>Entity Category</Label>
            <Select
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="mt-1"
            >
              {NODE_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Entity Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. PyTorch, Distributed Systems, HackMAIT"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description / Note (optional)</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Core machine learning framework used for twin inference"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || creating}
              onClick={handleCreateNode}
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 font-semibold"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                "Add to Graph"
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* =========================================================================
          CONNECT RELATIONSHIP MODAL DIALOG
          ========================================================================= */}
      {selected && (
        <Dialog
          open={connectOpen}
          onOpenChange={setConnectOpen}
          title={`Connect "${selected.name}"`}
          description="Establish an explicit directional knowledge edge in your personal graph."
        >
          <div className="space-y-4 py-2">
            <div>
              <Label>Target Entity</Label>
              <Select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1"
              >
                <option value="">Select target node...</option>
                {(data?.nodes || [])
                  .filter((n) => n.id !== selected.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.label})
                    </option>
                  ))}
              </Select>
            </div>

            <div>
              <Label>Relationship Label</Label>
              <Select
                value={relLabel}
                onChange={(e) => setRelLabel(e.target.value)}
                className="mt-1"
              >
                <option value="RELATED_TO">RELATED_TO</option>
                <option value="UTILIZES">UTILIZES</option>
                <option value="HAS_SKILL">HAS_SKILL</option>
                <option value="PURSUES_GOAL">PURSUES_GOAL</option>
                <option value="CONTRIBUTES_TO">CONTRIBUTES_TO</option>
                <option value="DEPENDS_ON">DEPENDS_ON</option>
                <option value="HAS_PREFERENCE">HAS_PREFERENCE</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConnectOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!targetId || connecting}
                onClick={handleAddRelationship}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 font-semibold"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
                  </>
                ) : (
                  "Create Edge"
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
