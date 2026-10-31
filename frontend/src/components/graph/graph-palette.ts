import type { GraphNode } from "@/types";

export interface DomainCluster {
  id: string;
  name: string;
  badge: string;
  subtitle: string;
  anchor: { x: number; y: number };
  color: string;
  glow: string;
  radius: number;
  rotation: number;
}

export const DOMAIN_CLUSTERS: Record<string, DomainCluster> = {
  ai_ml: {
    id: "ai_ml",
    name: "AI & ML PLATFORM",
    badge: "Neural Systems",
    subtitle: "Technique: PyTorch, LLMs & Local Inference",
    anchor: { x: 680, y: -380 },
    color: "#00e5ff", // Bright Cyan
    glow: "rgba(0, 229, 255, 0.45)",
    radius: 250,
    rotation: -0.22,
  },
  systems: {
    id: "systems",
    name: "LANGUAGES & SYSTEMS",
    badge: "Compilers & Runtimes",
    subtitle: "Technique: Rust, Python, C++ & Memory Safety",
    anchor: { x: -700, y: -400 },
    color: "#38bdf8", // Sky Blue
    glow: "rgba(56, 189, 248, 0.45)",
    radius: 240,
    rotation: 0.32,
  },
  cloud_data: {
    id: "cloud_data",
    name: "CLOUD & GRAPH STORAGE",
    badge: "Data Infrastructure",
    subtitle: "Technique: Neo4j, PostgreSQL & Microservices",
    anchor: { x: -760, y: 180 },
    color: "#818cf8", // Indigo
    glow: "rgba(129, 140, 248, 0.45)",
    radius: 240,
    rotation: -0.15,
  },
  web_stack: {
    id: "web_stack",
    name: "MODERN FULL-STACK",
    badge: "Product & UI",
    subtitle: "Technique: Next.js, React & Canvas Engine",
    anchor: { x: -80, y: 480 },
    color: "#00e676", // Bright Emerald / Teal
    glow: "rgba(0, 230, 118, 0.45)",
    radius: 230,
    rotation: 0.08,
  },
  robotics: {
    id: "robotics",
    name: "ROBOTICS & HARDWARE",
    badge: "Autonomous Edge",
    subtitle: "Technique: ROS, Edge AI & HackMAIT",
    anchor: { x: 740, y: 220 },
    color: "#ff4081", // Vibrant Magenta / Rose
    glow: "rgba(255, 64, 129, 0.45)",
    radius: 240,
    rotation: 0.38,
  },
  vision_goals: {
    id: "vision_goals",
    name: "COGNITIVE TWIN & VISION",
    badge: "Core Identity",
    subtitle: "Technique: GraphRAG, Career Roadmap & Goals",
    anchor: { x: 40, y: -30 },
    color: "#ffb300", // Warm Amber / Gold
    glow: "rgba(255, 179, 0, 0.45)",
    radius: 220,
    rotation: -0.1,
  },
};

export const DOMAIN_CLUSTER_LIST: DomainCluster[] = Object.values(DOMAIN_CLUSTERS);

export function getNodeCluster(node: GraphNode | { id?: string; name?: string; label?: string }): DomainCluster {
  const name = (node.name || "").toLowerCase();
  const label = (node.label || "").toLowerCase();

  // Robotics & Edge
  if (
    name.includes("robotics") ||
    name.includes("ros") ||
    name.includes("drone") ||
    name.includes("hardware") ||
    name.includes("firmware")
  ) {
    return DOMAIN_CLUSTERS.robotics;
  }

  // AI & Machine Learning
  if (
    name.includes("pytorch") ||
    name.includes("transformer") ||
    name.includes("llm") ||
    name.includes("nlp") ||
    name.includes("triton") ||
    name.includes("machine learning") ||
    name.includes("rag") ||
    name.includes("tensorflow") ||
    name.includes("chromadb") ||
    name.includes("vector")
  ) {
    return DOMAIN_CLUSTERS.ai_ml;
  }

  // Cloud, Distributed & Databases
  if (
    name.includes("fastapi") ||
    name.includes("flask") ||
    name.includes("docker") ||
    name.includes("kubernetes") ||
    name.includes("microservice") ||
    name.includes("distributed") ||
    name.includes("api design") ||
    name.includes("postgresql") ||
    name.includes("neo4j") ||
    name.includes("database") ||
    (name.includes("sql") && !name.includes("nosql") && !name.includes("postgre"))
  ) {
    return DOMAIN_CLUSTERS.cloud_data;
  }

  // Web & Full-Stack
  if (
    name.includes("react") ||
    name.includes("next") ||
    name.includes("node.js") ||
    name.includes("full-stack") ||
    name.includes("responsive") ||
    name.includes("ui")
  ) {
    return DOMAIN_CLUSTERS.web_stack;
  }

  // Languages & Systems
  if (
    name.includes("python") ||
    name.includes("rust") ||
    name.includes("c++") ||
    (name.includes("java") && !name.includes("script")) ||
    name.includes("typescript") ||
    name.includes("javascript") ||
    name.includes("compiler") ||
    name.includes("statically typed")
  ) {
    return DOMAIN_CLUSTERS.systems;
  }

  // Core Persona, Goals & Research
  if (
    label === "user" ||
    label === "goal" ||
    name.includes("taniksh") ||
    name.includes("omnilife") ||
    name.includes("graphrag") ||
    name.includes("utility") ||
    name.includes("career") ||
    name.includes("research") ||
    name.includes("communication") ||
    name.includes("action engine")
  ) {
    return DOMAIN_CLUSTERS.vision_goals;
  }

  // Secondary Fallback based on label
  if (label === "skill") return DOMAIN_CLUSTERS.systems;
  if (label === "project") return DOMAIN_CLUSTERS.web_stack;
  if (label === "fact" || label === "preference") return DOMAIN_CLUSTERS.vision_goals;

  return DOMAIN_CLUSTERS.vision_goals;
}

