import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const eq = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const r = Router();
r.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (eq(email, process.env.ADMIN_EMAIL) && eq(password, process.env.ADMIN_PASSWORD))
    return res.json({ token: jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" }) });
  res.status(401).json({ error: "Invalid credentials" });
});
export default r;
