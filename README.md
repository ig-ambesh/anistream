# ⚡ AniStream API ⚡

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,express,nodejs,vercel,github,figma" />
  <br/>
  <strong>The ultimate high-performance, serverless anime scraping and enrichment engine.</strong>
  <br/><br/>
  <a href="https://api-anime-rouge.vercel.app"><kbd>Live Demo: api-anime-rouge.vercel.app</kbd></a>
</p>

---

## 🚀 Key Features

*   **⚡ Hybrid Enrichment**: Automatically maps low-quality scraper data to high-definition assets from **TMDB** and **AniList**.
*   **🖼️ Smart Assets**: Fetches high-res banners, cinematic logos, cast members, and official trailers.
*   **🎞️ Episode Thumbnails**: Deep-syncs with TMDB to provide unique thumbnails and summaries for every episode.
*   **☁️ Serverless Ready**: Optimized for zero-latency deployment on **Vercel** via Serverless Functions.
*   **🛡️ Multi-Source Fallback**: Smart handshake architecture ensures data is fetched even if TMDB is blocked in certain regions.

---

## 🛠️ Tech Stack

- **Core**: TypeScript, Node.js, Express
- **Scraping**: Cheerio, Axios
- **Metadata**: TMDB API, AniList GraphQL
- **Deployment**: Vercel (Serverless)

---

## 📦 Deployment (Vercel)

1. **Clone the Repo**
2. **Set Environment Variables**:
   In your Vercel Dashboard, add:
   - `TMDB_API_KEY` = `your_api_key_here`
3. **Deploy**:
   ```bash
   vercel --prod
   ```

---

## ⚡ Web Scraping Status

| Provider | Status | Features |
| :--- | :--- | :--- |
| **AniWatch** | ✅ DONE | High-res metadata, Sub/Dub support |
| **GogoAnime** | ✅ DONE | Fast streaming, Legacy support |
| **KickAssAnime** | ⏳ FUTURE | Coming Soon |

---

## 📖 API Documentation

### `GET` /gogoanime/info/:id
Fetches full details for an anime, enriched with high-quality assets.

**Response Schema:**
```typescript
{
  "id": "naruto",
  "name": "Naruto",
  "banner": "https://image.tmdb.org/t/p/original/backdrop.jpg",
  "logo": "https://image.tmdb.org/t/p/original/logo.png",
  "description": "Professional summary...",
  "cast": [...],
  "episodes": [
    {
      "episodeId": "naruto-episode-1",
      "thumbnail": "https://image.tmdb.org/t/p/w500/still.jpg",
      "overview": "Episode summary..."
    }
  ]
}
```

---

### `GET` /aniwatch/search?q=:query
Search for anime across providers.

---

## 📜 License
ISC License. Build your own Anime empire! ⚡
