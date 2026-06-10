import { Router, type IRouter } from "express";
import { searchAnime, getAnimeInfo, getEpisodeSources, getDirectStream } from "../../controllers/hindidub/controllers";

const hindidub_router: IRouter = Router();

// /hindidub
hindidub_router.get("/", (_req, res) => {
  res.json({
    source: "WatchAnimeWorld.net",
    languages: ["Hindi", "Tamil", "Telugu", "English", "Japanese"],
    endpoints: {
      search: "/hindidub/search?keyword=naruto",
      animeInfo: "/hindidub/anime/:slug",
      episodeSources: "/hindidub/episode-srcs?id=slug-1x1&movie=false",
      directStream: "/hindidub/extract?url=https://play.zephyrflick.top/video/...",
    },
  });
});

// /hindidub/search?keyword=naruto
hindidub_router.get("/search", searchAnime);

// /hindidub/anime/:id
hindidub_router.get("/anime/:id", getAnimeInfo);

// /hindidub/episode-srcs?id=slug-1x1&movie=false
hindidub_router.get("/episode-srcs", getEpisodeSources);

// /hindidub/extract?url=https://play.zephyrflick.top/video/abc123
hindidub_router.get("/extract", getDirectStream);

export default hindidub_router;
