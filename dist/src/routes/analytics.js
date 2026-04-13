"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const client_1 = require("../../generated/prisma/client");
exports.analyticsRouter = (0, express_1.Router)();
exports.analyticsRouter.use(auth_1.authMiddleware);
function parseId(value) {
    if (!value)
        return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0)
        return null;
    return n;
}
function parseQueryString(value) {
    if (typeof value === "string")
        return value;
    if (Array.isArray(value) && typeof value[0] === "string")
        return value[0];
    return undefined;
}
function startOfUtcDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function endOfUtcDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
function parseDateRange(dateFromRaw, dateToRaw) {
    const dateFrom = parseQueryString(dateFromRaw);
    const dateTo = parseQueryString(dateToRaw);
    const range = {};
    if (dateFrom !== undefined) {
        const d = new Date(dateFrom);
        if (Number.isNaN(d.getTime()))
            return { ok: false, message: "Invalid dateFrom" };
        range.gte = startOfUtcDay(d);
    }
    if (dateTo !== undefined) {
        const d = new Date(dateTo);
        if (Number.isNaN(d.getTime()))
            return { ok: false, message: "Invalid dateTo" };
        range.lte = endOfUtcDay(d);
    }
    if (range.gte && range.lte && range.gte > range.lte) {
        return { ok: false, message: "dateFrom must be before or equal to dateTo" };
    }
    return { ok: true, range };
}
function dateFilter(range) {
    if (!range.gte && !range.lte)
        return {};
    return { date: { gte: range.gte, lte: range.lte } };
}
function parseOperationType(value) {
    if (value === "INCOME" || value === "EXPENSE")
        return value;
    return null;
}
function parseGroupBy(value) {
    if (value === "day" || value === "week" || value === "month")
        return value;
    return null;
}
function personalOperationsWhere(userId, range) {
    return {
        userId,
        familyId: null,
        ...dateFilter(range),
    };
}
function bucketKey(date, groupBy) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const day = date.getUTCDate();
    if (groupBy === "month") {
        return `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    const utcMidnight = new Date(Date.UTC(y, m, day));
    if (groupBy === "day") {
        return utcMidnight.toISOString().slice(0, 10);
    }
    // week: Monday as start (ISO-style), UTC
    const dow = utcMidnight.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(utcMidnight);
    monday.setUTCDate(monday.getUTCDate() + mondayOffset);
    return monday.toISOString().slice(0, 10);
}
async function requireFamilyMember(familyId, userId) {
    return prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
        select: { id: true },
    });
}
function decimalToString(v) {
    if (v == null)
        return "0";
    return v.toString();
}
/** GET /analytics/summary — личная сводка (только операции без familyId) */
exports.analyticsRouter.get("/summary", async (req, res) => {
    const parsed = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (!parsed.ok)
        return res.status(400).json({ message: parsed.message });
    const base = personalOperationsWhere(req.user.id, parsed.range);
    const [incomeAgg, expenseAgg, allCount, unplannedCount, unplannedAgg,] = await Promise.all([
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "INCOME" },
            _sum: { amount: true },
            _count: true,
        }),
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "EXPENSE" },
            _sum: { amount: true },
            _count: true,
        }),
        prisma_1.prisma.operation.count({ where: base }),
        prisma_1.prisma.operation.count({
            where: { ...base, type: "EXPENSE", planned: false },
        }),
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "EXPENSE", planned: false },
            _sum: { amount: true },
        }),
    ]);
    const totalIncome = incomeAgg._sum.amount ?? new client_1.Prisma.Decimal(0);
    const totalExpense = expenseAgg._sum.amount ?? new client_1.Prisma.Decimal(0);
    const balance = totalIncome.sub(totalExpense);
    return res.json({
        totalIncome: decimalToString(totalIncome),
        totalExpense: decimalToString(totalExpense),
        balance: decimalToString(balance),
        operationsCount: allCount,
        unplannedExpensesCount: unplannedCount,
        unplannedExpensesTotal: decimalToString(unplannedAgg._sum.amount),
    });
});
/** GET /analytics/by-category */
exports.analyticsRouter.get("/by-category", async (req, res) => {
    const parsed = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (!parsed.ok)
        return res.status(400).json({ message: parsed.message });
    const type = parseOperationType(req.query.type);
    if (!type) {
        return res.status(400).json({ message: "type must be INCOME or EXPENSE" });
    }
    const base = personalOperationsWhere(req.user.id, parsed.range);
    const grouped = await prisma_1.prisma.operation.groupBy({
        by: ["categoryId"],
        where: { ...base, type },
        _sum: { amount: true },
        _count: true,
    });
    const categoryIds = grouped
        .map((g) => g.categoryId)
        .filter((id) => id != null);
    const categories = categoryIds.length > 0
        ? await prisma_1.prisma.category.findMany({
            where: { id: { in: categoryIds }, userId: req.user.id },
            select: { id: true, name: true },
        })
        : [];
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const rows = grouped.map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryId == null ? null : nameById.get(g.categoryId) ?? "Unknown",
        totalAmount: decimalToString(g._sum.amount),
        operationsCount: g._count,
    }));
    return res.json(rows);
});
/** GET /analytics/by-period */
exports.analyticsRouter.get("/by-period", async (req, res) => {
    const groupBy = parseGroupBy(req.query.groupBy);
    if (!groupBy) {
        return res
            .status(400)
            .json({ message: "groupBy must be day, week or month" });
    }
    const parsed = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (!parsed.ok)
        return res.status(400).json({ message: parsed.message });
    const type = parseOperationType(req.query.type);
    if (!type) {
        return res.status(400).json({ message: "type must be INCOME or EXPENSE" });
    }
    const base = personalOperationsWhere(req.user.id, parsed.range);
    const ops = await prisma_1.prisma.operation.findMany({
        where: { ...base, type },
        select: { date: true, amount: true },
        orderBy: { date: "asc" },
    });
    const buckets = new Map();
    for (const op of ops) {
        const key = bucketKey(op.date, groupBy);
        const cur = buckets.get(key);
        const amt = op.amount;
        if (cur) {
            cur.total = cur.total.add(amt);
            cur.count += 1;
        }
        else {
            buckets.set(key, { period: key, total: amt, count: 1 });
        }
    }
    const periods = [...buckets.values()]
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((b) => ({
        period: b.period,
        totalAmount: decimalToString(b.total),
        operationsCount: b.count,
    }));
    return res.json({ groupBy, type, periods });
});
/** GET /analytics/unplanned */
exports.analyticsRouter.get("/unplanned", async (req, res) => {
    const parsed = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (!parsed.ok)
        return res.status(400).json({ message: parsed.message });
    const base = personalOperationsWhere(req.user.id, parsed.range);
    const whereUnplanned = { ...base, type: "EXPENSE", planned: false };
    const [agg, count, recent] = await Promise.all([
        prisma_1.prisma.operation.aggregate({
            where: whereUnplanned,
            _sum: { amount: true },
        }),
        prisma_1.prisma.operation.count({ where: whereUnplanned }),
        prisma_1.prisma.operation.findMany({
            where: whereUnplanned,
            orderBy: { date: "desc" },
            take: 20,
            select: {
                id: true,
                amount: true,
                date: true,
                description: true,
                categoryId: true,
            },
        }),
    ]);
    return res.json({
        totalUnplannedAmount: decimalToString(agg._sum.amount),
        totalUnplannedCount: count,
        recentUnplanned: recent.map((o) => ({
            ...o,
            amount: decimalToString(o.amount),
        })),
    });
});
/** GET /analytics/family/:familyId */
exports.analyticsRouter.get("/family/:familyId", async (req, res) => {
    const familyParam = req.params.familyId;
    const familyIdStr = Array.isArray(familyParam) ? familyParam[0] : familyParam;
    const familyId = parseId(familyIdStr);
    if (!familyId)
        return res.status(400).json({ message: "Invalid familyId" });
    const member = await requireFamilyMember(familyId, req.user.id);
    if (!member)
        return res.status(403).json({ message: "Forbidden" });
    const parsed = parseDateRange(req.query.dateFrom, req.query.dateTo);
    if (!parsed.ok)
        return res.status(400).json({ message: parsed.message });
    const base = {
        familyId,
        ...dateFilter(parsed.range),
    };
    const [incomeAgg, expenseAgg, allCount, unplannedCount, unplannedAgg, byCategory,] = await Promise.all([
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "INCOME" },
            _sum: { amount: true },
        }),
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "EXPENSE" },
            _sum: { amount: true },
        }),
        prisma_1.prisma.operation.count({ where: base }),
        prisma_1.prisma.operation.count({
            where: { ...base, type: "EXPENSE", planned: false },
        }),
        prisma_1.prisma.operation.aggregate({
            where: { ...base, type: "EXPENSE", planned: false },
            _sum: { amount: true },
        }),
        prisma_1.prisma.operation.groupBy({
            by: ["categoryId"],
            where: { ...base, type: "EXPENSE" },
            _sum: { amount: true },
            _count: true,
        }),
    ]);
    const totalIncome = incomeAgg._sum.amount ?? new client_1.Prisma.Decimal(0);
    const totalExpense = expenseAgg._sum.amount ?? new client_1.Prisma.Decimal(0);
    const balance = totalIncome.sub(totalExpense);
    const catIds = byCategory
        .map((g) => g.categoryId)
        .filter((id) => id != null);
    const cats = catIds.length > 0
        ? await prisma_1.prisma.category.findMany({
            where: { id: { in: catIds }, familyId },
            select: { id: true, name: true },
        })
        : [];
    const familyCatNames = new Map(cats.map((c) => [c.id, c.name]));
    const expensesByCategory = byCategory.map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryId == null
            ? null
            : familyCatNames.get(g.categoryId) ?? "Unknown",
        totalAmount: decimalToString(g._sum.amount),
        operationsCount: g._count,
    }));
    return res.json({
        familyId,
        totalIncome: decimalToString(totalIncome),
        totalExpense: decimalToString(totalExpense),
        balance: decimalToString(balance),
        operationsCount: allCount,
        unplannedExpensesCount: unplannedCount,
        unplannedExpensesTotal: decimalToString(unplannedAgg._sum.amount),
        expensesByCategory,
    });
});
