// The one data seam. Pages, forms, and admin all import from here and never
// care which store is behind it. Supabase wins when its env vars exist;
// otherwise the local JSON store (data/) serves dev and preview.

import * as local from "./local";
import * as supa from "./supabase";
import { hasSupabase } from "./supabase";

const impl = () => (hasSupabase() ? supa : local);

export const getEvents = () => impl().getEvents();
export const getEvent = (id: string) => impl().getEvent(id);
export const createEvent: typeof local.createEvent = (i) => impl().createEvent(i);
export const updateEvent: typeof local.updateEvent = (id, p) =>
  impl().updateEvent(id, p);
export const deleteEvent = (id: string) => impl().deleteEvent(id);
export const getSettings = () => impl().getSettings();
export const updateSettings: typeof local.updateSettings = (p) =>
  impl().updateSettings(p);
export const createInquiry: typeof local.createInquiry = (i) =>
  impl().createInquiry(i);
export const listInquiries = () => impl().listInquiries();
export const updateInquiry: typeof local.updateInquiry = (id, p) =>
  impl().updateInquiry(id, p);
export const listShowcasePublic = () => impl().listShowcasePublic();
export const listShowcaseAdmin = () => impl().listShowcaseAdmin();
export const createShowcaseEntry: typeof local.createShowcaseEntry = (i) =>
  impl().createShowcaseEntry(i);
export const updateShowcaseEntry: typeof local.updateShowcaseEntry = (id, p) =>
  impl().updateShowcaseEntry(id, p);
export const deleteShowcaseEntry = (id: string) => impl().deleteShowcaseEntry(id);
export const createStudentSignup: typeof local.createStudentSignup = (i) =>
  impl().createStudentSignup(i);
export const listStudentSignups = () => impl().listStudentSignups();
export const listOfficers = () => impl().listOfficers();
export const addOfficer = (email: string) => impl().addOfficer(email);
export const removeOfficer = (id: string) => impl().removeOfficer(id);

// Whether public form submissions can actually be stored right now. When this
// is false the forms fall back to a prefilled email to ailab@weber.edu rather
// than pretending to save (honesty rule: no dead buttons, no false promises).
// The GitHub Pages build has nowhere to send them, so it always falls back.
export async function formsLive(): Promise<boolean> {
  if (process.env.GITHUB_PAGES === "1") return false;
  if (hasSupabase()) return true;
  return local.localWritable();
}

export function dataMode(): "supabase" | "local" {
  return hasSupabase() ? "supabase" : "local";
}
