"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
exports.resolveCategoryForOperation = resolveCategoryForOperation;
exports.resolveCategoryForLimit = resolveCategoryForLimit;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const familyAccess_1 = require("../lib/familyAccess");
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
async function serializeCategory(category, userId) {
    const scope = (0, familyAccess_1.categoryScope)(category.familyId);
    return {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        userId: category.userId,
        familyId: category.familyId,
        familyName: category.family?.name ?? null,
        isDefault: category.isDefault,
        createdAt: category.createdAt,
        scope,
        canManage: await (0, familyAccess_1.canManageCategory)(category, userId),
    };
}
async function findVisibleCategory(id, userId) {
    const familyIds = await (0, familyAccess_1.getUserFamilyIds)(userId);
    return prisma_1.prisma.category.findFirst({
        where: {
            id,
            OR: [
                { userId, familyId: null },
                ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
            ],
        },
        include: { family: { select: { id: true, name: true } } },
    });
}
exports.categoriesRouter.post("/", async (req, res) => {
    try {
        const { name, type, color, icon, familyId } = req.body;
        const userId = req.user.id;
        if (!isNonEmptyString(name)) {
            return res.status(400).json({ message: "name is required" });
        }
        const operationType = parseOperationType(type);
        if (!operationType) {
            return res
                .status(400)
                .json({ message: "type must be INCOME or EXPENSE" });
        }
        const parsedFamilyId = familyId === undefined || familyId === null || familyId === ""
            ? null
            : parseId(familyId);
        if (familyId !== undefined && familyId !== null && familyId !== "" && !parsedFamilyId) {
            return res.status(400).json({ message: "Invalid familyId" });
        }
        if (parsedFamilyId) {
            const member = await (0, familyAccess_1.isFamilyMember)(parsedFamilyId, userId);
            if (!member) {
                return res.status(403).json({ message: "Forbidden" });
            }
            const duplicate = await prisma_1.prisma.category.findFirst({
                where: { familyId: parsedFamilyId, name },
            });
            if (duplicate) {
                return res.status(409).json({
                    message: "Category with this name already exists in this family",
                });
            }
        }
        else {
            const duplicate = await prisma_1.prisma.category.findFirst({
                where: { userId, familyId: null, name },
            });
            if (duplicate) {
                return res.status(409).json({
                    message: "Category with this name already exists",
                });
            }
        }
        const created = await prisma_1.prisma.category.create({
            data: {
                name,
                type: operationType,
                color: typeof color === "string" ? color : null,
                icon: typeof icon === "string" ? icon : null,
                userId,
                familyId: parsedFamilyId,
                isDefault: parsedFamilyId === null,
            },
            include: { family: { select: { id: true, name: true } } },
        });
        return res.status(201).json(await serializeCategory(created, userId));
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
    const userId = req.user.id;
    const operationType = parseOperationType(type);
    const familyIds = await (0, familyAccess_1.getUserFamilyIds)(userId);
    const categories = await prisma_1.prisma.category.findMany({
        where: {
            OR: [
                { userId, familyId: null },
                ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
            ],
            ...(operationType ? { type: operationType } : {}),
        },
        orderBy: [{ familyId: "asc" }, { createdAt: "desc" }],
        include: { family: { select: { id: true, name: true } } },
    });
    const result = await Promise.all(categories.map((c) => serializeCategory(c, userId)));
    return res.json(result);
});
exports.categoriesRouter.get("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const category = await findVisibleCategory(id, req.user.id);
    if (!category)
        return res.status(404).json({ message: "Not found" });
    return res.json(await serializeCategory(category, req.user.id));
});
exports.categoriesRouter.put("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const existing = await findVisibleCategory(id, req.user.id);
    if (!existing)
        return res.status(404).json({ message: "Not found" });
    if (!(await (0, familyAccess_1.canManageCategory)(existing, req.user.id))) {
        return res.status(403).json({ message: "Forbidden" });
    }
    const { name, type, color, icon } = req.body;
    const hasAnyUpdate = name !== undefined || type !== undefined || color !== undefined || icon !== undefined;
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
    const nextName = name ?? existing.name;
    if (nextName !== existing.name) {
        if (existing.familyId === null) {
            const duplicated = await prisma_1.prisma.category.findFirst({
                where: { userId: req.user.id, familyId: null, name: nextName },
            });
            if (duplicated && duplicated.id !== existing.id) {
                return res.status(409).json({
                    message: "Category with this name already exists",
                });
            }
        }
        else {
            const duplicated = await prisma_1.prisma.category.findFirst({
                where: { familyId: existing.familyId, name: nextName },
            });
            if (duplicated && duplicated.id !== existing.id) {
                return res.status(409).json({
                    message: "Category with this name already exists in this family",
                });
            }
        }
    }
    const updated = await prisma_1.prisma.category.update({
        where: { id: existing.id },
        data: {
            name: nextName,
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
        },
        include: { family: { select: { id: true, name: true } } },
    });
    return res.json(await serializeCategory(updated, req.user.id));
});
exports.categoriesRouter.delete("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
        return res.status(400).json({ message: "Invalid id" });
    const existing = await findVisibleCategory(id, req.user.id);
    if (!existing)
        return res.status(404).json({ message: "Not found" });
    if (!(await (0, familyAccess_1.canManageCategory)(existing, req.user.id))) {
        return res.status(403).json({ message: "Forbidden" });
    }
    await prisma_1.prisma.category.delete({ where: { id: existing.id } });
    return res.status(204).send();
});
/** Экспорт для operations / limits */
async function resolveCategoryForOperation(categoryId, userId, operationFamilyId) {
    const familyIds = await (0, familyAccess_1.getUserFamilyIds)(userId);
    const category = await prisma_1.prisma.category.findFirst({
        where: {
            id: categoryId,
            OR: [
                { userId, familyId: null },
                ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
            ],
        },
        select: { id: true, familyId: true, type: true },
    });
    if (!category)
        return { ok: false, status: 400, message: "Invalid categoryId" };
    if (operationFamilyId !== null) {
        if (category.familyId !== operationFamilyId) {
            return {
                ok: false,
                status: 400,
                message: "Category does not belong to this family",
            };
        }
    }
    else if (category.familyId !== null) {
        return {
            ok: false,
            status: 400,
            message: "Category is not personal",
        };
    }
    return { ok: true, category };
}
async function resolveCategoryForLimit(categoryId, userId, limitFamilyId) {
    if (limitFamilyId !== null) {
        const category = await prisma_1.prisma.category.findFirst({
            where: { id: categoryId, familyId: limitFamilyId },
            select: { id: true, familyId: true },
        });
        if (!category) {
            return {
                ok: false,
                status: 404,
                message: "Category not found",
            };
        }
        return { ok: true, category };
    }
    const category = await prisma_1.prisma.category.findFirst({
        where: { id: categoryId, userId, familyId: null },
        select: { id: true, familyId: true },
    });
    if (!category) {
        return {
            ok: false,
            status: 404,
            message: "Category not found",
        };
    }
    return { ok: true, category };
}
