import { URL_fn } from "../../utils/gogoanime/constants";
import { headers } from "../../config/headers";
import axios, { AxiosError } from "axios";
import { load } from "cheerio";
import createHttpError, { HttpError } from "http-errors";

export const scrapeEpisodeSources = async (
  episodeId: string,
): Promise<any | HttpError> => {
  const URLs = await URL_fn();
  try {
    const mainPage = await axios.get(`${URLs.BASE}/${episodeId}`, {
      headers: {
        "User-Agent": headers.USER_AGENT_HEADER,
        "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
        Accept: headers.ACCEPT_HEADER,
      },
    });

    const $ = load(mainPage.data);

    const servers: any[] = [];
    $(".anime_muti_link ul li.server").each((_i, el) => {
      const a = $(el).find("a");
      const name = a.text().replace("Choose this server", "").trim();
      let url = a.attr("data-video");
      const tab = a.attr("data-tab");
      
      if (url && url.startsWith("//")) {
        url = "https:" + url;
      }

      let type = 'SUB';
      if (tab === 'tab_0') type = 'HSUB';
      if (tab === 'tab_2') type = 'DUB';
      if (tab === 'tab_1') type = 'SUB';

      servers.push({ name, url, type });
    });

    const defaultIframe = servers.find(s => s.type === 'SUB')?.url 
                       || servers.find(s => s.type === 'HSUB')?.url
                       || servers[0]?.url;

    const downloadLink = $("div.favorites_book ul li.dowloads a").attr("href");

    return {
      headers: {
        Referer: URLs.BASE,
        "User-Agent": headers.USER_AGENT_HEADER,
      },
      iframe: defaultIframe || null,
      downloadUrl: downloadLink || null,
      servers: servers
    };
  } catch (err) {
    console.error("Error in scrapeEpisodeSources (gogoanime) :", err);
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
