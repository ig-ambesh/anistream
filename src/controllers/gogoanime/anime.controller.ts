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
        const title = tmdbDetails.name || tmdbDetails.title || "";
        const { scrapeSearchPage } = require("../../scrapers/gogoanime/search");
        
        let foundId = "";
        
        // 1. Try full title search
        try {
          const searchResults = await scrapeSearchPage(title, 1);
          if (searchResults && searchResults.animes && searchResults.animes.length > 0) {
            foundId = searchResults.animes[0].id;
          }
        } catch (e) {
          // ignore search errors and try fallback
        }
        
        // 2. Try subtitle splitting (e.g. "Attack on Titan: The Last Attack" -> "Attack on Titan")
        if (!foundId && (title.includes(":") || title.includes("-") || title.includes("–") || title.includes("("))) {
          const parts = title.split(/[:\-–(]/);
          const cleanTitle = parts[0].trim();
          if (cleanTitle.length > 2) {
            try {
              const searchResults = await scrapeSearchPage(cleanTitle, 1);
              if (searchResults && searchResults.animes && searchResults.animes.length > 0) {
                // Find matching movie title
                const movieMatch = searchResults.animes.find((a: any) => 
                  a.name.toLowerCase().includes("movie") || 
                  a.id.toLowerCase().includes("movie")
                );
                foundId = movieMatch ? movieMatch.id : searchResults.animes[0].id;
              }
            } catch (e) {
              // ignore search errors
            }
          }
        }
        
        if (foundId) {
          id = foundId;
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
