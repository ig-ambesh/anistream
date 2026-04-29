import { Router } from 'express';
import { searchTMDB, getDetails, getTrending } from '../../controllers/tmdb/tmdb.controller';

const tmdb_router = Router();

tmdb_router.get('/search', searchTMDB);
tmdb_router.get('/trending', getTrending);
tmdb_router.get('/info/:id', getDetails);

export default tmdb_router;
