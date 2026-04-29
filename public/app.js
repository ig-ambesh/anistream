const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' ? 'http://localhost:3000' : window.location.origin;

const fallbackAnimes = [
    {
        id: 'jujutsu-kaisen-2nd-season',
        name: 'Jujutsu Kaisen Season 2',
        img: 'https://cdn.myanimelist.net/images/anime/1792/138022l.jpg',
        releasedYear: '2023',
        subOrDub: 'sub',
        rating: '9.1',
        totalEpisodes: 23,
        description: 'Sorcerers collide with impossible curses in a brutal, stylish arc that turns Shibuya into a supernatural battlefield.'
    },
    {
        id: 'kimetsu-no-yaiba-hashira-geiko-hen',
        name: 'Demon Slayer: Hashira Training Arc',
        img: 'https://cdn.myanimelist.net/images/anime/1109/143871l.jpg',
        releasedYear: '2024',
        subOrDub: 'sub',
        rating: '8.7',
        totalEpisodes: 8,
        description: 'Tanjiro enters elite training with the Hashira as the Demon Slayer Corps prepares for its final confrontation.'
    },
    {
        id: 'one-piece',
        name: 'One Piece',
        img: 'https://cdn.myanimelist.net/images/anime/6/73245l.jpg',
        releasedYear: '1999',
        subOrDub: 'sub',
        rating: '9.0',
        totalEpisodes: 1100,
        description: 'A pirate crew chases the world greatest treasure through islands packed with danger, comedy, and impossible dreams.'
    },
    {
        id: 'solo-leveling',
        name: 'Solo Leveling',
        img: 'https://cdn.myanimelist.net/images/anime/1801/142390l.jpg',
        releasedYear: '2024',
        subOrDub: 'dub',
        rating: '8.5',
        totalEpisodes: 12,
        description: 'A weak hunter receives a mysterious system that lets him grow stronger after every deadly dungeon run.'
    },
    {
        id: 'chainsaw-man',
        name: 'Chainsaw Man',
        img: 'https://cdn.myanimelist.net/images/anime/1806/126216l.jpg',
        releasedYear: '2022',
        subOrDub: 'sub',
        rating: '8.8',
        totalEpisodes: 12,
        description: 'A broke devil hunter becomes something terrifying and strangely human after merging with his chainsaw devil companion.'
    },
    {
        id: 'frieren',
        name: 'Frieren: Beyond Journey End',
        img: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
        releasedYear: '2023',
        subOrDub: 'sub',
        rating: '9.4',
        totalEpisodes: 28,
        description: 'An elf mage retraces the echoes of a finished adventure, discovering the fragile weight of memory and friendship.'
    },
    {
        id: 'kaiju-no-8',
        name: 'Kaiju No. 8',
        img: 'https://cdn.myanimelist.net/images/anime/1370/140362l.jpg',
        releasedYear: '2024',
        subOrDub: 'sub',
        rating: '8.2',
        totalEpisodes: 12,
        description: 'A kaiju cleanup worker gains monstrous power and tries to join the defense force he always admired.'
    },
    {
        id: 'spy-x-family',
        name: 'Spy x Family',
        img: 'https://cdn.myanimelist.net/images/anime/1441/122795l.jpg',
        releasedYear: '2022',
        subOrDub: 'dub',
        rating: '8.7',
        totalEpisodes: 37,
        description: 'A spy, assassin, and telepath build a fake family that keeps becoming wonderfully real.'
    }
];

const genres = [
    { name: 'Action', icon: 'fa-bolt', query: 'action anime' },
    { name: 'Fantasy', icon: 'fa-wand-magic-sparkles', query: 'fantasy anime' },
    { name: 'Romance', icon: 'fa-heart', query: 'romance anime' },
    { name: 'Slice of Life', icon: 'fa-mug-hot', query: 'slice of life anime' },
    { name: 'Sci-Fi', icon: 'fa-rocket', query: 'sci fi anime' },
    { name: 'Sports', icon: 'fa-volleyball', query: 'sports anime' },
    { name: 'Mystery', icon: 'fa-eye', query: 'mystery anime' },
    { name: 'Movies', icon: 'fa-film', query: 'anime movie' }
];

