import type { RequestHandler } from "express";
import { scrapeRecentReleases } from "../../scrapers/gogoanime/scrappers";
import { enrichWithTMDB } from "../../utils/tmdbMapper";

const getRecentReleases: RequestHandler = async (req, res) => {
  try {
    const page = req.query.page
      ? Number(decodeURIComponent(req.query?.page as string))
      : 1;
    const data = await scrapeRecentReleases(page);
    
    // Enrich with TMDB metadata
    const enrichedData = Array.isArray(data) ? await enrichWithTMDB(data) : data;
    
    res.status(200).json(enrichedData);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { getRecentReleases };
