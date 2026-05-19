import { scrapeSearchPage } from "../../scrapers/gogoanime/search";
import type { RequestHandler } from "express";
import { enrichWithTMDB } from "../../utils/tmdbMapper";

export const searchAnime: RequestHandler = async (req, res) => {
  try {
    const keyword = req.query.keyword as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }

    const data = await scrapeSearchPage(keyword, page);
    
    // Enrich the list of animes in the search results
    if (data && data.animes) {
      data.animes = await enrichWithTMDB(data.animes);
    }
    
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in searchAnime controller:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
