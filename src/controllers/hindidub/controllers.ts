import { scrapeSearchPage } from "../../scrapers/hindidub/search";
import { scrapeAnimeInfo } from "../../scrapers/hindidub/anime";
import { scrapeEpisodeSources, extractZephyrFlick } from "../../scrapers/hindidub/servers";
import type { RequestHandler } from "express";

export const searchAnime: RequestHandler = async (req, res) => {
  try {
    const keyword = req.query.keyword as string;
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }
    const data = await scrapeSearchPage(keyword);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in hindi searchAnime:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAnimeInfo: RequestHandler = async (req, res) => {
  try {
    const slug = req.params.id;
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }
    const data = await scrapeAnimeInfo(slug);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in hindi getAnimeInfo:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getEpisodeSources: RequestHandler = async (req, res) => {
  try {
    const episodeId = req.query.id as string;
    const isMovie = req.query.movie === "true";
    if (!episodeId) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    const data = await scrapeEpisodeSources(episodeId, isMovie);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in hindi getEpisodeSources:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDirectStream: RequestHandler = async (req, res) => {
  try {
    const playerUrl = req.query.url as string;
    if (!playerUrl) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const data = await extractZephyrFlick(playerUrl);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in hindi getDirectStream:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
