import { URL_fn } from "../../utils/gogoanime/constants";
import { headers } from "../../config/headers";
import axios, { AxiosError } from "axios";
import { load } from "cheerio";
import createHttpError, { HttpError } from "http-errors";
import { AnimeDetails } from "../../types/gogoanime/anime";

export const scrapeAnimeInfo = async (
  animeId: string,
): Promise<AnimeDetails | HttpError> => {
  const URLs = await URL_fn();
  try {
    const mainPage = await axios.get(`${URLs.BASE}/category/${animeId}`, {
      headers: {
        "User-Agent": headers.USER_AGENT_HEADER,
        "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
        Accept: headers.ACCEPT_HEADER,
      },
    });

    const $ = load(mainPage.data);

    const animeInfo = $("div.anime_info_body_bg");
    const img = animeInfo.children("img").attr("src");
    const name = animeInfo.children("h1").text().trim();
    
    let type = "";
    let plotSummary = "";
    let genre = "";
    let released = "";
    let status = "";
    let otherName = "";

    animeInfo.children("p.type").each((_i, el) => {
      const typeText = $(el).find("span").text().trim();
      if (typeText.includes("Type:")) {
        type = $(el).text().replace("Type:", "").trim();
      } else if (typeText.includes("Plot Summary:")) {
        plotSummary = $(el).text().replace("Plot Summary:", "").trim();
      } else if (typeText.includes("Genre:")) {
        genre = $(el).text().replace("Genre:", "").trim();
      } else if (typeText.includes("Released:")) {
        released = $(el).text().replace("Released:", "").trim();
      } else if (typeText.includes("Status:")) {
        status = $(el).text().replace("Status:", "").trim();
      } else if (typeText.includes("Other name:")) {
        otherName = $(el).text().replace("Other name:", "").trim();
      }
    });

    const ep_start = $("#episode_page > li").first().find("a").attr("ep_start");
    const ep_end = $("#episode_page > li").last().find("a").attr("ep_end");
    const movie_id = $("#movie_id").attr("value");
    const alias = $("#alias_anime").attr("value");

    const res: AnimeDetails = {
      id: animeId,
      name: name || null,
      img: img || null,
      type,
      plotSummary,
      genre,
      released,
      status,
      otherName,
      totalEpisodes: parseInt(ep_end || "0", 10),
      episodes: [],
    };

    // Parse episodes from the page directly
    $("#episode_related li").each((_i, el) => {
      const a = $(el).find("a");
      const epNum = a.find("div.name").text().replace("EP", "").trim();
      const epUrl = a.attr("href")?.trim();
      
      if (epUrl) {
        res.episodes.push({
          episodeId: epUrl.replace("/", ""),
          episodeNo: parseFloat(epNum),
          episodeUrl: URLs.BASE + epUrl,
        });
      }
    });

    if (res.episodes.length === 0 && movie_id) {
      const epsPage = await axios.get(
        `${URLs.AJAX}/load-list-episode?ep_start=${ep_start}&ep_end=${ep_end}&id=${movie_id}&default_ep=0&alias=${alias}`,
        {
          headers: {
            "User-Agent": headers.USER_AGENT_HEADER,
            "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
            Accept: headers.ACCEPT_HEADER,
          },
        }
      );

      const $$ = load(epsPage.data);
      $$("ul > li").each((_i, el) => {
        const a = $$(el).find("a");
        const epNum = a.find("div.name").text().replace("EP", "").trim();
        const epUrl = a.attr("href")?.trim();
        
        if (epUrl) {
          res.episodes.push({
            episodeId: epUrl.replace("/", ""),
            episodeNo: parseFloat(epNum),
            episodeUrl: URLs.BASE + epUrl,
          });
        }
      });
      res.episodes.reverse();
    } else {
        // Sort episodes by number
        res.episodes.sort((a, b) => a.episodeNo - b.episodeNo);
    }

    return res;
  } catch (err) {
    console.error("Error in scrapeAnimeInfo (gogoanime) :", err);
    if (err instanceof AxiosError) {
      throw createHttpError(
        err?.response?.status || 500,
        err?.response?.statusText || "Something went wrong",
      );
    } else {
      throw createHttpError.InternalServerError("Internal server error");
    }
  }
};
