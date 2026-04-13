"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../prisma");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ message: "email, password, name required" });
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: "User already exists" });
    }
    const hash = await bcrypt_1.default.hash(password, 10);
    const user = await prisma_1.prisma.user.create({
        data: { email, password: hash, name },
    });
    return res.status(201).json({ id: user.id, email: user.email, name: user.name });
});
exports.authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "email and password required" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const ok = await bcrypt_1.default.compare(password, user.password);
    if (!ok) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const secret = process.env.JWT_SECRET || "dev-secret";
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, secret, { expiresIn: "7d" });
    return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
    });
});
