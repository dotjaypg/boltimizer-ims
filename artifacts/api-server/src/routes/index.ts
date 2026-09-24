import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import inventoryRouter from "./inventory";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(inventoryRouter);

export default router;
