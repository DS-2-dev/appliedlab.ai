"use client";

// The Admins' categories: the disciplines (and tags, once there are any)
// postings are filed under. Add one, rename or describe it, move it up or
// down, archive or restore it. A slug is fixed when a term is made.

import * as React from "react";
import { copy } from "@/content/copy";
import { send, useApi } from "@/components/projectum/pipeline-store";
import { LoadError, Loading } from "@/components/projectum/pipeline-ui";
import { ApiError } from "@/lib/account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const C = copy.projectum.pipeline.overview.categories;

type Kind = "discipline" | "tag";
type Term = { id: string; kind: Kind; slug: string; name: string; description: string; active: boolean; position: number };

// Runs a change, and says so if the Worker refused it.
function useAction() {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const run = async (path: string, method: string, body: unknown) => {
    setBusy(true);
    setFailed(null);
    try {
      await send(path, method, body);
      return true;
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 409 ? C.duplicate : C.failed);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, failed, run };
}

function TermRow({ term, prev, next }: { term: Term; prev?: Term; next?: Term }) {
  const [name, setName] = React.useState(term.name);
  const [description, setDescription] = React.useState(term.description);
  const { busy, failed, run } = useAction();
  const dirty = name.trim() !== term.name || description.trim() !== term.description;
  // Moving swaps positions with the neighbour.
  const swap = async (other: Term) => {
    if (await run(`/taxonomy/${other.id}`, "PATCH", { position: term.position })) {
      await run(`/taxonomy/${term.id}`, "PATCH", { position: other.position });
    }
  };
  return (
    <li className="grid gap-1" data-category={term.slug}>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={C.name} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="w-48" />
        <Input
          aria-label={C.description}
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
          className="min-w-48 flex-1"
        />
        <Button
          size="sm"
          disabled={busy || !dirty || !name.trim()}
          onClick={() => void run(`/taxonomy/${term.id}`, "PATCH", { name: name.trim(), description: description.trim() })}
        >
          {C.save}
        </Button>
        <Button size="sm" variant="outline" aria-label={C.moveUp(term.name)} disabled={busy || !prev} onClick={() => prev && void swap(prev)}>
          ↑
        </Button>
        <Button size="sm" variant="outline" aria-label={C.moveDown(term.name)} disabled={busy || !next} onClick={() => next && void swap(next)}>
          ↓
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(`/taxonomy/${term.id}`, "PATCH", { active: !term.active })}>
          {term.active ? C.archive : C.restore}
        </Button>
        {!term.active && <Badge variant="secondary">{C.archived}</Badge>}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      )}
    </li>
  );
}

function AddTerm({ kind }: { kind: Kind }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const { busy, failed, run } = useAction();
  const add = async () => {
    if (await run("/taxonomy", "POST", { kind, name: name.trim(), description: description.trim() })) {
      setName("");
      setDescription("");
    }
  };
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <Input aria-label={C.nameLabel} placeholder={C.name} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="w-48" />
      <Input
        aria-label={C.descriptionLabel}
        placeholder={C.description}
        value={description}
        maxLength={300}
        onChange={(e) => setDescription(e.target.value)}
        className="min-w-48 flex-1"
      />
      <Button type="submit" size="sm" disabled={busy || !name.trim()}>
        {C.add}
      </Button>
      {failed && (
        <p role="alert" className="w-full text-sm text-destructive">
          {failed}
        </p>
      )}
    </form>
  );
}

export function CategoriesAdmin() {
  const { data, error, retry } = useApi<{ disciplines: Term[]; tags: Term[] }>("/taxonomy?all=1");
  if (error && !data) return <LoadError retry={retry} />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-6">
      {([["discipline", C.disciplines, data.disciplines], ["tag", C.tags, data.tags]] as const).map(([kind, title, terms]) => (
        <section key={kind} className="grid gap-3" aria-label={title}>
          <h3 className="font-medium">{title}</h3>
          {terms.length ? (
            <ul className="grid gap-3">
              {terms.map((t, i) => (
                <TermRow key={`${t.id}:${t.name}:${t.description}`} term={t} prev={terms[i - 1]} next={terms[i + 1]} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{C.noneYet}</p>
          )}
          <AddTerm kind={kind} />
        </section>
      ))}
    </div>
  );
}
