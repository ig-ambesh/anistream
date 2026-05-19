import { getRecentReleases } from "./recentReleases.controller";
import { getNewSeasons } from "./newSeasons.controller";
import { getPopularAnimes } from "./popularAnimes.controller";
import { getAnimeMovies } from "./animeMovies.controller";

import { searchAnime } from "./search.controller";
import { getAnimeInfo } from "./anime.controller";
import { getEpisodeSources } from "./servers.controller";

export { 
  getRecentReleases, 
  getNewSeasons, 
  getPopularAnimes, 
  getAnimeMovies,
  searchAnime,
  getAnimeInfo,
  getEpisodeSources
};
