import { scrapeAboutPage } from "../../scrapers/aniwatch/about";
import type { RequestHandler } from "express";
import { enrichSingleWithTMDB } from "../../utils/tmdbMapper";

const getAboutPageInfo: RequestHandler = async (req, res) => {
  try {
    const data = await scrapeAboutPage(req.params.id);
    
    // Enrich with detailed TMDB metadata
    const enrichedData = await enrichSingleWithTMDB(data);
    
    res.status(200).json(enrichedData);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { getAboutPageInfo };
