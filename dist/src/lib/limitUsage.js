"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalToNumber = decimalToNumber;
exports.getPeriodRange = getPeriodRange;
exports.buildExpenseWhereForLimit = buildExpenseWhereForLimit;
exports.calculateLimitUsage = calculateLimitUsage;
const prisma_1 = require("../prisma");
const client_1 = require("../../generated/prisma/client");
function startOfWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = (date.getDay() + 6) % 7;
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
function decimalToNumber(d) {
    return Number(d.toString());
}
function roundMoney(n) {
    return Math.round(n * 100) / 100;
}
function getPeriodRange(period, now = new Date()) {
    const periodStart = period === "WEEKLY" ? startOfWeek(now) : startOfMonth(now);
    const periodEnd = period === "WEEKLY" ? addDays(periodStart, 7) : addMonths(periodStart, 1);
    return { periodStart, periodEnd };
}
function buildExpenseWhereForLimit(limit, now = new Date()) {
    const { periodStart, periodEnd } = getPeriodRange(limit.period, now);
    const where = {
        type: "EXPENSE",
        date: { gte: periodStart, lt: periodEnd },
    };
    if (limit.familyId) {
        where.familyId = limit.familyId;
    }
    else if (limit.userId) {
        where.userId = limit.userId;
        where.familyId = null;
    }
    if (limit.scope === "CATEGORY" && limit.categoryId) {
        where.categoryId = limit.categoryId;
    }
    return where;
}
async function calculateLimitUsage(limit) {
    const agg = await prisma_1.prisma.operation.aggregate({
        where: buildExpenseWhereForLimit(limit),
        _sum: { amount: true },
    });
    const usedDecimal = (agg._sum.amount ?? new client_1.Prisma.Decimal(0));
    const limitAmount = limit.amount;
    const usedAmount = roundMoney(decimalToNumber(usedDecimal));
    const limitNum = decimalToNumber(limitAmount);
    const remainingAmount = roundMoney(Math.max(limitNum - usedAmount, 0));
    const percentUsed = limitNum > 0 ? roundMoney((usedAmount / limitNum) * 100) : 0;
    const isExceeded = usedDecimal.gt(limitAmount);
    const exceededBy = isExceeded
        ? roundMoney(Math.max(usedAmount - limitNum, 0))
        : 0;
    return {
        usedAmount,
        remainingAmount,
        percentUsed,
        isExceeded,
        exceededBy,
    };
}
