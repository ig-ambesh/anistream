import { scrapeSearchPage } from "../../scrapers/aniwatch/search";
import createHttpError from "http-errors";
import type { RequestHandler } from "express";
import { enrichWithTMDB } from "../../utils/tmdbMapper";

const getSearchPageInfo: RequestHandler = async (req, res) => {
  try {
    const page: number = req.query.page
      ? Number(decodeURIComponent(req.query?.page as string))
      : 1;
    const keyword: string | null = req.query.keyword
      ? decodeURIComponent(req.query.keyword as string)
      : null;

    if (keyword === null) {
      throw createHttpError.BadRequest("Search keyword required");
    }

    const data: any = await scrapeSearchPage(keyword, page);
    
    // Enrich search results and sidebar
    if (data) {
      if (data.animes) data.animes = await enrichWithTMDB(data.animes);
      if (data.mostPopularAnimes) data.mostPopularAnimes = await enrichWithTMDB(data.mostPopularAnimes);
    }
    
    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { getSearchPageInfo };
