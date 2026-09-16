"use client";

// One public form surface with audience-specific fields.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { JoinForm } from "./JoinForm";
import { InquiryForm } from "./InquiryForm";

const A = copy.join.audience;

type Audience = "student" | "faculty" | "organization";

export function AudienceSwitch({
  formsLive,
  followupDays,
  initial,
}: {
  formsLive: boolean;
  followupDays: number;
  initial?: Audience;
}) {
  const [who, setWho] = useState<Audience>(initial ?? "student");

  return (
    <div className="form-surface w-full max-w-3xl rounded-[var(--radius-image)] border border-line-inverse bg-ground-inverse p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.65)] md:p-6">
      <p className="font-sans text-sm font-medium">{A.label}</p>
      <div
        role="group"
        aria-label={A.label}
        className="mt-2 grid w-full grid-cols-3 rounded-[12px] bg-[#27272a] p-1"
      >
        {A.options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={who === o.id}
            onClick={() => setWho(o.id as Audience)}
            className={`min-w-0 rounded-[8px] border px-1 py-1.5 font-sans text-xs leading-5 transition-colors sm:px-3 sm:text-sm ${
              who === o.id
                ? "border-brand bg-[#3a2148] font-medium text-brand-inverse shadow-sm"
                : "border-transparent bg-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {who === "student" && (
          <div>
            <p className="text-sm">
              <Link
                href={copy.join.roleLinks.student.href}
                className="inline-flex items-center gap-1.5 font-medium text-brand-inverse underline-offset-4 hover:underline"
              >
                {copy.join.roleLinks.student.label}
                <ArrowRight aria-hidden className="link-arrow size-3.5 shrink-0" />
              </Link>
            </p>
            <div className="mt-3">
              <JoinForm formsLive={formsLive} />
            </div>
          </div>
        )}
        {who === "faculty" && (
          <div>
            <p className="text-sm">
              <Link
                href={copy.join.roleLinks.faculty.href}
                className="inline-flex items-center gap-1.5 font-medium text-brand-inverse underline-offset-4 hover:underline"
              >
                {copy.join.roleLinks.faculty.label}
                <ArrowRight aria-hidden className="link-arrow size-3.5 shrink-0" />
              </Link>
            </p>
            <div className="mt-3">
              <InquiryForm
                kind="representative"
                text={copy.faculty.start}
                formsLive={formsLive}
                followupDays={followupDays}
                mailSubject={copy.faculty.start.mailSubject}
              />
            </div>
          </div>
        )}
        {who === "organization" && (
          <div>
            <p className="text-sm">
              <Link
                href={copy.join.roleLinks.organization.href}
                className="inline-flex items-center gap-1.5 font-medium text-brand-inverse underline-offset-4 hover:underline"
              >
                {copy.join.roleLinks.organization.label}
                <ArrowRight aria-hidden className="link-arrow size-3.5 shrink-0" />
              </Link>
            </p>
            <div className="mt-3">
              <InquiryForm
                kind="casework"
                text={copy.partners.start}
                formsLive={formsLive}
                followupDays={followupDays}
                mailSubject={copy.partners.start.mailSubject}
              />
            </div>
          </div>
        )}
      </div>

      <p className="form-muted mt-5 border-t border-line-inverse pt-3 text-sm">
        {copy.join.justLooking.text}{" "}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-medium text-brand-inverse underline-offset-4 hover:underline"
        >
          {copy.join.justLooking.cta}
          <ArrowRight aria-hidden className="link-arrow size-3.5 shrink-0" />
        </Link>
      </p>
    </div>
  );
}
