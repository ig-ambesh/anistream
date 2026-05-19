import { isSiteReachable } from "../../lib/isSiteReachable";
import { websites_collection, AnimeWebsiteConfig } from "../../config/websites";

type GogoAnimeConfig = {
  "BASE": string,
  "SEARCH": string,
  "CATEGORY": string,
  "MOVIES": string,
  "POPULAR": string,
  "NEW_SEASON": string,
  "SEASONS": string,
  "AJAX": string,
}

const gogoanime: AnimeWebsiteConfig = websites_collection["GogoAnime"];
// storing initial base link
let gogoanime_base = gogoanime.BASE;
// array of clones
let clones_array: string[] = [];
clones_array.push(gogoanime_base);

if (gogoanime.CLONES) {
  const gogoanime_clones: Record<string, string[]> = gogoanime.CLONES;

  for (const key in gogoanime_clones) {
    if (Object.prototype.hasOwnProperty.call(gogoanime_clones, key)) {
      const values: string[] = gogoanime_clones[key];
      clones_array.push(...values);
    }
  }
}

// Testing
// console.log(clones_array);

// make new gogoanimeobj using new gogoanime_base
const makeGogoAnimeObj = (gogoanime_base: string): GogoAnimeConfig => {
  // Testing
  // console.log(gogoanime_base);
  return {
    BASE: gogoanime_base,
    SEARCH: `${gogoanime_base}/search.html`,
    CATEGORY: `${gogoanime_base}/category/`,
    MOVIES: `${gogoanime_base}/anime-movies.html`,
    POPULAR: `${gogoanime_base}/popular.html`,
    NEW_SEASON: `${gogoanime_base}/new-season.html`,
    SEASONS: `${gogoanime_base}/sub-category/`,
    AJAX: `${gogoanime_base}/ajax`,
  }
}

let cached_gogoanime_base: string | null = null;
let last_resolved_time = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// return fn
const URL_fn = async (): Promise<GogoAnimeConfig> => {
  const now = Date.now();
  if (cached_gogoanime_base && (now - last_resolved_time < CACHE_DURATION)) {
    return makeGogoAnimeObj(cached_gogoanime_base);
  }

  try {
    for (const url of clones_array) {
      if (await isSiteReachable(url as string)) {
        cached_gogoanime_base = url;
        last_resolved_time = now;
        gogoanime_base = url;
        console.log(`[GogoAnime] Resolved and cached working domain: ${url}`);
        break;
      } else {
        console.log(`[GogoAnime] Domain unreachable: ${url}`);
      }
    }
    return makeGogoAnimeObj(gogoanime_base as string);
  } catch (error) {
    console.error("[GogoAnime] All domains failed:", error);
    return makeGogoAnimeObj(cached_gogoanime_base || (gogoanime_base as string));
  }
};

export { URL_fn };
