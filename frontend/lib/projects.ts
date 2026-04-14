export type Project = {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
};

const API_BASE = "/api/projects";
const ACTIVE_PROJECT_KEY = "bagana_active_project_id";

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (!id) localStorage.removeItem(ACTIVE_PROJECT_KEY);
  else localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(API_BASE, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? (data as Project[]) : [];
}

export async function createProject(name: string): Promise<Project> {
  const res = await fetch(API_BASE, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Project;
}

export async function renameProject(id: string, name: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}

