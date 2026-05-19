import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.tmdb.org/3'; 

if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY not found in .env file!');
} else {
    console.log('✅ TMDB_API_KEY loaded successfully.');
}

// Custom agent to bypass common Node.js networking issues on Windows/Restricted networks
const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Ignore SSL certificate issues
    family: 4, // Force IPv4
    keepAlive: true, 
    minVersion: 'TLSv1.2', // Force TLS 1.2
    maxVersion: 'TLSv1.2'
});

export const tmdb = axios.create({
    baseURL: TMDB_BASE_URL,
    timeout: 15000, 
    httpsAgent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
    },
    params: {
        api_key: TMDB_API_KEY,
    },
});

export const searchAnimeOnTMDB = async (query: string) => {
    try {
        const response = await tmdb.get('/search/multi', {
            params: {
                query,
                include_adult: false,
            },
        });
        
        // Filter for TV or Movie and ensure it's likely an anime (though TMDB doesn't have a perfect "anime" filter, we can filter by genre later)
        return response.data.results.filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie');
    } catch (error) {
        console.error('Error searching TMDB:', error);
        return [];
    }
};

export const getTMDBDetails = async (id: string, type: 'tv' | 'movie' = 'tv') => {
    try {
        const response = await tmdb.get(`/${type}/${id}`, {
            params: {
                append_to_response: 'videos,images,credits,external_ids',
                include_image_language: 'en,null' // Get English logos
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error getting TMDB details:', error);
        return null;
    }
};

export const getTMDBTrending = async (type: 'tv' | 'movie' = 'tv') => {
    try {
        const response = await tmdb.get(`/trending/${type}/week`);
        return response.data.results;
    } catch (error) {
        console.error('Error getting TMDB trending:', error);
        return [];
    }
};

export const getAnimeTrending = async () => {
    try {
        const response = await tmdb.get(`/discover/tv`, {
            params: {
                with_genres: 16,
                with_keywords: 210024,
                sort_by: 'popularity.desc'
            }
        });
        return response.data.results;
    } catch (error) {
        console.error('Error getting Anime Trending:', error);
        return [];
    }
};

export const getAnimeNewReleases = async () => {
    try {
        const response = await tmdb.get(`/discover/tv`, {
            params: {
                with_genres: 16,
                with_keywords: 210024,
                sort_by: 'first_air_date.desc',
                'air_date.lte': new Date().toISOString().split('T')[0],
                'vote_count.gte': 5
            }
        });
        return response.data.results;
    } catch (error) {
        console.error('Error getting Anime New Releases:', error);
        return [];
    }
};

export const getAnimeHighRated = async () => {
    try {
        const response = await tmdb.get(`/discover/tv`, {
            params: {
                with_genres: 16,
                with_keywords: 210024,
                sort_by: 'vote_average.desc',
                'vote_count.gte': 300
            }
        });
        return response.data.results;
    } catch (error) {
        console.error('Error getting Anime High Rated:', error);
        return [];
    }
};
