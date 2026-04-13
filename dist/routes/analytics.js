"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.analyticsRouter = (0, express_1.Router)();
exports.analyticsRouter.use(auth_1.authMiddleware);
exports.analyticsRouter.get("/summary", async (req, res) => {
    const { from, to, familyId } = req.query;
    const where = {
        userId: req.user.id,
    };
    if (familyId) {
        where.familyId = Number(familyId);
    }
    if (from || to) {
        where.date = {};
        if (from)
            where.date.gte = new Date(String(from));
        if (to)
            where.date.lte = new Date(String(to));
    }
    const grouped = await prisma_1.prisma.operation.groupBy({
        by: ["categoryId", "type"],
        where,
        _sum: { amount: true },
    });
    return res.json(grouped);
});
