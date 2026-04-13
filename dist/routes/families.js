"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.familiesRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.familiesRouter = (0, express_1.Router)();
exports.familiesRouter.use(auth_1.authMiddleware);
exports.familiesRouter.post("/", async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ message: "name is required" });
    }
    const family = await prisma_1.prisma.familyGroup.create({
        data: {
            name,
            description,
            members: {
                create: {
                    userId: req.user.id,
                    role: "OWNER",
                },
            },
        },
        include: { members: true },
    });
    return res.status(201).json(family);
});
exports.familiesRouter.get("/", async (req, res) => {
    const families = await prisma_1.prisma.familyGroup.findMany({
        where: {
            members: {
                some: {
                    userId: req.user.id,
                },
            },
        },
        include: { members: true },
    });
    return res.json(families);
});
