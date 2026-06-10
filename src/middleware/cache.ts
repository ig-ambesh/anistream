import { Request, Response, NextFunction } from 'express';

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutes cache for all major homepage requests

export const apiCache = (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }

    // Use the full URL as the cache key to account for query parameters
    const key = req.originalUrl || req.url;
    const cachedEntry = cache.get(key);

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION_MS)) {
        console.log(`[Cache HIT] Serving ${key} from memory cache.`);
        return res.json(cachedEntry.data);
    }

    console.log(`[Cache MISS] Fetching ${key} fresh...`);

    // Override res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
            cache.set(key, { data: body, timestamp: Date.now() });
        }
        return originalJson(body);
    };

    next();
};
