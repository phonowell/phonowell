import React, { startTransition, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `request failed: ${response.status}`);
  }
  return payload;
}

function formatDateTime(value) {
  if (!value) {
    return "未记录";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function summarizeDiffKey(key) {
  if (key === "wish") {
    return "愿景";
  }
  if (key === "goal") {
    return "目标";
  }
  if (key.startsWith("dod:")) {
    return `完成定义: ${key.slice(4)}`;
  }
  if (key.startsWith("constraint:")) {
    return `约束: ${key.slice("constraint:".length)}`;
  }
  if (key.startsWith("domain:")) {
    return `Domain: ${key.slice(7)}`;
  }
  if (key.startsWith("inbox:")) {
    return `待归档资产: ${key.slice(6)}`;
  }
  return key;
}

function summarizePolicyScope(scopeHint) {
  if (scopeHint === "visual") {
    return "视觉资产";
  }
  if (scopeHint === "text") {
    return "文本资产";
  }
  if (scopeHint === "assets") {
    return "全体资产";
  }
  return "整个工作区";
}

function parseTextBlocks(value) {
  return value
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortByUpdatedAtDesc(items) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightValue = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightValue - leftValue;
  });
}

const DOMAIN_NODE_SIZE = { width: 272, height: 212 };
const CLUSTER_NODE_SIZE = { width: 272, height: 188 };

function layoutGraph({ nodes, edges, direction = "LR", nodeSize = DOMAIN_NODE_SIZE, ranksep = 180, nodesep = 120 }) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: nodeSize.width,
      height: nodeSize.height,
    });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);
    if (!positioned) {
      return node;
    }
    return {
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: positioned.x - nodeSize.width / 2,
        y: positioned.y - nodeSize.height / 2,
      },
    };
  });
}

