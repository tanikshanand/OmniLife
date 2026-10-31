"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { getEntityVisual } from "@/components/graph/graph-palette";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { GraphLink, GraphNode, GraphNodeDetails } from "@/types";
import { cn } from "@/lib/utils";

function endpointId(value: GraphLink["source"]): string {
  return typeof value === "string" ? value : (value as { id: string }).id;
}

export function EntityDetailsPanel({
  selected,
  details,
  loading,
  allNodes = [],
  onClose,
  onSelectNode,
  onDeleteNode,
  onDeleteRelationship,
  onAddRelationship,
}: {
  selected: GraphNode | null;
  details: GraphNodeDetails | null;
  loading: boolean;
  allNodes?: GraphNode[];
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onDeleteNode: (node: GraphNode) => void;
  onDeleteRelationship: (sourceId: string, targetId: string, label: string) => Promise<void>;
  onAddRelationship: (sourceId: string, targetId: string, label: string) => Promise<void>;
}) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [relLabel, setRelLabel] = useState("RELATED_TO");
  const [connecting, setConnecting] = useState(false);
  const [deletingRelKey, setDeletingRelKey] = useState<string | null>(null);

  if (!selected) return null;

  const visual = getEntityVisual(selected.label);
  const properties = (details?.node?.properties || selected.properties || {}) as Record<
    string,
    any
  >;

  // Filter out internal system keys from attributes display
  const ignoredKeys = new Set([
    "id",
    "name",
    "label",
    "normalized_name",
    "description",
    "title",
    "user_id",
  ]);

  const attributes = Object.entries(properties).filter(
    ([k, v]) => !ignoredKeys.has(k) && v != null && v !== ""
  );

  const createdAt = (properties.created_at || (details?.node?.properties as any)?.created_at) as string | undefined;
  const updatedAt = (properties.updated_at || (details?.node?.properties as any)?.updated_at) as string | undefined;

  const description =
    properties.description ||
    (selected.label === "User"
      ? "Your primary digital twin knowledge identity."
      : selected.label === "Skill"
      ? `Skill entity categorized under ${properties.category || "General"} with ${properties.proficiency || "Intermediate"} proficiency.`
      : selected.label === "Project"
      ? `Project tracking active development and shipped deliverables.`
      : selected.label === "Goal"
      ? `Active roadmap target (${properties.status || "ACTIVE"}).`
      : null);

  const connections = useMemo(() => {
    if (!details || !selected) return [];
    return (details.links || []).map((link) => {
      const sourceId = endpointId(link.source);
      const targetId = endpointId(link.target);
      const outgoing = sourceId === selected.id;
      const relatedId = outgoing ? targetId : sourceId;
      const related = details.neighbors?.find((n) => n.id === relatedId) || {
        id: relatedId,
        name: relatedId,
        label: "Entity",
        val: 8,
        color: "#94a3b8",
        properties: {},
      };
      return {
        source_id: sourceId,
        target_id: targetId,
        label: link.label,
        target: related,
        outgoing,
      };
    });
  }, [details, selected]);

  async function handleAddRel() {
    if (!targetId || !selected) return;
    setConnecting(true);
    try {
      await onAddRelationship(selected.id, targetId, relLabel);
      setConnectOpen(false);
      setTargetId("");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDeleteRel(sourceId: string, targetId: string, label: string) {
    const key = `${sourceId}-${targetId}-${label}`;
    setDeletingRelKey(key);
    try {
      await onDeleteRelationship(sourceId, targetId, label);
    } finally {
      setDeletingRelKey(null);
    }
  }

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm sm:max-w-md flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-neutral-800/90 dark:bg-[#070a0f]/95 transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: visual.color }}
            />
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                visual.badgeBg,
                visual.badgeText,
                visual.badgeBorder
              )}
            >
              {visual.category} · {selected.label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition"
              aria-label="Close entity panel"
              title="Close panel (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 scrollbar-thin">
          {/* Entity Name & Primary Details */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {selected.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-neutral-400 break-all">
              ID: {selected.id}
            </p>

            {description && (
              <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-900/60 p-3 rounded-xl border border-slate-200 dark:border-neutral-800/80">
                {description}
              </p>
            )}
          </div>

          {/* Timestamps & Quick Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/40">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <Layers className="h-3 w-3" /> Connections
              </span>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {loading ? "..." : connections.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/40">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <Tag className="h-3 w-3" /> Entity Type
              </span>
              <p className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-white">
                {selected.label}
              </p>
            </div>
          </div>

          {/* Timestamps if available */}
          {(createdAt || updatedAt) && (
            <div className="flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-slate-50/40 px-3 py-2 text-[11px] dark:border-neutral-800/60 dark:bg-neutral-900/20">
              {createdAt && (
                <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Created
                  </span>
                  <span className="font-mono text-slate-700 dark:text-neutral-300">
                    {new Date(createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {updatedAt && (
                <div className="flex items-center justify-between text-slate-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Updated
                  </span>
                  <span className="font-mono text-slate-700 dark:text-neutral-300">
                    {new Date(updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Custom Stored Attributes */}
          {attributes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Properties & Metadata
              </h3>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/30 text-xs dark:divide-neutral-800/60 dark:border-neutral-800 dark:bg-neutral-900/30">
                {attributes.map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-400">
                      {key}
                    </span>
                    <span className="max-w-[60%] truncate font-medium text-slate-800 dark:text-neutral-200">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Entities Section */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Connected Entities ({connections.length})
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[11px] border-slate-200 dark:border-neutral-800"
                onClick={() => setConnectOpen(true)}
              >
                <Plus className="h-3 w-3" /> Connect
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : connections.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
                No active connections linked to this entity.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {connections.map((c, i) => {
                  const targetNode = c.target;
                  const targetVisual = getEntityVisual(targetNode.label);
                  const isOutgoing = c.source_id === selected.id;
                  const relKey = `${c.source_id}-${c.target_id}-${c.label}`;
                  const isDeleting = deletingRelKey === relKey;

                  return (
                    <div
                      key={`${c.source_id}-${c.target_id}-${c.label}-${i}`}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs transition hover:border-slate-300 dark:border-neutral-800/80 dark:bg-neutral-900/40 dark:hover:border-neutral-700"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectNode(targetNode)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: targetVisual.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-cyan-400">
                            {targetNode.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-neutral-400">
                            <span>{isOutgoing ? "→" : "←"}</span>
                            <span className="font-mono">{c.label}</span>
                            <span>·</span>
                            <span>{targetNode.label}</span>
                          </div>
                        </div>
                      </button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                        disabled={isDeleting}
                        onClick={() =>
                          handleDeleteRel(c.source_id, c.target_id, c.label)
                        }
                        title="Delete relationship"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-4 dark:border-neutral-800">
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => onDeleteNode(selected)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Entity from Graph
          </Button>
        </div>
      </aside>

      {/* Connect Relationship Modal */}
      <Dialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        title={`Connect "${selected.name}" to another entity`}
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
              {allNodes
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
            <Button disabled={!targetId || connecting} onClick={handleAddRel}>
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
                </>
              ) : (
                "Create Link"
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
