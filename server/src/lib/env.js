import "dotenv/config";

const REQUIRED = [
  "GEMINI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

// Clean up common copy-paste issues in cloud dashboards (e.g., surrounding quotes or "KEY=value" pasted into the Value field)
for (const [k, rawVal] of Object.entries(process.env)) {
  if (typeof rawVal !== "string") continue;
  let v = rawVal.trim();
  if (v.startsWith(`${k}=`)) v = v.slice(k.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  process.env[k] = v;
}

if (process.env.SUPABASE_URL && !/^https?:\/\//i.test(process.env.SUPABASE_URL)) {
  if (process.env.SUPABASE_URL.includes(".supabase.co")) {
    process.env.SUPABASE_URL = `https://${process.env.SUPABASE_URL.replace(/^\/+/, "")}`;
  } else {
    process.env.SUPABASE_URL = "https://rwjknedfmmilevkhjcgb.supabase.co";
  }
}

for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing env var: ${k} (see server/.env.example)`);
    process.exit(1);
  }
}
