import axios from 'axios';
import { searchAnimeOnTMDB, getTMDBDetails, tmdb } from '../lib/tmdb';

const metadataCache = new Map<string, any>();

const cleanName = (name: string) => {
    return name
        .replace(/\(Dub\)/gi, '')
        .replace(/\(Sub\)/gi, '')
        .replace(/TV/gi, '')
        .replace(/Season \d+/gi, '')
        .replace(/S\d+/gi, '')
        .replace(/:/g, ' ')
        .replace(/-/g, ' ')
        .trim();
};

/**
 * Enhanced Search with Retry
 */
const aggressiveSearch = async (query: string, retries = 2): Promise<any> => {
    try {
        const results = await searchAnimeOnTMDB(query);
        if (results && results.length > 0) return results[0];
        
        // If no results, try with a even cleaner name
        if (retries > 0) {
            const cleaner = query.split(' ').slice(0, 3).join(' '); // Try just the first 3 words
            return await aggressiveSearch(cleaner, retries - 1);
        }
    } catch (e) {
        if (retries > 0) return await aggressiveSearch(query, retries - 1);
    }
    return null;
};

export const enrichWithTMDB = async (animeList: any[]) => {
    if (!Array.isArray(animeList)) return animeList;

    const enrichedList = [];
    for (const anime of animeList) {
        const animeName = anime.name || anime.title;
        if (!animeName) {
            enrichedList.push(anime);
            continue;
        }

        if (metadataCache.has(animeName)) {
            enrichedList.push({ ...anime, ...metadataCache.get(animeName) });
            continue;
        }

        const clean = cleanName(animeName);
        
        // FORCING TMDB
        try {
            const match = await aggressiveSearch(clean);
            if (match) {
                const data = {
                    tmdbId: match.id,
                    tmdbRating: match.vote_average,
                    banner: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : (anime.img || anime.image),
                    poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : (anime.img || anime.image),
                    description: match.overview || anime.plotSummary || anime.description
                };
                metadataCache.set(animeName, data);
                enrichedList.push({ ...anime, ...data });
                continue;
            }
        } catch (e) {}

        enrichedList.push(anime);
    }
    return enrichedList;
};

export const enrichSingleWithTMDB = async (anime: any) => {
    if (!anime || !anime.name) return anime;
    const clean = cleanName(anime.name);

    try {
        const match = await aggressiveSearch(clean);
        if (match) {
            const details = await getTMDBDetails(match.id, match.media_type as 'tv' | 'movie');
            
            if (details) {
                let episodesWithThumbs = anime.episodes || [];
                if (match.media_type === 'tv' && details.seasons) {
                    try {
                        let allTmdbEpisodes: any[] = [];
                        const totalSeasons = Math.min(details.number_of_seasons, 8); 
                        for (let s = 1; s <= totalSeasons; s++) {
                            const res = await tmdb.get(`/tv/${match.id}/season/${s}`).catch(() => null);
                            if (res?.data?.episodes) allTmdbEpisodes = [...allTmdbEpisodes, ...res.data.episodes];
                        }

                        episodesWithThumbs = (anime.episodes || []).map((ep: any, index: number) => {
                            const tmdbEp = allTmdbEpisodes[index];
                            return {
                                ...ep,
                                thumbnail: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null,
                                overview: tmdbEp?.overview || ''
                            };
                        });
                    } catch (e) {}
                }

                return {
                    ...anime,
                    tmdbId: details.id,
                    tmdbRating: details.vote_average,
                    banner: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : (anime.banner || anime.img),
                    poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : anime.img,
                    logo: details.images?.logos?.[0]?.file_path ? `https://image.tmdb.org/t/p/original${details.images.logos[0].file_path}` : null,
                    description: details.overview || anime.plotSummary,
                    cast: details.credits?.cast?.slice(0, 15).map((c: any) => ({
                        name: c.name,
                        character: c.character,
                        photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                    })) || [],
                    trailer: details.videos?.results?.find((v: any) => v.type === 'Trailer')?.key ? `https://www.youtube.com/watch?v=${details.videos.results.find((v: any) => v.type === 'Trailer').key}` : null,
                    episodes: episodesWithThumbs
                };
            }
        }
    } catch (error) {}

    return anime;
};
