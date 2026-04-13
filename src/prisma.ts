import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import dotenv from "dotenv";
// Ensure env is loaded before checking DATABASE_URL (Prisma client is imported early).
dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Prisma ORM 7 requires configuring the driver via `adapter`.
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

