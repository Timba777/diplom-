import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { OperationType } from "../../generated/prisma/enums";
import {
  canManageCategory,
  categoryScope,
  getUserFamilyIds,
  isFamilyMember,
} from "../lib/familyAccess";

export const categoriesRouter = Router();

categoriesRouter.use(authMiddleware);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOperationType(value: unknown): OperationType | null {
  if (value === "INCOME" || value === "EXPENSE") return value;
  return null;
}

function parseId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

type CategoryRow = {
  id: number;
  name: string;
  type: OperationType;
  color: string | null;
  icon: string | null;
  userId: number;
  familyId: number | null;
  isDefault: boolean;
  createdAt: Date;
  family?: { id: number; name: string } | null;
};

async function serializeCategory(
  category: CategoryRow,
  userId: number,
): Promise<{
  id: number;
  name: string;
  type: OperationType;
  color: string | null;
  icon: string | null;
  userId: number;
  familyId: number | null;
  familyName: string | null;
  isDefault: boolean;
  createdAt: Date;
  scope: "PERSONAL" | "FAMILY";
  canManage: boolean;
}> {
  const scope = categoryScope(category.familyId);
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
    canManage: await canManageCategory(category, userId),
  };
}

async function findVisibleCategory(id: number, userId: number) {
  const familyIds = await getUserFamilyIds(userId);
  return prisma.category.findFirst({
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

categoriesRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, type, color, icon, familyId } = req.body;
    const userId = req.user!.id;

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ message: "name is required" });
    }

    const operationType = parseOperationType(type);
    if (!operationType) {
      return res
        .status(400)
        .json({ message: "type must be INCOME or EXPENSE" });
    }

    const parsedFamilyId =
      familyId === undefined || familyId === null || familyId === ""
        ? null
        : parseId(familyId);

    if (familyId !== undefined && familyId !== null && familyId !== "" && !parsedFamilyId) {
      return res.status(400).json({ message: "Invalid familyId" });
    }

    if (parsedFamilyId) {
      const member = await isFamilyMember(parsedFamilyId, userId);
      if (!member) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const duplicate = await prisma.category.findFirst({
        where: { familyId: parsedFamilyId, name },
      });
      if (duplicate) {
        return res.status(409).json({
          message: "Category with this name already exists in this family",
        });
      }
    } else {
      const duplicate = await prisma.category.findFirst({
        where: { userId, familyId: null, name },
      });
      if (duplicate) {
        return res.status(409).json({
          message: "Category with this name already exists",
        });
      }
    }

    const created = await prisma.category.create({
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
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") {
        return res.status(409).json({
          message: "Category with this name already exists",
        });
      }
    }

    return res.status(500).json({ message: "Failed to create category" });
  }
});

categoriesRouter.get("/", async (req: AuthRequest, res) => {
  const { type } = req.query;
  const userId = req.user!.id;
  const operationType = parseOperationType(type);
  const familyIds = await getUserFamilyIds(userId);

  const categories = await prisma.category.findMany({
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

  const result = await Promise.all(
    categories.map((c) => serializeCategory(c, userId)),
  );

  return res.json(result);
});

categoriesRouter.get("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const category = await findVisibleCategory(id, req.user!.id);
  if (!category) return res.status(404).json({ message: "Not found" });

  return res.json(await serializeCategory(category, req.user!.id));
});

categoriesRouter.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await findVisibleCategory(id, req.user!.id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  if (!(await canManageCategory(existing, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { name, type, color, icon } = req.body;

  const hasAnyUpdate =
    name !== undefined || type !== undefined || color !== undefined || icon !== undefined;

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
      const duplicated = await prisma.category.findFirst({
        where: { userId: req.user!.id, familyId: null, name: nextName },
      });
      if (duplicated && duplicated.id !== existing.id) {
        return res.status(409).json({
          message: "Category with this name already exists",
        });
      }
    } else {
      const duplicated = await prisma.category.findFirst({
        where: { familyId: existing.familyId, name: nextName },
      });
      if (duplicated && duplicated.id !== existing.id) {
        return res.status(409).json({
          message: "Category with this name already exists in this family",
        });
      }
    }
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      type: operationType ?? existing.type,
      color:
        color === undefined
          ? existing.color
          : typeof color === "string"
            ? color
            : null,
      icon:
        icon === undefined
          ? existing.icon
          : typeof icon === "string"
            ? icon
            : null,
    },
    include: { family: { select: { id: true, name: true } } },
  });

  return res.json(await serializeCategory(updated, req.user!.id));
});

categoriesRouter.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await findVisibleCategory(id, req.user!.id);
  if (!existing) return res.status(404).json({ message: "Not found" });

  if (!(await canManageCategory(existing, req.user!.id))) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await prisma.category.delete({ where: { id: existing.id } });
  return res.status(204).send();
});

/** Экспорт для operations / limits */
export async function resolveCategoryForOperation(
  categoryId: number,
  userId: number,
  operationFamilyId: number | null,
) {
  const familyIds = await getUserFamilyIds(userId);
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [
        { userId, familyId: null },
        ...(familyIds.length ? [{ familyId: { in: familyIds } }] : []),
      ],
    },
    select: { id: true, familyId: true, type: true },
  });

  if (!category) return { ok: false as const, status: 400, message: "Invalid categoryId" };

  if (operationFamilyId !== null) {
    if (category.familyId !== operationFamilyId) {
      return {
        ok: false as const,
        status: 400,
        message: "Category does not belong to this family",
      };
    }
  } else if (category.familyId !== null) {
    return {
      ok: false as const,
      status: 400,
      message: "Category is not personal",
    };
  }

  return { ok: true as const, category };
}

export async function resolveCategoryForLimit(
  categoryId: number,
  userId: number,
  limitFamilyId: number | null,
) {
  if (limitFamilyId !== null) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, familyId: limitFamilyId },
      select: { id: true, familyId: true },
    });
    if (!category) {
      return {
        ok: false as const,
        status: 404,
        message: "Category not found",
      };
    }
    return { ok: true as const, category };
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, familyId: null },
    select: { id: true, familyId: true },
  });
  if (!category) {
    return {
      ok: false as const,
      status: 404,
      message: "Category not found",
    };
  }
  return { ok: true as const, category };
}