const els = {};
let hls = null;
let currentAnimeId = '';
let currentAnimeDetails = null;
let currentEpisodes = [];
let currentEpIndex = -1;
let homeCache = {
    trending: [],
    popular: [],
    recent: [],
    movies: []
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    cacheDom();
    wireEvents();
    initCustomCursor();
    initScrollReveal();
    renderGenres();
    renderSkeletons();
    loadHomeData();
    loadContinueWatching();
}

function cacheDom() {
    [
        'search-form',
        'search-input',
        'search-suggestions',
        'home-content',
        'hero-section',
        'anime-details-section',
        'search-results-section',
        'genres-section',
        'watchlist-section',
        'back-btn',
        'trending-grid',
        'popular-grid',
        'recent-grid',
        'movies-grid',
        'continue-grid',
        'continue-watching-section',
        'hero-title',
        'hero-desc',
        'hero-bg',
        'hero-meta',
        'hero-play-btn',
        'hero-info-btn',
        'detail-img',
        'detail-banner',
        'detail-title',
        'detail-desc',
        'detail-rating',
        'detail-type',
        'detail-status',
        'detail-genres',
        'detail-episodes-list',
        'detail-ep-count',
        'player-section',
        'video-player',
        'video-frame',
        'player-loading',
        'sidebar-episodes-list',
        'ep-count-display',
        'current-ep-num',
        'server-tabs',
        'server-list',
        'detail-title-player',
        'detail-desc-player',
        'watchlist-btn',
        'export-json-btn',
        'search-results-grid',
        'search-heading',
        'search-eyebrow',
        'genre-grid',
        'watchlist-grid',
        'custom-cursor',
        'prev-ep-btn',
        'next-ep-btn'
    ].forEach((id) => {
        els[toCamel(id)] = document.getElementById(id);
    });
}

function wireEvents() {
    window.addEventListener('scroll', () => {
        document.querySelector('.main-header').classList.toggle('scrolled', window.scrollY > 18);
    });

    els.searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = els.searchInput.value.trim();
        if (query) runSearch(query);
    });

    els.searchInput.addEventListener('input', debounce(handleSearchInput, 280));

    document.addEventListener('click', (event) => {
        if (!els.searchForm.contains(event.target)) {
            els.searchSuggestions.classList.add('hidden');
        }
    });

    document.querySelectorAll('[data-scroll-left], [data-scroll-right]').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.scrollLeft || button.dataset.scrollRight;
            const direction = button.dataset.scrollLeft ? -1 : 1;
            const row = document.getElementById(targetId);
            if (row) row.scrollBy({ left: row.clientWidth * 0.82 * direction, behavior: 'smooth' });
        });
    });

    els.backBtn.addEventListener('click', goHome);
    els.prevEpBtn.addEventListener('click', playPreviousEpisode);
    els.nextEpBtn.addEventListener('click', playNextEpisode);
    els.watchlistBtn.addEventListener('click', toggleCurrentWatchlist);
    els.exportJsonBtn.addEventListener('click', exportCurrentAnimeJson);
}

async function loadHomeData() {
    const [trending, recent, movies] = await Promise.all([
        getJson('/gogoanime/popular?page=1', fallbackAnimes),
        getJson('/gogoanime/recent-releases?page=1', fallbackAnimes.slice().reverse()),
        getJson('/gogoanime/anime-movies?page=1', fallbackAnimes.slice(1))
    ]);

    homeCache.trending = normalizeList(trending);
    homeCache.popular = [...homeCache.trending].sort((a, b) => getRating(b) - getRating(a));
    homeCache.recent = normalizeList(recent, true);
    homeCache.movies = normalizeList(movies);

    setupHero(homeCache.trending[0] || fallbackAnimes[0]);
    renderRow(homeCache.trending, els.trendingGrid);
    renderRow(homeCache.popular, els.popularGrid);
    renderRow(homeCache.recent, els.recentGrid, { recent: true });
    renderRow(homeCache.movies, els.moviesGrid);
    observeRevealTargets();
}

function renderSkeletons() {
    [els.trendingGrid, els.popularGrid, els.recentGrid, els.moviesGrid].forEach((container) => {
        container.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join('');
    });
}

