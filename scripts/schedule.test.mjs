import test from "node:test";
import assert from "node:assert/strict";
import { eventWhen, meetingRoom, nextEvent } from "../src/lib/schedule.ts";

const list = [
  { id: "a", title: "Work session", type: "meeting", starts_at: "2026-09-10T13:30:00-06:00", room: "Room A", room_confirmed: false },
  { id: "b", title: "Work session", type: "meeting", starts_at: "2026-09-17T13:30:00-06:00", room: "Room B", room_confirmed: true },
  { id: "c", title: "Fall showcase", type: "showcase", starts_at: "2026-12-03T13:30:00-07:00", room: "Union", room_confirmed: false },
];

test("nextEvent is the earliest event still ahead, or null", () => {
  assert.equal(nextEvent(new Date("2026-09-12T00:00:00Z"), list)?.id, "b");
  assert.equal(nextEvent(new Date("2026-11-10T00:00:00Z"), list)?.id, "c");
  assert.equal(nextEvent(new Date("2027-01-01T00:00:00Z"), list), null);
});

test("meetingRoom is the latest meeting's room", () => {
  assert.deepEqual(meetingRoom(list), { room: "Room B", confirmed: true });
  assert.equal(meetingRoom([]), null);
});

test("eventWhen shows Utah time", () => {
  assert.equal(eventWhen(list[2]), "Thu, Dec 3, 1:30 pm");
});
