import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import {
  GoalContributionType,
  GoalStatus,
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import {
  canContributeToGoal,
  canCreateFamilyGoal,
  canManageGoal,
  getUserFamilyIds,
} from "../lib/familyAccess";
import { decimalToNumber } from "../lib/limitUsage";

export const goalsRouter = Router();

goalsRouter.use(authMiddleware);

function parseId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
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

function parseGoalStatus(value: unknown): GoalStatus | null {
  if (value === "ACTIVE" || value === "COMPLETED" || value === "PAUSED") {
    return value;
  }
  return null;
}

function parseContributionType(value: unknown): GoalContributionType | null {
  if (value === "ADD" || value === "REMOVE") return value;
  return null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type GoalRow = {
  id: number;
  title: string;
  description: string | null;
  targetAmount: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
  deadline: Date | null;
  status: GoalStatus;
  userId: number | null;
  familyId: number | null;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  family?: { id: number; name: string } | null;
  createdBy?: { id: number; name: string; email: string };
};

function computeProgress(target: Prisma.Decimal, current: Prisma.Decimal) {
  const targetNum = decimalToNumber(target);
  const currentNum = decimalToNumber(current);
  const remainingAmount = roundMoney(Math.max(targetNum - currentNum, 0));
  const progressPercent =
    targetNum > 0 ? roundMoney((currentNum / targetNum) * 100) : 0;
  const isCompleted = current.gte(target);
  return { remainingAmount, progressPercent, isCompleted };
}

async function serializeGoal(goal: GoalRow, userId: number) {
  const { remainingAmount, progressPercent, isCompleted } = computeProgress(
    goal.targetAmount,
    goal.currentAmount,
  );
  const scope = goal.familyId === null ? "PERSONAL" : "FAMILY";

  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    targetAmount: decimalToNumber(goal.targetAmount),
    currentAmount: decimalToNumber(goal.currentAmount),
    deadline: goal.deadline,
    status: goal.status,
    userId: goal.userId,
    familyId: goal.familyId,
    createdById: goal.createdById,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    scope,
    familyName: goal.family?.name ?? null,
    remainingAmount,
    progressPercent,
    isCompleted,
    canManage: await canManageGoal(goal, userId),
    canContribute: await canContributeToGoal(goal, userId),
    createdBy: goal.createdBy ?? undefined,
  };
}

async function findVisibleGoal(id: number, userId: number) {
  const familyIds = await getUserFamilyIds(userId);
  return prisma.financialGoal.findFirst({
    where: {
      id,
      OR: [
        { userId },
        ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
      ],
    },
    include: {
      family: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

function syncStatusAfterAmountChange(
  current: Prisma.Decimal,
  target: Prisma.Decimal,
  status: GoalStatus,
): GoalStatus {
  if (current.gte(target)) return "COMPLETED";
  if (status === "COMPLETED") return "ACTIVE";
  return status;
}

goalsRouter.get("/", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const familyIds = await getUserFamilyIds(userId);

  const goals = await prisma.financialGoal.findMany({
    where: {
      OR: [
        { userId },
        ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
      ],
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    include: {
      family: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const result = await Promise.all(goals.map((g) => serializeGoal(g, userId)));
  return res.json(result);
});

goalsRouter.post("/", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { title, description, targetAmount, deadline, familyId } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ message: "title is required" });
  }

  const parsedTarget = parseAmount(targetAmount);
  if (!parsedTarget) {
    return res.status(400).json({ message: "targetAmount must be a positive number" });
  }

  const parsedFamilyId =
    familyId === undefined || familyId === null || familyId === ""
      ? null
      : parseId(familyId);

  if (familyId !== undefined && familyId !== null && familyId !== "" && !parsedFamilyId) {
    return res.status(400).json({ message: "Invalid familyId" });
  }

  let deadlineDate: Date | null = null;
  if (deadline !== undefined && deadline !== null && deadline !== "") {
    deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: "Invalid deadline" });
    }
  }

  if (parsedFamilyId) {
    const canCreate = await canCreateFamilyGoal(parsedFamilyId, userId);
    if (!canCreate) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const created = await prisma.financialGoal.create({
    data: {
      title: title.trim(),
      description:
        typeof description === "string" ? description.trim() || null : null,
      targetAmount: parsedTarget,
      currentAmount: new Prisma.Decimal(0),
      deadline: deadlineDate,
      status: "ACTIVE",
      userId: parsedFamilyId ? null : userId,
      familyId: parsedFamilyId,
      createdById: userId,
    },
    include: {
      family: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json(await serializeGoal(created, userId));
});

goalsRouter.get("/:id/contributions", async (req: AuthRequest, res) => {
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(400).json({ message: "Invalid id" });

  const goal = await findVisibleGoal(goalId, req.user!.id);
  if (!goal) return res.status(404).json({ message: "Not found" });

  const contributions = await prisma.goalContribution.findMany({
    where: { goalId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return res.json(
    contributions.map((c) => ({
      id: c.id,
      goalId: c.goalId,
      userId: c.userId,
      amount: decimalToNumber(c.amount),
      type: c.type,
      comment: c.comment,
      createdAt: c.createdAt,
      user: c.user,
    })),
  );
});

goalsRouter.post("/:id/contributions", async (req: AuthRequest, res) => {
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(400).json({ message: "Invalid id" });

  const goal = await findVisibleGoal(goalId, req.user!.id);
  if (!goal) return res.status(404).json({ message: "Not found" });

  if (!(await canContributeToGoal(goal, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { amount, type, comment } = req.body;
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const contributionType = type === undefined ? "ADD" : parseContributionType(type);
  if (!contributionType) {
    return res.status(400).json({ message: "type must be ADD or REMOVE" });
  }

  let newCurrent: Prisma.Decimal;
  if (contributionType === "ADD") {
    newCurrent = goal.currentAmount.add(parsedAmount);
  } else {
    newCurrent = goal.currentAmount.sub(parsedAmount);
    if (newCurrent.lt(0)) {
      return res.status(400).json({ message: "currentAmount cannot be negative" });
    }
  }

  const newStatus = syncStatusAfterAmountChange(
    newCurrent,
    goal.targetAmount,
    goal.status,
  );

  const [contribution, updatedGoal] = await prisma.$transaction([
    prisma.goalContribution.create({
      data: {
        goalId,
        userId: req.user!.id,
        amount: parsedAmount,
        type: contributionType,
        comment: typeof comment === "string" ? comment.trim() || null : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.financialGoal.update({
      where: { id: goalId },
      data: {
        currentAmount: newCurrent,
        status: newStatus,
      },
      include: {
        family: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return res.status(201).json({
    contribution: {
      id: contribution.id,
      goalId: contribution.goalId,
      userId: contribution.userId,
      amount: decimalToNumber(contribution.amount),
      type: contribution.type,
      comment: contribution.comment,
      createdAt: contribution.createdAt,
      user: contribution.user,
    },
    goal: await serializeGoal(updatedGoal, req.user!.id),
  });
});

goalsRouter.get("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const goal = await findVisibleGoal(id, req.user!.id);
  if (!goal) return res.status(404).json({ message: "Not found" });

  return res.json(await serializeGoal(goal, req.user!.id));
});

goalsRouter.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await findVisibleGoal(id, req.user!.id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  if (!(await canManageGoal(existing, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { title, description, targetAmount, deadline, status } = req.body;

  const hasAny =
    title !== undefined ||
    description !== undefined ||
    targetAmount !== undefined ||
    deadline !== undefined ||
    status !== undefined;

  if (!hasAny) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  if (title !== undefined && !isNonEmptyString(title)) {
    return res.status(400).json({ message: "title is required" });
  }

  const nextTarget =
    targetAmount === undefined ? existing.targetAmount : parseAmount(targetAmount);
  if (targetAmount !== undefined && !nextTarget) {
    return res.status(400).json({ message: "targetAmount must be a positive number" });
  }

  const nextStatus =
    status === undefined ? existing.status : parseGoalStatus(status);
  if (status !== undefined && !nextStatus) {
    return res.status(400).json({ message: "status must be ACTIVE, COMPLETED or PAUSED" });
  }

  let nextDeadline = existing.deadline;
  if (deadline !== undefined) {
    if (deadline === null || deadline === "") {
      nextDeadline = null;
    } else {
      nextDeadline = new Date(deadline);
      if (Number.isNaN(nextDeadline.getTime())) {
        return res.status(400).json({ message: "Invalid deadline" });
      }
    }
  }

  let resolvedStatus = nextStatus ?? existing.status;
  if (existing.currentAmount.gte(nextTarget!)) {
    resolvedStatus = "COMPLETED";
  } else if (resolvedStatus === "COMPLETED") {
    resolvedStatus = "ACTIVE";
  }

  const updated = await prisma.financialGoal.update({
    where: { id },
    data: {
      title: title !== undefined ? title.trim() : existing.title,
      description:
        description === undefined
          ? existing.description
          : typeof description === "string"
            ? description.trim() || null
            : null,
      targetAmount: nextTarget!,
      deadline: nextDeadline,
      status: resolvedStatus,
    },
    include: {
      family: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return res.json(await serializeGoal(updated, req.user!.id));
});

goalsRouter.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await findVisibleGoal(id, req.user!.id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  if (!(await canManageGoal(existing, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await prisma.financialGoal.delete({ where: { id } });
  return res.json({ success: true });
});