function normalizeClusterKey(drop) {
  return drop.clusterId || `cluster-${(drop.clusterLabel || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeClusterLabel(drop) {
  return drop.clusterLabel || "General";
}

function groupDropsByCluster(drops) {
  const map = new Map();
  for (const drop of drops) {
    const key = normalizeClusterKey(drop);
    if (!map.has(key)) {
      map.set(key, {
        clusterId: key,
        label: normalizeClusterLabel(drop),
        drops: [],
      });
    }
    map.get(key).drops.push(drop);
  }
  return [...map.values()].sort((left, right) => right.drops.length - left.drops.length);
}

function buildClusterEdges(domainDrops, relations) {
  const dropById = new Map(domainDrops.map((drop) => [drop.dropId, drop]));
  const edgeMap = new Map();

  for (const relation of relations) {
    const fromDrop = dropById.get(relation.fromDropId);
    const toDrop = dropById.get(relation.toDropId);
    if (!fromDrop || !toDrop) {
      continue;
    }
    const fromClusterId = normalizeClusterKey(fromDrop);
    const toClusterId = normalizeClusterKey(toDrop);
    if (fromClusterId === toClusterId) {
      continue;
    }
    const key = `${fromClusterId}|${toClusterId}`;
    const current = edgeMap.get(key);
    edgeMap.set(key, {
      id: key,
      source: fromClusterId,
      target: toClusterId,
      count: (current?.count || 0) + 1,
    });
  }

  return [...edgeMap.values()];
}

async function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(`failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function buildFilePayload(file) {
  if (file.type.startsWith("image/")) {
    return {
      type: "image",
      title: file.name,
      summary: `Image asset · ${file.name}`,
      content: await readDataUrl(file),
    };
  }

  let content = "";
  try {
    content = await file.text();
  } catch {
    content = "";
  }

  const trimmed = content.trim();
  return {
    type: "doc",
    title: file.name,
    summary: trimmed.slice(0, 280) || `[binary file] ${file.name} (${file.type || "unknown"}, ${file.size} bytes)`,
    content: trimmed || `[binary file] ${file.name} (${file.type || "unknown"}, ${file.size} bytes)`,
  };
}

function DomainNodeCard({ data }) {
  return (
    <div className={`graph-node domain-node kind-${data.domain.kind} ${data.selected ? "selected" : ""} nopan nowheel ${data.clickable ? "clickable" : ""}`}>
      <Handle className="graph-handle" type="target" position={Position.Left} />
      <div className="graph-node-topline">
        <span className="node-chip">{data.domain.kind}</span>
        <span className={`node-chip tone-${data.domain.status}`}>{data.domain.status}</span>
      </div>
      <div className="graph-node-title">{data.domain.name}</div>
      <div className="graph-node-summary">{data.domain.summary}</div>
      <div className="graph-node-meta">
        <span>{data.assetCount} assets</span>
        <span>{data.relationCount} links</span>
      </div>
      <div className="node-cta-hint">
        {data.domain.kind === "workspace" ? "点击卡片进入二级视图" : "点击卡片查看"}
      </div>
      <Handle className="graph-handle" type="source" position={Position.Right} />
    </div>
  );
}

function ClusterNodeCard({ data }) {
  return (
    <div className={`graph-node cluster-node ${data.selected ? "selected" : ""} nopan nowheel clickable`}>
      <Handle className="graph-handle" type="target" position={Position.Left} />
      <div className="graph-node-topline">
        <span className="node-chip">cluster</span>
        <span className="node-chip">{data.dropCount} assets</span>
      </div>
      <div className="graph-node-title">{data.label}</div>
      <div className="graph-node-summary">{data.summary}</div>
      <div className="node-cta-hint">点击卡片查看资产</div>
      <Handle className="graph-handle" type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  domain: DomainNodeCard,
  cluster: ClusterNodeCard,
};

function findDomainById(domainNodes, domainId) {
  return domainNodes.find((node) => node.domainId === domainId) || null;
}

function App() {
  const [state, setState] = useState(null);
  const [observability, setObservability] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [busyLabel, setBusyLabel] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showIntake, setShowIntake] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showGeneratePreview, setShowGeneratePreview] = useState(false);
  const [drawerMode, setDrawerMode] = useState("");
  const [viewOverride, setViewOverride] = useState("auto");
  const [focusDomainId, setFocusDomainId] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [intakeText, setIntakeText] = useState("");
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [draggingAdd, setDraggingAdd] = useState(false);
  const [composerInput, setComposerInput] = useState("");
  const [generationPreview, setGenerationPreview] = useState(null);
  const [domainNameDraft, setDomainNameDraft] = useState("");
  const [domainSummaryDraft, setDomainSummaryDraft] = useState("");
  const [domainFrozenDraft, setDomainFrozenDraft] = useState(false);
  const [assetDomainDraft, setAssetDomainDraft] = useState("");
  const [assetClusterDraft, setAssetClusterDraft] = useState("");
  const [assetSummaryDraft, setAssetSummaryDraft] = useState("");
  const [assetFrozenDraft, setAssetFrozenDraft] = useState(false);

  function openDomainFocus(domainId) {
    const domain = findDomainById(domainNodes, domainId);
    if (!domain) {
      return;
    }
    setFocusDomainId(domainId);
    setSelectedAssetId("");
    setSelectedClusterId("");
  }

  function openCluster(clusterId) {
    setSelectedClusterId(clusterId);
    setSelectedAssetId("");
  }

  async function refresh(dropId = selectedAssetId) {
    const [statePayload, observabilityPayload, conversationPayload] = await Promise.all([
      api("/api/state"),
      api("/api/observability"),
      api(`/api/conversations${dropId ? `?dropId=${dropId}` : ""}`),
    ]);

    startTransition(() => {
      setState(statePayload);
      setObservability(observabilityPayload);
      setConversations(conversationPayload.messages || []);
    });
  }

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 12000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }
    void refresh(selectedAssetId);
  }, [selectedAssetId]);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        const target = event.target;
        if (target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
          return;
        }
        event.preventDefault();
        setShowComposer(true);
      }
      if (event.key === "Escape") {
        setShowComposer(false);
        setShowIntake(false);
        setShowGeneratePreview(false);
        setDrawerMode("");
        if (focusDomainId) {
          setSelectedAssetId("");
        }
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [focusDomainId]);

  const domainNodes = state?.domainNodes || [];
  const drops = (state?.drops || []).filter((drop) => drop.lifecycleState !== "archived");
  const userDrops = sortByUpdatedAtDesc(drops.filter((drop) =>
    drop.source === "user" && drop.type !== "goal-origin",
  ));
  const domainEdges = state?.domainEdges || [];
  const relations = state?.relations || [];
  const timeline = observability?.activityTimeline || state?.activityTimeline || [];
  const workspacePolicies = observability?.workspacePolicies || [];
  const workspaceView = observability?.workspaceView || {
    suggestedMode: "quick-task",
    reasons: ["当前还是简单任务，先用轻量视图承载。"],
    metrics: {
      userAssetCount: userDrops.length,
      workspaceDomainCount: 0,
      domainEdgeCount: 0,
      structuralCorrectionCount: 0,
      hasStructuralGenerationDiff: false,
    },
  };
  const displayMode = viewOverride === "auto" ? workspaceView.suggestedMode : viewOverride;
  const latestArtifact = state?.candidates?.[0] || null;
  const latestGeneration = state?.generationHistory?.[0] || observability?.latestGenerationRun || null;
  const latestDryRun = state?.well?.dryRunReport || observability?.latestDryRun || null;
  const inboxDomain = domainNodes.find((node) => node.kind === "inbox") || null;
  const focusDomain = domainNodes.find((node) => node.domainId === focusDomainId) || null;
  const domainDrops = focusDomain
    ? drops.filter((drop) => drop.domainId === focusDomain.domainId)
    : [];
  const clusters = useMemo(() => groupDropsByCluster(domainDrops), [domainDrops]);

  useEffect(() => {
    if (displayMode === "quick-task" && focusDomainId) {
      setFocusDomainId("");
    }
  }, [displayMode, focusDomainId]);

  useEffect(() => {
    if (!focusDomain) {
      setSelectedClusterId("");
      return;
    }
    if (!clusters.some((cluster) => cluster.clusterId === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.clusterId || "");
    }
  }, [focusDomain?.domainId, clusters, selectedClusterId]);

  const selectedCluster = clusters.find((cluster) => cluster.clusterId === selectedClusterId) || null;
  const selectedClusterDrops = selectedCluster?.drops || [];
  const selectedAsset = focusDomain
    ? selectedClusterDrops.find((drop) => drop.dropId === selectedAssetId)
      || domainDrops.find((drop) => drop.dropId === selectedAssetId)
      || null
    : drops.find((drop) => drop.dropId === selectedAssetId) || null;
  const quickPrimaryAsset = selectedAsset || userDrops[0] || null;
  const quickRecentAssets = userDrops.slice(0, 6);
  const latestTimelineItem = timeline[0] || null;
  const policyByDropId = useMemo(
    () => new Map(workspacePolicies.map((policy) => [policy.sourceDropId, policy])),
    [workspacePolicies],
  );

  useEffect(() => {
    if (!selectedClusterDrops.length) {
      setSelectedAssetId("");
      return;
    }
    if (!selectedClusterDrops.some((drop) => drop.dropId === selectedAssetId)) {
      setSelectedAssetId(selectedClusterDrops[0]?.dropId || "");
    }
  }, [selectedClusterDrops, selectedAssetId]);

  useEffect(() => {
    setDomainNameDraft(focusDomain?.name || "");
    setDomainSummaryDraft(focusDomain?.summary || "");
    setDomainFrozenDraft(Boolean(focusDomain?.frozen));
  }, [focusDomain?.domainId, focusDomain?.name, focusDomain?.summary, focusDomain?.frozen]);

  useEffect(() => {
    setAssetDomainDraft(selectedAsset?.domainId || "");
    setAssetClusterDraft(selectedAsset?.clusterLabel || "");
    setAssetSummaryDraft(selectedAsset?.summary || "");
    setAssetFrozenDraft(Boolean(selectedAsset?.frozenPlacement));
  }, [selectedAsset?.dropId]);

  const globalGraph = useMemo(() => {
    const relationCounts = new Map();
    for (const edge of domainEdges) {
      relationCounts.set(edge.fromDomainId, (relationCounts.get(edge.fromDomainId) || 0) + 1);
      relationCounts.set(edge.toDomainId, (relationCounts.get(edge.toDomainId) || 0) + 1);
    }

    const nodes = domainNodes.map((domain) => ({
        id: domain.domainId,
        type: "domain",
        position: domain.position || { x: 0, y: 0 },
        data: {
          domain,
          selected: domain.domainId === focusDomainId,
          assetCount: domain.assetDropIds.length,
          relationCount: relationCounts.get(domain.domainId) || 0,
          onOpen: openDomainFocus,
          clickable: true,
        },
      }));
    const edges = domainEdges.map((edge) => ({
        id: edge.edgeId,
        source: edge.fromDomainId,
        target: edge.toDomainId,
        label: edge.summary,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: edge.kind === "causal",
        className: `edge-${edge.kind}`,
        style: edge.kind === "structure"
          ? { strokeWidth: 2.4 }
          : edge.kind === "causal"
            ? { strokeWidth: 2.1, strokeDasharray: "7 5" }
            : { strokeWidth: 1.8 },
      }));

    return {
      nodes: layoutGraph({
        nodes,
        edges,
        direction: "LR",
        nodeSize: DOMAIN_NODE_SIZE,
        ranksep: 220,
        nodesep: 150,
      }),
      edges,
    };
  }, [domainEdges, domainNodes, focusDomainId]);

  const focusGraph = useMemo(() => {
    if (!focusDomain) {
      return { nodes: [], edges: [] };
    }

    const clusterRelations = buildClusterEdges(domainDrops, relations);
    const nodes = clusters.map((cluster) => ({
        id: cluster.clusterId,
        type: "cluster",
        position: { x: 0, y: 0 },
        data: {
          clusterId: cluster.clusterId,
          label: cluster.label,
          summary: `${cluster.drops.length} 个资产，聚合在 ${focusDomain.name} 内部。`,
          dropCount: cluster.drops.length,
          selected: cluster.clusterId === selectedClusterId,
          onSelect: openCluster,
        },
      }));
    const edges = clusterRelations.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: `${edge.count}`,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        className: "edge-cluster",
        style: { strokeWidth: 1.7, strokeDasharray: "4 4" },
      }));

    return {
      nodes: layoutGraph({
        nodes,
        edges,
        direction: "LR",
        nodeSize: CLUSTER_NODE_SIZE,
        ranksep: 180,
        nodesep: 120,
      }),
      edges,
    };
  }, [clusters, domainDrops, focusDomain, relations, selectedClusterId]);

  async function runTask(label, work, options = {}) {
    setBusyLabel(label);
    setFeedback(null);
    try {
      await work();
      if (options.successText) {
        setFeedback({ kind: "success", text: options.successText });
      }
      if (options.openDrawer) {
        setDrawerMode(options.openDrawer);
      }
    } catch (error) {
      setFeedback({ kind: "error", text: String(error.message || error) });
    } finally {
      setBusyLabel("");
    }
  }

  async function uploadFiles(files) {
    await Promise.all(files.map(async (file) => {
      const payload = await buildFilePayload(file);
      await api("/api/drops", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }));
  }

  async function handleAddAssets() {
    const blocks = parseTextBlocks(intakeText);
    if (blocks.length === 0 && queuedFiles.length === 0) {
      setFeedback({ kind: "error", text: "先输入一点文本，或者加一个文件。" });
      return;
    }
    await runTask("正在加入资产...", async () => {
      await Promise.all(blocks.map((text) =>
        api("/api/drops", {
          method: "POST",
          body: JSON.stringify({ text }),
        })
      ));
      await uploadFiles(queuedFiles);
      setIntakeText("");
      setQueuedFiles([]);
      setShowIntake(false);
      await refresh();
    }, { successText: "资产已经进入待归档池。" });
  }

  async function handleDirectDrop(files) {
    await runTask("正在导入文件...", async () => {
      await uploadFiles(files);
      await refresh();
    }, { successText: "文件已直接加入资产池。" });
  }

  async function handleAction(path, label, options = {}) {
    await runTask(label, async () => {
      await api(path, {
        method: "POST",
        body: JSON.stringify(options.body || {}),
      });
      await refresh();
    }, {
      successText: options.successText,
      openDrawer: options.openDrawer,
    });
  }

  async function handleOpenGeneratePreview() {
    await runTask("正在准备生成预览...", async () => {
      const payload = await api("/api/generate/preview", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setGenerationPreview(payload.preview);
      setShowGeneratePreview(true);
      await refresh();
    });
  }

  async function handleConfirmGenerate() {
    await runTask("正在生成产物...", async () => {
      await api("/api/generate", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setShowGeneratePreview(false);
      setGenerationPreview(null);
      await refresh();
    }, {
      successText: "产物已生成，并对比了上次需求 diff。",
      openDrawer: "artifact",
    });
  }

  async function handleComposerSend() {
    const content = composerInput.trim();
    if (!content) {
      return;
    }

    await runTask("正在和 AI 交互...", async () => {
      await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          content,
          dropId: selectedAsset?.dropId,
          scope: selectedAsset ? "asset" : "global",
        }),
      });
      setComposerInput("");
      await refresh(selectedAsset?.dropId);
    }, { successText: "AI 已记录这条纠偏指令。", openDrawer: "activity" });
  }

  async function handleAssetSave() {
    if (!selectedAsset) {
      return;
    }

    await runTask("正在保存纠偏...", async () => {
      await api(`/api/drops/${selectedAsset.dropId}`, {
        method: "PUT",
        body: JSON.stringify({
          domainId: assetDomainDraft || undefined,
          clusterLabel: assetClusterDraft || undefined,
          frozenPlacement: assetFrozenDraft,
          summary: assetSummaryDraft,
          skipAutoFlow: true,
        }),
      });
      await refresh(selectedAsset.dropId);
    }, { successText: "资产纠偏已写回。" });
  }

  async function handleSendToInbox() {
    if (!selectedAsset || !inboxDomain) {
      return;
    }

    await runTask("正在送回待归档池...", async () => {
      await api(`/api/drops/${selectedAsset.dropId}`, {
        method: "PUT",
        body: JSON.stringify({
          domainId: inboxDomain.domainId,
          clusterId: "",
          clusterLabel: "",
          skipAutoFlow: true,
        }),
      });
      await refresh();
    }, { successText: "资产已送回待归档池。" });
  }

  async function handleDomainSave() {
    if (!focusDomain) {
      return;
    }

    await runTask("正在保存 domain...", async () => {
      await api(`/api/domains/${focusDomain.domainId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: domainNameDraft,
          summary: domainSummaryDraft,
          frozen: domainFrozenDraft,
        }),
      });
      await refresh(selectedAsset?.dropId);
    }, {
      successText: domainFrozenDraft ? "Domain 已冻结并写回。" : "Domain 更新已写回。",
      openDrawer: "activity",
    });
  }

  function openComposerForReconsider() {
    if (!selectedAsset) {
      return;
    }
    setComposerInput(`请重新判断资产「${selectedAsset.title}」应该归入哪个 domain / cluster；如果当前归类不对，请给出更合理的归属与原因。`);
    setShowComposer(true);
  }

  if (!state) {
    return <div className="booting">正在唤醒 phonowell...</div>;
  }

  const graph = focusDomain ? focusGraph : globalGraph;
  const workspaceDomainCount = domainNodes.filter((node) => node.kind === "workspace").length;
  const inboxCount = inboxDomain?.assetDropIds?.length || 0;
  const quickTaskLabel = viewOverride === "quick-task" && workspaceView.suggestedMode === "domain-map"
    ? "简化查看"
    : displayMode === "quick-task"
      ? "Quick Task"
      : "Domain Map";
  const toggleViewLabel = displayMode === "quick-task"
    ? "展开结构视图"
    : "简化查看";
  const viewReason = workspaceView.reasons[0] || "";

  return (
    <div className="app-shell">
      <div className="canvas-surface">
        {displayMode === "domain-map" ? (
          <ReactFlow
            key={focusDomain ? `focus-${focusDomain.domainId}` : "global-map"}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.24, duration: 300 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onPaneClick={() => setSelectedAssetId("")}
            onNodeClick={(_, node) => {
              if (focusDomain) {
                openCluster(node.id);
                return;
              }
              openDomainFocus(node.id);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={28} color="rgba(117, 134, 123, 0.16)" />
            <MiniMap
              className="minimap"
              pannable
              zoomable
              nodeStrokeWidth={3}
              nodeColor={(node) => node.type === "cluster" ? "#8fb299" : "#e9dfc4"}
            />
            <Controls className="flow-controls" showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="quick-stage">
            <section className="quick-card quick-core">
              <div className="panel-kicker">{quickTaskLabel}</div>
              <div className="quick-core-title">
                {state.well.wish || state.drops.find((drop) => drop.type === "goal-origin")?.summary || "开始这个任务"}
              </div>
              <div className="quick-core-body">
                {observability?.mainLoop?.summary || "继续加资产、发指令、看结果。结构会在需要时自动长出来。"}
              </div>
              <div className="status-strip">
                <span className="status-chip">assets {workspaceView.metrics.userAssetCount}</span>
                <span className="status-chip">{workspaceView.metrics.workspaceDomainCount} domains</span>
                {latestDryRun ? <span className={`status-chip tone-${latestDryRun.gateResult}`}>preflight {latestDryRun.gateResult}</span> : null}
              </div>
            </section>

            <section className="quick-card quick-primary">
              <div className="panel-kicker">主资产</div>
              {quickPrimaryAsset ? (
                <>
                  <div className="quick-card-title">{quickPrimaryAsset.title}</div>
                  {quickPrimaryAsset.type === "image" && typeof quickPrimaryAsset.content === "string" && quickPrimaryAsset.content.startsWith("data:") ? (
                    <img className="quick-image" src={quickPrimaryAsset.content} alt={quickPrimaryAsset.title} />
                  ) : null}
                  <div className="quick-card-body">{quickPrimaryAsset.summary || quickPrimaryAsset.content || "暂无摘要"}</div>
                  <div className="panel-actions">
                    <button className="ghost-button" type="button" onClick={() => setSelectedAssetId(quickPrimaryAsset.dropId)}>
                      选中它
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setShowComposer(true)}>
                      直接喊 AI
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-box">先加一点资产进来，Quick Task 才会浮出任务核心。</div>
              )}
            </section>

            <section className="quick-card quick-assets">
              <div className="panel-kicker">最近资产</div>
              <div className="quick-asset-list">
                {quickRecentAssets.length ? quickRecentAssets.map((drop) => (
                  <button
                    key={drop.dropId}
                    className={`quick-asset-chip ${selectedAssetId === drop.dropId ? "selected" : ""}`}
                    type="button"
                    onClick={() => setSelectedAssetId(drop.dropId)}
                  >
                    <span>{drop.title}</span>
                    <span>{drop.type}</span>
                  </button>
                )) : <div className="muted-copy">还没有用户资产。</div>}
              </div>
            </section>

            <section className="quick-card quick-output">
              <div className="panel-kicker">当前产物</div>
              <div className="quick-card-title">{latestArtifact ? latestArtifact.candidateId : "尚未生成"}</div>
              <div className="quick-card-body">
                {latestArtifact ? latestArtifact.content.slice(0, 420) : "这个任务目前还没有产物。先投料，再决定是否生成。"}
              </div>
            </section>

            <section className="quick-card quick-ai">
              <div className="panel-kicker">AI 判断</div>
              <div className="quick-card-title">{viewReason}</div>
              <div className="quick-card-body">
                {latestTimelineItem
                  ? `${latestTimelineItem.summary}\n${latestTimelineItem.detail || ""}`.trim()
                  : "系统会先把简单任务保持在轻量视图，只有变复杂时才自动展开结构地图。"}
              </div>
              {workspacePolicies.length ? (
                <div className="queue-list">
                  {workspacePolicies.slice(0, 3).map((policy) => (
                    <span key={policy.policyId} className="status-chip accent">
                      policy · {policy.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        )}

        <div className="gradient-veil" />

        <div className="hud top-left">
          {focusDomain ? (
            <button className="ghost-button" type="button" onClick={() => setFocusDomainId("")}>
              返回全局地图
            </button>
          ) : null}

          <div className="action-group">
            <button
              className="primary-pill"
              type="button"
              disabled={Boolean(busyLabel)}
              onClick={() => handleAction("/api/deep-organize", "正在整理资产...", {
                body: { trigger: "webui.organize" },
                successText: "待归档池与全局规则已交给 AI 重新整理。",
                openDrawer: "activity",
              })}
            >
              整理资产
            </button>
            <button
              className="primary-pill secondary"
              type="button"
              disabled={Boolean(busyLabel)}
              onClick={() => handleAction("/api/dry-run", "正在执行预检...", {
                successText: "预检结果已更新。",
                openDrawer: "activity",
              })}
            >
              预检
            </button>
            <button
              className="primary-pill secondary"
              type="button"
              disabled={Boolean(busyLabel)}
              onClick={handleOpenGeneratePreview}
            >
              生成产物
            </button>
          </div>

          <div className="status-strip">
            <span className="status-chip">domain {workspaceDomainCount}</span>
            <span className={`status-chip ${inboxCount > 0 ? "accent" : ""}`}>inbox {inboxCount}</span>
            {workspacePolicies.length ? <span className="status-chip accent">policy {workspacePolicies.length}</span> : null}
            {latestDryRun ? (
              <span className={`status-chip tone-${latestDryRun.gateResult}`}>preflight {latestDryRun.gateResult}</span>
            ) : null}
            {displayMode === "quick-task" ? (
              <span className="status-chip subtle">{quickTaskLabel}</span>
            ) : focusDomain ? (
              <span className="status-chip focus">focus · {focusDomain.name}</span>
            ) : (
              <span className="status-chip subtle">global domain map</span>
            )}
          </div>
        </div>

        <div className="hud top-right">
          <div className="top-right-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setViewOverride((current) => {
                if (displayMode === "quick-task") {
                  return current === "domain-map" ? "auto" : "domain-map";
                }
                return current === "quick-task" ? "auto" : "quick-task";
              })}
            >
              {toggleViewLabel}
            </button>
            <button className="ghost-button" type="button" onClick={() => setDrawerMode(drawerMode ? "" : "activity")}>
              {drawerMode ? "收起侧栏" : "活动 / 产物"}
            </button>
          </div>
        </div>

        <div className="hud bottom-center">
          <button className="composer-pill" type="button" onClick={() => setShowComposer(true)}>
            全局输入 / 直接喊 AI
            <span>/</span>
          </button>
        </div>

        <div className="hud bottom-right">
          <div
            className={`add-fab ${draggingAdd ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingAdd(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDraggingAdd(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingAdd(false);
              const files = [...(event.dataTransfer?.files || [])];
              if (files.length > 0) {
                void handleDirectDrop(files);
              }
            }}
          >
            <button className="add-fab-button" type="button" onClick={() => setShowIntake(true)}>
              添加新资产
            </button>
            <div className="fab-hint">拖文件到这里可直接导入</div>
          </div>
        </div>

        {feedback ? (
          <div className={`banner banner-${feedback.kind}`}>
            {feedback.text}
          </div>
        ) : null}

        {busyLabel ? (
          <div className="busy-banner">{busyLabel}</div>
        ) : null}

        {displayMode === "quick-task" ? (
          <div className="view-caption">
            <div className="caption-title">{quickTaskLabel}</div>
            <div className="caption-body">{viewReason}</div>
          </div>
        ) : !focusDomain ? (
          <div className="view-caption">
            <div className="caption-title">任务已展开为 Domain Map</div>
            <div className="caption-body">
              {viewReason || "任务已经进入结构治理阶段，系统开始显式展示 domain 和它们之间的关系。"}
            </div>
          </div>
        ) : (
          <div className="view-caption">
            <div className="caption-title">{focusDomain.name}</div>
            <div className="caption-body">{focusDomain.summary}</div>
          </div>
        )}

        {displayMode === "quick-task" && selectedAsset ? (
          <aside className="quick-inspector">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">选中资产</div>
                <div className="panel-title">{selectedAsset.title}</div>
              </div>
              <span className="panel-chip">{selectedAsset.type}</span>
            </div>
            <div className="timeline-detail">{selectedAsset.summary || selectedAsset.content || "暂无摘要"}</div>
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={() => setShowComposer(true)}>
                直接纠偏
              </button>
              <button className="ghost-button" type="button" onClick={() => setViewOverride("domain-map")}>
                打开结构视图
              </button>
            </div>
          </aside>
        ) : null}

        {displayMode === "domain-map" && focusDomain ? (
          <aside className="focus-panel">
            <div className="domain-editor">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Domain</div>
                  <div className="panel-title">{focusDomain.name}</div>
                </div>
                <span className="panel-chip">{focusDomain.assetDropIds.length} assets</span>
              </div>

              {focusDomain.kind === "workspace" ? (
                <>
                  <label className="form-field">
                    <span>名称</span>
                    <input value={domainNameDraft} onChange={(event) => setDomainNameDraft(event.target.value)} />
                  </label>

                  <label className="form-field">
                    <span>摘要</span>
                    <textarea
                      rows="3"
                      value={domainSummaryDraft}
                      onChange={(event) => setDomainSummaryDraft(event.target.value)}
                    />
                  </label>

                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={domainFrozenDraft}
                      onChange={(event) => setDomainFrozenDraft(event.target.checked)}
                    />
                    <span>冻结 domain，避免它继续吸收新的 Inbox 资产</span>
                  </label>

                  <div className="panel-actions">
                    <button className="ghost-button strong" type="button" onClick={handleDomainSave}>
                      保存 Domain
                    </button>
                  </div>
                </>
              ) : (
                <div className="timeline-detail">
                  {focusDomain.kind === "system"
                    ? "System Domain 承载系统资产和全局 policy，默认只读。"
                    : "Inbox 是待归档池，整理后这里会自动变干净。"}
                </div>
              )}
            </div>

            {selectedCluster ? (
              <>
                <div className="panel-header">
                  <div>
                    <div className="panel-kicker">Cluster</div>
                    <div className="panel-title">{selectedCluster.label}</div>
                  </div>
                  <span className="panel-chip">{selectedClusterDrops.length} assets</span>
                </div>

                <div className="asset-list">
                  {selectedClusterDrops.map((drop) => (
                    <button
                      key={drop.dropId}
                      className={`asset-row ${selectedAsset?.dropId === drop.dropId ? "selected" : ""}`}
                      type="button"
                      onClick={() => setSelectedAssetId(drop.dropId)}
                    >
                      <span>{policyByDropId.has(drop.dropId) ? `Policy · ${drop.title}` : drop.title}</span>
                      <span className="asset-row-meta">{drop.type}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-box">这个 domain 里还没有 cluster，先让 AI 整理，或者把资产拖回来。</div>
            )}

            {selectedAsset ? (
              <div className="asset-editor">
                <div className="panel-kicker">Asset</div>
                <div className="panel-title">{selectedAsset.title}</div>
                <div className="asset-editor-meta">更新于 {formatDateTime(selectedAsset.updatedAt)}</div>
                {policyByDropId.has(selectedAsset.dropId) ? (
                  <div className="timeline-detail">
                    这是一个 workspace policy，作用范围: {summarizePolicyScope(policyByDropId.get(selectedAsset.dropId).scopeHint)}。
                  </div>
                ) : null}

                <label className="form-field">
                  <span>Domain</span>
                  <select value={assetDomainDraft} onChange={(event) => setAssetDomainDraft(event.target.value)}>
                    {domainNodes.map((domain) => (
                      <option key={domain.domainId} value={domain.domainId}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Cluster</span>
                  <input value={assetClusterDraft} onChange={(event) => setAssetClusterDraft(event.target.value)} />
                </label>

                <label className="form-field">
                  <span>摘要</span>
                  <textarea
                    rows="4"
                    value={assetSummaryDraft}
                    onChange={(event) => setAssetSummaryDraft(event.target.value)}
                  />
                </label>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={assetFrozenDraft}
                    onChange={(event) => setAssetFrozenDraft(event.target.checked)}
                  />
                  <span>冻结当前归属，避免后续自动挪动</span>
                </label>

                <div className="panel-actions">
                  <button className="ghost-button strong" type="button" onClick={handleAssetSave}>
                    保存纠偏
                  </button>
                  <button className="ghost-button" type="button" onClick={handleSendToInbox}>
                    送回 Inbox
                  </button>
                  <button className="ghost-button" type="button" onClick={openComposerForReconsider}>
                    让 AI 重判
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        {drawerMode ? (
          <aside className="drawer">
            <div className="drawer-tabs">
              <button
                className={drawerMode === "activity" ? "active" : ""}
                type="button"
                onClick={() => setDrawerMode("activity")}
              >
                活动
              </button>
              <button
                className={drawerMode === "artifact" ? "active" : ""}
                type="button"
                onClick={() => setDrawerMode("artifact")}
              >
                产物
              </button>
            </div>

            {drawerMode === "activity" ? (
              <div className="drawer-section">
                {workspacePolicies.length ? (
                  <section className="drawer-card">
                    <div className="panel-kicker">Active Workspace Policies</div>
                    <div className="diff-list">
                      {workspacePolicies.map((policy) => (
                        <div key={policy.policyId} className="diff-item tone-added">
                          <div className="diff-title">{policy.title}</div>
                          <div className="diff-body">
                            {policy.instruction}
                            {"\n"}
                            scope · {summarizePolicyScope(policy.scopeHint)} · confidence {policy.confidence.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {latestGeneration?.diff ? (
                  <section className="drawer-card">
                    <div className="panel-kicker">上次生成需求 Diff</div>
                    <div className="panel-title">{latestGeneration.diff.summary}</div>
                    <div className="diff-list">
                      {(latestGeneration.diff.entries || []).slice(0, 10).map((entry, index) => (
                        <div key={`${entry.key}-${index}`} className={`diff-item tone-${entry.status}`}>
                          <div className="diff-title">{summarizeDiffKey(entry.key)}</div>
                          <div className="diff-body">
                            {entry.after || entry.before || "变更"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="drawer-card">
                  <div className="panel-kicker">AI 活动时间线</div>
                  <div className="timeline-list">
                    {timeline.length ? timeline.map((item) => (
                      <article key={item.activityId} className="timeline-item">
                        <div className="timeline-topline">
                          <span className={`node-chip tone-${item.kind}`}>{item.kind}</span>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                        <div className="timeline-title">{item.summary}</div>
                        {item.detail ? <div className="timeline-detail">{item.detail}</div> : null}
                        {(item.relatedDomainIds?.length || item.relatedDropIds?.length) ? (
                          <div className="timeline-links">
                            {item.relatedDomainIds?.length ? <span>{item.relatedDomainIds.length} domain</span> : null}
                            {item.relatedDropIds?.length ? <span>{item.relatedDropIds.length} assets</span> : null}
                          </div>
                        ) : null}
                      </article>
                    )) : <div className="empty-box">还没有 AI 活动记录。</div>}
                  </div>
                </section>
              </div>
            ) : (
              <div className="drawer-section">
                <section className="drawer-card">
                  <div className="panel-kicker">当前产物</div>
                  <div className="panel-title">{latestArtifact ? latestArtifact.candidateId : "尚未生成"}</div>
                  {latestArtifact ? (
                    <>
                      <pre className="artifact-preview">{latestArtifact.content}</pre>
                      <div className="artifact-meta">
                        <span>覆盖 {latestArtifact.coverageDropIds.length} 个资产</span>
                        <span>生成于 {formatDateTime(latestArtifact.createdAt)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="empty-box">当前还没有产物。先整理资产，再执行生成。</div>
                  )}
                </section>

                {latestGeneration?.diff ? (
                  <section className="drawer-card">
                    <div className="panel-kicker">本次生成与上次的需求差异</div>
                    <div className="diff-list">
                      {(latestGeneration.diff.entries || []).length ? latestGeneration.diff.entries.map((entry, index) => (
                        <div key={`${entry.key}-${index}`} className={`diff-item tone-${entry.status}`}>
                          <div className="diff-title">{summarizeDiffKey(entry.key)}</div>
                          <div className="diff-body">
                            {entry.after || entry.before || "变更"}
                          </div>
                        </div>
                      )) : <div className="empty-box">这次生成前，需求相对上次没有变化。</div>}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </aside>
        ) : null}

        {showIntake ? (
          <div className="modal-scrim" onClick={() => setShowIntake(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">添加资产</div>
                  <div className="panel-title">先扔进来，AI 再收拾</div>
                </div>
                <button className="ghost-button" type="button" onClick={() => setShowIntake(false)}>
                  关闭
                </button>
              </div>

              <label className="form-field">
                <span>文本输入</span>
                <textarea
                  rows="8"
                  placeholder="按空行分段。你可以直接贴需求、会议记录、链接说明、结构草稿或随手想法。"
                  value={intakeText}
                  onChange={(event) => setIntakeText(event.target.value)}
                />
              </label>

              <label
                className="drop-area"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setQueuedFiles((current) => [...current, ...(event.dataTransfer?.files || [])]);
                }}
              >
                <input
                  type="file"
                  multiple
                  onChange={(event) => setQueuedFiles((current) => [...current, ...(event.target.files || [])])}
                />
                <span>点击选择文件，或直接把文件拖到这里</span>
              </label>

              <div className="queue-list">
                {queuedFiles.length ? queuedFiles.map((file) => (
                  <span key={`${file.name}-${file.lastModified}`} className="status-chip accent">
                    {file.name}
                  </span>
                )) : <span className="muted-copy">还没有排队文件</span>}
              </div>

              <div className="panel-actions">
                <button className="ghost-button strong" type="button" onClick={handleAddAssets}>
                  添加到画布
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showGeneratePreview && generationPreview ? (
          <div className="modal-scrim" onClick={() => setShowGeneratePreview(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">生成前确认</div>
                  <div className="panel-title">先看本次需求变化，再决定是否生成</div>
                </div>
                <button className="ghost-button" type="button" onClick={() => setShowGeneratePreview(false)}>
                  关闭
                </button>
              </div>

              <div className="preview-grid">
                <section className="drawer-card">
                  <div className="panel-kicker">Preflight</div>
                  <div className="panel-title">
                    gate · {generationPreview.dryRunReport?.gateResult || "unknown"}
                  </div>
                  <div className="timeline-detail">
                    {generationPreview.dryRunReport?.gateReason || "未记录 gate reason"}
                  </div>
                </section>

                <section className="drawer-card">
                  <div className="panel-kicker">Snapshot</div>
                  <div className="timeline-detail">wish · {generationPreview.snapshot?.wish || "未填写"}</div>
                  <div className="timeline-detail">
                    domain signatures · {(generationPreview.snapshot?.domainSignatures || []).length}
                  </div>
                  <div className="timeline-detail">
                    inbox assets · {(generationPreview.snapshot?.inboxDropIds || []).length}
                  </div>
                </section>
              </div>

              <section className="drawer-card preview-card">
                <div className="panel-kicker">相对上次生成的 Requirement Diff</div>
                <div className="panel-title">{generationPreview.diff?.summary || "无 diff"}</div>
                <div className="diff-list">
                  {(generationPreview.diff?.entries || []).length ? generationPreview.diff.entries.map((entry, index) => (
                    <div key={`${entry.key}-${index}`} className={`diff-item tone-${entry.status}`}>
                      <div className="diff-title">{summarizeDiffKey(entry.key)}</div>
                      <div className="diff-body">{entry.after || entry.before || "变更"}</div>
                    </div>
                  )) : <div className="empty-box">相对上次生成，这次没有新的需求变化。</div>}
                </div>
              </section>

              {generationPreview.dryRunReport?.gateResult === "fail" ? (
                <div className="empty-box preview-warning">
                  当前 preflight 为 fail，这次生成会被后端拒绝。先修正 domain / 资产结构，再回来生成。
                </div>
              ) : null}

              <div className="panel-actions">
                <button className="ghost-button" type="button" onClick={() => setShowGeneratePreview(false)}>
                  暂不生成
                </button>
                <button
                  className="ghost-button strong"
                  type="button"
                  disabled={generationPreview.dryRunReport?.gateResult === "fail" || Boolean(busyLabel)}
                  onClick={handleConfirmGenerate}
                >
                  确认生成
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showComposer ? (
          <div className="modal-scrim" onClick={() => setShowComposer(false)}>
            <div className="modal-card composer-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Universal Composer</div>
                  <div className="panel-title">
                    {selectedAsset ? `直接纠偏「${selectedAsset.title}」` : "和 AI 说一句人话"}
                  </div>
                </div>
                <button className="ghost-button" type="button" onClick={() => setShowComposer(false)}>
                  关闭
                </button>
              </div>

              <textarea
                rows="6"
                placeholder={selectedAsset
                  ? "例如：这个资产被分错了，请重新归组，并解释为什么。"
                  : "例如：整理 Inbox、补出缺失的 domain，或解释最近 AI 为什么这样调整。"}
                value={composerInput}
                onChange={(event) => setComposerInput(event.target.value)}
              />

              <div className="panel-actions">
                <button className="ghost-button strong" type="button" onClick={handleComposerSend}>
                  发送给 AI
                </button>
              </div>

              <div className="conversation-list">
                {conversations.length ? conversations.map((message) => (
                  <article key={message.messageId} className={`conversation-item ${message.role}`}>
                    <div className="timeline-topline">
                      <span className="node-chip">{message.role}</span>
                      <span>{formatDateTime(message.createdAt)}</span>
                    </div>
                    <div className="timeline-detail">{message.content}</div>
                  </article>
                )) : <div className="empty-box">这里会展示最近的全局或当前资产对话。</div>}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")).render(<App />);
