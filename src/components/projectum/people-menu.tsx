"use client";

// "Add person": picks a Lab member or rep who is not on the project yet.
// Shared by the Add Project and Solidifying forms.

import { UserPlus } from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import type { Person } from "@/lib/projects";
import { usePeople } from "@/components/projectum/people-store";
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
  const everyone = usePeople();
  const available = (everyone ?? []).filter((d) => !people.some((p) => p.id === d.id));
  // While the list loads, the button stays off but keeps its label.
  const label = everyone && available.length === 0 ? F.everyoneAdded : F.addPerson;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" disabled={available.length === 0} />}>
        <UserPlus />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
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
