import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const e = React.createElement;

const COPY = {
  zh: {
    booting: "启动 phonowell...",
    subtitle: "把零散输入稳定收敛成可交付结果",
    language: "语言",
    languageZh: "中文",
    languageEn: "English",
    organize: "整理资产",
    preflight: "预检",
    generate: "生成产物",
    verify: "验证",
    generateBlocked: "生成产物（预检未通过）",
    addAsset: "添加新资产",
    addAssetTitle: "添加新资产",
    addAssetHint: "输入文本或拖入文件。添加后先作为孤儿资产进入画布。",
    assetText: "文本输入",
    assetTextPlaceholder: "粘贴需求、链接说明、想法、摘要。可用空行分隔为多个资产。",
    dropFiles: "拖入文件到此处，或使用文件选择",
    confirmAdd: "确认添加",
    cancel: "取消",
    canvas: "资产画布",
    globalScope: "全局范围",
    assetScope: "当前资产范围",
    llmPlaceholderGlobal: "向 Phonowell 输入全局指令、问题或补充上下文",
    llmPlaceholderAsset: "向当前资产输入补充说明、问题或修改要求",
    summary: "信息摘要",
    conversation: "对话流",
    noSelection: "未选中资产",
    noConversation: "暂无会话流，当前显示运行日志摘要。",
    orphan: "孤儿资产",
    dragHint: "拖拽调整位置",
    selectPrompt: "点击画布中的资产查看摘要与会话流",
    queuedFiles: "待添加文件",
    noFiles: "暂无文件",
    send: "发送",
    close: "关闭",
    status: "状态",
    latestProposal: "最新提案",
    latestVerify: "最新验证",
    assetDetails: "资产详情",
    selectedAsset: "已选资产",
    selectAssetTip: "选中资产后可查看摘要与会话",
    activeAsset: "当前资产",
    goalPanel: "目标源",
    goalDraft: "起草目标",
    goalConfirm: "确认目标",
    goalRevise: "标记修订",
    goalSummaryPlaceholder: "编辑目标摘要，确认后才允许稳定生成",
    connectRelation: "连接关系",
    relationType: "关系类型",
    saveSummary: "保存摘要",
    automation: "自动整理",
    acceptance: "验收覆盖",
    verifyRoute: "验证路由",
    priorityAudit: "优先级审计",
    applied: "已落地",
    deferred: "已延后",
    evidence: "证据",
  },
  en: {
    booting: "booting phonowell...",
    subtitle: "Turn scattered input into a deliverable result",
    language: "Language",
    languageZh: "中文",
    languageEn: "English",
    organize: "Organize Assets",
    preflight: "Preflight",
    generate: "Generate Artifact",
    verify: "Verify",
    generateBlocked: "Generate (Preflight Required)",
    addAsset: "Add Asset",
    addAssetTitle: "Add Asset",
    addAssetHint: "Paste text or drop files. New assets enter the canvas as orphans first.",
    assetText: "Text Input",
    assetTextPlaceholder: "Paste requirements, notes, links, or ideas. Separate multiple assets with blank lines.",
    dropFiles: "Drop files here, or choose files",
    confirmAdd: "Add",
    cancel: "Cancel",
    canvas: "Asset Canvas",
    globalScope: "Global Scope",
    assetScope: "Asset Scope",
    llmPlaceholderGlobal: "Ask globally, add context, or direct the system",
    llmPlaceholderAsset: "Ask about this asset, add context, or request edits",
    summary: "Summary",
    conversation: "Conversation",
    noSelection: "No asset selected",
    noConversation: "No conversation yet. Showing recent runtime logs instead.",
    orphan: "orphan asset",
    dragHint: "drag to reposition",
    selectPrompt: "Click an asset to open summary and conversation",
    queuedFiles: "Queued Files",
    noFiles: "No files",
    send: "Send",
    close: "Close",
    status: "Status",
    latestProposal: "Latest Proposal",
    latestVerify: "Latest Verify",
    assetDetails: "Asset Details",
    selectedAsset: "Selected Asset",
    selectAssetTip: "Select an asset to inspect summary and conversation",
    activeAsset: "Active Asset",
    goalPanel: "Goal Origin",
    goalDraft: "Draft Goal",
    goalConfirm: "Confirm Goal",
    goalRevise: "Mark Revised",
    goalSummaryPlaceholder: "Edit the goal summary before confirming generation intent",
    connectRelation: "Connect Relation",
    relationType: "Relation Type",
    saveSummary: "Save Summary",
    automation: "Automation",
    acceptance: "Acceptance Coverage",
    verifyRoute: "Verify Route",
    priorityAudit: "Priority Audit",
    applied: "Applied",
    deferred: "Deferred",
    evidence: "Evidence",
  },
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `request failed: ${res.status}`);
  }
  return data;
}

