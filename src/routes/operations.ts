import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Prisma } from "../../generated/prisma/client";
import { resolveCategoryForOperation } from "./categories";

export const operationsRouter = Router();

operationsRouter.use(authMiddleware);

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Prisma.Decimal(value);
  }
  if (typeof value === "string") {
    const v = value.trim();
    if (!v) return null;
    try {
      return new Prisma.Decimal(v);
    } catch {
      return null;
    }
  }
  return null;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Monday=0..Sunday=6
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

async function isFamilyMember(familyId: number, userId: number) {
  const m = await prisma.familyMember.findFirst({
    where: { familyId, userId },
    select: { role: true },
  });
  return m;
}

operationsRouter.post("/", async (req: AuthRequest, res) => {
  const { amount, type, description, date, categoryId, familyId, planned, force } =
    req.body;

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

  let parsedFamilyId: number | null = null;
  if (familyId !== undefined && familyId !== null && familyId !== "") {
    parsedFamilyId = Number(familyId);
    if (!Number.isInteger(parsedFamilyId) || parsedFamilyId <= 0) {
      return res.status(400).json({ message: "Invalid familyId" });
    }

    const membership = await isFamilyMember(parsedFamilyId, req.user!.id);
    if (!membership) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  let parsedCategoryId: number | null = null;
  if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
    parsedCategoryId = Number(categoryId);
    if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    const resolved = await resolveCategoryForOperation(
      parsedCategoryId,
      req.user!.id,
      parsedFamilyId,
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.message });
    }
  }

  const unplannedPurchase = type === "EXPENSE" && !planned;

  // Check limits only for EXPENSE
  if (type === "EXPENSE") {
    const limitsWhere = parsedFamilyId
      ? { familyId: parsedFamilyId }
      : { userId: req.user!.id, familyId: null };

    const limits = await prisma.budgetLimit.findMany({
      where: limitsWhere,
      orderBy: { createdAt: "desc" },
    });

    const exceeded: Array<{
      limit: (typeof limits)[number];
      currentSpent: Prisma.Decimal;
      attemptedAmount: Prisma.Decimal;
      allowedRemaining: Prisma.Decimal;
      blocking: boolean;
    }> = [];

    for (const limit of limits) {
      if (limit.scope === "CATEGORY") {
        if (!parsedCategoryId || limit.categoryId !== parsedCategoryId) {
          continue;
        }
      }

      const periodStart =
        limit.period === "WEEKLY" ? startOfWeek(operationDate) : startOfMonth(operationDate);
      const periodEnd =
        limit.period === "WEEKLY" ? addDays(periodStart, 7) : addMonths(periodStart, 1);

      const where: Prisma.OperationWhereInput = {
        type: "EXPENSE",
        date: { gte: periodStart, lt: periodEnd },
      };

      if (parsedFamilyId) {
        where.familyId = parsedFamilyId;
      } else {
        where.userId = req.user!.id;
        where.familyId = null;
      }

      if (limit.scope === "CATEGORY") {
        where.categoryId = limit.categoryId;
      }

      const agg = await prisma.operation.aggregate({
        where,
        _sum: { amount: true },
      });

      const spent = (agg._sum.amount ?? new Prisma.Decimal(0)) as Prisma.Decimal;
      const next = spent.add(parsedAmount);

      if (next.gt(limit.amount)) {
        const remaining = (limit.amount as Prisma.Decimal).sub(spent);
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
      const canForce =
        !!force &&
        (!blockingExceeded.limit.familyId ||
          (await isFamilyMember(blockingExceeded.limit.familyId, req.user!.id))?.role === "OWNER");

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

    const operation = await prisma.operation.create({
      data: {
        amount: parsedAmount,
        type,
        description,
        date: operationDate,
        planned: !!planned,
        categoryId: parsedCategoryId,
        familyId: parsedFamilyId,
        userId: req.user!.id,
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

  const operation = await prisma.operation.create({
    data: {
      amount: parsedAmount,
      type,
      description,
      date: operationDate,
      planned: !!planned,
      categoryId: parsedCategoryId,
      familyId: parsedFamilyId,
      userId: req.user!.id,
    },
  });

  return res.status(201).json(operation);
});

operationsRouter.get("/", async (req: AuthRequest, res) => {
  const { familyId } = req.query;

  const operations = await prisma.operation.findMany({
    where: {
      userId: req.user!.id,
      familyId: familyId ? Number(familyId) : undefined,
    },
    orderBy: { date: "desc" },
  });

  return res.json(operations);
});

function parseOperationId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

operationsRouter.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseOperationId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  try {
    const existing = await prisma.operation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Not found" });
    }
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await prisma.operation.delete({ where: { id } });
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({
      message: e instanceof Error ? e.message : "Failed to delete operation",
    });
  }
});

