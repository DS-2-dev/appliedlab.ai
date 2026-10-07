// Role presets for Projectum projects: the name and default meaning come from
// copy, the colour from here. A project can reword a meaning; the name and
// colour stay fixed so a role reads the same everywhere. No purple, by the
// Projectum rule.

import { copy } from "@/content/copy";
import { ROLE_IDS, type Project, type RoleId } from "@/lib/projects";

export const ROLE_STYLE: Record<RoleId, { ring: string; dot: string }> = {
  manager: { ring: "ring-amber-500", dot: "bg-amber-500" },
  uiux: { ring: "ring-pink-500", dot: "bg-pink-500" },
  frontend: { ring: "ring-cyan-500", dot: "bg-cyan-500" },
  backend: { ring: "ring-blue-600", dot: "bg-blue-600" },
  data: { ring: "ring-orange-600", dot: "bg-orange-600" },
  qa: { ring: "ring-lime-500", dot: "bg-lime-500" },
  communication: { ring: "ring-green-600", dot: "bg-green-600" },
};

export const roleName = (id: RoleId) => copy.projectum.roles[id].name;

export function defaultMeanings(): Record<RoleId, string> {
  return Object.fromEntries(ROLE_IDS.map((id) => [id, copy.projectum.roles[id].meaning])) as Record<RoleId, string>;
}

export function projectMeanings(project: Project): Record<RoleId, string> {
  return { ...defaultMeanings(), ...project.roleMeanings };
}
