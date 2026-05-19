type WebsiteConfig = {
  BASE: string,
}

export type AnimeWebsiteConfig = WebsiteConfig & {
  CLONES?: Record<string, string[]>,
}

type Websites = Record<string, AnimeWebsiteConfig>;

// anime websites and their clones
// NOTE (May 2026): HiAnime/AniWatch shut down March 2026. All domains are dead.
// GogoAnime anitaku.to redirected to anineko.to (incompatible HTML structure).
// gogoanimes.fi mirrors retain the original GogoAnime HTML structure.
export const websites_collection: Websites = {
  "GogoAnime": {
    BASE: "https://ww5.gogoanimes.fi",
    CLONES: {
      "GogoAnimesFi": ["https://ww6.gogoanimes.fi", "https://ww4.gogoanimes.fi", "https://ww3.gogoanimes.fi", "https://gogoanimes.fi"],
      "Gogoanime3": ["https://gogoanime3.co"]
    }
  }
}
