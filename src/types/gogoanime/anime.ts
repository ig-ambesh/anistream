interface Anime {
  id: string | null;
  name: string | null;
  img: string | null;
}

interface RecentRelease extends Anime {
  episodeId: string;
  episodeNo: number;
  subOrDub: string;
  episodeUrl: string;
}

interface NewSeason extends Anime {
  releasedYear: string;
  animeUrl: string;
}

interface PopularAnime extends NewSeason { };
interface AnimeMovie extends NewSeason { };

export interface ScrapedSearchPage {
  animes: NewSeason[];
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
}

export interface AnimeEpisode {
  episodeId: string;
  episodeNo: number;
  episodeUrl: string;
}

export interface AnimeDetails extends Anime {
  type: string;
  plotSummary: string;
  genre: string;
  released: string;
  status: string;
  otherName: string;
  totalEpisodes: number;
  episodes: AnimeEpisode[];
}

export interface VideoSource {
  url: string;
  isM3U8: boolean;
  quality?: string;
}

export interface ScrapedAnimeEpisodesSources {
  headers?: any;
  sources: VideoSource[];
}

export { RecentRelease, NewSeason, PopularAnime, AnimeMovie };
