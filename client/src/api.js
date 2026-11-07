export const getToken = () => localStorage.getItem("token");
export async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && location.pathname.startsWith("/admin") && path !== "/auth/login") {
    localStorage.removeItem("token");
    location.href = "/admin/login";
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
export const fmt = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};
