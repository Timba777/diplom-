import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: number;
}

export interface AuthRequest extends Request {
  user?: { id: number };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const secret = process.env.JWT_SECRET || "dev-secret";
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