function setupHero(anime) {
    const normalized = normalizeAnime(anime);
    els.heroTitle.textContent = normalized.name;
    els.heroDesc.textContent = normalized.description || 'A high-energy anime pick with cinematic action, memorable characters, and enough momentum for a full evening binge.';
    els.heroBg.src = normalized.banner || normalized.img;
    els.heroBg.alt = normalized.name;
    els.heroMeta.innerHTML = `
        <span><i class="fa-solid fa-star"></i> ${normalized.rating}</span>
        <span>${normalized.releasedYear}</span>
        <span>${normalized.subOrDub.toUpperCase()}</span>
    `;
    els.heroPlayBtn.onclick = () => loadAnimeDetails(normalized.id, { autoplay: true });
    els.heroInfoBtn.onclick = () => loadAnimeDetails(normalized.id);
}

function renderRow(animes, container, options = {}) {
    container.innerHTML = '';
    normalizeList(animes, options.recent).forEach((anime) => {
        container.appendChild(createAnimeCard(anime, options));
    });
}

function renderGrid(animes, container, options = {}) {
    container.innerHTML = '';
    const list = normalizeList(animes, options.recent);
    if (!list.length) {
        container.innerHTML = '<div class="empty-state">Nothing here yet. Try searching for another title or add shows to your watchlist.</div>';
        return;
    }
    list.forEach((anime) => container.appendChild(createAnimeCard(anime, options)));
    observeRevealTargets();
}

function createAnimeCard(anime, options = {}) {
    const item = normalizeAnime(anime, options.recent);
    const card = document.createElement('article');
    card.className = 'anime-card';
    card.tabIndex = 0;
    card.dataset.reveal = '';
    card.setAttribute('aria-label', item.name);

    const progress = getWatchProgress(item.id);
    const inWatchlist = isInWatchlist(item.id);
    const episodeText = item.episodeNo ? `EP ${item.episodeNo}` : `${item.totalEpisodes || '?'} EP`;
    const dubBadge = item.subOrDub === 'dub' ? '<span class="card-badge">DUB</span>' : '';

    card.innerHTML = `
        <div class="card-img-wrapper">
            ${dubBadge}
            <span class="episode-badge">${episodeText}</span>
            <img src="${escapeAttr(item.img)}" alt="${escapeAttr(item.name)}" class="card-img" loading="lazy">
            ${progress ? `<div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div>` : ''}
            <div class="card-overlay">
                <div class="card-title">${escapeHtml(item.name)}</div>
                <div class="card-meta">
                    <span class="card-rating"><i class="fa-solid fa-star"></i> ${item.rating}</span>
                    <span>${item.releasedYear}</span>
                    <span>${item.subOrDub.toUpperCase()}</span>
                </div>
                <div class="card-actions">
                    <button class="mini-action play" type="button" aria-label="Play ${escapeAttr(item.name)}"><i class="fa-solid fa-play"></i></button>
                    <button class="mini-action bookmark ${inWatchlist ? 'active' : ''}" type="button" aria-label="Bookmark ${escapeAttr(item.name)}"><i class="${inWatchlist ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
                    <button class="mini-action info" type="button" aria-label="Details for ${escapeAttr(item.name)}"><i class="fa-solid fa-circle-info"></i></button>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => loadAnimeDetails(item.id));
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadAnimeDetails(item.id);
    });

    card.querySelector('.play').addEventListener('click', (event) => {
        event.stopPropagation();
        loadAnimeDetails(item.id, { autoplay: true });
    });

    card.querySelector('.info').addEventListener('click', (event) => {
        event.stopPropagation();
        loadAnimeDetails(item.id);
    });

    card.querySelector('.bookmark').addEventListener('click', (event) => {
        event.stopPropagation();
        toggleWatchlist(item);
        renderWatchlist();
        event.currentTarget.innerHTML = `<i class="${isInWatchlist(item.id) ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>`;
    });

    return card;
}

async function loadAnimeDetails(animeId, options = {}) {
    currentAnimeId = normalizeId(animeId);
    hideAllSections();
    els.animeDetailsSection.classList.remove('hidden');
    els.playerSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav('');

    showDetailsLoading();

    const fallback = fallbackAnimes.find((anime) => anime.id === currentAnimeId) || fallbackAnimes[0];
    const details = await getJson(`/gogoanime/anime/${currentAnimeId}`, makeFallbackDetails(fallback));
    currentAnimeDetails = normalizeDetails(details, fallback);
    currentEpisodes = currentAnimeDetails.episodes;

    renderDetails(currentAnimeDetails);
    renderEpisodes(currentEpisodes);
    updateWatchlistButton();

    if (options.autoplay && currentEpisodes.length) {
        currentEpIndex = 0;
        playEpisode(currentEpisodes[0].episodeId, currentEpisodes[0].episodeNo);
    }
}

