import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { OperationType } from "../../generated/prisma/enums";

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

categoriesRouter.post("/", async (req: AuthRequest, res) => {
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

    const category = await prisma.category.findFirst({
      where: { userId: req.user!.id, name },
    });

    if (category) {
      return res.status(409).json({
        message: "Category with this name already exists",
      });
    }

    const created = await prisma.category.create({
      data: {
        name,
        type: operationType,
        color: typeof color === "string" ? color : null,
        icon: typeof icon === "string" ? icon : null,
        userId: req.user!.id,
        familyId: familyId ? Number(familyId) : null,
        isDefault: !familyId,
      },
    });

    return res.status(201).json(created);
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

  const operationType = parseOperationType(type);

  const categories = await prisma.category.findMany({
    where: {
      userId: req.user!.id,
      ...(operationType ? { type: operationType } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json(categories);
});

categoriesRouter.get("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const category = await prisma.category.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!category) return res.status(404).json({ message: "Not found" });

  return res.json(category);
});

categoriesRouter.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const existing = await prisma.category.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!existing) return res.status(404).json({ message: "Not found" });

  const { name, type, color, icon, familyId } = req.body;

  const hasAnyUpdate =
    name !== undefined ||
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
    const duplicated = await prisma.category.findFirst({
      where: { userId: req.user!.id, name },
    });
    if (duplicated) {
      return res.status(409).json({
        message: "Category with this name already exists",
      });
    }
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      name: name ?? existing.name,
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
      familyId:
        familyId === undefined ? existing.familyId : familyId ? Number(familyId) : null,
      isDefault: familyId === undefined ? existing.isDefault : !familyId,
    },
  });

  return res.json(updated);
});

categoriesRouter.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const deleted = await prisma.category.deleteMany({
    where: { id, userId: req.user!.id },
  });

  if (deleted.count === 0) {
    return res.status(404).json({ message: "Not found" });
  }

  return res.status(204).send();
});
