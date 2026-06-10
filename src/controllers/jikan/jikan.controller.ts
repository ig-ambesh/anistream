import { Request, Response } from 'express';
import { 
    searchAnimeOnJikan, 
    getAnimeFull, 
    getAnimeCharacters, 
    getAnimeThemes, 
    getAnimeRecommendations, 
    getSchedules,
    getAnimeReviews,
    getAnimeStats,
    getTopAnime,
    getSeasonAnime,
    getStudioAnime,
    getCharacterFull
} from '../../lib/jikan';

export const searchJikan = async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    try {
        const results = await searchAnimeOnJikan(q as string);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getDetails = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const details = await getAnimeFull(id);
        if (!details) {
            return res.status(404).json({ error: 'Details not found' });
        }
        res.json(details);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getCharacters = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getAnimeCharacters(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getThemes = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getAnimeThemes(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getRecommendations = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getAnimeRecommendations(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAnimeSchedules = async (req: Request, res: Response) => {
    const { filter } = req.query;
    try {
        const results = await getSchedules(filter as string);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getReviews = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getAnimeReviews(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getStats = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getAnimeStats(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTop = async (req: Request, res: Response) => {
    const { filter, page } = req.query;
    try {
        const results = await getTopAnime(filter as string, page ? parseInt(page as string) : 1);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getSeason = async (req: Request, res: Response) => {
    const { year, season } = req.params;
    const { page } = req.query;
    try {
        const results = await getSeasonAnime(parseInt(year), season, page ? parseInt(page as string) : 1);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getStudio = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page } = req.query;
    try {
        const results = await getStudioAnime(id, page ? parseInt(page as string) : 1);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getCharacter = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const results = await getCharacterFull(id);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
