import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth";
import { operationsRouter } from "./routes/operations";
import { categoriesRouter } from "./routes/categories";
import { familiesRouter } from "./routes/families";
import { analyticsRouter } from "./routes/analytics";
import { limitsRouter } from "./routes/limits";

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/operations", operationsRouter);
app.use("/categories", categoriesRouter);
app.use("/families", familiesRouter);
app.use("/limits", limitsRouter);
app.use("/analytics", analyticsRouter);

