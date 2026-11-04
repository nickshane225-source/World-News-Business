import "dotenv/config";
for (const k of ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
  if (!process.env[k]) { console.error(`Missing env var: ${k} (see server/.env.example)`); process.exit(1); }
}
