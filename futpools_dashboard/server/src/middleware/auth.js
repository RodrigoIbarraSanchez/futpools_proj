import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = payload.adminId;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