function showDetailsLoading() {
    els.detailTitle.textContent = 'Loading...';
    els.detailDesc.textContent = 'Fetching anime details and episode list.';
    els.detailImg.src = '';
    els.detailBanner.src = '';
    els.detailEpisodesList.innerHTML = Array.from({ length: 12 }, (_, index) => `<button class="episode-btn" type="button">${index + 1}</button>`).join('');
    els.sidebarEpisodesList.innerHTML = '';
}

function renderDetails(details) {
    els.detailImg.src = details.img;
    els.detailImg.alt = details.name;
    els.detailBanner.src = details.img;
    els.detailBanner.alt = details.name;
    els.detailTitle.textContent = details.name;
    els.detailDesc.textContent = details.description;
    els.detailRating.innerHTML = `<i class="fa-solid fa-star"></i> ${details.rating}`;
    els.detailType.textContent = details.type;
    els.detailStatus.textContent = details.status;
    els.detailEpCount.textContent = `${details.episodes.length} Episodes`;
    els.epCountDisplay.textContent = `${details.episodes.length} Episodes`;
    els.detailTitlePlayer.textContent = details.name;
    els.detailDescPlayer.textContent = details.description;
    els.videoPlayer.poster = details.img;
    els.detailGenres.innerHTML = details.genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join('');
}

function renderEpisodes(episodes) {
    els.detailEpisodesList.innerHTML = '';
    els.sidebarEpisodesList.innerHTML = '';

    episodes.forEach((ep, index) => {
        const detailBtn = makeEpisodeButton(ep, index);
        const sidebarBtn = makeEpisodeButton(ep, index);
        els.detailEpisodesList.appendChild(detailBtn);
        els.sidebarEpisodesList.appendChild(sidebarBtn);
    });
}

function makeEpisodeButton(ep, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'episode-btn';
    btn.textContent = ep.episodeNo;
    btn.addEventListener('click', () => {
        currentEpIndex = index;
        playEpisode(ep.episodeId, ep.episodeNo);
    });
    return btn;
}

async function playEpisode(episodeId, epNum) {
    els.playerSection.classList.remove('hidden');
    els.currentEpNum.textContent = epNum;
    setActiveEpisode();
    saveContinueWatching(currentAnimeDetails || { id: currentAnimeId, episodeId });
    saveWatchProgress(currentAnimeId, progressForEpisode(epNum));

    els.playerLoading.classList.remove('hidden');
    const data = await getJson(`/gogoanime/episode-srcs?id=${encodeURIComponent(episodeId)}`, makeFallbackServers());
    els.playerLoading.classList.add('hidden');

    const servers = normalizeStreamServers(data);
    if (servers.length) {
        renderServerSwitcher(servers);
        loadVideo(servers[0].url);
    } else {
        renderServerSwitcher([]);
    }
}

function normalizeStreamServers(data) {
    const servers = [];

    if (Array.isArray(data.servers)) {
        data.servers.forEach((server, index) => {
            const url = server.url || server.file || server.src;
            if (url) {
                servers.push({
                    name: server.name || `Server ${index + 1}`,
                    type: server.type || 'Embed',
                    url
                });
            }
        });
    }

    if (Array.isArray(data.sources)) {
        data.sources.forEach((source, index) => {
            const url = source.url || source.file || source.src;
            if (url) {
                servers.push({
                    name: source.name || source.quality || `Source ${index + 1}`,
                    type: source.type || (isDirectVideoUrl(url) ? 'Video' : 'Embed'),
                    url
                });
            }
        });
    }

    if (data.iframe) {
        servers.unshift({
            name: 'Default',
            type: 'Embed',
            url: data.iframe
        });
    }

    if (data.downloadUrl) {
        servers.push({
            name: 'Download',
            type: 'File',
            url: data.downloadUrl
        });
    }

    return servers.filter((server, index, list) => (
        server.url && list.findIndex((item) => item.url === server.url) === index
    ));
}

