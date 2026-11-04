import jwt from "jsonwebtoken";
export const requireAuth = (req, res, next) => {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    jwt.verify(t, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
};
