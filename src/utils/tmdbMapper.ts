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
        .trim();
};

/**
 * AniList Helper (Fast & Reliable for Lists)
 */
const fetchFromAniList = async (query: string) => {
    const graphqlQuery = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        description
        bannerImage
        coverImage { extraLarge }
        averageScore
      }
    }`;
    
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: graphqlQuery,
            variables: { search: query }
        }, { timeout: 3000 });
        
        const media = response.data.data.Media;
        if (media) {
            return {
                banner: media.bannerImage,
                poster: media.coverImage.extraLarge,
                description: media.description?.replace(/<[^>]*>?/gm, ''), 
                rating: (media.averageScore / 10).toFixed(1)
            };
        }
    } catch (e) {
        return null;
    }
    return null;
};

export const enrichWithTMDB = async (animeList: any[]) => {
    if (!Array.isArray(animeList)) return animeList;

    const enrichedList = [];
    // Process in smaller batches to avoid Vercel connection limits
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
        
        // Use AniList for LIST VIEW (Faster, more reliable banners)
        const aniData = await fetchFromAniList(clean);
        if (aniData) {
            const data = {
                banner: aniData.banner || anime.img || anime.image,
                poster: aniData.poster || anime.img || anime.image,
                tmdbRating: aniData.rating,
                description: aniData.description || anime.plotSummary || anime.description
            };
            metadataCache.set(animeName, data);
            enrichedList.push({ ...anime, ...data });
        } else {
            enrichedList.push(anime);
        }
    }
    return enrichedList;
};

export const enrichSingleWithTMDB = async (anime: any) => {
    if (!anime || !anime.name) return anime;
    const clean = cleanName(anime.name);
    console.log(`🔍 Single Enrichment: ${anime.name}`);

    // Try TMDB for maximum detail (Logos, Cast, Trailers)
    try {
        const results = await searchAnimeOnTMDB(clean);
        if (results && results.length > 0) {
            const match = results[0];
            const details = await getTMDBDetails(match.id, match.media_type as 'tv' | 'movie');
            
            if (details) {
                let episodesWithThumbs = anime.episodes || [];
                if (match.media_type === 'tv' && details.seasons) {
                    try {
                        let allTmdbEpisodes: any[] = [];
                        const totalSeasons = Math.min(details.number_of_seasons, 5); // Limit for speed
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
                    banner: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : anime.banner,
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

    // Fallback to AniList
    const aniData = await fetchFromAniList(clean);
    if (aniData) {
        return {
            ...anime,
            banner: aniData.banner || anime.img,
            poster: aniData.poster || anime.img,
            description: aniData.description || anime.plotSummary,
            tmdbRating: aniData.rating
        };
    }

    return anime;
};
