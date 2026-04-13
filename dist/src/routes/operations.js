"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const client_1 = require("../../generated/prisma/client");
exports.operationsRouter = (0, express_1.Router)();
exports.operationsRouter.use(auth_1.authMiddleware);
function parseAmount(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return new client_1.Prisma.Decimal(value);
    }
    if (typeof value === "string") {
        const v = value.trim();
        if (!v)
            return null;
        try {
            return new client_1.Prisma.Decimal(v);
        }
        catch {
            return null;
        }
    }
    return null;
}
function startOfWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = (date.getDay() + 6) % 7; // Monday=0..Sunday=6
    date.setDate(date.getDate() - day);
    return date;
}
function startOfMonth(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return date;
}
function addDays(d, days) {
    const date = new Date(d);
    date.setDate(date.getDate() + days);
    return date;
}
function addMonths(d, months) {
    const date = new Date(d);
    date.setMonth(date.getMonth() + months);
    return date;
}
async function isFamilyMember(familyId, userId) {
    const m = await prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
        select: { role: true },
    });
    return m;
}
exports.operationsRouter.post("/", async (req, res) => {
    const { amount, type, description, date, categoryId, familyId, planned, force } = req.body;
    if (!amount || !type) {
        return res
            .status(400)
            .json({ message: "amount and type are required" });
    }
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
        return res.status(400).json({ message: "amount must be a number" });
    }
    const operationDate = date ? new Date(date) : new Date();
    if (Number.isNaN(operationDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
    }
    if (categoryId !== undefined && categoryId !== null) {
        const parsedCategoryId = Number(categoryId);
        if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
            return res.status(400).json({ message: "Invalid categoryId" });
        }
        const ownedCategory = await prisma_1.prisma.category.findFirst({
            where: { id: parsedCategoryId, userId: req.user.id },
            select: { id: true, familyId: true },
        });
        if (!ownedCategory) {
            return res.status(400).json({ message: "Invalid categoryId" });
        }
        if (familyId !== undefined && familyId !== null) {
            const parsedFamilyId = Number(familyId);
            if (!Number.isInteger(parsedFamilyId) || parsedFamilyId <= 0) {
                return res.status(400).json({ message: "Invalid familyId" });
            }
            if (ownedCategory.familyId !== parsedFamilyId) {
                return res
                    .status(400)
                    .json({ message: "Category does not belong to this family" });
            }
        }
        else {
            if (ownedCategory.familyId !== null) {
                return res.status(400).json({ message: "Category is not personal" });
            }
        }
    }
    let parsedFamilyId = null;
    if (familyId !== undefined && familyId !== null) {
        parsedFamilyId = Number(familyId);
        if (!Number.isInteger(parsedFamilyId) || parsedFamilyId <= 0) {
            return res.status(400).json({ message: "Invalid familyId" });
        }
        const membership = await isFamilyMember(parsedFamilyId, req.user.id);
        if (!membership) {
            return res.status(403).json({ message: "Forbidden" });
        }
    }
    const unplannedPurchase = type === "EXPENSE" && !planned;
    // Check limits only for EXPENSE
    if (type === "EXPENSE") {
        const limits = await prisma_1.prisma.budgetLimit.findMany({
            where: {
                OR: [
                    { userId: req.user.id },
                    ...(parsedFamilyId ? [{ familyId: parsedFamilyId }] : []),
                ],
            },
            orderBy: { createdAt: "desc" },
        });
        const exceeded = [];
        for (const limit of limits) {
            const periodStart = limit.period === "WEEKLY" ? startOfWeek(operationDate) : startOfMonth(operationDate);
            const periodEnd = limit.period === "WEEKLY" ? addDays(periodStart, 7) : addMonths(periodStart, 1);
            const where = {
                type: "EXPENSE",
                date: { gte: periodStart, lt: periodEnd },
            };
            // Personal limits apply to user's expenses.
            if (limit.userId) {
                where.userId = limit.userId;
            }
            // Family limits apply only inside that family.
            if (limit.familyId) {
                where.familyId = limit.familyId;
            }
            if (limit.scope === "CATEGORY") {
                where.categoryId = limit.categoryId;
            }
            const agg = await prisma_1.prisma.operation.aggregate({
                where,
                _sum: { amount: true },
            });
            const spent = (agg._sum.amount ?? new client_1.Prisma.Decimal(0));
            const next = spent.add(parsedAmount);
            if (next.gt(limit.amount)) {
                const remaining = limit.amount.sub(spent);
                exceeded.push({
                    limit,
                    currentSpent: spent,
                    attemptedAmount: parsedAmount,
                    allowedRemaining: remaining,
                    blocking: !!limit.isBlocking,
                });
            }
        }
        const blockingExceeded = exceeded.find((x) => x.blocking);
        if (blockingExceeded) {
            const canForce = !!force &&
                (!blockingExceeded.limit.familyId ||
                    (await isFamilyMember(blockingExceeded.limit.familyId, req.user.id))?.role === "OWNER");
            if (!canForce) {
                return res.status(409).json({
                    message: "Limit exceeded",
                    limitExceeded: true,
                    blocking: true,
                    unplannedPurchase,
                    blockedByLimit: true,
                    limit: blockingExceeded.limit,
                    currentSpent: blockingExceeded.currentSpent.toString(),
                    attemptedAmount: blockingExceeded.attemptedAmount.toString(),
                    allowedRemaining: blockingExceeded.allowedRemaining.toString(),
                });
            }
        }
        // Non-blocking exceed -> warning in response after creation.
        const warningExceeded = exceeded.length ? exceeded[0] : null;
        const operation = await prisma_1.prisma.operation.create({
            data: {
                amount: parsedAmount,
                type,
                description,
                date: operationDate,
                planned: !!planned,
                categoryId: categoryId ?? null,
                familyId: parsedFamilyId,
                userId: req.user.id,
            },
        });
        if (warningExceeded) {
            return res.status(201).json({
                ...operation,
                warning: "Limit exceeded",
                limitExceeded: true,
                blocking: !!warningExceeded.blocking,
                unplannedPurchase,
                blockedByLimit: !!warningExceeded.blocking && !force,
                limit: warningExceeded.limit,
                currentSpent: warningExceeded.currentSpent.toString(),
                attemptedAmount: warningExceeded.attemptedAmount.toString(),
                allowedRemaining: warningExceeded.allowedRemaining.toString(),
            });
        }
        return res.status(201).json({
            ...operation,
            unplannedPurchase,
            blockedByLimit: false,
        });
    }
    const operation = await prisma_1.prisma.operation.create({
        data: {
            amount: parsedAmount,
            type,
            description,
            date: operationDate,
            planned: !!planned,
            categoryId: categoryId ?? null,
            familyId: parsedFamilyId,
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
