import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import siswaRouter from "./siswa";
import guruRouter from "./guru";
import kelasRouter from "./kelas";
import mataPelajaranRouter from "./mata-pelajaran";
import jadwalRouter from "./jadwal";
import absensiRouter from "./absensi";
import nilaiRouter from "./nilai";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(siswaRouter);
router.use(guruRouter);
router.use(kelasRouter);
router.use(mataPelajaranRouter);
router.use(jadwalRouter);
router.use(absensiRouter);
router.use(nilaiRouter);
router.use(chatRouter);

export default router;
