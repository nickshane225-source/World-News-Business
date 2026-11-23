import jwt from "jsonwebtoken";
export const requireAuth = (req, res, next) => {
  try {
    const match = /^Bearer\\s+([^\\s]+)$/i.exec(req.headers.authorization || "");
    if (!match) return res.status(401).json({ error: "Unauthorized" });
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded || decoded.role !== "admin" || typeof decoded.exp !== "number") return res.status(403).json({ error: "Forbidden" });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
};
