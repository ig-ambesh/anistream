import { Router } from 'express';
import { searchTMDB, getDetails, getTrending, getAnimeTrendingHandler, getAnimeNewReleasesHandler, getAnimeHighRatedHandler, getSeasonDetails } from '../../controllers/tmdb/tmdb.controller';
import { apiCache } from '../../middleware/cache';

const tmdb_router = Router();

tmdb_router.get('/search', searchTMDB);
tmdb_router.get('/trending', apiCache, getTrending);
tmdb_router.get('/info/:id', apiCache, getDetails);
tmdb_router.get('/tv/:id/season/:season_number', apiCache, getSeasonDetails);
tmdb_router.get('/anime/trending', apiCache, getAnimeTrendingHandler);
tmdb_router.get('/anime/recent', apiCache, getAnimeNewReleasesHandler);
tmdb_router.get('/anime/popular', apiCache, getAnimeHighRatedHandler);

export default tmdb_router;
