import { Router } from 'express';
import { 
    searchJikan, 
    getDetails, 
    getCharacters, 
    getThemes, 
    getRecommendations, 
    getAnimeSchedules,
    getReviews,
    getStats,
    getTop,
    getSeason,
    getStudio,
    getCharacter
} from '../../controllers/jikan/jikan.controller';

const router = Router();

router.get('/search', searchJikan);
router.get('/top', getTop);
router.get('/anime/:id/full', getDetails);
router.get('/anime/:id/characters', getCharacters);
router.get('/anime/:id/themes', getThemes);
router.get('/anime/:id/recommendations', getRecommendations);
router.get('/anime/:id/reviews', getReviews);
router.get('/anime/:id/stats', getStats);
router.get('/schedules', getAnimeSchedules);
router.get('/seasons/:year/:season', getSeason);
router.get('/studio/:id', getStudio);
router.get('/character/:id', getCharacter);

export default router;
