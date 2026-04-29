import { scrapeAnimeInfo } from "../../scrapers/gogoanime/anime";
import type { RequestHandler } from "express";
import { enrichSingleWithTMDB } from "../../utils/tmdbMapper";

export const getAnimeInfo: RequestHandler = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "id parameter is required" });
      return;
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
