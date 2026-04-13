"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv_1 = __importDefault(require("dotenv"));
// Ensure env is loaded before checking DATABASE_URL (Prisma client is imported early).
dotenv_1.default.config({ override: true });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}
// Prisma ORM 7 requires configuring the driver via `adapter`.
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
exports.prisma = new client_1.PrismaClient({ adapter });
