import axios from 'axios';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

const jikanClient = axios.create({
    baseURL: JIKAN_BASE_URL,
    timeout: 10000,
});

// Simple in-memory cache to prevent hitting Jikan rate limits (60 req/min)
const cache = new Map<string, { data: any; expiry: number }>();

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours for most static anime data
const SCHEDULE_CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours for schedules

async function fetchWithCache(endpoint: string, params: any = {}, ttl: number = CACHE_TTL_MS) {
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    try {
        const response = await jikanClient.get(endpoint, { params });
        const data = response.data.data;
        
        cache.set(cacheKey, {
            data,
            expiry: Date.now() + ttl,
        });
        
        return data;
    } catch (error: any) {
        // Fallback to stale cache if API is rate limited
        if (cached) {
            return cached.data;
        }
        throw new Error(`Jikan API Error: ${error.message}`);
    }
}

export const searchAnimeOnJikan = async (q: string) => {
    return fetchWithCache('/anime', { q, limit: 1 });
};

export const getAnimeFull = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/full`);
};

export const getAnimeCharacters = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/characters`);
};

export const getAnimeThemes = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/themes`);
};

export const getAnimeRecommendations = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/recommendations`);
};

export const getAnimeReviews = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/reviews`);
};

export const getAnimeStats = async (id: number | string) => {
    return fetchWithCache(`/anime/${id}/statistics`);
};

export const getTopAnime = async (filter?: string, page: number = 1, type?: string) => {
    const params: any = { page, limit: 24, sfw: true };
    if (filter) params.filter = filter; // filter can be 'airing', 'upcoming', 'bypopularity', 'favorite'
    if (type) params.type = type;
    return fetchWithCache('/top/anime', params);
};

export const getSeasonAnime = async (year: number, season: string, page: number = 1) => {
    return fetchWithCache(`/seasons/${year}/${season}`, { page, limit: 24, sfw: true });
};

export const getStudioAnime = async (studioId: number | string, page: number = 1) => {
    return fetchWithCache('/anime', { producers: studioId, page, limit: 24, sfw: true });
};

export const getCharacterFull = async (id: number | string) => {
    return fetchWithCache(`/characters/${id}/full`);
};

export const getSchedules = async (filter?: string) => {
    // filter can be 'monday', 'tuesday', etc., or empty for all
    const params: any = {};
    if (filter) params.filter = filter;
    params.sfw = true; // safe for work only
    
    return fetchWithCache('/schedules', params, SCHEDULE_CACHE_TTL_MS);
};
