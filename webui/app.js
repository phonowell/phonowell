import React, { startTransition, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const e = React.createElement;

const COPY = {
  zh: {
    booting: "启动 phonowell...",
    subtitle: "把零散材料收敛成一个可判断的结果",
    language: "语言",
    languageZh: "中文",
    languageEn: "English",
    currentGoal: "当前目标",
    currentArtifact: "当前结果",
    nextCheckpoint: "下一检查点",
    noGoal: "先补充材料并确认目标。",
    noArtifact: "助手还没有产出可判断的结果。",
    noCheckpoint: "当前没有待审查的检查点。",
    trust: "可信度",
    materialTitle: "材料输入",
    materialHint: "粘贴文本、补充链接说明，或拖入文件。材料会立即进入项目。",
    materialPlaceholder: "输入需求、上下文、参考链接、结构草稿或约束。",
    queuedFiles: "待添加文件",
    noFiles: "暂无文件",
    addMaterial: "添加材料",
    goalTitle: "目标确认",
    goalHint: "只保留一条当前最想交付的方向。确认后，助手才会默认推进生成。",
    goalPlaceholder: "用一句话描述要交付什么，以及怎样算完成。",
    confirmGoal: "确认目标",
    reviseGoal: "标记修订",
    draftGoal: "重新起草",
    artifactTitle: "当前结果",
    artifactHint: "这里始终显示最新候选结果和可信说明。",
    artifactCoverage: "覆盖材料数",
    acceptedAt: "接受时间",
    resultSummary: "结果说明",
    checkpointTitle: "待处理检查点",
    checkpointHint: "只展示会阻塞默认主循环的高影响检查点。",
    noReview: "当前没有额外审查项。",
    diagnostics: "诊断与手工控制",
    diagnosticsHint: "这里保留手工编辑、连接、阶段运行和原始证据，不阻塞默认路径。",
    manualControls: "手工控制",
    organize: "整理",
    preflight: "预检",
    generate: "生成",
    verify: "验证",
    materials: "材料列表",
    noSelection: "未选中材料",
    selectMaterial: "选择一个材料查看详情、关系和对话。",
    saveSummary: "保存摘要",
    connectRelation: "连接关系",
    relationType: "关系类型",
    automation: "自动决策记录",
    evidence: "证据",
    acceptance: "验收映射",
    conversation: "对话",
    conversationPlaceholderGlobal: "补充目标、提问，或让助手解释下一步。",
    conversationPlaceholderAsset: "针对当前材料补充说明或提出修改要求。",
    send: "发送",
    activeMaterial: "当前材料",
    rawRuntime: "运行诊断",
    status: "状态",
    primaryAction: "主动作",
    noConversations: "暂无对话记录。",
    noAutomation: "暂无自动决策记录。",
    noAcceptance: "暂无验收映射结果。",
    packetSummary: "最新运行摘要",
    proposalSummary: "最新提案摘要",
  },
  en: {
    booting: "booting phonowell...",
    subtitle: "Turn scattered material into one reviewable result",
    language: "Language",
    languageZh: "中文",
    languageEn: "English",
    currentGoal: "Current goal",
    currentArtifact: "Current result",
    nextCheckpoint: "Next checkpoint",
    noGoal: "Add material and confirm the goal first.",
    noArtifact: "No reviewable result yet.",
    noCheckpoint: "No blocking checkpoint right now.",
    trust: "Trust",
    materialTitle: "Material intake",
    materialHint: "Paste text, add links, or drop files. Material enters the project immediately.",
    materialPlaceholder: "Paste requirements, context, reference links, structure ideas, or constraints.",
    queuedFiles: "Queued files",
    noFiles: "No files",
    addMaterial: "Add material",
    goalTitle: "Goal confirmation",
    goalHint: "Keep one current delivery direction. The assistant only generates by default after confirmation.",
    goalPlaceholder: "Describe the deliverable and what success looks like.",
    confirmGoal: "Confirm goal",
    reviseGoal: "Mark revised",
    draftGoal: "Draft again",
    artifactTitle: "Current result",
    artifactHint: "This always shows the latest candidate and trust summary.",
    artifactCoverage: "Covered material",
    acceptedAt: "Accepted at",
    resultSummary: "Result summary",
    checkpointTitle: "Blocking checkpoints",
    checkpointHint: "Only high-impact checkpoints that block the default loop appear here.",
    noReview: "No extra review item right now.",
    diagnostics: "Diagnostics and manual controls",
    diagnosticsHint: "Manual edits, links, stage runs, and raw evidence stay here without blocking the default path.",
    manualControls: "Manual controls",
    organize: "Organize",
    preflight: "Preflight",
    generate: "Generate",
    verify: "Verify",
    materials: "Materials",
    noSelection: "No material selected",
    selectMaterial: "Select a material to inspect details, relations, and conversation.",
    saveSummary: "Save summary",
    connectRelation: "Connect relation",
    relationType: "Relation type",
    automation: "Automation log",
    evidence: "Evidence",
    acceptance: "Acceptance mapping",
    conversation: "Conversation",
    conversationPlaceholderGlobal: "Add context, ask a question, or ask the assistant to explain the next step.",
    conversationPlaceholderAsset: "Add instructions or request changes for the selected material.",
    send: "Send",
    activeMaterial: "Active material",
    rawRuntime: "Runtime diagnostics",
    status: "Status",
    primaryAction: "Primary action",
    noConversations: "No conversation yet.",
    noAutomation: "No automation log yet.",
    noAcceptance: "No acceptance mapping yet.",
    packetSummary: "Latest runtime summary",
    proposalSummary: "Latest proposal summary",
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

function summarizeFileForAsset(file) {
  const type = file.type || "application/octet-stream";
  const textLike = type.startsWith("text/") || /(json|xml|javascript|typescript|markdown|csv|svg)/i.test(type);
  if (textLike) {
    return file.text();
  }
  return Promise.resolve(`[binary file] ${file.name} (${type}, ${file.size} bytes)`);
}

function statusClass(key) {
  return `status-pill ${String(key || "neutral").replace(/[^a-z-]+/g, "-")}`;
}

function App() {
  const [state, setState] = useState(null);
  const [loop, setLoop] = useState(null);
  const [observability, setObservability] = useState(null);
  const [packets, setPackets] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [language, setLanguage] = useState("zh");
  const [selectedDropId, setSelectedDropId] = useState("");
  const [assetInput, setAssetInput] = useState("");
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [connectTargetId, setConnectTargetId] = useState("");
  const [connectType, setConnectType] = useState("references");
  const [llmInput, setLlmInput] = useState("");
  const t = COPY[language];

  const refresh = useCallback(async () => {
    const [stateData, loopData, observabilityData, packetData, proposalData, conversationData] = await Promise.all([
      api("/api/state"),
      api("/api/loop"),
      api("/api/observability"),
      apiOrDefault("/api/packets", { packets: [] }),
      apiOrDefault("/api/proposals", { proposals: [] }),
      api(`/api/conversations${selectedDropId ? `?dropId=${selectedDropId}` : ""}`),
    ]);
    startTransition(() => {
      setState(stateData);
      setLoop(loopData.loop);
      setObservability(observabilityData);
      setPackets(packetData.packets || []);
      setProposals(proposalData.proposals || []);
      setConversations(conversationData.messages || []);
      setSelectedDropId((current) => current && stateData.drops.some((drop) => drop.dropId === current) ? current : "");
    });
  }, [selectedDropId]);

  useEffect(() => {
    refresh().catch((error) => window.alert(String(error)));
  }, [refresh]);

  const visibleDrops = state?.drops?.filter((drop) => drop.lifecycleState !== "archived") || [];
  const selectedDrop = visibleDrops.find((drop) => drop.dropId === selectedDropId) || null;
  const latestAutomation = observability?.automationTasks?.[0] || state?.automationTasks?.[0] || null;
  const latestVerify = state?.verifyReports?.[0] || null;
  const latestVerifyCycle = state?.verifyCycles?.[0] || null;
  const latestPacket = packets[0] || null;
  const latestProposal = proposals[0] || null;

  useEffect(() => {
    const goal = visibleDrops.find((drop) => drop.type === "goal-origin");
    setGoalDraft(goal?.summary || "");
  }, [visibleDrops]);

  useEffect(() => {
    setEditedSummary(selectedDrop?.summary || "");
    setConnectTargetId("");
  }, [selectedDrop?.dropId, selectedDrop?.summary]);

  if (!state || !loop) {
    return e("div", { className: "booting" }, t.booting);
  }

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
      window.alert(t.materialHint);
      return;
    }
    await Promise.all(tasks);
    setAssetInput("");
    setQueuedFiles([]);
    await refresh();
  }

  async function handleGoalStatus(status) {
    await api("/api/goal", {
      method: "PUT",
      body: JSON.stringify({ summary: goalDraft, status }),
    });
    await refresh();
  }

  async function handleGoalDraft() {
    await api("/api/goal/draft", { method: "POST" });
    await refresh();
  }

  async function handlePrimaryAction() {
    if (!loop?.primaryAction) {
      return;
    }
    switch (loop.primaryAction.key) {
      case "add-material":
        await handleAddAssets();
        break;
      case "confirm-goal":
        await handleGoalStatus("confirmed");
        break;
      case "accept-direction":
        await api("/api/assistant-loop/accept", {
          method: "POST",
          body: JSON.stringify({ note: "ui.accept-direction" }),
        });
        await refresh();
        break;
      default:
        await api("/api/assistant-loop", {
          method: "POST",
          body: JSON.stringify({ trigger: "ui.primary-action" }),
        });
        await refresh();
        break;
    }
  }

  async function handleFileInput(event) {
    const files = Array.from(event.target.files || []);
    const loaded = await Promise.all(files.map(async (file) => ({
      name: file.name,
      type: file.type,
      content: await summarizeFileForAsset(file),
    })));
    setQueuedFiles((current) => [...current, ...loaded]);
    event.target.value = "";
  }

  async function handleSaveSummary() {
    if (!selectedDrop) {
      return;
    }
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

  async function runManual(path, trigger) {
    await api(path, { method: "POST", body: JSON.stringify(trigger ? { trigger } : {}) });
    await refresh();
  }

  return e("div", { className: "app-shell" },
    e("header", { className: "hero-card" },
      e("div", { className: "hero-top" },
        e("div", null,
          e("div", { className: "kicker" }, "phonowell"),
          e("h1", { className: "hero-title" }, loop.statusLabel),
          e("p", { className: "hero-subtitle" }, loop.summary || t.subtitle),
        ),
        e("button", {
          className: "ghost small-button",
          onClick: () => setLanguage((value) => value === "zh" ? "en" : "zh"),
          type: "button",
        }, `${t.language}: ${language === "zh" ? t.languageEn : t.languageZh}`),
      ),
      e("div", { className: "hero-status-row" },
        e("span", { className: statusClass(loop.status) }, loop.statusLabel),
        loop.latestResult ? e("span", { className: statusClass(loop.latestResult.label) }, `${t.trust}: ${loop.latestResult.label}`) : null,
        state.project?.name ? e("span", { className: statusClass("neutral") }, state.project.name) : null,
      ),
      e("div", { className: "hero-grid" },
        e("article", { className: "hero-block" },
          e("div", { className: "hero-label" }, t.currentGoal),
          e("div", { className: "hero-value" }, loop.currentGoalSummary || t.noGoal),
        ),
        e("article", { className: "hero-block" },
          e("div", { className: "hero-label" }, t.currentArtifact),
          e("div", { className: "hero-value" }, loop.latestArtifact?.excerpt || t.noArtifact),
        ),
        e("article", { className: "hero-block" },
          e("div", { className: "hero-label" }, t.nextCheckpoint),
          e("div", { className: "hero-value" }, loop.nextCheckpoint?.title || t.noCheckpoint),
          e("div", { className: "hero-note" }, loop.nextCheckpoint?.summary || ""),
        ),
      ),
      e("button", { className: "primary-cta", onClick: handlePrimaryAction, type: "button" }, loop.primaryAction.label),
      e("p", { className: "primary-detail" }, `${t.primaryAction}: ${loop.primaryAction.detail}`),
    ),
    e("section", { className: "default-grid" },
      e("article", { className: "panel" },
        e("div", { className: "panel-title" }, t.materialTitle),
        e("p", { className: "panel-hint" }, t.materialHint),
        e("textarea", {
          className: "panel-textarea",
          value: assetInput,
          onChange: (event) => setAssetInput(event.target.value),
          rows: 7,
          placeholder: t.materialPlaceholder,
        }),
        e("label", { className: "file-picker" },
          t.queuedFiles,
          e("input", { type: "file", multiple: true, onChange: handleFileInput }),
        ),
        e("div", { className: "file-queue" },
          queuedFiles.length
            ? queuedFiles.map((file, index) => e("span", { key: `${file.name}-${index}`, className: "file-chip" }, file.name))
            : e("span", { className: "muted-note" }, t.noFiles),
        ),
        e("button", { className: "ghost", onClick: handleAddAssets, type: "button" }, t.addMaterial),
      ),
      e("article", { className: "panel" },
        e("div", { className: "panel-title" }, t.goalTitle),
        e("p", { className: "panel-hint" }, t.goalHint),
        e("textarea", {
          className: "panel-textarea",
          value: goalDraft,
          onChange: (event) => setGoalDraft(event.target.value),
          rows: 7,
          placeholder: t.goalPlaceholder,
        }),
        e("div", { className: "button-row" },
          e("button", { className: "ghost", onClick: handleGoalDraft, type: "button" }, t.draftGoal),
          e("button", { className: "ghost", onClick: () => handleGoalStatus("revised"), type: "button" }, t.reviseGoal),
          e("button", { className: "ghost", onClick: () => handleGoalStatus("confirmed"), type: "button" }, t.confirmGoal),
        ),
      ),
      e("article", { className: "panel" },
        e("div", { className: "panel-title" }, t.artifactTitle),
        e("p", { className: "panel-hint" }, t.artifactHint),
        loop.latestArtifact
          ? e(React.Fragment, null,
              e("div", { className: "artifact-excerpt" }, loop.latestArtifact.excerpt),
              e("div", { className: "meta-list" },
                e("span", null, `${t.artifactCoverage}: ${loop.latestArtifact.coverageDropCount}`),
                loop.latestArtifact.acceptedAt ? e("span", null, `${t.acceptedAt}: ${loop.latestArtifact.acceptedAt}`) : null,
                e("span", null, loop.latestArtifact.createdAt),
              ),
            )
          : e("div", { className: "empty-state" }, t.noArtifact),
        loop.latestResult
          ? e("div", { className: "result-summary" },
              e("div", { className: "result-label" }, `${t.resultSummary}: ${loop.latestResult.label}`),
              e("div", null, loop.latestResult.summary),
            )
          : null,
      ),
      e("article", { className: "panel" },
        e("div", { className: "panel-title" }, t.checkpointTitle),
        e("p", { className: "panel-hint" }, t.checkpointHint),
        loop.reviewCheckpoints.length
          ? e("div", { className: "checkpoint-list" },
              loop.reviewCheckpoints.map((checkpoint) => e("div", { key: checkpoint.checkpointId, className: "checkpoint-card" },
                e("div", { className: "checkpoint-title" }, checkpoint.title),
                e("div", { className: "checkpoint-summary" }, checkpoint.summary),
                e("div", { className: "checkpoint-meta" }, `${checkpoint.nextAction.label} · ${checkpoint.source}`),
              )),
            )
          : e("div", { className: "empty-state" }, t.noReview),
      ),
    ),
    e("details", { className: "diagnostics-shell" },
      e("summary", null, t.diagnostics),
      e("p", { className: "panel-hint diagnostics-hint" }, t.diagnosticsHint),
      e("section", { className: "diagnostics-grid" },
        e("article", { className: "panel diagnostics-panel" },
          e("div", { className: "panel-title" }, t.manualControls),
          e("div", { className: "button-row" },
            e("button", { className: "ghost", onClick: () => runManual("/api/deep-organize", "ui.manual.organize"), type: "button" }, t.organize),
            e("button", { className: "ghost", onClick: () => runManual("/api/dry-run"), type: "button" }, t.preflight),
            e("button", { className: "ghost", onClick: () => runManual("/api/generate"), type: "button" }, t.generate),
            e("button", { className: "ghost", onClick: () => runManual("/api/verify"), type: "button" }, t.verify),
          ),
          e("div", { className: "meta-stack" },
            e("div", null, `${t.status}: ${loop.statusLabel}`),
            e("div", null, `${t.packetSummary}: ${latestPacket?.response?.summary || "-"}`),
            e("div", null, `${t.proposalSummary}: ${latestProposal?.summary || "-"}`),
          ),
        ),
        e("article", { className: "panel diagnostics-panel" },
          e("div", { className: "panel-title" }, t.materials),
          e("div", { className: "material-list" },
            visibleDrops.map((drop) => e("button", {
              key: drop.dropId,
              className: `material-item ${selectedDropId === drop.dropId ? "selected" : ""}`,
              onClick: () => setSelectedDropId(drop.dropId),
              type: "button",
            },
            e("div", { className: "material-title" }, drop.title),
            e("div", { className: "material-meta" }, `${drop.type} · ${drop.layer} · ${drop.priority}`),
            )),
          ),
          selectedDrop
            ? e("div", { className: "selected-panel" },
                e("div", { className: "panel-title minor" }, selectedDrop.title),
                e("textarea", {
                  className: "panel-textarea compact",
                  value: editedSummary,
                  onChange: (event) => setEditedSummary(event.target.value),
                  rows: 4,
                }),
                e("button", { className: "ghost", onClick: handleSaveSummary, type: "button" }, t.saveSummary),
                e("div", { className: "panel-title minor" }, t.connectRelation),
                e("select", { className: "panel-select", value: connectTargetId, onChange: (event) => setConnectTargetId(event.target.value) },
                  e("option", { value: "" }, t.noSelection),
                  visibleDrops.filter((drop) => drop.dropId !== selectedDrop.dropId)
                    .map((drop) => e("option", { key: drop.dropId, value: drop.dropId }, drop.title)),
                ),
                e("select", { className: "panel-select", value: connectType, onChange: (event) => setConnectType(event.target.value) },
                  ["references", "supports", "implements", "constrains", "derives"].map((item) => e("option", { key: item, value: item }, item)),
                ),
                e("button", { className: "ghost", onClick: handleConnectRelation, type: "button" }, t.connectRelation),
              )
            : e("div", { className: "empty-state" }, t.selectMaterial),
        ),
        e("article", { className: "panel diagnostics-panel" },
          e("div", { className: "panel-title" }, t.conversation),
          selectedDrop ? e("div", { className: "meta-list" }, e("span", null, `${t.activeMaterial}: ${selectedDrop.title}`)) : null,
          e("div", { className: "conversation-list" },
            conversations.length
              ? conversations.map((item) => e("div", { key: item.messageId, className: `conversation-item ${item.role}` },
                  e("div", { className: "conversation-role" }, `${item.scope} · ${item.role}`),
                  e("div", { className: "conversation-content" }, item.content),
                ))
              : e("div", { className: "empty-state" }, t.noConversations),
          ),
          e("textarea", {
            className: "panel-textarea compact",
            value: llmInput,
            onChange: (event) => setLlmInput(event.target.value),
            rows: 4,
            placeholder: selectedDrop ? t.conversationPlaceholderAsset : t.conversationPlaceholderGlobal,
          }),
          e("button", { className: "ghost", onClick: handleSend, type: "button" }, t.send),
        ),
        e("article", { className: "panel diagnostics-panel" },
          e("div", { className: "panel-title" }, t.rawRuntime),
          e("div", { className: "panel-title minor" }, t.automation),
          latestAutomation?.decisions?.length
            ? e("div", { className: "checkpoint-list compact-list" },
                latestAutomation.decisions.map((decision) => e("div", { key: decision.decisionId, className: "checkpoint-card" },
                  e("div", { className: "checkpoint-title" }, `${decision.kind} · ${decision.approvalClass}`),
                  e("div", { className: "checkpoint-summary" }, decision.proposedValue),
                  e("div", { className: "checkpoint-meta" }, `${decision.confidence} · ${decision.applied ? "applied" : "deferred"}`),
                )),
              )
            : e("div", { className: "empty-state" }, t.noAutomation),
          e("div", { className: "panel-title minor" }, t.acceptance),
          latestVerify?.acceptanceItems?.length
            ? e("div", { className: "checkpoint-list compact-list" },
                latestVerify.acceptanceItems.map((item) => e("div", { key: item.itemId, className: "checkpoint-card" },
                  e("div", { className: "checkpoint-title" }, `${item.title} · ${item.status}`),
                  e("div", { className: "checkpoint-summary" }, item.uncoveredReason || item.evidence.map((entry) => `${entry.kind}:${entry.ref}`).join(", ") || "-"),
                )),
              )
            : e("div", { className: "empty-state" }, t.noAcceptance),
          latestVerifyCycle ? e("div", { className: "meta-stack" },
            e("div", null, `${t.status}: ${latestVerifyCycle.routeExecution?.route || "-"}`),
            e("div", null, `${t.evidence}: ${(latestVerifyCycle.routeExecution?.evidence || []).join(" | ") || "-"}`),
          ) : null,
        ),
      ),
    ),
  );
}

createRoot(document.getElementById("app")).render(e(App));