export interface EntityVisualConfig {
  category: string;
  color: string;
  glow: string;
  fill: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function hexToRgb(hex: string): string {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) {
    c = c.split("").map((ch) => ch + ch).join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return "0, 240, 255";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export const ENTITY_PALETTE_DARK: Record<string, EntityVisualConfig> = {
  Skill: {
    category: "Concepts",
    color: "#00f0ff", // Electric Cyan
    glow: "rgba(0, 240, 255, 0.6)",
    fill: "rgba(0, 240, 255, 0.22)",
    border: "#00e5ff",
    badgeBg: "bg-cyan-950/80",
    badgeText: "text-cyan-300",
    badgeBorder: "border-cyan-500/40",
  },
  Topic: {
    category: "Concepts",
    color: "#22d3ee", // Aqua / Cyan
    glow: "rgba(34, 211, 238, 0.55)",
    fill: "rgba(34, 211, 238, 0.2)",
    border: "#06b6d4",
    badgeBg: "bg-cyan-950/70",
    badgeText: "text-cyan-400",
    badgeBorder: "border-cyan-700/60",
  },
  User: {
    category: "People",
    color: "#ffffff", // Pure Radiant White Nucleus
    glow: "rgba(255, 255, 255, 0.85)",
    fill: "rgba(255, 255, 255, 0.35)",
    border: "#38bdf8",
    badgeBg: "bg-slate-900",
    badgeText: "text-white",
    badgeBorder: "border-cyan-400/50",
  },
  Person: {
    category: "People",
    color: "#38bdf8", // Sky Blue
    glow: "rgba(56, 189, 248, 0.55)",
    fill: "rgba(56, 189, 248, 0.2)",
    border: "#0284c7",
    badgeBg: "bg-sky-950/70",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-800/60",
  },
  Goal: {
    category: "Processes",
    color: "#f59e0b", // Warm Amber
    glow: "rgba(245, 158, 11, 0.55)",
    fill: "rgba(245, 158, 11, 0.2)",
    border: "#d97706",
    badgeBg: "bg-amber-950/70",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-800/60",
  },
  Milestone: {
    category: "Processes",
    color: "#ffd54f",
    glow: "rgba(255, 213, 79, 0.5)",
    fill: "rgba(255, 213, 79, 0.2)",
    border: "#ffb300",
    badgeBg: "bg-amber-950/60",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-800/60",
  },
  Project: {
    category: "Tools & Projects",
    color: "#10b981", // Emerald Teal
    glow: "rgba(16, 185, 129, 0.55)",
    fill: "rgba(16, 185, 129, 0.2)",
    border: "#059669",
    badgeBg: "bg-emerald-950/70",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-800/60",
  },
  Fact: {
    category: "Knowledge",
    color: "#a855f7",
    glow: "rgba(168, 85, 247, 0.5)",
    fill: "rgba(168, 85, 247, 0.2)",
    border: "#9333ea",
    badgeBg: "bg-purple-950/70",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-800/60",
  },
  Preference: {
    category: "Knowledge",
    color: "#ec4899",
    glow: "rgba(236, 72, 153, 0.5)",
    fill: "rgba(236, 72, 153, 0.2)",
    border: "#db2777",
    badgeBg: "bg-pink-950/70",
    badgeText: "text-pink-300",
    badgeBorder: "border-pink-800/60",
  },
  Institution: {
    category: "Organizations",
    color: "#64748b",
    glow: "rgba(100, 116, 139, 0.4)",
    fill: "rgba(100, 116, 139, 0.16)",
    border: "#475569",
    badgeBg: "bg-slate-900",
    badgeText: "text-slate-300",
    badgeBorder: "border-slate-800",
  },
};

export const ENTITY_PALETTE_LIGHT: Record<string, EntityVisualConfig> = {
  Skill: {
    category: "Concepts",
    color: "#0284c7", // Sky 600 - High-contrast readable on light background
    glow: "rgba(2, 132, 199, 0.4)",
    fill: "rgba(2, 132, 199, 0.12)",
    border: "#0369a1",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
    badgeBorder: "border-sky-200",
  },
  Topic: {
    category: "Concepts",
    color: "#0891b2", // Cyan 600
    glow: "rgba(8, 145, 178, 0.4)",
    fill: "rgba(8, 145, 178, 0.12)",
    border: "#0e7490",
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-700",
    badgeBorder: "border-cyan-200",
  },
  User: {
    category: "People",
    color: "#0f172a", // Slate 900 - Dark prominent nucleus on light
    glow: "rgba(15, 23, 42, 0.45)",
    fill: "rgba(15, 23, 42, 0.15)",
    border: "#0284c7",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-900",
    badgeBorder: "border-slate-300",
  },
  Person: {
    category: "People",
    color: "#2563eb", // Blue 600
    glow: "rgba(37, 99, 235, 0.4)",
    fill: "rgba(37, 99, 235, 0.12)",
    border: "#1d4ed8",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
  },
  Goal: {
    category: "Processes",
    color: "#d97706", // Amber 600 - High contrast on light
    glow: "rgba(217, 119, 6, 0.45)",
    fill: "rgba(217, 119, 6, 0.15)",
    border: "#b45309",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
  },
  Milestone: {
    category: "Processes",
    color: "#b45309",
    glow: "rgba(180, 83, 9, 0.4)",
    fill: "rgba(180, 83, 9, 0.12)",
    border: "#92400e",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
  },
  Project: {
    category: "Tools & Projects",
    color: "#059669", // Emerald 600 - Crisp on light
    glow: "rgba(5, 150, 105, 0.45)",
    fill: "rgba(5, 150, 105, 0.15)",
    border: "#047857",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
  },
  Fact: {
    category: "Knowledge",
    color: "#7c3aed", // Violet 600
    glow: "rgba(124, 58, 237, 0.4)",
    fill: "rgba(124, 58, 237, 0.12)",
    border: "#6d28d9",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
  },
  Preference: {
    category: "Knowledge",
    color: "#db2777", // Pink 600
    glow: "rgba(219, 39, 119, 0.4)",
    fill: "rgba(219, 39, 119, 0.12)",
    border: "#be185d",
    badgeBg: "bg-pink-50",
    badgeText: "text-pink-700",
    badgeBorder: "border-pink-200",
  },
  Institution: {
    category: "Organizations",
    color: "#475569", // Slate 600
    glow: "rgba(71, 85, 105, 0.3)",
    fill: "rgba(71, 85, 105, 0.12)",
    border: "#334155",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
    badgeBorder: "border-slate-300",
  },
};

// Default export for backward compatibility
export const ENTITY_PALETTE: Record<string, EntityVisualConfig> = ENTITY_PALETTE_DARK;

export const DEFAULT_VISUAL_CONFIG_DARK: EntityVisualConfig = {
  category: "General",
  color: "#94a3b8",
  glow: "rgba(148, 163, 184, 0.3)",
  fill: "rgba(148, 163, 184, 0.12)",
  border: "#64748b",
  badgeBg: "bg-slate-900/80",
  badgeText: "text-slate-300",
  badgeBorder: "border-slate-800",
};

export const DEFAULT_VISUAL_CONFIG_LIGHT: EntityVisualConfig = {
  category: "General",
  color: "#64748b",
  glow: "rgba(100, 116, 139, 0.3)",
  fill: "rgba(100, 116, 139, 0.12)",
  border: "#94a3b8",
  badgeBg: "bg-slate-100",
  badgeText: "text-slate-700",
  badgeBorder: "border-slate-300",
};

export const DEFAULT_VISUAL_CONFIG: EntityVisualConfig = DEFAULT_VISUAL_CONFIG_DARK;

export function getEntityVisual(label: string, isDark: boolean = true): EntityVisualConfig {
  const palette = isDark ? ENTITY_PALETTE_DARK : ENTITY_PALETTE_LIGHT;
  const def = isDark ? DEFAULT_VISUAL_CONFIG_DARK : DEFAULT_VISUAL_CONFIG_LIGHT;
  return palette[label] || def;
}

export interface CategoryGroup {
  name: string;
  labelFilter: string[];
  color?: string;
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { name: "All", labelFilter: [] },
  { name: "Skills", labelFilter: ["Skill"], color: "#00e5ff" },
  { name: "Projects", labelFilter: ["Project"], color: "#10b981" },
  { name: "Goals", labelFilter: ["Goal", "Milestone"], color: "#f59e0b" },
  { name: "People", labelFilter: ["User", "Person"], color: "#38bdf8" },
  { name: "Facts", labelFilter: ["Fact", "Preference"], color: "#a855f7" },
];
