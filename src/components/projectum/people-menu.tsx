"use client";

// "Add person": picks someone from the demo directory who is not on the
// project yet. Shared by the Add Project and Solidifying forms.

import { UserPlus } from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import type { Person } from "@/lib/projects";
import { DIRECTORY } from "@/components/projectum/demo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const F = copy.projectum.form;

export function AddPersonMenu({ people, onAdd }: { people: Person[]; onAdd: (person: Person) => void }) {
  const available = DIRECTORY.filter((d) => !people.some((p) => p.id === d.id));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" disabled={available.length === 0} />}>
        <UserPlus />
        {available.length ? F.addPerson : F.everyoneAdded}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {available.map((person) => (
          <DropdownMenuItem key={person.id} onClick={() => onAdd({ ...person, role: null })}>
            <Avatar size="sm">
              <AvatarFallback>{initials(person.name)}</AvatarFallback>
            </Avatar>
            {person.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
