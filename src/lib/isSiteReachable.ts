import { headers } from "../config/headers";

export const isSiteReachable = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: {
        "User-Agent": headers.USER_AGENT_HEADER,
        "Accept": headers.ACCEPT_HEADER
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    
    // Verify the response contains actual anime content,
    // not a parked domain, redirect page, or shutdown notice
    const body = await response.text();
    const hasAnimeContent = body.includes('last_episodes') || 
                            body.includes('anime_name') ||
                            body.includes('film_list-wrap');
    return hasAnimeContent;
  } catch (error) {
    return false;
  }
}
