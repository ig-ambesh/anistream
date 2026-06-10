import { BASE_URL } from "./constants";
import { load } from "cheerio";
import createHttpError, { HttpError } from "http-errors";
import { fetchHtml } from "./browser";

export interface HindiEpisode {
  season: number;
  episode: number;
  title: string;
  url: string;
  episodeId: string;
}

export interface HindiAnimeDetails {
  id: string;
  name: string | null;
  img: string | null;
  description: string | null;
  genres: string[];
  year: string | null;
  type: "series" | "movie";
  episodes: HindiEpisode[];
}

/**
 * Extract episodes from HTML (works for both main page and AJAX responses)
 */
function extractEpisodes($: ReturnType<typeof load>): HindiEpisode[] {
  const episodes: HindiEpisode[] = [];

  $("li").each((_i, el) => {
    const article = $(el).find("article.episodes");
    if (!article.length) return;

    const link = article.find("a.lnk-blk");
    const numEpi = article.find("span.num-epi");
    const titleEl = article.find("h2.entry-title");

    if (link.length && numEpi.length) {
      const href = link.attr("href") || "";
      const epText = numEpi.text().trim();
      const match = epText.match(/(\d+)x(\d+)/);

      if (match) {
        const season = parseInt(match[1], 10);
        const episode = parseInt(match[2], 10);
        // Extract episode ID from URL: /episode/slug-1x1/ => slug-1x1
        const slug = href.replace(/\/$/, "").split("/").pop() || "";

        episodes.push({
          season,
          episode,
          title: titleEl.length ? titleEl.text().trim() : `Episode ${episode}`,
          url: href,
          episodeId: slug,
        });
      }
    }
  });

  return episodes;
}

export const scrapeAnimeInfo = async (
  slug: string,
): Promise<HindiAnimeDetails | HttpError> => {
  // Try both series and movies paths
  for (const contentType of ["series", "movies"]) {
    try {
      const url = `${BASE_URL}/${contentType}/${slug}`;
      const html = await fetchHtml(url);

      const $ = load(html);

      const title = $(".entry-title, h1.entry-title").first();
      const description = $(".description p").first();
      const poster = $("article.post img").first();
      const genres = $(".genres a")
        .map((_i, el) => $(el).text().trim())
        .get();
      const yearEl = $(".year .overviewCss").first();
      const year = yearEl.length ? yearEl.text().trim() : null;

      let img = poster.attr("src") || null;
      if (img && img.startsWith("//")) img = "https:" + img;

      let episodes: HindiEpisode[] = [];

      if (contentType === "series") {
        episodes = extractEpisodes($);

        // Handle multi-season: fetch additional seasons via AJAX
        const seasonLinks = $(".choose-season .sel-temp a");
        if (seasonLinks.length > 1) {
          const postId = seasonLinks.first().attr("data-post");
          const currentSeasonEl = $(".n_s").first();
          const currentSeason = currentSeasonEl.length
            ? parseInt(currentSeasonEl.text().trim(), 10)
            : 1;

          if (postId) {
            for (let i = 0; i < seasonLinks.length; i++) {
              const sLink = seasonLinks.eq(i);
              const seasonNum = parseInt(sLink.attr("data-season") || "0", 10);
              if (seasonNum && seasonNum !== currentSeason) {
                try {
                  const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php?action=action_select_season&season=${seasonNum}&post=${postId}`;
                  const ajaxHtml = await fetchHtml(ajaxUrl);
                  const $s = load(ajaxHtml);
                  episodes.push(...extractEpisodes($s));
                } catch {
                  // Skip failed season fetches
                }
              }
            }
          }
        }

        episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
      } else {
        // Movie: single "episode"
        episodes.push({
          season: 1,
          episode: 1,
          title: title.length ? title.text().trim() : "Movie",
          url,
          episodeId: slug,
        });
      }

      return {
        id: slug,
        name: title.length ? title.text().trim() : null,
        img,
        description: description.length ? description.text().trim() : null,
        genres,
        year,
        type: contentType === "movies" ? "movie" : "series",
        episodes,
      };
    } catch {
      continue; // Try next content type
    }
  }

  throw createHttpError.NotFound("Anime not found");
};