async function exportCurrentAnimeJson() {
    if (!currentAnimeDetails || !currentEpisodes.length) return;

    const button = els.exportJsonBtn;
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing JSON...';

    try {
        const episodeSources = await fetchEpisodeSourcesForExport(currentEpisodes, (completed, total) => {
            button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${completed}/${total} Episodes`;
        });

        const payload = {
            exportedAt: new Date().toISOString(),
            source: `${API_BASE}/gogoanime/anime/${currentAnimeId}`,
            anime: {
                id: currentAnimeDetails.id,
                name: currentAnimeDetails.name,
                image: currentAnimeDetails.img,
                releasedYear: currentAnimeDetails.releasedYear,
                rating: currentAnimeDetails.rating,
                type: currentAnimeDetails.type,
                status: currentAnimeDetails.status,
                subOrDub: currentAnimeDetails.subOrDub,
                genres: currentAnimeDetails.genres,
                description: currentAnimeDetails.description,
                totalEpisodes: currentEpisodes.length
            },
            episodes: episodeSources
        };

        downloadJsonFile(payload, `${slugify(currentAnimeDetails.name)}-stream-data.json`);
        button.innerHTML = '<i class="fa-solid fa-check"></i> JSON Downloaded';
        setTimeout(() => {
            button.innerHTML = originalLabel;
            button.disabled = false;
        }, 1400);
    } catch (error) {
        console.error('Failed to export anime JSON', error);
        button.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Export Failed';
        setTimeout(() => {
            button.innerHTML = originalLabel;
            button.disabled = false;
        }, 1800);
    }
}

async function fetchEpisodeSourcesForExport(episodes, onProgress) {
    const results = new Array(episodes.length);
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(4, episodes.length);

    async function worker() {
        while (nextIndex < episodes.length) {
            const index = nextIndex;
            nextIndex += 1;
            const episode = episodes[index];
            results[index] = await fetchSingleEpisodeExportData(episode);
            completed += 1;
            onProgress(completed, episodes.length);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

async function fetchSingleEpisodeExportData(episode) {
    try {
        const endpoint = `/gogoanime/episode-srcs?id=${encodeURIComponent(episode.episodeId)}`;
        const data = await getJson(endpoint, {});
        const servers = normalizeStreamServers(data);

        return {
            episodeNo: episode.episodeNo,
            episodeId: episode.episodeId,
            endpoint: `${API_BASE}${endpoint}`,
            iframe: data.iframe || null,
            downloadUrl: data.downloadUrl || null,
            headers: data.headers || null,
            servers,
            raw: data
        };
    } catch (error) {
        return {
            episodeNo: episode.episodeNo,
            episodeId: episode.episodeId,
            error: error.message || 'Failed to fetch episode sources'
        };
    }
}

function downloadJsonFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function renderServerSwitcher(servers) {
    els.serverTabs.innerHTML = '';
    els.serverList.innerHTML = '';

    if (!servers.length) {
        els.serverList.innerHTML = '<div class="empty-state">No streaming servers were returned for this episode.</div>';
        return;
    }

    const types = [...new Set(servers.map((server) => server.type || 'Default'))];
    types.forEach((type, index) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `server-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = type;
        tab.addEventListener('click', () => {
            els.serverTabs.querySelectorAll('.server-tab').forEach((node) => node.classList.remove('active'));
            tab.classList.add('active');
            renderServersForType(servers, type);
        });
        els.serverTabs.appendChild(tab);
    });

    renderServersForType(servers, types[0]);
}

function renderServersForType(servers, type) {
    els.serverList.innerHTML = '';
    servers.filter((server) => (server.type || 'Default') === type).forEach((server, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `server-item ${index === 0 ? 'active' : ''}`;
        item.textContent = server.name || `Server ${index + 1}`;
        item.addEventListener('click', () => {
            els.serverList.querySelectorAll('.server-item').forEach((node) => node.classList.remove('active'));
            item.classList.add('active');
            loadVideo(server.url);
        });
        els.serverList.appendChild(item);
    });
}

function loadVideo(url) {
    if (!url) return;
    const video = els.videoPlayer;
    const frame = els.videoFrame;

    if (hls) {
        hls.destroy();
        hls = null;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();
    frame.src = 'about:blank';

    if (isDirectVideoUrl(url)) {
        frame.classList.add('hidden');
        video.classList.remove('hidden');
    } else {
        video.classList.add('hidden');
        frame.classList.remove('hidden');
        frame.src = url;
        return;
    }

    if (window.Hls && Hls.isSupported() && url.includes('.m3u8')) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
    } else {
        video.src = url;
    }

    video.play().catch(() => {});
}

async function handleSearchInput() {
    const query = els.searchInput.value.trim();
    if (query.length < 2) {
        els.searchSuggestions.classList.add('hidden');
        return;
    }

    const result = await searchAnime(query);
    showSuggestions(result.slice(0, 6));
}

async function searchAnime(query) {
    const result = await getJson(`/gogoanime/search?keyword=${encodeURIComponent(query)}&page=1`, {
        animes: fallbackAnimes.filter((anime) => anime.name.toLowerCase().includes(query.toLowerCase()))
    });
    return normalizeList(result.animes || result || []);
}

function showSuggestions(animes) {
    if (!animes.length) {
        els.searchSuggestions.classList.add('hidden');
        return;
    }

    els.searchSuggestions.innerHTML = animes.map((anime) => `
        <div class="suggestion-item" role="option" data-id="${escapeAttr(anime.id)}">
            <img src="${escapeAttr(anime.img)}" alt="">
            <div>
                <div class="s-title">${escapeHtml(anime.name)}</div>
                <div class="s-meta">${anime.releasedYear} - ${anime.subOrDub.toUpperCase()}</div>
            </div>
        </div>
    `).join('');

    els.searchSuggestions.querySelectorAll('.suggestion-item').forEach((item) => {
        item.addEventListener('click', () => {
            els.searchInput.value = '';
            els.searchSuggestions.classList.add('hidden');
            loadAnimeDetails(item.dataset.id);
        });
    });

    els.searchSuggestions.classList.remove('hidden');
}

async function runSearch(query) {
    hideAllSections();
    els.searchResultsSection.classList.remove('hidden');
    els.searchHeading.textContent = `Results for "${query}"`;
    els.searchEyebrow.textContent = 'Search';
    els.searchResultsGrid.innerHTML = Array.from({ length: 10 }, () => '<div class="skeleton-card"></div>').join('');
    els.searchSuggestions.classList.add('hidden');
    setActiveNav('search');

    const results = await searchAnime(query);
    renderGrid(results, els.searchResultsGrid);
}

function renderGenres() {
    els.genreGrid.innerHTML = genres.map((genre) => `
        <button class="genre-tile" type="button" data-query="${escapeAttr(genre.query)}">
            <i class="fa-solid ${genre.icon}"></i>
            <strong>${escapeHtml(genre.name)}</strong>
        </button>
    `).join('');

    els.genreGrid.querySelectorAll('.genre-tile').forEach((tile) => {
        tile.addEventListener('click', () => runSearch(tile.dataset.query));
    });
}

function renderWatchlist() {
    const list = getWatchlist();
    renderGrid(list, els.watchlistGrid);
}

function loadContinueWatching() {
    const list = getContinueWatching();
    if (!list.length) {
        els.continueWatchingSection.classList.add('hidden');
        return;
    }

    els.continueWatchingSection.classList.remove('hidden');
    renderRow(list, els.continueGrid);
}

function saveContinueWatching(details) {
    if (!details || !details.id) return;
    const list = getContinueWatching().filter((item) => item.id !== details.id);
    list.unshift({
        id: details.id,
        name: details.name || currentAnimeDetails?.name || details.id,
        img: details.img || currentAnimeDetails?.img || fallbackAnimes[0].img,
        releasedYear: details.releasedYear || currentAnimeDetails?.releasedYear || '2024',
        subOrDub: details.subOrDub || currentAnimeDetails?.subOrDub || 'sub',
        rating: details.rating || currentAnimeDetails?.rating || '8.8',
        totalEpisodes: currentEpisodes.length || details.totalEpisodes || 12,
        description: details.description || currentAnimeDetails?.description || '',
        timestamp: Date.now()
    });
    localStorage.setItem('continue-watching', JSON.stringify(list.slice(0, 12)));
    loadContinueWatching();
}

function getContinueWatching() {
    return safeParse(localStorage.getItem('continue-watching'), []);
}

function toggleCurrentWatchlist() {
    if (!currentAnimeDetails) return;
    toggleWatchlist(currentAnimeDetails);
    updateWatchlistButton();
    renderWatchlist();
}

function toggleWatchlist(anime) {
    const item = normalizeAnime(anime);
    let list = getWatchlist();
    if (list.some((entry) => entry.id === item.id)) {
        list = list.filter((entry) => entry.id !== item.id);
    } else {
        list.unshift(item);
    }
    localStorage.setItem('watchlist', JSON.stringify(list));
}

function getWatchlist() {
    return safeParse(localStorage.getItem('watchlist'), []);
}

function isInWatchlist(id) {
    return getWatchlist().some((item) => item.id === normalizeId(id));
}

function updateWatchlistButton() {
    const active = isInWatchlist(currentAnimeId);
    els.watchlistBtn.classList.toggle('active', active);
    els.watchlistBtn.innerHTML = `<i class="${active ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> ${active ? 'In Watchlist' : 'Add to Watchlist'}`;
}

function saveWatchProgress(animeId, percent) {
    const progress = safeParse(localStorage.getItem('watch-progress'), {});
    progress[normalizeId(animeId)] = Math.max(8, Math.min(96, percent));
    localStorage.setItem('watch-progress', JSON.stringify(progress));
}

function getWatchProgress(animeId) {
    return safeParse(localStorage.getItem('watch-progress'), {})[normalizeId(animeId)] || null;
}

function progressForEpisode(epNum) {
    const episode = Number(epNum) || currentEpIndex + 1;
    return Math.round((episode / Math.max(currentEpisodes.length, episode, 1)) * 100);
}

function playPreviousEpisode() {
    if (currentEpIndex > 0) {
        currentEpIndex -= 1;
        const ep = currentEpisodes[currentEpIndex];
        playEpisode(ep.episodeId, ep.episodeNo);
    }
}

function playNextEpisode() {
    if (currentEpIndex < currentEpisodes.length - 1) {
        currentEpIndex += 1;
        const ep = currentEpisodes[currentEpIndex];
        playEpisode(ep.episodeId, ep.episodeNo);
    }
}

function setActiveEpisode() {
    document.querySelectorAll('.episode-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index % currentEpisodes.length === currentEpIndex);
    });
}

