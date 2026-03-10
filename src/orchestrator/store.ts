import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { engine } from "./index.js";
import { PhonoWellEngine } from "./engine.js";
import type { ProjectState, ProjectSummary, WellState } from "./types.js";
import { normalizeAndValidateState } from "./validator.js";
import { resolveFromWorkspaceRoot } from "../runtime-paths.js";
import { archiveRunLogs } from "./log-archive.js";

function workdirRoot(): string {
  return resolveFromWorkspaceRoot(".phonowell");
}

function projectsRoot(): string {
  return join(workdirRoot(), "projects");
}

function activeProjectFile(): string {
  return join(workdirRoot(), "active-project.json");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function assertValidProjectSlug(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`invalid project slug: ${slug}`);
  }
  return slug;
}

function projectDir(slug: string): string {
  return join(projectsRoot(), slug);
}

function stateFileForProject(slug: string): string {
  return join(projectDir(slug), "state.json");
}

function metaFileForProject(slug: string): string {
  return join(projectDir(slug), "project.json");
}

function readJsonFile<T>(file: string): T | undefined {
  if (!existsSync(file)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function isProjectState(item: ProjectState | undefined): item is ProjectState {
  return item !== undefined && !item.deletedAt;
}

function writeJsonFile(file: string, value: unknown): void {
  ensureDir(resolve(file, ".."));
  writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function persistStateForProject(project: ProjectState, state: WellState): WellState {
  state.project = project;
  const normalized = normalizeAndValidateState(state);
  writeJsonFile(stateFileForProject(project.slug), normalized);
  archiveRunLogs(project, normalized);
  return normalized;
}

function buildFreshProjectState(project: ProjectState): WellState {
  const freshEngine = new PhonoWellEngine();
  freshEngine.setProject(project);
  freshEngine.bootstrapInitialState();
  const state = freshEngine.getState();
  state.project = project;
  return normalizeAndValidateState(state);
}

function defaultProject(): ProjectState {
  const createdAt = new Date().toISOString();
  const slug = "main";
  return {
    projectId: "project-main",
    name: "Main",
    slug,
    workdir: projectDir(slug),
    createdAt,
    updatedAt: createdAt,
  };
}

function ensureProjectWorkspace(project: ProjectState): void {
  ensureDir(project.workdir);
  writeJsonFile(metaFileForProject(project.slug), project);
}

export function ensureWorkdirRoot(): string {
  ensureDir(projectsRoot());
  return workdirRoot();
}

export function getActiveProject(): ProjectState {
  ensureWorkdirRoot();
  const activeFile = activeProjectFile();
  const active = readJsonFile<ProjectState>(activeFile);
  if (active) {
    ensureProjectWorkspace(active);
    return active;
  }
  const project = defaultProject();
  ensureProjectWorkspace(project);
  writeJsonFile(activeFile, project);
  return project;
}

export function listProjects(): ProjectSummary[] {
  ensureWorkdirRoot();
  const root = projectsRoot();
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root)
    .map((slug) => metaFileForProject(slug))
    .filter((file) => existsSync(file))
    .map((file) => readJsonFile<ProjectState>(file))
    .filter(isProjectState)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ projectId, name, slug, workdir, createdAt, updatedAt }) => ({
      projectId,
      name,
      slug,
      workdir,
      createdAt,
      updatedAt,
    }));
}

export function createProject(name: string): ProjectState {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 2;
  while (existsSync(projectDir(slug))) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  const createdAt = new Date().toISOString();
  const project: ProjectState = {
    projectId: `project-${slug}`,
    name: name.trim() || "Untitled Project",
    slug,
    workdir: projectDir(slug),
    createdAt,
    updatedAt: createdAt,
  };
  ensureProjectWorkspace(project);
  persistStateForProject(project, buildFreshProjectState(project));
  writeJsonFile(activeProjectFile(), project);
  return project;
}

export function switchProject(slug: string): ProjectState {
  const safeSlug = assertValidProjectSlug(slug);
  const project = readJsonFile<ProjectState>(metaFileForProject(safeSlug));
  if (!project || project.deletedAt) {
    throw new Error(`project not found: ${safeSlug}`);
  }
  project.updatedAt = new Date().toISOString();
  ensureProjectWorkspace(project);
  writeJsonFile(activeProjectFile(), project);
  return project;
}

export function deleteProject(slug: string): { deleted: boolean; activeProject: ProjectState } {
  const safeSlug = assertValidProjectSlug(slug);
  const active = getActiveProject();
  if (active.slug === safeSlug && listProjects().length <= 1) {
    throw new Error("cannot delete the only project");
  }

  const dir = projectDir(safeSlug);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`project not found: ${safeSlug}`);
  }
  rmSync(dir, { recursive: true, force: true });

  const remaining = listProjects();
  const next = remaining[0] ? switchProject(remaining[0].slug) : (() => {
    const created = defaultProject();
    ensureProjectWorkspace(created);
    persistStateForProject(created, buildFreshProjectState(created));
    writeJsonFile(activeProjectFile(), created);
    return created;
  })();

  return { deleted: true, activeProject: next };
}

export function loadPersistedState(): WellState | undefined {
  const project = getActiveProject();
  const stored = readJsonFile<WellState>(stateFileForProject(project.slug));
  if (!stored) {
    return undefined;
  }
  stored.project = project;
  return normalizeAndValidateState(stored);
}

export function persistCurrentState(): void {
  const project = getActiveProject();
  persistStateForProject(project, engine.getState());
}
