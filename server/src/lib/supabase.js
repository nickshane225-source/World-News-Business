import "./env.js";
import { createClient } from "@supabase/supabase-js";

const rawUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseUrl = /^https?:\/\//i.test(rawUrl)
  ? rawUrl
  : "https://rwjknedfmmilevkhjcgb.supabase.co";

export const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
