"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.use(auth_1.authMiddleware);
exports.categoriesRouter.post("/", async (req, res) => {
    const { name, type, familyId } = req.body;
    if (!name || !type) {
        return res.status(400).json({ message: "name and type are required" });
    }
    const category = await prisma_1.prisma.category.create({
        data: {
            name,
            type,
            familyId: familyId ?? null,
            isDefault: !familyId,
        },
    });
    return res.status(201).json(category);
});
exports.categoriesRouter.get("/", async (req, res) => {
    const { familyId, type } = req.query;
    const categories = await prisma_1.prisma.category.findMany({
        where: {
            familyId: familyId ? Number(familyId) : null,
            type: type ? String(type) : undefined,
        },
    });
    return res.json(categories);
});
