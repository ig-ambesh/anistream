import { BASE_URL, TIMEOUT } from "./constants";
import { headers } from "../../config/headers";
import axios, { AxiosError } from "axios";
import { load } from "cheerio";
import createHttpError, { HttpError } from "http-errors";
import { fetchHtml } from "./browser";

export interface HindiStream {
  player: string;
  url: string;
  type: string; // "HINDI" | "TAMIL" | "TELUGU" | "ENGLISH" | "JAPANESE"
}

export interface HindiEpisodeSources {
  streams: HindiStream[];
  iframe: string | null;
  headers: Record<string, string>;
}

/**
 * Detect language from server button text or iframe URL
 */
function detectLanguage(serverName: string, iframeUrl: string): string {
  const combined = (serverName + " " + iframeUrl).toLowerCase();
  if (combined.includes("hindi") || combined.includes("hin")) return "HINDI";
  if (combined.includes("tamil") || combined.includes("tam")) return "TAMIL";
  if (combined.includes("telugu") || combined.includes("tel")) return "TELUGU";
  if (combined.includes("english") || combined.includes("eng")) return "ENGLISH";
  if (combined.includes("japanese") || combined.includes("jpn")) return "JAPANESE";
  // Default: check for "indian" servers which are typically Hindi
  if (combined.includes("indian")) return "HINDI";
  return "HINDI"; // Default for this Hindi-focused scraper
}

/**
 * Scrape episode/movie page for streaming servers.
 * For series episodes: episodeId format = "slug-1x1"
 * For movies: episodeId = slug (uses /movies/ path)
 */
export const scrapeEpisodeSources = async (
  episodeId: string,
  isMovie: boolean = false,
): Promise<HindiEpisodeSources | HttpError> => {
  try {
    const url = isMovie
      ? `${BASE_URL}/movies/${episodeId}/`
      : `${BASE_URL}/episode/${episodeId}/`;

    const html = await fetchHtml(url);

    const $ = load(html);
    const streams: HindiStream[] = [];

    // Method 1: Find iframes (ZephyrFlick embeds)
    $("iframe").each((_i, el) => {
      let src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (!src) return;
      if (src.startsWith("//")) src = "https:" + src;

      const player = src.toLowerCase().includes("zephyrflick")
        ? "zephyrflick"
        : "unknown";

      streams.push({
        player,
        url: src,
        type: "HINDI",
      });
    });

    // Method 2: Find server buttons (e.g. .server-item, language tabs)
    $(".server-item, .tab-content .server, [data-server]").each((_i, el) => {
      const serverName = $(el).text().trim();
      const dataUrl = $(el).attr("data-url") || $(el).attr("data-src") || "";
      if (dataUrl) {
        let fullUrl = dataUrl;
        if (fullUrl.startsWith("//")) fullUrl = "https:" + fullUrl;

        streams.push({
          player: fullUrl.includes("zephyrflick") ? "zephyrflick" : "embed",
          url: fullUrl,
          type: detectLanguage(serverName, fullUrl),
        });
      }
    });

    const defaultIframe = streams.find((s) => s.type === "HINDI")?.url
      || streams[0]?.url
      || null;

    return {
      streams,
      iframe: defaultIframe,
      headers: {
        Referer: BASE_URL,
        "User-Agent": headers.USER_AGENT_HEADER,
      },
    };
  } catch (err) {
    console.error("Error in scrapeEpisodeSources (hindidub):", err);
    throw createHttpError.InternalServerError("Internal server error");
  }
};

/**
 * Extract direct video source from ZephyrFlick player.
 * POST to play.zephyrflick.top/player/index.php with video ID.
 * Returns HLS m3u8 URL.
 */
export const extractZephyrFlick = async (
  playerUrl: string,
): Promise<{ videoUrl: string | null; subtitles: Array<{ lang: string; url: string }> }> => {
  try {
    // Extract video ID from URL: /video/[hex_id]
    const match = playerUrl.match(/\/video\/([a-f0-9]+)/);
    if (!match) return { videoUrl: null, subtitles: [] };

    const videoId = match[1];
    const apiUrl = "https://play.zephyrflick.top/player/index.php";

    const resp = await axios.post(apiUrl, null, {
      params: { data: videoId, do: "getVideo" },
      headers: {
        "User-Agent": headers.USER_AGENT_HEADER,
        "X-Requested-With": "XMLHttpRequest",
        Referer: playerUrl,
      },
      timeout: TIMEOUT,
    });

    const videoUrl = resp.data?.videoSource || null;

    // Extract subtitles from player page
    const subtitles: Array<{ lang: string; url: string }> = [];
    try {
      const pageResp = await axios.get(playerUrl, {
        headers: {
          "User-Agent": headers.USER_AGENT_HEADER,
          Referer: playerUrl,
        },
        timeout: TIMEOUT,
      });

      const subMatch = pageResp.data.match(
        /var playerjsSubtitle = "([^"]+)"/,
      );
      if (subMatch) {
        const subData = subMatch[1];
        for (const line of subData.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const m = trimmed.match(/\[([^\]]+)\](.+)/);
          if (m) {
            subtitles.push({ lang: m[1], url: m[2] });
          }
        }
      }
    } catch {
      // Subtitles optional
    }

    return { videoUrl, subtitles };
  } catch (err) {
    console.error("Error extracting ZephyrFlick video:", err);
    return { videoUrl: null, subtitles: [] };
  }
};
