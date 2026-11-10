"use client";

// When and where the Lab meets, under the landing's intro: the weekly time
// and room, then the next dated meeting or event. The schedule is data
// (src/lib/schedule.ts); the next event is worked out in the browser, so a
// static build never shows one that has passed.

import * as React from "react";
import { copy } from "@/content/copy";
import { eventWhen, meetingRoom, nextEvent, weekly } from "@/lib/schedule";
import { INK } from "@/components/home/SiteFrame";

const M = copy.home.meetings;
const subscribeNever = () => () => {};
// The time the page opened, read once so every render agrees.
let opened = 0;
const openedAt = () => (opened ||= Date.now());

export function Meetings() {
  // Null on the server and in the first render, so hydration matches.
  const now = React.useSyncExternalStore(subscribeNever, openedAt, () => null);
  const next = now === null ? null : nextEvent(new Date(now));
  const room = meetingRoom();
  return (
    <dl className="grid max-w-[300px] gap-3 text-sm/[17px]">
      <div>
        <dt className={INK}>{M.label}</dt>
        <dd className="mt-0.5 font-medium text-[#737378]">
          {weekly}
          {room && (
            <>
              <br />
              {room.room}
              {!room.confirmed && ` ${M.unconfirmed}`}
            </>
          )}
        </dd>
      </div>
      {next && (
        <div>
          <dt className={INK}>{M.next}</dt>
          <dd className="mt-0.5 font-medium text-[#737378]">
            {next.title}, {eventWhen(next)}
          </dd>
        </div>
      )}
    </dl>
  );
}
