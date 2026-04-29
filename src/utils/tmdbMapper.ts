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
 * AniList Fallback
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
        }, { timeout: 4000 });
        
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
                    character: edge.role 
                })) || []
            };
        }
    } catch (e) {
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
            
            // Try TMDB FIRST (User wants to force TMDB)
            try {
                const results: any = await Promise.race([
                    searchAnimeOnTMDB(clean),
                    new Promise((_, reject) => setTimeout(() => reject('timeout'), 3500))
                ]);

                if (results && results.length > 0) {
                    const match = results[0];
                    const tmdbData = {
                        tmdbId: match.id,
                        tmdbRating: match.vote_average,
                        banner: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
                        poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : anime.img,
                        description: match.overview || anime.plotSummary,
                    };
                    metadataCache.set(animeName, tmdbData);
                    return { ...anime, ...tmdbData };
                }
            } catch (error) {}

            // Fallback to AniList
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
    console.log(`🔍 Forcing Aggressive TMDB Enrichment for: ${anime.name}`);

    try {
        // 1. Aggressive TMDB Search
        const results = await searchAnimeOnTMDB(clean);
        if (results && results.length > 0) {
            const match = results[0];
            const details = await getTMDBDetails(match.id, match.media_type as 'tv' | 'movie');
            
            if (details) {
                let episodesWithThumbs = anime.episodes || [];
                
                // Aggressive Multi-Season Episode Fetching
                if (match.media_type === 'tv' && details.seasons) {
                    try {
                        let allTmdbEpisodes: any[] = [];
                        const totalSeasons = details.number_of_seasons;
                        
                        // Fetch EVERY available season to ensure 100% thumbnail coverage
                        const seasonPromises = [];
                        for (let s = 1; s <= totalSeasons; s++) {
                            seasonPromises.push(tmdb.get(`/tv/${match.id}/season/${s}`).catch(() => null));
                        }
                        
                        const seasonResults = await Promise.all(seasonPromises);
                        seasonResults.forEach(res => {
                            if (res && res.data && res.data.episodes) {
                                allTmdbEpisodes = [...allTmdbEpisodes, ...res.data.episodes];
                            }
                        });

                        console.log(`✅ Successfully fetched ${allTmdbEpisodes.length} episodes from ${totalSeasons} TMDB seasons.`);

                        episodesWithThumbs = (anime.episodes || []).map((ep: any, index: number) => {
                            const tmdbEp = allTmdbEpisodes[index];
                            return {
                                ...ep,
                                thumbnail: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null,
                                overview: tmdbEp?.overview || ''
                            };
                        });
                    } catch (e) {
                        console.error("❌ Episode thumbnails fetch failed.");
                    }
                }

                return {
                    ...anime,
                    tmdbId: details.id,
                    tmdbRating: details.vote_average,
                    banner: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
                    poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : anime.img,
                    logo: details.images?.logos?.[0]?.file_path ? `https://image.tmdb.org/t/p/original${details.images.logos[0].file_path}` : null,
                    description: details.overview || anime.plotSummary,
                    genres: details.genres?.map((g: any) => g.name) || anime.genre?.split(', '),
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
    } catch (error) {
        console.error("❌ TMDB Main Enrichment Failed.");
    }

    // Secondary Fallback only if TMDB fails completely
    const aniData = await fetchFromAniList(clean);
    if (aniData) {
        return {
            ...anime,
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

    return anime;
};
