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
    let servers: any[] = [];
    let downloadLink = null;
    let refererUrl = URLs.BASE;

    // Helper function to scrape a single episode page
    const scrapePage = async (id: string, isDubCounterpart: boolean) => {
      const pageServers: any[] = [];
      
      // 1. Try default resolved base domain (e.g. ww5.gogoanimes.fi) first - verified reachable
      try {
        const mainPage = await axios.get(`${URLs.BASE}/${id}`, {
          headers: {
            "User-Agent": headers.USER_AGENT_HEADER,
            "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
            Accept: headers.ACCEPT_HEADER,
          },
          timeout: 4000,
        });

        const $ = load(mainPage.data);
        $(".anime_muti_link ul li").each((_i, el) => {
          const a = $(el).find("a");
          if (!a.length) return;
          const name = a.text().replace("Choose this server", "").trim();
          let rawVideo = a.attr("data-video");
          if (!rawVideo) return;

          let url = rawVideo;
          if (rawVideo.includes("<iframe")) {
            const match = rawVideo.match(/src=["']([^"']+)["']/i);
            if (match && match[1]) {
              url = match[1];
            }
          }
          url = url.replace(/&amp;/g, '&');
          if (url && url.startsWith("//")) {
            url = "https:" + url;
          }

          let type = isDubCounterpart ? 'DUB' : 'SUB';
          const liClass = $(el).attr("class") || "";
          const tab = a.attr("data-tab");
          if (liClass.includes("dub") || url?.includes("type=dub") || url?.includes('category=dub') || tab === 'tab_2') {
            type = 'DUB';
          } else if (liClass.includes("sub") || url?.includes("type=sub") || url?.includes('category=sub') || tab === 'tab_1') {
            type = 'SUB';
          }

          pageServers.push({ name, url, type });

          // Generate DUB/SUB counterparts for unified player links containing category=sub/dub or type=sub/dub
          if (url.includes("category=") || url.includes("type=")) {
            const isSub = url.includes("category=sub") || url.includes("type=sub");
            const isDub = url.includes("category=dub") || url.includes("type=dub");
            
            if (isSub) {
              const dubUrl = url.replace("category=sub", "category=dub").replace("type=sub", "type=dub");
              const cleanName = name.replace(" (SUB)", "").replace(" (DUB)", "");
              pageServers.push({ name: cleanName + " (DUB)", url: dubUrl, type: "DUB" });
            } else if (isDub) {
              const subUrl = url.replace("category=dub", "category=sub").replace("type=dub", "type=sub");
              const cleanName = name.replace(" (SUB)", "").replace(" (DUB)", "");
              pageServers.push({ name: cleanName + " (SUB)", url: subUrl, type: "SUB" });
            }
          }
        });

        if (pageServers.length > 0) {
          refererUrl = URLs.BASE;
          downloadLink = $("div.favorites_book ul li.dowloads a").attr("href") || null;
        }
      } catch (err: any) {
        // 2. Try gogoanimes.cv as fallback with low timeout
        try {
          const cvResponse = await axios.get(`https://gogoanimes.cv/${id}/`, {
            headers: {
              "User-Agent": headers.USER_AGENT_HEADER,
              "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
              Accept: headers.ACCEPT_HEADER,
            },
            timeout: 1500,
          });

          const $ = load(cvResponse.data);
          $(".anime_muti_link ul li").each((_i, el) => {
            const a = $(el).find("a");
            if (!a.length) return;
            const name = a.text().replace("Choose this server", "").trim();
            let rawVideo = a.attr("data-video");
            if (!rawVideo) return;

            let url = rawVideo;
            if (rawVideo.includes("<iframe")) {
              const match = rawVideo.match(/src=["']([^"']+)["']/i);
              if (match && match[1]) {
                url = match[1];
              }
            }
            url = url.replace(/&amp;/g, '&');
            if (url && url.startsWith("//")) {
              url = "https:" + url;
            }

            let type = isDubCounterpart ? 'DUB' : 'SUB';
            const liClass = $(el).attr("class") || "";
            if (liClass.includes("dub") || url?.includes("type=dub") || url?.includes('category=dub')) {
              type = 'DUB';
            } else if (liClass.includes("sub") || url?.includes("type=sub") || url?.includes('category=sub')) {
              type = 'SUB';
            }

            pageServers.push({ name, url, type });

            // Generate DUB/SUB counterparts for unified player links containing category=sub/dub or type=sub/dub
            if (url.includes("category=") || url.includes("type=")) {
              const isSub = url.includes("category=sub") || url.includes("type=sub");
              const isDub = url.includes("category=dub") || url.includes("type=dub");
              
              if (isSub) {
                const dubUrl = url.replace("category=sub", "category=dub").replace("type=sub", "type=dub");
                const cleanName = name.replace(" (SUB)", "").replace(" (DUB)", "");
                pageServers.push({ name: cleanName + " (DUB)", url: dubUrl, type: "DUB" });
              } else if (isDub) {
                const subUrl = url.replace("category=dub", "category=sub").replace("type=dub", "type=sub");
                const cleanName = name.replace(" (SUB)", "").replace(" (DUB)", "");
                pageServers.push({ name: cleanName + " (SUB)", url: subUrl, type: "SUB" });
              }
            }
          });

          if (pageServers.length > 0) {
            refererUrl = "https://gogoanimes.cv";
            downloadLink = $("div.favorites_book ul li.dowloads a").attr("href") || null;
          }
        } catch (cvErr: any) {
          console.log(`[Gogoanime Scraper] Both sources failed for ${id}: ${cvErr.message}`);
        }
      }
      return pageServers;
    };

    // 1. Scrape primary sources
    servers = await scrapePage(episodeId, false);

    // 2. Check if DUB is missing. If missing, attempt to scrape and merge DUB counterpart page!
    const hasDub = servers.some(s => s.type === 'DUB');
    if (!hasDub && !episodeId.includes('-dub')) {
      let dubEpId = '';
      if (episodeId.includes("-episode-")) {
        dubEpId = episodeId.replace("-episode-", "-dub-episode-");
      } else {
        dubEpId = episodeId + "-dub";
      }
      
      console.log(`[Gogoanime Scraper] No DUB servers found. Attempting DUB counterpart: ${dubEpId}`);
      const dubServers = await scrapePage(dubEpId, true);
      if (dubServers.length > 0) {
        servers.push(...dubServers);
      }
    }

    const defaultIframe = servers.find(s => s.type === 'SUB')?.url 
                       || servers.find(s => s.type === 'HSUB')?.url
                       || servers[0]?.url;

    return {
      headers: {
        Referer: refererUrl,
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
