"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter.use(auth_1.authMiddleware);
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function parseOperationType(value) {
    if (value === "INCOME" || value === "EXPENSE")
        return value;
    return null;
}
function parseId(value) {
    const n = typeof value === "string" ? Number(value) : Number(value);
    if (!Number.isInteger(n) || n <= 0)
        return null;
    return n;
}
exports.categoriesRouter.post("/", async (req, res) => {
    try {
        const { name, type, color, icon, familyId } = req.body;
        if (!isNonEmptyString(name)) {
            return res.status(400).json({ message: "name is required" });
        }
        const operationType = parseOperationType(type);
        if (!operationType) {
            return res
                .status(400)
                .json({ message: "type must be INCOME or EXPENSE" });
        }
        const category = await prisma_1.prisma.category.findFirst({
            where: { userId: req.user.id, name },
        });
        if (category) {
            return res.status(409).json({
                message: "Category with this name already exists",
            });
        }
        const created = await prisma_1.prisma.category.create({
            data: {
                name,
                type: operationType,
                color: typeof color === "string" ? color : null,
                icon: typeof icon === "string" ? icon : null,
                userId: req.user.id,
                familyId: familyId ? Number(familyId) : null,
                isDefault: !familyId,
            },
        });
        return res.status(201).json(created);
    }
    catch (e) {
        if (typeof e === "object" && e !== null && "code" in e) {
            const code = e.code;
            if (code === "P2002") {
                return res.status(409).json({
                    message: "Category with this name already exists",
                });
            }
        }
        return res.status(500).json({ message: "Failed to create category" });
    }
});
exports.categoriesRouter.get("/", async (req, res) => {
    const { type } = req.query;
    const operationType = parseOperationType(type);
    const categories = await prisma_1.prisma.category.findMany({
        where: {
            userId: req.user.id,
            ...(operationType ? { type: operationType } : {}),
        },
        orderBy: { createdAt: "desc" },
    });
    return res.json(categories);
});
exports.categoriesRouter.get("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const category = await prisma_1.prisma.category.findFirst({
        where: { id, userId: req.user.id },
    });
    if (!category)
        return res.status(404).json({ message: "Not found" });
    return res.json(category);
});
exports.categoriesRouter.put("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const existing = await prisma_1.prisma.category.findFirst({
        where: { id, userId: req.user.id },
    });
    if (!existing)
        return res.status(404).json({ message: "Not found" });
    const { name, type, color, icon, familyId } = req.body;
    const hasAnyUpdate = name !== undefined ||
        type !== undefined ||
        color !== undefined ||
        icon !== undefined ||
        familyId !== undefined;
    if (!hasAnyUpdate) {
        return res.status(400).json({ message: "Nothing to update" });
    }
    if (name !== undefined && !isNonEmptyString(name)) {
        return res.status(400).json({ message: "name is required" });
    }
    const operationType = type !== undefined ? parseOperationType(type) : null;
    if (type !== undefined && !operationType) {
        return res
            .status(400)
            .json({ message: "type must be INCOME or EXPENSE" });
    }
    // If name changes, ensure uniqueness for this user.
    if (name !== undefined && name !== existing.name) {
        const duplicated = await prisma_1.prisma.category.findFirst({
            where: { userId: req.user.id, name },
        });
        if (duplicated) {
            return res.status(409).json({
                message: "Category with this name already exists",
            });
        }
    }
    const updated = await prisma_1.prisma.category.update({
        where: { id: existing.id },
        data: {
            name: name ?? existing.name,
            type: operationType ?? existing.type,
            color: color === undefined
                ? existing.color
                : typeof color === "string"
                    ? color
                    : null,
            icon: icon === undefined
                ? existing.icon
                : typeof icon === "string"
                    ? icon
                    : null,
            familyId: familyId === undefined ? existing.familyId : familyId ? Number(familyId) : null,
            isDefault: familyId === undefined ? existing.isDefault : !familyId,
        },
    });
    return res.json(updated);
});
exports.categoriesRouter.delete("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const deleted = await prisma_1.prisma.category.deleteMany({
        where: { id, userId: req.user.id },
    });
    if (deleted.count === 0) {
        return res.status(404).json({ message: "Not found" });
    }
    return res.status(204).send();
});