function goHome() {
    hideAllSections();
    els.heroSection.classList.remove('hidden');
    els.homeContent.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav('home');
}

function showSection(name) {
    if (name === 'search') {
        els.searchInput.focus();
        return;
    }

    if (name === 'trending') {
        hideAllSections();
        els.searchResultsSection.classList.remove('hidden');
        els.searchHeading.textContent = 'Trending Now';
        els.searchEyebrow.textContent = 'The current heat';
        renderGrid(homeCache.trending, els.searchResultsGrid);
        setActiveNav('trending');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (name === 'genres') {
        hideAllSections();
        els.genresSection.classList.remove('hidden');
        setActiveNav('genres');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (name === 'watchlist') {
        hideAllSections();
        els.watchlistSection.classList.remove('hidden');
        renderWatchlist();
        setActiveNav('watchlist');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function hideAllSections() {
    [
        els.heroSection,
        els.homeContent,
        els.searchResultsSection,
        els.genresSection,
        els.watchlistSection,
        els.animeDetailsSection
    ].forEach((section) => section.classList.add('hidden'));
}

function setActiveNav(name) {
    document.querySelectorAll('[data-nav]').forEach((link) => {
        link.classList.toggle('active', link.dataset.nav === name);
    });
}

async function getJson(path, fallback) {
    try {
        const response = await fetch(`${API_BASE}${path}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn(`Using fallback for ${path}`, error);
        return fallback;
    }
}

function normalizeList(list, recent = false) {
    if (!Array.isArray(list)) return [];
    return list.map((anime) => normalizeAnime(anime, recent)).filter((anime) => anime.id && anime.name && anime.img);
}

function normalizeAnime(anime, recent = false) {
    const rawId = anime.id || anime.animeId || anime.slug || anime.name || '';
    const id = recent ? String(rawId).split('-episode-')[0] : normalizeId(rawId);
    const episodeNo = anime.episodeNo || anime.episode || extractEpisode(rawId);
    return {
        id,
        name: anime.name || anime.title || 'Untitled Anime',
        img: anime.img || anime.image || anime.poster || fallbackAnimes[0].img,
        banner: anime.banner || null,
        releasedYear: anime.releasedYear || anime.year || '2024',
        subOrDub: String(anime.subOrDub || anime.language || 'sub').toLowerCase().includes('dub') ? 'dub' : 'sub',
        rating: anime.tmdbRating || anime.rating || anime.score || (8 + Math.random() * 1.5).toFixed(1),
        totalEpisodes: anime.totalEpisodes || anime.episodesCount || anime.episodes?.length || episodeNo || 12,
        episodeNo,
        description: anime.description || anime.plotSummary || fallbackAnimes.find((item) => item.id === id)?.description || ''
    };
}

function normalizeDetails(details, fallback) {
    const base = normalizeAnime({ ...fallback, ...details });
    const episodes = Array.isArray(details.episodes) && details.episodes.length
        ? details.episodes.map((ep, index) => ({
            episodeId: ep.episodeId || ep.id || `${base.id}-episode-${index + 1}`,
            episodeNo: ep.episodeNo || ep.number || index + 1
        }))
        : makeFallbackEpisodes(base.id, base.totalEpisodes);

    return {
        ...base,
        description: details.plotSummary || details.description || base.description || fallback.description,
        type: details.type || 'TV Series',
        status: details.status || 'HD Streaming',
        genres: Array.isArray(details.genres) && details.genres.length ? details.genres.slice(0, 6) : ['Action', 'Adventure', 'Drama'],
        episodes
    };
}

function makeFallbackDetails(anime) {
    return {
        ...anime,
        plotSummary: anime.description,
        type: 'TV Series',
        status: 'HD Streaming',
        genres: ['Action', 'Adventure', 'Supernatural'],
        episodes: makeFallbackEpisodes(anime.id, Math.min(anime.totalEpisodes || 12, 24))
    };
}

function makeFallbackEpisodes(id, count = 12) {
    const limit = Math.max(1, Math.min(Number(count) || 12, 48));
    return Array.from({ length: limit }, (_, index) => ({
        episodeId: `${id}-episode-${index + 1}`,
        episodeNo: index + 1
    }));
}

function makeFallbackServers() {
    return {
        servers: [
            {
                name: 'Preview',
                type: 'MP4',
                url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
            }
        ]
    };
}

function initScrollReveal() {
    window.revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                window.revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    observeRevealTargets();
}

function observeRevealTargets() {
    if (!window.revealObserver) return;
    document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => window.revealObserver.observe(el));
}

function initCustomCursor() {
    if (!els.customCursor || window.matchMedia('(max-width: 820px)').matches) return;
    let active = false;

    document.addEventListener('mousemove', (event) => {
        active = true;
        els.customCursor.style.opacity = '1';
        els.customCursor.style.transform = `translate3d(${event.clientX - 9}px, ${event.clientY - 9}px, 0)`;
    });

    document.addEventListener('mouseleave', () => {
        if (active) els.customCursor.style.opacity = '0';
    });

    document.addEventListener('mouseover', (event) => {
        if (event.target.closest('button, a, .anime-card, .genre-tile')) {
            els.customCursor.style.width = '34px';
            els.customCursor.style.height = '34px';
        }
    });

    document.addEventListener('mouseout', (event) => {
        if (event.target.closest('button, a, .anime-card, .genre-tile')) {
            els.customCursor.style.width = '18px';
            els.customCursor.style.height = '18px';
        }
    });
}

function debounce(fn, delay) {
    let timeout = null;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

function toCamel(id) {
    return id.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizeId(id) {
    return String(id || '').trim();
}

function extractEpisode(value) {
    const match = String(value || '').match(/episode-(\d+)/);
    return match ? Number(match[1]) : null;
}

function getRating(anime) {
    return Number(anime.rating || 0);
}

function slugify(value) {
    return String(value || 'anime')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'anime';
}

function isDirectVideoUrl(url) {
    return /\.(m3u8|mp4|webm|ogg)(\?|$)/i.test(url);
}

function safeParse(value, fallback) {
    try {
        return JSON.parse(value) || fallback;
    } catch {
        return fallback;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}
