import { isSiteReachable } from "../../lib/isSiteReachable";
import { websites_collection, AnimeWebsiteConfig } from "../../config/websites";

type AniWatchConfig = {
  BASE: string,
  HOME: string,
  SEARCH: string,
  GENRE: string,
  AJAX: string,
}

const aniwatch: AnimeWebsiteConfig = websites_collection["AniWatch"];
// storing initial base link
let aniwatch_base = aniwatch.BASE;
// array of clones
let clones_array: string[] = [];
clones_array.push(aniwatch_base);

if (aniwatch.CLONES) {
  const aniwatch_clones: Record<string, string[]> = aniwatch.CLONES;

  for (const key in aniwatch_clones) {
    if (Object.prototype.hasOwnProperty.call(aniwatch_clones, key)) {
      const values: string[] = aniwatch_clones[key];
      clones_array.push(...values);
    }
  }
}

// Testing
// console.log(clones_array);

// make new aniwatchobj using new aniwatch_base
const makeAniWatchObj = (aniwatch_base: string): AniWatchConfig => {
  // Testing
  // console.log(aniwatch_base);
  return {
    BASE: aniwatch_base,
    HOME: `${aniwatch_base}/home`,
    SEARCH: `${aniwatch_base}/search`,
    GENRE: `${aniwatch_base}/genre`,
    AJAX: `${aniwatch_base}/ajax`,
  }
}

let cached_aniwatch_base: string | null = null;
let last_resolved_time = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// return fn
const URL_fn = async (): Promise<AniWatchConfig> => {
  const now = Date.now();
  if (cached_aniwatch_base && (now - last_resolved_time < CACHE_DURATION)) {
    return makeAniWatchObj(cached_aniwatch_base);
  }

  try {
    for (const url of clones_array) {
      if (await isSiteReachable(url as string)) {
        cached_aniwatch_base = url;
        last_resolved_time = now;
        aniwatch_base = url;
        console.log(`[AniWatch] Resolved and cached working domain: ${url}`);
        break;
      }
    }
    return makeAniWatchObj(aniwatch_base as string);
  } catch (error) {
    console.error("Error occurred in both sites:", error);
    return makeAniWatchObj(cached_aniwatch_base || (aniwatch_base as string));
  }
};

export { URL_fn };
