import { Router, type IRouter } from "express";

const aniwatch_router: IRouter = Router();

// AniWatch/HiAnime shut down in March 2026.
// All routes now return a 503 Service Unavailable response.
const shutdownHandler = (_req: any, res: any) => {
  res.status(503).json({
    success: false,
    error: "AniWatch/HiAnime has been permanently shut down as of March 2026. This data source is no longer available.",
  });
};

aniwatch_router.use(shutdownHandler);

export default aniwatch_router;
