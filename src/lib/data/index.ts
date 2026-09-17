// The one data seam. Everything imports from here and never cares which
// store is behind it: Supabase when its env vars exist, otherwise the local
// JSON store in data/ for dev and preview.

import * as local from "./local";
import * as supa from "./supabase";
import { hasSupabase } from "./supabase";

const impl = () => (hasSupabase() ? supa : local);

export const getEvents = () => impl().getEvents();
export const getSettings = () => impl().getSettings();
