import { prisma } from "../prisma";
import { LimitPeriod, LimitScope } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

export type LimitForUsage = {
  amount: Prisma.Decimal;
  period: LimitPeriod;
  scope: LimitScope;
  categoryId: number | null;
  userId: number | null;
  familyId: number | null;
};

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}

function startOfMonth(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function addDays(d: Date, days: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

function addMonths(d: Date, months: number) {
  const date = new Date(d);
  date.setMonth(date.getMonth() + months);
  return date;
}

export function decimalToNumber(d: Prisma.Decimal): number {
  return Number(d.toString());
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getPeriodRange(period: LimitPeriod, now = new Date()) {
  const periodStart =
    period === "WEEKLY" ? startOfWeek(now) : startOfMonth(now);
  const periodEnd =
    period === "WEEKLY" ? addDays(periodStart, 7) : addMonths(periodStart, 1);
  return { periodStart, periodEnd };
}

export function buildExpenseWhereForLimit(
  limit: LimitForUsage,
  now = new Date(),
): Prisma.OperationWhereInput {
  const { periodStart, periodEnd } = getPeriodRange(limit.period, now);

  const where: Prisma.OperationWhereInput = {
    type: "EXPENSE",
    date: { gte: periodStart, lt: periodEnd },
  };

  if (limit.familyId) {
    where.familyId = limit.familyId;
  } else if (limit.userId) {
    where.userId = limit.userId;
    where.familyId = null;
  }

  if (limit.scope === "CATEGORY" && limit.categoryId) {
    where.categoryId = limit.categoryId;
  }

  return where;
}

export async function calculateLimitUsage(limit: LimitForUsage) {
  const agg = await prisma.operation.aggregate({
    where: buildExpenseWhereForLimit(limit),
    _sum: { amount: true },
  });

  const usedDecimal = (agg._sum.amount ?? new Prisma.Decimal(0)) as Prisma.Decimal;
  const limitAmount = limit.amount;

  const usedAmount = roundMoney(decimalToNumber(usedDecimal));
  const limitNum = decimalToNumber(limitAmount);
  const remainingAmount = roundMoney(Math.max(limitNum - usedAmount, 0));
  const percentUsed =
    limitNum > 0 ? roundMoney((usedAmount / limitNum) * 100) : 0;
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
