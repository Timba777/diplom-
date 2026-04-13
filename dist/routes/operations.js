"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.operationsRouter = (0, express_1.Router)();
exports.operationsRouter.use(auth_1.authMiddleware);
exports.operationsRouter.post("/", async (req, res) => {
    const { amount, type, description, date, categoryId, familyId, planned } = req.body;
    if (!amount || !type) {
        return res
            .status(400)
            .json({ message: "amount and type are required" });
    }
    const operation = await prisma_1.prisma.operation.create({
        data: {
            amount,
            type,
            description,
            date: date ? new Date(date) : undefined,
            planned: !!planned,
            categoryId: categoryId ?? null,
            familyId: familyId ?? null,
            userId: req.user.id,
        },
    });
    return res.status(201).json(operation);
});
exports.operationsRouter.get("/", async (req, res) => {
    const { familyId } = req.query;
    const operations = await prisma_1.prisma.operation.findMany({
        where: {
            userId: req.user.id,
            familyId: familyId ? Number(familyId) : undefined,
        },
        orderBy: { date: "desc" },
    });
    return res.json(operations);
});
