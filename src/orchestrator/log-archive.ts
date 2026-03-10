import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectState, RunLog, RunLogStateSummary, WellState } from "./types.js";
import { buildRunLogStateSummary, extractRunLogStateSummary, stripRunLogStateSummary } from "./run-log-state.js";

const LOG_ARCHIVE_SCHEMA_VERSION = "1.0.0";

interface RunEventArchiveCursor {
  schemaVersion: typeof LOG_ARCHIVE_SCHEMA_VERSION;
  lastRunId?: string;
  lastCreatedAt?: string;
}

export interface PersistedRunEvent {
  schemaVersion: typeof LOG_ARCHIVE_SCHEMA_VERSION;
  eventType: "run-log";
  projectId: string;
  projectSlug: string;
  wellId: string;
  runId: string;
  stage: RunLog["stage"];
  status: RunLog["status"];
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  archivedAt: string;
  stateSummary: RunLogStateSummary;
}

function logsDir(project: ProjectState): string {
  return join(project.workdir, "logs");
}

export function runEventLogFile(project: ProjectState): string {
  return join(logsDir(project), "run-events.jsonl");
}

export function runEventCursorFile(project: ProjectState): string {
  return join(logsDir(project), "run-events.cursor.json");
}

function ensureLogsDir(project: ProjectState): void {
  mkdirSync(logsDir(project), { recursive: true });
}

function readCursor(project: ProjectState): RunEventArchiveCursor {
  const file = runEventCursorFile(project);
  if (!existsSync(file)) {
    return { schemaVersion: LOG_ARCHIVE_SCHEMA_VERSION };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<RunEventArchiveCursor>;
    return {
      schemaVersion: LOG_ARCHIVE_SCHEMA_VERSION,
      lastRunId: typeof parsed.lastRunId === "string" ? parsed.lastRunId : undefined,
      lastCreatedAt: typeof parsed.lastCreatedAt === "string" ? parsed.lastCreatedAt : undefined,
    };
  } catch {
    return { schemaVersion: LOG_ARCHIVE_SCHEMA_VERSION };
  }
}

function writeCursor(project: ProjectState, log: RunLog | undefined): void {
  if (!log) {
    return;
  }
  ensureLogsDir(project);
  writeFileSync(runEventCursorFile(project), JSON.stringify({
    schemaVersion: LOG_ARCHIVE_SCHEMA_VERSION,
    lastRunId: log.runId,
    lastCreatedAt: log.createdAt,
  }, null, 2), "utf8");
}

function selectLogsToArchive(runLogs: RunLog[], cursor: RunEventArchiveCursor): RunLog[] {
  if (runLogs.length === 0) {
    return [];
  }

  if (!cursor.lastRunId && !cursor.lastCreatedAt) {
    return [...runLogs].reverse();
  }

  const unseen: RunLog[] = [];
  let foundCursor = false;
  for (const log of runLogs) {
    if (cursor.lastRunId && log.runId === cursor.lastRunId) {
      foundCursor = true;
      break;
    }
    unseen.push(log);
  }
  if (foundCursor) {
    return unseen.reverse();
  }

  const lastCreatedAt = cursor.lastCreatedAt;
  return runLogs
    .filter((log) => {
      if (!lastCreatedAt) {
        return true;
      }
      if (log.createdAt > lastCreatedAt) {
        return true;
      }
      return log.createdAt === lastCreatedAt && log.runId !== cursor.lastRunId;
    })
    .reverse();
}

function toPersistedRunEvent(project: ProjectState, state: WellState, log: RunLog, archivedAt: string): PersistedRunEvent {
  return {
    schemaVersion: LOG_ARCHIVE_SCHEMA_VERSION,
    eventType: "run-log",
    projectId: project.projectId,
    projectSlug: project.slug,
    wellId: state.well.id,
    runId: log.runId,
    stage: log.stage,
    status: log.status,
    summary: log.summary,
    payload: stripRunLogStateSummary(log.payload),
    createdAt: log.createdAt,
    archivedAt,
    stateSummary: extractRunLogStateSummary(log.payload) ?? buildRunLogStateSummary(state),
  };
}

export function archiveRunLogs(project: ProjectState, state: WellState): { file: string; appendedCount: number } {
  ensureLogsDir(project);
  const file = runEventLogFile(project);
  const cursor = readCursor(project);
  const nextLogs = selectLogsToArchive(state.runLogs, cursor);
  if (nextLogs.length === 0) {
    writeCursor(project, state.runLogs[0]);
    return { file, appendedCount: 0 };
  }

  const archivedAt = new Date().toISOString();
  const lines = nextLogs
    .map((log) => JSON.stringify(toPersistedRunEvent(project, state, log, archivedAt)))
    .join("\n");
  appendFileSync(file, `${lines}\n`, "utf8");
  writeCursor(project, state.runLogs[0]);
  return { file, appendedCount: nextLogs.length };
}
