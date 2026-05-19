import { Router } from 'express';
import { searchTMDB, getDetails, getTrending, getAnimeTrendingHandler, getAnimeNewReleasesHandler, getAnimeHighRatedHandler, getSeasonDetails } from '../../controllers/tmdb/tmdb.controller';

const tmdb_router = Router();

tmdb_router.get('/search', searchTMDB);
tmdb_router.get('/trending', getTrending);
tmdb_router.get('/info/:id', getDetails);
tmdb_router.get('/tv/:id/season/:season_number', getSeasonDetails);
tmdb_router.get('/anime/trending', getAnimeTrendingHandler);
tmdb_router.get('/anime/recent', getAnimeNewReleasesHandler);
tmdb_router.get('/anime/popular', getAnimeHighRatedHandler);

export default tmdb_router;
