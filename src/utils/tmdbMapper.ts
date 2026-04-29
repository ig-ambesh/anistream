import axios from 'axios';
import { searchAnimeOnTMDB, getTMDBDetails, tmdb } from '../lib/tmdb';

const metadataCache = new Map<string, any>();

const cleanName = (name: string) => {
    return name
        .replace(/\(Dub\)/gi, '')
        .replace(/\(Sub\)/gi, '')
        .replace(/TV/gi, '')
        .replace(/Season \d+/gi, '')
        .trim();
};

/**
 * AniList Helper (Very reliable)
 */
const fetchFromAniList = async (query: string) => {
    const graphqlQuery = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        description
        bannerImage
        coverImage { extraLarge large }
        averageScore
        genres
        status
        seasonYear
        title { english romaji }
        trailer { site id }
        characters (sort: [ROLE, RELEVANCE], perPage: 12) {
          edges {
            role
            node {
              name { full }
              image { medium }
            }
          }
        }
      }
    }`;
    
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: graphqlQuery,
            variables: { search: query }
        }, { timeout: 5000 });
        
        const media = response.data.data.Media;
        if (media) {
            return {
                banner: media.bannerImage,
                poster: media.coverImage.extraLarge || media.coverImage.large,
                description: media.description?.replace(/<[^>]*>?/gm, ''), 
                rating: (media.averageScore / 10).toFixed(1),
                genres: media.genres,
                year: media.seasonYear,
                status: media.status?.toLowerCase(),
                trailer: media.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null,
                cast: media.characters?.edges?.map((edge: any) => ({
                    name: edge.node.name.full,
                    photo: edge.node.image.medium,
                    character: edge.role // e.g., "MAIN", "SUPPORTING"
                })) || []
            };
        }
    } catch (e) {
        console.error("AniList Fetch Error:", e);
        return null;
    }
    return null;
};

export const enrichWithTMDB = async (animeList: any[]) => {
    if (!Array.isArray(animeList)) return animeList;

    return await Promise.all(
        animeList.map(async (anime) => {
            const animeName = anime.name;
            if (!animeName) return anime;
            if (metadataCache.has(animeName)) return { ...anime, ...metadataCache.get(animeName) };

            const clean = cleanName(animeName);
            
            // Try AniList (Most reliable for lists)
            const aniData = await fetchFromAniList(clean);
            if (aniData) {
                const enriched = {
                    ...anime,
                    banner: aniData.banner || anime.img,
                    poster: aniData.poster || anime.img,
                    description: aniData.description || anime.plotSummary,
                    tmdbRating: aniData.rating,
                    genres: aniData.genres || anime.genre?.split(', ')
                };
                metadataCache.set(animeName, enriched);
                return enriched;
            }

            return anime;
        })
    );
};

export const enrichSingleWithTMDB = async (anime: any) => {
    if (!anime || !anime.name) return anime;
    const clean = cleanName(anime.name);

    // 1. Always start with AniList (Reliable base)
    const aniData = await fetchFromAniList(clean);
    let currentData = { ...anime };
    
    if (aniData) {
        currentData = {
            ...currentData,
            banner: aniData.banner || anime.img,
            poster: aniData.poster || anime.img,
            description: aniData.description || anime.plotSummary,
            tmdbRating: aniData.rating,
            genres: aniData.genres || anime.genre?.split(', '),
            status: aniData.status || anime.status,
            year: aniData.year || anime.year,
            trailer: aniData.trailer || anime.trailer,
            cast: aniData.cast || []
        };
    }

    // 2. Try TMDB for Extra Assets (Thumbnails, Logos)
    try {
        const results = await searchAnimeOnTMDB(clean);
        if (results && results.length > 0) {
            const match = results[0];
            const details = await getTMDBDetails(match.id, match.media_type as 'tv' | 'movie');
            
            if (details) {
                let episodesWithThumbs = currentData.episodes || [];
                
                // Fetch Season 1 episodes for thumbnails
                if (match.media_type === 'tv' && details.seasons) {
                    try {
                        const seasonRes = await tmdb.get(`/tv/${match.id}/season/1`);
                        const tmdbEpisodes = seasonRes.data.episodes || [];
                        episodesWithThumbs = (currentData.episodes || []).map((ep: any, index: number) => {
                            const tmdbEp = tmdbEpisodes[index];
                            return {
                                ...ep,
                                thumbnail: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null,
                                overview: tmdbEp?.overview || ''
                            };
                        });
                    } catch (e) {}
                }

                // Merge TMDB high-res assets
                currentData = {
                    ...currentData,
                    tmdbId: details.id,
                    logo: details.images?.logos?.[0]?.file_path ? `https://image.tmdb.org/t/p/original${details.images.logos[0].file_path}` : null,
                    episodes: episodesWithThumbs,
                    // If TMDB banner is better/available, use it
                    banner: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : currentData.banner,
                    description: details.overview || currentData.description
                };
                
                // If TMDB has a better cast (with character names), merge it
                if (details.credits?.cast?.length) {
                    currentData.cast = details.credits.cast.slice(0, 10).map((c: any) => ({
                        name: c.name,
                        character: c.character,
                        photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                    }));
                }
            }
        }
    } catch (error) {
        console.error("TMDB Enrichment Failed, using AniList data only.");
    }

    return currentData;
};
