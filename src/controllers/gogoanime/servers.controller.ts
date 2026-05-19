import { scrapeEpisodeSources } from "../../scrapers/gogoanime/servers";
import type { RequestHandler } from "express";

export const getEpisodeSources: RequestHandler = async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "id query parameter is required" });
      return;
    }

    const data = await scrapeEpisodeSources(id);
    res.status(200).json(data);
  } catch (err) {
    console.error("Error in getEpisodeSources controller:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
