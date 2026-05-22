import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { LimitPeriod, LimitScope } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { resolveCategoryForLimit } from "./categories";
import {
  canManageBudgetLimit,
  isFamilyOwner,
  limitScope,
} from "../lib/familyAccess";
import {
  calculateLimitUsage,
  decimalToNumber,
} from "../lib/limitUsage";

export const limitsRouter = Router();

limitsRouter.use(authMiddleware);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parsePeriod(value: unknown): LimitPeriod | null {
  if (value === "WEEKLY" || value === "MONTHLY") return value;
  return null;
}

function parseScope(value: unknown): LimitScope | null {
  if (value === "TOTAL" || value === "CATEGORY") return value;
  return null;
}

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return null;
    return new Prisma.Decimal(value);
  }
  if (typeof value === "string") {
    const v = value.trim();
    if (!v) return null;
    try {
      const d = new Prisma.Decimal(v);
      if (d.lte(0)) return null;
      return d;
    } catch {
      return null;
    }
  }
  return null;
}

async function hasFamilyAccess(familyId: number, userId: number): Promise<boolean> {
  const member = await prisma.familyMember.findFirst({
    where: { familyId, userId },
    select: { id: true },
  });
  return !!member;
}

type LimitRow = {
  id: number;
  name: string;
  amount: Prisma.Decimal;
  period: LimitPeriod;
  scope: LimitScope;
  isBlocking: boolean;
  createdAt: Date;
  categoryId: number | null;
  userId: number | null;
  familyId: number | null;
  category?: { id: number; name: string } | null;
  family?: { id: number; name: string } | null;
};

async function serializeLimit(
  limit: LimitRow,
  userId: number,
  options?: { includeUsage?: boolean },
) {
  const scope = limitScope(limit.userId, limit.familyId);
  const base = {
    id: limit.id,
    name: limit.name,
    amount: decimalToNumber(limit.amount),
    period: limit.period,
    scope: limit.scope,
    isBlocking: limit.isBlocking,
    createdAt: limit.createdAt,
    categoryId: limit.categoryId,
    userId: limit.userId,
    familyId: limit.familyId,
    category: limit.category ?? null,
    family: limit.family ?? null,
    limitScope: scope,
    familyName: limit.family?.name ?? null,
    canManage: await canManageBudgetLimit(limit, userId),
  };

  if (options?.includeUsage === false) {
    return base;
  }

  const usage = await calculateLimitUsage(limit);
  return { ...base, ...usage };
}

limitsRouter.post("/", async (req: AuthRequest, res) => {
  const { name, amount, period, scope, categoryId, familyId, isBlocking } = req.body;

  if (!isNonEmptyString(name)) {
    return res.status(400).json({ message: "name is required" });
  }

  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const parsedPeriod = parsePeriod(period);
  if (!parsedPeriod) {
    return res.status(400).json({ message: "period must be WEEKLY or MONTHLY" });
  }

  const parsedScope = parseScope(scope);
  if (!parsedScope) {
    return res.status(400).json({ message: "scope must be TOTAL or CATEGORY" });
  }

  const parsedCategoryId = categoryId === undefined ? null : parseId(categoryId);
  if (categoryId !== undefined && !parsedCategoryId) {
    return res.status(400).json({ message: "Invalid categoryId" });
  }

  const parsedFamilyId = familyId === undefined ? null : parseId(familyId);
  if (familyId !== undefined && !parsedFamilyId) {
    return res.status(400).json({ message: "Invalid familyId" });
  }

  // Must belong either to user OR family (not both).
  // Personal limit always belongs to current user.
  const belongsToUser = parsedFamilyId === null ? req.user!.id : null;
  const belongsToFamily = parsedFamilyId;

  if (belongsToUser && belongsToFamily) {
    return res.status(400).json({ message: "limit must be personal or family, not both" });
  }

  if (!belongsToUser && !belongsToFamily) {
    return res.status(400).json({ message: "limit must belong to user or family" });
  }

  if (belongsToFamily) {
    const ok = await isFamilyOwner(belongsToFamily, req.user!.id);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
  }

  if (parsedScope === "CATEGORY" && !parsedCategoryId) {
    return res.status(400).json({ message: "categoryId is required for CATEGORY scope" });
  }
  if (parsedScope === "TOTAL" && parsedCategoryId) {
    return res.status(400).json({ message: "categoryId must be null for TOTAL scope" });
  }

  if (parsedCategoryId) {
    const resolved = await resolveCategoryForLimit(
      parsedCategoryId,
      req.user!.id,
      belongsToFamily,
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.message });
    }
  }

  const created = await prisma.budgetLimit.create({
    data: {
      name,
      amount: parsedAmount,
      period: parsedPeriod,
      scope: parsedScope,
      isBlocking: !!isBlocking,
      categoryId: parsedCategoryId,
      userId: belongsToUser,
      familyId: belongsToFamily,
    },
    include: {
      category: { select: { id: true, name: true } },
      family: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json(await serializeLimit(created, req.user!.id));
});

limitsRouter.get("/", async (req: AuthRequest, res) => {
  const memberships = await prisma.familyMember.findMany({
    where: { userId: req.user!.id },
    select: { familyId: true },
  });
  const familyIds = memberships.map((m) => m.familyId);

  const limits = await prisma.budgetLimit.findMany({
    where: {
      OR: [
        { userId: req.user!.id },
        ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { id: true, name: true } },
      family: { select: { id: true, name: true } },
    },
  });

  const result = await Promise.all(
    limits.map((l) => serializeLimit(l, req.user!.id, { includeUsage: true })),
  );

  return res.json(result);
});

limitsRouter.get("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const limit = await prisma.budgetLimit.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      family: { select: { id: true, name: true } },
    },
  });

  if (!limit) return res.status(404).json({ message: "Not found" });

  if (limit.userId) {
    if (limit.userId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
  } else if (limit.familyId) {
    const ok = await hasFamilyAccess(limit.familyId, req.user!.id);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
  } else {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.json(
    await serializeLimit(limit, req.user!.id, { includeUsage: true }),
  );
});

