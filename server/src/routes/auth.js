import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verifyAdminPassword } from "../lib/password.js";
const eq = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const r = Router();
r.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const emailOk = eq(email, process.env.ADMIN_EMAIL);
  const passwordOk = typeof password === "string" && password.length > 0 && await verifyAdminPassword(password);
  if (emailOk && passwordOk) return res.json({ token: jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "12h" }) });
  res.status(401).json({ error: "Invalid credentials" });
});
export default r;