async function apiOrDefault(path, fallback, options = {}) {
  try {
    return await api(path, options);
  } catch (error) {
    if (String(error.message || "").includes("debug api disabled")) {
      return fallback;
    }
    throw error;
  }
}

function getNodePosition(drop, index, total) {
  if (drop.position && Number.isFinite(drop.position.x) && Number.isFinite(drop.position.y)) {
    return { x: drop.position.x, y: drop.position.y };
  }
  if (drop.type === "goal-origin") {
    return { x: 420, y: 220 };
  }
  const radius = 280;
  const angle = (index / Math.max(1, total - 1)) * Math.PI * 2;
  return {
    x: Math.round(440 + radius * Math.cos(angle)),
    y: Math.round(260 + radius * Math.sin(angle)),
  };
}

function summarizeFileForAsset(file) {
  const type = file.type || "application/octet-stream";
  const textLike = type.startsWith("text/") || /(json|xml|javascript|typescript|markdown|csv|svg)/i.test(type);
  if (textLike) {
    return file.text();
  }
  return Promise.resolve(`[binary file] ${file.name} (${type}, ${file.size} bytes)`);
}

function App() {
  const [state, setState] = useState(null);
  const [packets, setPackets] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [observability, setObservability] = useState(null);
  const [language, setLanguage] = useState("zh");
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetInput, setAssetInput] = useState("");
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [selectedDropId, setSelectedDropId] = useState("");
  const [llmInput, setLlmInput] = useState("");
  const [dragging, setDragging] = useState(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [connectTargetId, setConnectTargetId] = useState("");
  const [connectType, setConnectType] = useState("references");
  const canvasRef = useRef(null);
  const t = COPY[language];

  const refresh = useCallback(async () => {
    const [stateData, packetData, observabilityData, proposalData, conversationData] = await Promise.all([
      api("/api/state"),
      apiOrDefault("/api/packets", { packets: [] }),
      api("/api/observability"),
      apiOrDefault("/api/proposals", { proposals: [] }),
      api(`/api/conversations${selectedDropId ? `?dropId=${selectedDropId}` : ""}`),
    ]);
    startTransition(() => {
      setState(stateData);
      setPackets(packetData.packets || []);
      setObservability(observabilityData);
      setProposals(proposalData.proposals || []);
      setConversations(conversationData.messages || []);
      setSelectedDropId((current) => current && stateData.drops.some((drop) => drop.dropId === current) ? current : "");
    });
  }, [selectedDropId]);

  useEffect(() => {
    refresh().catch((error) => window.alert(String(error)));
  }, [refresh]);

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }
    const onMove = (event) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      setDragging((current) => current ? {
        ...current,
        x: Math.round(event.clientX - rect.left - current.offsetX),
        y: Math.round(event.clientY - rect.top - current.offsetY),
      } : null);
    };
    const onUp = async () => {
      const finalDrag = dragging;
      setDragging(null);
      if (!finalDrag) {
        return;
      }
      await api(`/api/drops/${finalDrag.dropId}`, {
        method: "PUT",
        body: JSON.stringify({ position: { x: finalDrag.x, y: finalDrag.y }, skipAutoFlow: true }),
      });
      await refresh();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, refresh]);

  const labels = useMemo(() => ({
    packet: packets[0]?.response?.structured?.summary || packets[0]?.response?.summary || null,
  }), [packets]);

  if (!state) {
    return e("div", { className: "booting" }, t.booting);
  }

  const visibleDrops = state.drops.filter((drop) => drop.lifecycleState !== "archived");
  const latestProposal = proposals[0] || null;
  const latestVerify = state.verifyReports?.[0] || null;
  const latestAutomation = observability?.automationTasks?.[0] || state.automationTasks?.[0] || null;
  const latestVerifyCycle = state.verifyCycles?.[0] || null;
  const dryRunStatus = state.well.dryRunStatus;
  const canGenerate = dryRunStatus === "pass";
  const canVerify = (state.candidates?.length ?? 0) > 0;
  const selectedDrop = visibleDrops.find((drop) => drop.dropId === selectedDropId) || null;
  const goalDrop = visibleDrops.find((drop) => drop.type === "goal-origin") || null;
  const showGoalPanel = !selectedDrop || selectedDrop.type === "goal-origin";
  const nodeMap = new Map();
  visibleDrops.forEach((drop, index) => {
    const pos = dragging?.dropId === drop.dropId ? { x: dragging.x, y: dragging.y } : getNodePosition(drop, index, visibleDrops.length);
    nodeMap.set(drop.dropId, { ...pos, width: 250, height: 110 });
  });
  const conversationItems = conversations;
  const selectedSummary = selectedDrop ? [
    `${selectedDrop.type} · ${selectedDrop.layer} · ${selectedDrop.priority}`,
    selectedDrop.summary,
  ].join("\n") : "";

  useEffect(() => {
    setGoalDraft(goalDrop?.summary || "");
  }, [goalDrop?.dropId, goalDrop?.summary]);

  useEffect(() => {
    setEditedSummary(selectedDrop?.summary || "");
    setConnectTargetId("");
  }, [selectedDrop?.dropId, selectedDrop?.summary]);

  async function handleAddAssets() {
    const blocks = assetInput.split(/\n\s*\n/g).map((item) => item.trim()).filter(Boolean);
    const tasks = [];
    for (const block of blocks) {
      tasks.push(api("/api/drops", { method: "POST", body: JSON.stringify({ text: block }) }));
    }
    for (const file of queuedFiles) {
      tasks.push(api("/api/drops", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileContent: file.content, mimeType: file.type }),
      }));
    }
    if (tasks.length === 0) {
      window.alert(t.addAssetHint);
      return;
    }
    await Promise.all(tasks);
    setAssetInput("");
    setQueuedFiles([]);
    setAssetModalOpen(false);
    await refresh();
  }

  async function handleFileInput(event) {
    const files = Array.from(event.target.files || []);
    const loaded = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type, content: await summarizeFileForAsset(file) })));
    setQueuedFiles((current) => [...current, ...loaded]);
    event.target.value = "";
  }

  async function handleDropFiles(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    const loaded = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type, content: await summarizeFileForAsset(file) })));
    setQueuedFiles((current) => [...current, ...loaded]);
  }

  async function handleOrganize() {
    await api("/api/deep-organize", { method: "POST", body: JSON.stringify({ trigger: "ui.organize.assets" }) });
    await refresh();
  }

  async function handlePreflight() {
    await api("/api/dry-run", { method: "POST" });
    await refresh();
  }

  async function handleGenerate() {
    await api("/api/generate", { method: "POST" });
    await refresh();
  }

  async function handleVerify() {
    await api("/api/verify", { method: "POST" });
    await refresh();
  }

  async function handleGoalDraft() {
    const result = await api("/api/goal/draft", { method: "POST" });
    setGoalDraft(result.goal?.summary || "");
    await refresh();
  }

  async function handleGoalStatus(status) {
    await api("/api/goal", {
      method: "PUT",
      body: JSON.stringify({ summary: goalDraft, status }),
    });
    await refresh();
  }

  async function handleSaveSummary() {
    if (!selectedDrop) return;
    await api(`/api/drops/${selectedDrop.dropId}`, {
      method: "PUT",
      body: JSON.stringify({ summary: editedSummary, skipAutoFlow: false }),
    });
    await refresh();
  }

  async function handleConnectRelation() {
    if (!selectedDrop || !connectTargetId || connectTargetId === selectedDrop.dropId) {
      return;
    }
    await api("/api/relations", {
      method: "POST",
      body: JSON.stringify({
        fromDropId: selectedDrop.dropId,
        toDropId: connectTargetId,
        relationType: connectType,
      }),
    });
    await refresh();
  }

  async function handleSend() {
    const message = llmInput.trim();
    if (!message) {
      return;
    }
    await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ content: message, dropId: selectedDrop?.dropId, scope: selectedDrop ? "asset" : "global" }),
    });
    setLlmInput("");
    await refresh();
  }

  function startDrag(event, drop) {
    if (event.target.closest(".node-title-click")) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = drop.position || getNodePosition(drop, 0, visibleDrops.length);
    setDragging({
      dropId: drop.dropId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: pos.x,
      y: pos.y,
    });
  }

  return e("div", { className: "stage-shell" },
    e("main", { className: "canvas-stage" },
      e("section", { className: "canvas-fullscreen", ref: canvasRef },
        e("div", { className: "canvas-action-group" },
          e("button", { className: "ghost", disabled: !canVerify, onClick: handleVerify, type: "button" }, t.verify),
          e("button", { onClick: handleOrganize, type: "button" }, t.organize),
          e("button", { className: "ghost", onClick: handlePreflight, type: "button" }, t.preflight),
          e("button", { disabled: !canGenerate, onClick: handleGenerate, type: "button" }, canGenerate ? t.generate : t.generateBlocked),
        ),
        e("div", { className: "canvas-status-bar" },
          e("div", null, `${t.status}: dry-run=${dryRunStatus}`),
          latestProposal ? e("div", null, `${t.latestProposal}: ${latestProposal.summary}`) : null,
          latestVerify ? e("div", null, `${t.latestVerify}: ${latestVerify.pass}`) : null,
        ),
        state.relations.map((rel) => {
          const from = nodeMap.get(rel.fromDropId);
          const to = nodeMap.get(rel.toDropId);
          if (!from || !to) return null;
          const x1 = from.x + from.width / 2;
          const y1 = from.y + from.height / 2;
          const x2 = to.x + to.width / 2;
          const y2 = to.y + to.height / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return e("div", { key: rel.relationId, className: "edge", style: { left: `${x1}px`, top: `${y1}px`, width: `${length}px`, transform: `rotate(${angle}deg)` } });
        }),
        visibleDrops.map((drop, index) => {
          const pos = dragging?.dropId === drop.dropId ? { x: dragging.x, y: dragging.y } : getNodePosition(drop, index, visibleDrops.length);
          const isOrphan = !state.relations.some((rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId);
          return e("button", {
            key: drop.dropId,
            className: `node stage-node ${selectedDropId === drop.dropId ? "selected" : ""} ${drop.layer}`,
            style: { left: `${pos.x}px`, top: `${pos.y}px` },
            type: "button",
            onPointerDown: (event) => startDrag(event, drop),
            onClick: () => setSelectedDropId(drop.dropId),
          },
            e("div", { className: "title node-title-click" }, drop.title),
            e("div", { className: "summary" }, drop.summary),
            isOrphan ? e("div", { className: "node-badge orphan" }, t.orphan) : null,
            e("div", { className: "meta" }, `${drop.layer} · ${drop.priority} · ${t.dragHint}`),
          );
        }),
        !selectedDrop ? e("div", { className: "canvas-empty-hint" }, t.selectPrompt) : null,
        e("section", { className: `asset-detail-card ${selectedDrop ? "visible" : ""}` },
          e("div", { className: "asset-detail-head" },
            e("div", null,
              e("div", { className: "asset-detail-kicker" }, t.assetDetails),
              e("div", { className: "asset-detail-title" }, selectedDrop ? selectedDrop.title : t.noSelection),
            ),
            e("div", { className: "row" },
              e("button", { className: "ghost", onClick: () => setLanguage((value) => value === "zh" ? "en" : "zh"), type: "button" }, `${t.language}: ${language === "zh" ? t.languageEn : t.languageZh}`),
              selectedDrop ? e("button", { className: "ghost", onClick: () => setSelectedDropId(""), type: "button" }, t.close) : null,
            ),
          ),
          selectedDrop
            ? e(React.Fragment, null,
                showGoalPanel ? e(React.Fragment, null,
                  e("div", { className: "asset-detail-section-title" }, t.goalPanel),
                  e("div", { className: "inline-form" },
                    e("textarea", {
                      value: goalDraft,
                      onChange: (event) => setGoalDraft(event.target.value),
                      rows: 3,
                      placeholder: t.goalSummaryPlaceholder,
                    }),
                    e("div", { className: "row wrap" },
                      e("button", { className: "ghost", onClick: handleGoalDraft, type: "button" }, t.goalDraft),
                      e("button", { onClick: () => handleGoalStatus("confirmed"), type: "button" }, t.goalConfirm),
                      e("button", { className: "ghost", onClick: () => handleGoalStatus("revised"), type: "button" }, t.goalRevise),
                    ),
                  ),
                ) : null,
                e("div", { className: "asset-detail-meta" }, `${t.selectedAsset}: ${selectedDrop.type} · ${selectedDrop.layer} · ${selectedDrop.priority}`),
                e("div", { className: "inline-form" },
                  e("textarea", {
                    value: editedSummary,
                    onChange: (event) => setEditedSummary(event.target.value),
                    rows: 4,
                  }),
                  e("button", { onClick: handleSaveSummary, type: "button" }, t.saveSummary),
                ),
                e("div", { className: "asset-detail-summary" }, selectedSummary),
                e("div", { className: "asset-detail-section-title" }, t.connectRelation),
                e("div", { className: "inline-form" },
                  e("select", {
                    value: connectTargetId,
                    onChange: (event) => setConnectTargetId(event.target.value),
                  },
                    e("option", { value: "" }, t.noSelection),
                    visibleDrops
                      .filter((drop) => drop.dropId !== selectedDrop.dropId)
                      .map((drop) => e("option", { key: drop.dropId, value: drop.dropId }, drop.title)),
                  ),
                  e("select", {
                    value: connectType,
                    onChange: (event) => setConnectType(event.target.value),
                  },
                    ["references", "supports", "implements", "constrains", "derives"].map((item) => e("option", { key: item, value: item }, item)),
                  ),
                  e("button", { onClick: handleConnectRelation, type: "button" }, t.connectRelation),
                ),
                latestAutomation ? e("div", { className: "asset-detail-section-title" }, t.automation) : null,
                latestAutomation ? e("div", { className: "conversation-list scrollable" },
                  latestAutomation.decisions?.map((decision) => e("div", { key: decision.decisionId, className: "conversation-item system" },
                    e("div", { className: "conversation-role" }, `${decision.kind} · ${decision.source} · ${decision.applied ? t.applied : t.deferred}`),
                    e("div", { className: "conversation-content" }, `${decision.proposedValue}\n${decision.applied ? decision.appliedReason : decision.deferredReason}`),
                  )),
                ) : null,
                latestVerifyCycle ? e("div", { className: "asset-detail-section-title" }, t.verifyRoute) : null,
                latestVerifyCycle ? e("div", { className: "muted-note" }, `${latestVerifyCycle.routeExecution?.route} · ${latestVerifyCycle.routeExecution?.actions?.join(", ")}`) : null,
                latestVerifyCycle?.priorityLifecycleAudits?.length ? e("div", { className: "asset-detail-section-title" }, t.priorityAudit) : null,
                latestVerifyCycle?.priorityLifecycleAudits?.length ? e("div", { className: "conversation-list scrollable" },
                  latestVerifyCycle.priorityLifecycleAudits.map((audit) => e("div", { key: `${audit.dropId}-${audit.createdAt}`, className: "conversation-item system" },
                    e("div", { className: "conversation-role" }, `${audit.dropId} · ${audit.decision}`),
                    e("div", { className: "conversation-content" }, `${audit.from} -> ${audit.to}\n${audit.reason}`),
                  )),
                ) : null,
                latestVerify ? e("div", { className: "asset-detail-section-title" }, t.acceptance) : null,
                latestVerify ? e("div", { className: "conversation-list scrollable" },
                  latestVerify.acceptanceItems?.map((item) => e("div", { key: item.itemId, className: "conversation-item system" },
                    e("div", { className: "conversation-role" }, `${item.itemId} · ${item.status}`),
                    e("div", { className: "conversation-content" }, `${item.title}\n${item.evidence?.map((entry) => `${entry.kind}:${entry.ref}:${entry.detail}`).join("\n") || item.uncoveredReason || ""}`),
                  )),
                ) : null,
                e("div", { className: "asset-detail-section-title" }, t.conversation),
                conversationItems.length
                  ? e("div", { className: "conversation-list scrollable" }, conversationItems.map((item) => e("div", { key: item.messageId, className: `conversation-item ${item.role}` }, e("div", { className: "conversation-role" }, `${item.scope} · ${item.role}`), e("div", { className: "conversation-content" }, item.content))))
                  : e("div", { className: "muted-note" }, t.noConversation),
              )
            : e("div", { className: "muted-note" }, t.selectAssetTip),
        ),
        e("div", { className: "composer-dock" },
          e("div", { className: "scope-chip" }, selectedDrop ? t.assetScope : t.globalScope),
          e("textarea", {
            value: llmInput,
            onChange: (event) => setLlmInput(event.target.value),
            rows: 3,
            placeholder: selectedDrop ? t.llmPlaceholderAsset : t.llmPlaceholderGlobal,
          }),
          selectedDrop ? e("div", { className: "composer-selected-asset" }, `${t.activeAsset}: ${selectedDrop.title}`) : null,
          e("button", { onClick: handleSend, type: "button" }, t.send),
        ),
        e("button", { className: "add-asset-fab", onClick: () => setAssetModalOpen(true), type: "button" }, t.addAsset),
      ),
    ),
    assetModalOpen ? e("div", { className: "modal-backdrop", onClick: () => setAssetModalOpen(false) },
      e("div", { className: "asset-modal", onClick: (event) => event.stopPropagation(), onDragOver: (event) => event.preventDefault(), onDrop: handleDropFiles },
        e("div", { className: "sidebar-head" },
          e("div", { className: "sidebar-title" }, t.addAssetTitle),
          e("button", { className: "ghost", onClick: () => setAssetModalOpen(false), type: "button" }, t.close),
        ),
        e("div", { className: "asset-intake-hint" }, t.addAssetHint),
        e("label", null, t.assetText, e("textarea", { value: assetInput, onChange: (event) => setAssetInput(event.target.value), rows: 8, placeholder: t.assetTextPlaceholder })),
        e("label", { className: "file-drop-label" },
          t.dropFiles,
          e("input", { type: "file", multiple: true, onChange: handleFileInput }),
        ),
        e("div", { className: "file-queue" },
          queuedFiles.length
            ? queuedFiles.map((file, index) => e("div", { key: `${file.name}-${index}`, className: "file-chip" }, file.name))
            : e("div", { className: "muted-note" }, t.noFiles),
        ),
        e("div", { className: "row" },
          e("button", { onClick: handleAddAssets, type: "button" }, t.confirmAdd),
          e("button", { className: "ghost", onClick: () => setAssetModalOpen(false), type: "button" }, t.cancel),
        ),
      ),
    ) : null,
  );
}

createRoot(document.getElementById("app")).render(e(App));
