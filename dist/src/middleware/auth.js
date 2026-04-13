"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const token = header.slice("Bearer ".length);
    try {
        const secret = process.env.JWT_SECRET || "dev-secret";
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.user = { id: payload.userId };
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid token" });
    }
}
