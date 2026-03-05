import express, { type Express } from "express";
import cors from "cors";
import apiRouter from "./routes/index.js";
import { logger } from "./utils/logger.js";

const app: Express = express();

app.use(cors());
app.use(express.json());

// Request logger — shows every HTTP request that reaches Express
app.use((req, _res, next) => {
  logger.info(`[http] ${req.method} ${req.url}`);
  next();
});

app.use("/api", apiRouter);

export default app;
