import { Router, type IRouter } from "express";
import { getRecentReleases, getNewSeasons, getPopularAnimes, getAnimeMovies, searchAnime, getAnimeInfo, getEpisodeSources } from "../../controllers/gogoanime/controllers";
import { apiCache } from '../../middleware/cache';

const gogoanime_router: IRouter = Router();

// /gogoanime.
gogoanime_router.get("/", (_req, res) => {
  res.redirect("/");
}); // TODO: make custom gogoanime api docs API

// /gogoanime/recent-releases
gogoanime_router.get("/recent-releases", apiCache, getRecentReleases);

// /gogoanime/new-seasons
gogoanime_router.get("/new-seasons", apiCache, getNewSeasons);

// /gogoanime/popular
gogoanime_router.get("/popular", apiCache, getPopularAnimes);

// /gogoanime/anime-movies
gogoanime_router.get("/anime-movies", apiCache, getAnimeMovies);

// /gogoanime/search
gogoanime_router.get("/search", apiCache, searchAnime); // Search shouldn't heavily cache user queries usually, but could. Leaving it dynamic.

// /gogoanime/anime/:id
gogoanime_router.get("/anime/:id", apiCache, getAnimeInfo);

// /gogoanime/episode-srcs
gogoanime_router.get("/episode-srcs", getEpisodeSources); // Never cache streaming sources

export default gogoanime_router;
