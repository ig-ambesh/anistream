import { URL_fn } from "../../utils/gogoanime/constants";
import { headers } from "../../config/headers";
import axios, { AxiosError } from "axios";
import { load } from "cheerio";
import createHttpError, { HttpError } from "http-errors";
import { ScrapedSearchPage, NewSeason } from "../../types/gogoanime/anime";

export const scrapeSearchPage = async (
  query: string,
  page: number,
): Promise<ScrapedSearchPage | HttpError> => {
  const URLs = await URL_fn();
  try {
    const res: ScrapedSearchPage = {
      animes: [],
      currentPage: page,
      hasNextPage: false,
      totalPages: 1,
    };

    const mainPage = await axios.get(
      `${URLs.BASE}/search.html?keyword=${encodeURIComponent(query)}&page=${page}`,
      {
        headers: {
          "User-Agent": headers.USER_AGENT_HEADER,
          "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
          Accept: headers.ACCEPT_HEADER,
        },
      },
    );

    const $ = load(mainPage.data);

    $("div.last_episodes > ul > li").each((_i, el) => {
      const a = $(el).find("p.name a");
      const img = $(el).find("div.img a img");
      const released = $(el).find("p.released").text().trim();

      res.animes.push({
        id: a.attr("href")?.split("/category/")[1] || null,
        name: a.attr("title") || null,
        img: img.attr("src") || null,
        releasedYear: released.replace("Released:", "").trim(),
        animeUrl: URLs.BASE + a.attr("href"),
      });
    });

    const pagination = $("ul.pagination-list li");
    if (pagination.length > 0) {
      const lastPageText = pagination.last().text();
      const lastPageLink = pagination.last().find("a").attr("href");
      
      if (lastPageText.includes("Next")) {
        res.hasNextPage = true;
      }

      if (lastPageLink) {
        const urlParams = new URLSearchParams(lastPageLink.split("?")[1]);
        res.totalPages = parseInt(urlParams.get("page") || "1", 10);
      }
    }

    return res;
  } catch (err) {
    console.error("Error in scrapeSearchPage (gogoanime) :", err);
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
