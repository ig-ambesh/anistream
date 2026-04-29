import { Request, Response } from 'express';
import { searchAnimeOnTMDB, getTMDBDetails, getTMDBTrending } from '../../lib/tmdb';

export const searchTMDB = async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    try {
        const results = await searchAnimeOnTMDB(q as string);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getDetails = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { type } = req.query; // 'tv' or 'movie'

    try {
        const details = await getTMDBDetails(id, (type as 'tv' | 'movie') || 'tv');
        if (!details) {
            return res.status(404).json({ error: 'Details not found' });
        }
        res.json(details);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTrending = async (req: Request, res: Response) => {
    const { type } = req.query;

    try {
        const results = await getTMDBTrending((type as 'tv' | 'movie') || 'tv');
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
