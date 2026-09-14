import { Router, type IRouter } from "express";

import healthRouter from "./health";
import productsRouter from "./products";
import salesRouter from "./sales";
import expensesRouter from "./expenses";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";
import uploadsRouter from "./uploads";
import debtsRouter from "./debts";
import stockPurchasesRouter from "./stock-purchases";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(salesRouter);
router.use(expensesRouter);
router.use(tasksRouter);
router.use(dashboardRouter);
router.use(uploadsRouter);
router.use(debtsRouter);
router.use(stockPurchasesRouter);

export default router;