limitsRouter.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await prisma.budgetLimit.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Not found" });

  // Rights
  if (existing.userId) {
    if (existing.userId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
  } else if (existing.familyId) {
    const ok = await isFamilyOwner(existing.familyId, req.user!.id);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
  } else {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { name, amount, period, scope, categoryId, isBlocking } = req.body;

  const nextName = name === undefined ? existing.name : name;
  if (nextName !== existing.name && !isNonEmptyString(nextName)) {
    return res.status(400).json({ message: "name is required" });
  }

  const nextAmount =
    amount === undefined ? existing.amount : parseAmount(amount);
  if (amount !== undefined && !nextAmount) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const nextPeriod = period === undefined ? existing.period : parsePeriod(period);
  if (period !== undefined && !nextPeriod) {
    return res.status(400).json({ message: "period must be WEEKLY or MONTHLY" });
  }

  const nextScope = scope === undefined ? existing.scope : parseScope(scope);
  if (scope !== undefined && !nextScope) {
    return res.status(400).json({ message: "scope must be TOTAL or CATEGORY" });
  }

  const nextCategoryId =
    categoryId === undefined ? existing.categoryId : categoryId === null ? null : parseId(categoryId);
  if (categoryId !== undefined && categoryId !== null && !nextCategoryId) {
    return res.status(400).json({ message: "Invalid categoryId" });
  }

  if (nextScope === "CATEGORY" && !nextCategoryId) {
    return res.status(400).json({ message: "categoryId is required for CATEGORY scope" });
  }
  if (nextScope === "TOTAL" && nextCategoryId) {
    return res.status(400).json({ message: "categoryId must be null for TOTAL scope" });
  }

  if (nextCategoryId) {
    const resolved = await resolveCategoryForLimit(
      nextCategoryId,
      req.user!.id,
      existing.familyId,
    );
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.message });
    }
  }

  const updated = await prisma.budgetLimit.update({
    where: { id },
    data: {
      name: nextName,
      amount: nextAmount!,
      period: nextPeriod!,
      scope: nextScope!,
      categoryId: nextCategoryId,
      isBlocking: isBlocking === undefined ? existing.isBlocking : !!isBlocking,
    },
    include: {
      category: { select: { id: true, name: true } },
      family: { select: { id: true, name: true } },
    },
  });

  return res.json(await serializeLimit(updated, req.user!.id));
});

limitsRouter.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await prisma.budgetLimit.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Not found" });

  if (existing.userId) {
    if (existing.userId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
  } else if (existing.familyId) {
    const ok = await isFamilyOwner(existing.familyId, req.user!.id);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
  } else {
    return res.status(403).json({ message: "Forbidden" });
  }

  await prisma.budgetLimit.delete({ where: { id } });
  return res.status(204).send();
});

