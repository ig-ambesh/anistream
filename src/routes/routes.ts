import aniwatch_router from "./aniwatch/routes";
import gogoanime_router from "./gogoanime/routes";
import hindidub_router from "./hindidub/routes";
import tmdb_router from "./tmdb/routes";
import jikan_router from "./jikan/routes";
import { getRoot } from "../lib/getRoot";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

// /
router.get("/status", getRoot);

// health check API
router.get("/health", (_req, res) => {
  res.sendStatus(200);
});

// aniwatch
router.use("/aniwatch", aniwatch_router);

// gogoanime
router.use("/gogoanime", gogoanime_router);

// hindidub (Hindi/Tamil/Telugu/English from WatchAnimeWorld)
router.use("/hindidub", hindidub_router);

// tmdb
router.use("/tmdb", tmdb_router);

// jikan
router.use("/jikan", jikan_router);

export { router };
