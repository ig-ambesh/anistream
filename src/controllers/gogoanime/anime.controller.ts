import { scrapeAnimeInfo } from "../../scrapers/gogoanime/anime";
import type { RequestHandler } from "express";
import { enrichSingleWithTMDB } from "../../utils/tmdbMapper";

export const getAnimeInfo: RequestHandler = async (req, res) => {
  try {
    let id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "id parameter is required" });
      return;
    }

    if (id.startsWith("tmdb-")) {
      const tmdbId = id.replace("tmdb-", "");
      const { getTMDBDetails } = require("../../lib/tmdb");
      let tmdbDetails = await getTMDBDetails(tmdbId, "tv");
      if (!tmdbDetails) {
        tmdbDetails = await getTMDBDetails(tmdbId, "movie");
      }
      
      if (tmdbDetails) {
        const title = tmdbDetails.name || tmdbDetails.title;
        const { scrapeSearchPage } = require("../../scrapers/gogoanime/search");
        const searchResults = await scrapeSearchPage(title, 1);
        if (searchResults && searchResults.animes && searchResults.animes.length > 0) {
          id = searchResults.animes[0].id;
        } else {
          id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }
      }
    }

    const data = await scrapeAnimeInfo(id);
    
    // Enrich with single TMDB metadata (cast, trailers, etc.)
    const enrichedData = await enrichSingleWithTMDB(data);
    
    res.status(200).json(enrichedData);
  } catch (err) {
    console.error("Error in getAnimeInfo controller:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
