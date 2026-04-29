import { scrapeHomePage } from "../../scrapers/aniwatch/scrapers";
import type { RequestHandler } from "express";
import { enrichWithTMDB } from "../../utils/tmdbMapper";

const getHomePageInfo: RequestHandler = async (_req, res) => {
  try {
    const data: any = await scrapeHomePage();
    
    // Enrich all major sections with TMDB metadata
    if (data) {
      const enrichmentTasks = [
        enrichWithTMDB(data.spotLightAnimes).then(res => data.spotLightAnimes = res),
        enrichWithTMDB(data.trendingAnimes).then(res => data.trendingAnimes = res),
        enrichWithTMDB(data.latestEpisodes).then(res => data.latestEpisodes = res),
        enrichWithTMDB(data.topAiringAnimes).then(res => data.topAiringAnimes = res),
        enrichWithTMDB(data.topUpcomingAnimes).then(res => data.topUpcomingAnimes = res),
        enrichWithTMDB(data.top10Animes.day).then(res => data.top10Animes.day = res),
        enrichWithTMDB(data.top10Animes.week).then(res => data.top10Animes.week = res),
        enrichWithTMDB(data.top10Animes.month).then(res => data.top10Animes.month = res),
      ];
      
      await Promise.all(enrichmentTasks);
    }
    
    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { getHomePageInfo };
