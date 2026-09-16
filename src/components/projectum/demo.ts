// Demo data for Projectum: the people you can add to a project until accounts
// can be searched. The people are made up.

import { copy } from "@/content/copy";
import type { Person } from "@/lib/projects";

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const DIRECTORY: Person[] = copy.projectum.demo.directory.map((name) => ({
  id: `demo-${slug(name)}`,
  name,
  role: null,
}));
