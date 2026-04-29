// ==========================================
// 1. CONFIGURATION (API)
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' ? 'http://localhost:3000' : window.location.origin;
async function getJson(endpoint, fallback) { 
    try { 
        // Cache busting for API calls
        const url = new URL(API_BASE + endpoint);
        url.searchParams.append('v', '1.1.0');
        
        const r = await fetch(url.toString()); 
        if(!r.ok) throw new Error(); 
        return await r.json(); 
    } catch(e) { 
        console.error(`API Error on ${endpoint}:`, e);
        return fallback; 
    } 
}

let allContentCache = [];

const db = {
    collection: () => ({
        doc: () => ({
            onSnapshot: () => {},
            get: async () => ({ size: 0, exists: false, data: () => ({}) }),
            set: async () => {},
            delete: async () => {}
        }),
        get: async () => [],
        limit: () => ({ get: async () => [] }),
        orderBy: () => ({ get: async () => [], limit: () => ({ get: async () => [] }) })
    })
};
const auth = { onAuthStateChanged: (cb) => { cb(null); }, signOut: async () => {} };
const firebase = { auth: { EmailAuthProvider: { credential: () => {} } } };

let currentUser = null;
let currentAnimeData = null;
let currentSeasonIndex = 0;
let currentEpisodeIndex = 0;
let userHistoryCache = [];

function getTimestampMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number') return value;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return 0;
}

function getLatestHeroItems(items, limit = 6) {
    const sortedByLatest = [...items].sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));
    const latestTmdbImports = sortedByLatest
        .filter(item => item.tmdbId && (item.type === 'series' || item.type === 'movie'))
        .slice(0, limit)
        .map((item, index) => ({
            ...item,
            bannerLabel: index === 0 ? 'Latest Import' : (item.type === 'movie' ? 'New Movie' : 'New Series')
        }));

    if (latestTmdbImports.length > 0) return latestTmdbImports;

    return sortedByLatest.slice(0, limit).map((item, index) => ({
        ...item,
        bannerLabel: index === 0 ? 'Just Added' : (item.type === 'movie' ? 'Latest Movie' : 'Latest Series')
    }));
}

function formatHeroTitle(title, maxLength = 32) {
    const cleanTitle = (title || '').trim();
    if (cleanTitle.length <= maxLength) return cleanTitle;

    const primaryChunk = cleanTitle.split(/[:\-|]/)[0].trim();
    if (primaryChunk && primaryChunk.length <= maxLength) return primaryChunk;

    return `${cleanTitle.slice(0, maxLength - 3).trimEnd()}...`;
}

function getRatingValue(item) {
    const rating = typeof item.rating === 'string' ? parseFloat(item.rating) : item.rating;
    return Number.isFinite(rating) ? rating : 0;
}

function getReleaseYearValue(item) {
    const year = typeof item.year === 'string' ? parseInt(item.year, 10) : item.year;
    return Number.isFinite(year) ? year : 0;
}

function getPopularityValue(item) {
    const popularity = typeof item.popularity === 'string' ? parseFloat(item.popularity) : item.popularity;
    return Number.isFinite(popularity) ? popularity : 0;
}

function getHeroLabel(item, index) {
    if (item.bannerLabel) return item.bannerLabel;
    if (item._isNew) return index === 0 ? 'Fresh Drop' : 'Just Added';
    if (getRatingValue(item) >= 8.5) return 'Top Rated';
    return (item.type || '').toLowerCase() === 'movie' ? 'Featured Movie' : 'Featured Series';
}

function getHeroDescription(item) {
    if (item.description) return item.description;

    const genres = (item.genres || []).slice(0, 3).join(' / ');
    const parts = [genres, item.year, item.language].filter(Boolean);
    if (parts.length) return `${parts.join(' / ')} on AniStream.`;

    return 'Watch this amazing title on AniStream.';
}

function getHomeScore(item) {
    const ratingScore = getRatingValue(item) * 20;
    const recentScore = item._isNew ? 40 : 0;
    const imageScore = item.banner ? 15 : (item.image ? 8 : 0);
    const tmdbScore = item.tmdbId ? 10 : 0;
    const yearScore = Math.max(getReleaseYearValue(item) - 2018, 0);
    return ratingScore + recentScore + imageScore + tmdbScore + yearScore;
}

function sortByHomeScore(items) {
    return [...items].sort((a, b) => {
        const scoreDiff = getHomeScore(b) - getHomeScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp);
    });
}

function getCuratedRowItems(items, options = {}) {
    const { type = 'all', limit = 7 } = options;
    const filtered = items.filter(item => {
        const itemType = (item.type || 'series').toLowerCase();
        if (type === 'movie') return itemType === 'movie';
        if (type === 'series') return itemType !== 'movie';
        return true;
    });

    return sortByHomeScore(filtered).slice(0, limit);
}

function getFreshDropItems(items, limit = 7) {
    const freshItems = items
        .filter(item => item._isNew)
        .sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));

    return freshItems.slice(0, limit);
}

function getHiddenGemItems(items, limit = 7) {
    return [...items]
        .filter(item => getRatingValue(item) >= 7.5)
        .sort((a, b) => {
            const tmdbDiff = Number(Boolean(a.tmdbId)) - Number(Boolean(b.tmdbId));
            if (tmdbDiff !== 0) return tmdbDiff;
            const yearDiff = getReleaseYearValue(a) - getReleaseYearValue(b);
            if (yearDiff !== 0) return yearDiff;
            return getHomeScore(b) - getHomeScore(a);
        })
        .slice(0, limit);
}

function getMostViewedItems(items, limit = 8) {
    return [...items]
        .sort((a, b) => {
            const popularityDiff = getPopularityValue(b) - getPopularityValue(a);
            if (popularityDiff !== 0) return popularityDiff;
            const scoreDiff = getHomeScore(b) - getHomeScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp);
        })
        .slice(0, limit);
}

function getTopRatedSidebarItems(items, limit = 5) {
    return [...items]
        .filter(item => getRatingValue(item) > 0)
        .sort((a, b) => {
            const ratingDiff = getRatingValue(b) - getRatingValue(a);
            if (ratingDiff !== 0) return ratingDiff;
            return getHomeScore(b) - getHomeScore(a);
        })
        .slice(0, limit);
}

function getPopularGenres(items, limit = 8) {
    const counts = new Map();
    items.forEach(item => {
        (item.genres || []).forEach(genre => {
            counts.set(genre, (counts.get(genre) || 0) + 1);
        });
    });

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([genre]) => genre);
}

function setHomeSectionsVisibility(isHomeView) {
    ['series-section', 'movie-section', 'fresh-section', 'gems-section', 'recommended-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isHomeView ? 'block' : 'none';
    });
    const sidebar = document.getElementById('most-viewed-sidebar');
    if (sidebar) sidebar.style.display = isHomeView ? 'block' : 'none';
}

function getBecauseYouWatchedItems(items, historyEntries, limit = 7) {
    if (!items.length || !historyEntries.length) return [];

    const watchedIds = new Set(historyEntries.map(entry => entry.id));
    const watchedItems = historyEntries
        .map(entry => items.find(item => item.id === entry.id))
        .filter(Boolean);

    if (!watchedItems.length) return [];

    const genreWeights = new Map();
    watchedItems.forEach((item, index) => {
        const weight = Math.max(4 - index, 1);
        (item.genres || []).forEach(genre => {
            genreWeights.set(genre, (genreWeights.get(genre) || 0) + weight);
        });
    });

    return [...items]
        .filter(item => !watchedIds.has(item.id))
        .map(item => ({
            item,
            score: (item.genres || []).reduce((sum, genre) => sum + (genreWeights.get(genre) || 0), 0) + (getRatingValue(item) / 2)
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score || getHomeScore(b.item) - getHomeScore(a.item))
        .slice(0, limit)
        .map(entry => entry.item);
}

function renderPersonalizedRow() {
    const section = document.getElementById('recommended-section');
    const row = document.getElementById('recommended-row');
    if (!section || !row) return;

    row.innerHTML = '';
    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    if (!currentUser || !sourceItems.length || !userHistoryCache.length) {
        section.style.display = 'none';
        return;
    }

    const recommended = getBecauseYouWatchedItems(sourceItems, userHistoryCache, 7);
    recommended.forEach(item => row.appendChild(createNetflixCard(item)));
    section.style.display = recommended.length ? 'block' : 'none';
}

function formatMostViewedScore(item) {
    const popularity = getPopularityValue(item);
    if (popularity > 0) return `${Math.round(popularity)} buzz`;
    const ratingValue = getRatingValue(item);
    if (ratingValue > 0) return `${ratingValue.toFixed(1)} rated`;
    return 'Featured';
}

function renderMostViewedSidebar() {
    const sidebar = document.getElementById('most-viewed-sidebar');
    const list = document.getElementById('most-viewed-list');
    if (!sidebar || !list) return;

    list.innerHTML = '';
    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    if (!sourceItems.length) {
        sidebar.style.display = 'none';
        return;
    }

    const items = getMostViewedItems(sourceItems, 8);
    items.forEach((item, index) => {
        const row = document.createElement('div');
        const year = getReleaseYearValue(item);
        const typeLabel = (item.type || '').toLowerCase() === 'movie' ? 'Movie' : 'Series';
        row.className = 'most-viewed-item';
        row.innerHTML = `
            <img class="most-viewed-thumb" src="${item.image || ''}" alt="${item.title}" loading="lazy">
            <div class="most-viewed-copy">
                <div class="most-viewed-title">${item.title}</div>
                <div class="most-viewed-meta">
                    <span class="most-viewed-chip">${typeLabel}</span>
                    ${year ? `<span>${year}</span>` : ''}
                    <span>${formatMostViewedScore(item)}</span>
                </div>
            </div>
            <div class="most-viewed-rank">${String(index + 1).padStart(2, '0')}</div>
        `;
        row.onclick = () => window.location.href = `detail.html?anime=${item.id}`;
        list.appendChild(row);
    });

    sidebar.style.display = items.length ? 'block' : 'none';
}

function renderCompactSidebarRows(items, listId, formatter) {
    const list = document.getElementById(listId);
    if (!list) return 0;

    list.innerHTML = '';
    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'most-viewed-item';
        row.innerHTML = formatter(item, index);
        row.onclick = () => window.location.href = `detail.html?anime=${item.id}`;
        list.appendChild(row);
    });

    return items.length;
}

function renderSidebarFreshPicks() {
    const list = document.getElementById('sidebar-fresh-list');
    if (!list) return;

    list.innerHTML = '';
    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    const items = getFreshDropItems(sourceItems, 4);
    items.forEach(item => {
        const card = document.createElement('div');
        const year = getReleaseYearValue(item);
        card.className = 'sidebar-pick-card';
        card.innerHTML = `
            <img src="${item.image || ''}" alt="${item.title}" loading="lazy">
            <div class="sidebar-pick-overlay">
                <div class="sidebar-pick-badge">New</div>
                <div class="sidebar-pick-title">${item.title}</div>
                <div class="sidebar-pick-meta">${year || 'Latest Drop'}</div>
            </div>
        `;
        card.onclick = () => window.location.href = `detail.html?anime=${item.id}`;
        list.appendChild(card);
    });

    if (!items.length) {
        list.innerHTML = '<p style="color:#70707b;font-size:0.82rem;line-height:1.5;">Newly added titles will show up here.</p>';
    }
}

function renderSidebarTopRated() {
    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    const items = getTopRatedSidebarItems(sourceItems, 5);
    return renderCompactSidebarRows(items, 'sidebar-top-rated-list', (item, index) => {
        const year = getReleaseYearValue(item);
        return `
            <img class="most-viewed-thumb" src="${item.image || ''}" alt="${item.title}" loading="lazy">
            <div class="most-viewed-copy">
                <div class="most-viewed-title">${item.title}</div>
                <div class="most-viewed-meta">
                    ${year ? `<span>${year}</span>` : ''}
                    <span>${getRatingValue(item).toFixed(1)} rated</span>
                </div>
            </div>
            <div class="most-viewed-rank">${String(index + 1).padStart(2, '0')}</div>
        `;
    });
}

function renderSidebarGenres() {
    const list = document.getElementById('sidebar-genre-list');
    if (!list) return 0;

    list.innerHTML = '';
    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    const genres = getPopularGenres(sourceItems, 8);
    genres.forEach(genre => {
        const chip = document.createElement('button');
        chip.className = 'sidebar-genre-chip';
        chip.textContent = genre;
        chip.onclick = () => {
            const chipEl = [...document.querySelectorAll('.genre-chip')].find(el => el.textContent.toLowerCase().includes(genre.toLowerCase()));
            filterByGenre(genre, chipEl || chip);
        };
        list.appendChild(chip);
    });

    return genres.length;
}

function refreshSidebarModules() {
    const sidebar = document.getElementById('most-viewed-sidebar');
    if (!sidebar) return;

    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    const counts = {
        mostViewed: getMostViewedItems(sourceItems, 8).length,
        fresh: getFreshDropItems(sourceItems, 4).length,
        topRated: renderSidebarTopRated(),
        genres: renderSidebarGenres()
    };

    renderMostViewedSidebar();
    renderSidebarFreshPicks();

    const moduleConfigs = [
        { moduleId: 'sidebar-most-viewed-module', count: counts.mostViewed },
        { moduleId: 'sidebar-fresh-module', count: counts.fresh },
        { moduleId: 'sidebar-top-rated-module', count: counts.topRated },
        { moduleId: 'sidebar-genres-module', count: counts.genres }
    ];

    moduleConfigs.forEach(({ moduleId, count }) => {
        const el = document.getElementById(moduleId);
        if (el) el.style.display = count ? 'block' : 'none';
    });

    const moduleStates = moduleConfigs.map(config => {
        const el = document.getElementById(config.moduleId);
        return { el, visible: Boolean(el && el.style.display !== 'none') };
    });

    const visibleModules = moduleStates.filter(entry => entry.visible);

    const dividers = [...sidebar.querySelectorAll('.sidebar-divider')];
    dividers.forEach((divider, index) => {
        const currentVisible = moduleStates[index]?.visible;
        const laterVisible = moduleStates.slice(index + 1).some(entry => entry.visible);
        divider.classList.toggle('hidden', !(currentVisible && laterVisible));
    });

    sidebar.style.display = visibleModules.length ? 'block' : 'none';
}


// ==========================================
// 2. TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(msg, type = 'default', icon = '') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: 'fa-check-circle', info: 'fa-info-circle', default: 'fa-bell' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icon || icons[type] || icons.default}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s var(--ease-out) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 3. AUTHENTICATION & PROFILE
// ==========================================
auth.onAuthStateChanged((user) => {
    currentUser = user;

    const authBtns = document.getElementById('auth-buttons');
    const profileWrap = document.getElementById('profile-wrapper');
    const avatar = document.getElementById('user-avatar');
    const mobileBtn = document.getElementById('mobile-profile-btn');

    if (user) {
        if (authBtns) authBtns.style.display = 'none';
        if (profileWrap) {
            profileWrap.style.display = 'block';
            if (avatar) {
                if (user.photoURL) {
                    avatar.src = user.photoURL;
                } else {
                    // Generate avatar with initials
                    const name = user.displayName || user.email || '?';
                    const initial = name.charAt(0).toUpperCase();
                    avatar.src = `https://ui-avatars.com/api/?name=${initial}&background=e50914&color=fff&size=35&bold=true`;
                }
            }
        }
        if (mobileBtn) {
            const displayName = user.displayName || user.email?.split('@')[0] || 'Profile';
            mobileBtn.innerHTML = `<i class="fas fa-user-circle"></i> <span>${displayName.length > 8 ? displayName.substring(0,8) + '..' : displayName}</span>`;
        }
        loadHistory(user.uid);

        // Populate dropdown user info
        const dropAvatar = document.getElementById('dropdown-avatar');
        const dropName = document.getElementById('dropdown-name');
        const dropEmail = document.getElementById('dropdown-email');
        const avatarSrc = avatar ? avatar.src : '';
        if (dropAvatar) dropAvatar.src = avatarSrc;
        if (dropName) dropName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
        if (dropEmail) dropEmail.textContent = user.email || '';
    } else {
        if (authBtns) authBtns.style.display = 'flex';
        if (profileWrap) profileWrap.style.display = 'none';
        if (mobileBtn) mobileBtn.innerHTML = `<i class="fas fa-user-circle"></i> <span>Sign In</span>`;
    }
});



function logout() {
    auth.signOut().then(() => {
        showToast('Signed out', 'info');
        setTimeout(() => location.reload(), 800);
    });
}
function openEditProfile(tab) {
    if (!currentUser) return;
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    // Populate profile info
    document.getElementById('edit-name').value = currentUser.displayName || '';
    document.getElementById('edit-pic').value = currentUser.photoURL || '';

    const avatarUrl = currentUser.photoURL || `https://ui-avatars.com/api/?name=${(currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase()}&background=e50914&color=fff&size=64&bold=true`;
    const el = id => document.getElementById(id);

    // Avatar & display info
    if (el('profile-avatar-preview')) el('profile-avatar-preview').src = avatarUrl;
    if (el('profile-display-name')) el('profile-display-name').textContent = currentUser.displayName || 'No Name Set';
    if (el('profile-display-email')) el('profile-display-email').textContent = currentUser.email || '';

    // Dropdown info
    if (el('dropdown-avatar')) el('dropdown-avatar').src = avatarUrl;
    if (el('dropdown-name')) el('dropdown-name').textContent = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    if (el('dropdown-email')) el('dropdown-email').textContent = currentUser.email || '';

    // Account tab info
    if (el('account-email')) el('account-email').textContent = currentUser.email || 'â€”';
    if (el('account-uid')) el('account-uid').textContent = currentUser.uid || 'â€”';

    // Member since
    const createdAt = currentUser.metadata?.creationTime;
    if (el('profile-member-since')) {
        el('profile-member-since').textContent = createdAt
            ? 'Member since ' + new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Member';
    }

    // Load stats from Firestore
    if (currentUser.uid) {
        db.collection('users').doc(currentUser.uid).collection('mylist').get().then(snap => {
            if (el('account-mylist-count')) el('account-mylist-count').textContent = snap.size;
        }).catch(() => {});
        db.collection('users').doc(currentUser.uid).collection('history').get().then(snap => {
            if (el('account-history-count')) el('account-history-count').textContent = snap.size;
        }).catch(() => {});
    }

    // Clear password fields
    ['current-password', 'new-password', 'confirm-new-password'].forEach(id => { if (el(id)) el(id).value = ''; });

    // Switch to the requested tab
    if (tab === 'security') {
        const secTab = document.querySelector('[onclick*="profile-tab-security"]');
        if (secTab) switchProfileTab('profile-tab-security', secTab);
    } else {
        const profTab = document.querySelector('[onclick*="profile-tab-info"]');
        if (profTab) switchProfileTab('profile-tab-info', profTab);
    }

    modal.style.display = 'flex';
}
function closeEditProfile() { document.getElementById('edit-profile-modal').style.display = 'none'; }

function switchProfileTab(tabId, btn) {
    document.querySelectorAll('.profile-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');
}

function previewProfileAvatar() {
    const url = document.getElementById('edit-pic')?.value;
    const img = document.getElementById('profile-avatar-preview');
    if (img && url) {
        img.src = url;
        img.onerror = () => {
            const initial = (currentUser?.displayName || currentUser?.email || '?').charAt(0).toUpperCase();
            img.src = `https://ui-avatars.com/api/?name=${initial}&background=e50914&color=fff&size=64&bold=true`;
        };
    }
}

function togglePassVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) { icon.className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye'; }
}

function saveProfileChanges() {
    const name = document.getElementById('edit-name').value;
    const pic = document.getElementById('edit-pic').value;
    const btn = document.querySelector('#profile-tab-info .btn-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i> Saving...'; }
    currentUser.updateProfile({ displayName: name, photoURL: pic })
        .then(() => {
            // Also update Firestore
            db.collection('users').doc(currentUser.uid).set({
                displayName: name,
                photoURL: pic
            }, { merge: true });
            showToast('Profile updated!', 'success');
            closeEditProfile();
            setTimeout(() => location.reload(), 600);
        })
        .catch(err => {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save" style="margin-right:6px;"></i> Save Changes'; }
            showToast(err.message);
        });
}

function changePassword() {
    const currentPass = document.getElementById('current-password')?.value;
    const newPass = document.getElementById('new-password')?.value;
    const confirmPass = document.getElementById('confirm-new-password')?.value;
    if (!currentPass || !newPass || !confirmPass) { showToast('Please fill in all fields', 'info'); return; }
    if (newPass.length < 6) { showToast('New password must be at least 6 characters', 'info'); return; }
    if (newPass !== confirmPass) { showToast('New passwords do not match', 'info'); return; }

    const btn = document.querySelector('#profile-tab-security .btn-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i> Updating...'; }

    // Re-authenticate then update password
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPass);
    currentUser.reauthenticateWithCredential(credential).then(() => {
        return currentUser.updatePassword(newPass);
    }).then(() => {
        showToast('Password updated successfully!', 'success');
        ['current-password', 'new-password', 'confirm-new-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock" style="margin-right:6px;"></i> Update Password'; }
    }).catch(err => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock" style="margin-right:6px;"></i> Update Password'; }
        let msg = 'Password change failed';
        if (err.code === 'auth/wrong-password') msg = 'Current password is incorrect';
        else if (err.code === 'auth/weak-password') msg = 'New password is too weak';
        else if (err.code === 'auth/invalid-credential') msg = 'Current password is incorrect';
        showToast(msg, 'default');
    });
}

function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    const password = prompt('Enter your password to confirm:');
    if (!password) return;

    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
    currentUser.reauthenticateWithCredential(credential).then(() => {
        // Delete Firestore user data
        const uid = currentUser.uid;
        db.collection('users').doc(uid).delete().catch(() => {});
        // Delete auth account
        return currentUser.delete();
    }).then(() => {
        showToast('Account deleted', 'info');
        closeEditProfile();
        setTimeout(() => location.reload(), 800);
    }).catch(err => {
        let msg = 'Failed to delete account';
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Incorrect password';
        showToast(msg, 'default');
    });
}

function handleProfileClick() {
    /* no auth */
}
function openMobileProfile() { handleProfileClick(); }

// Toggle profile dropdown on click
function toggleProfileDropdown(e) {
    e.stopPropagation();
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
}
// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown && !e.target.closest('.profile-wrapper')) {
        dropdown.classList.remove('show');
    }
});

// ==========================================
// 4. HOME PAGE
// ==========================================
async function loadHomePage() {
    const mainRow = document.getElementById('anime-row');
    if (!mainRow) return;

    allContentCache = [];
    mainRow.innerHTML = '';
    const seriesRow = document.getElementById('series-row'); if(seriesRow) seriesRow.innerHTML = '';
    const movieRow = document.getElementById('movie-row'); if(movieRow) movieRow.innerHTML = '';

    try {
        const [trending, recent, movies] = await Promise.all([
            getJson('/gogoanime/popular?page=1', []),
            getJson('/gogoanime/recent-releases?page=1', []),
            getJson('/gogoanime/anime-movies?page=1', [])
        ]);

        const popMapped = (trending.animes || trending || []).map(i => normalizeGogoAnimeItem(i, { type: 'series' }));
        const recMapped = (recent.animes || recent || []).map(i => normalizeGogoAnimeItem(i, { type: 'series', isRecent: true }));
        const movMapped = (movies.animes || movies || []).map(i => normalizeGogoAnimeItem(i, { type: 'movie' }));

        const added = new Set();
        [...popMapped, ...recMapped, ...movMapped].forEach(item => {
            if (!added.has(item.id)) {
                added.add(item.id);
                allContentCache.push(item);
            }
        });

        const displayContent = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
        resetHome();
        renderHeroSlider(getLatestHeroItems(displayContent));
        
        // Populate Rows
        renderGrid(getCuratedRowItems(displayContent, { limit: 12 }), mainRow);
        
        const seriesRow = document.getElementById('series-row');
        if (seriesRow) renderGrid(getCuratedRowItems(displayContent, { type: 'series', limit: 12 }), seriesRow);
        
        const movieRow = document.getElementById('movie-row');
        if (movieRow) renderGrid(getCuratedRowItems(displayContent, { type: 'movie', limit: 12 }), movieRow);
        
        const freshRow = document.getElementById('fresh-row');
        if (freshRow) renderGrid(recMapped, freshRow);
        
        const gemsRow = document.getElementById('gems-row');
        if (gemsRow) renderGrid(getCuratedRowItems(displayContent, { limit: 12 }).reverse(), gemsRow);

        renderPersonalizedRow();
        refreshSidebarModules();
    } catch(err) {
        console.error(err);
    }
}

function renderHeroSlider(items) {
    const container = document.getElementById('hero-section');
    let slidesHTML = '';

    items.forEach((data, index) => {
        const desktopImg = data.banner || data.image;
        const mobileImg = data.image || data.banner;
        const lang = data.language || 'Sub';
        const year = data.year || '2025';
        const rating = data.rating ? `* ${data.rating}` : '';
        const ratingValue = getRatingValue(data);
        const genres = (data.genres || []).slice(0, 2);
        const heroTitle = formatHeroTitle(data.title);
        const genreBadges = genres.map(g => `<span class="hero-badge badge-genre">${g}</span>`).join('');
        const labelBadge = `<span class="hero-badge badge-match">${getHeroLabel(data, index)}</span>`;
        slidesHTML += `
            <div class="swiper-slide" style="--bg-pc: url('${desktopImg}'); --bg-mobile: url('${mobileImg}'); --hero-accent: ${(data.type || '').toLowerCase() === 'movie' ? 'rgba(255, 180, 87, 0.22)' : 'rgba(229, 9, 20, 0.24)'};">
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <div class="hero-badges">
                        ${labelBadge}
                        <span class="hero-badge badge-year">${year}</span>
                        <span class="hero-badge badge-hd">HD</span>
                        <span class="hero-badge badge-lang">${lang}</span>
                        ${rating ? `<span class="hero-badge badge-rating">${rating}</span>` : ''}
                        ${genreBadges}
                    </div>
                    <h1 class="hero-title" title="${escapeHtml(data.title)}">${heroTitle}</h1>
                    <p class="hero-desc">${getHeroDescription(data)}</p>
                    <div class="hero-btns">
                        <button class="btn-primary" onclick="window.location.href='watch.html?anime=${data.id}&season=0&ep=0'"><i class="fas fa-play"></i> Play</button>
                        <button class="btn-secondary" onclick="window.location.href='detail.html?anime=${data.id}'"><i class="fas fa-info-circle"></i> More Info</button>
                        <button class="btn-mylist-hero" onclick="quickToggleMyList(event, '${data.id}', '${escapeHtml(data.title)}', '${data.image}', '${data.type || 'series'}')" title="Add to My List">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = `
        <div class="swiper mySwiper">
            <div class="swiper-wrapper">${slidesHTML}</div>
            <div class="swiper-button-next"></div>
            <div class="swiper-button-prev"></div>
            <div class="swiper-pagination"></div>
        </div>`;

    new Swiper(".mySwiper", {
        loop: true,
        effect: "fade",
        autoplay: { delay: 6000, disableOnInteraction: false },
        pagination: { el: ".swiper-pagination", clickable: true },
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" }
    });
}

function escapeHtml(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function splitGenres(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(g => g.trim()).filter(Boolean);
    return [];
}

function normalizeGogoAnimeItem(item, options = {}) {
    const id = item.id || item.animeId || item.slug || '';
    const image = item.img || item.animeImg || item.image || item.poster || '';
    const title = item.name || item.animeTitle || item.title || 'Untitled Anime';
    const type = options.type || (String(item.type || '').toLowerCase().includes('movie') ? 'movie' : 'series');
    return {
        id,
        title,
        image,
        banner: item.banner || image,
        tmdbId: item.tmdbId || null,
        language: item.subOrDub || item.language || 'Sub',
        year: item.releasedDate || item.releasedYear || item.released || item.year || '',
        rating: item.tmdbRating || item.rating || item.score || '',
        genres: splitGenres(item.genres || item.genre),
        type,
        timestamp: options.isRecent ? Date.now() : Date.now() - (Math.random() * 10000000),
        description: item.description || item.plotSummary || 'Enjoy this anime on AniStream.',
        seasons: [{ episodes: [] }]
    };
}

function normalizeGogoAnimeDetail(data, id) {
    const genres = splitGenres(data.genres || data.genre);
    const episodes = Array.isArray(data.episodes) ? data.episodes.map((ep, index) => {
        const episodeNo = ep.episodeNo || ep.number || index + 1;
        return {
            title: ep.title || `Episode ${episodeNo}`,
            episodeNo,
            subEpisodeId: ep.episodeId || ep.id || null,
            urlSub: ep.episodeId || ep.id || '',
            episodeUrl: ep.episodeUrl || ''
        };
    }) : [];
    const typeText = data.type || '';
    const type = typeText.toLowerCase().includes('movie') ? 'movie' : 'series';
    const image = data.img || data.animeImg || data.image || '';

    return {
        id,
        title: data.name || data.animeTitle || data.title || id,
        image,
        banner: data.banner || image,
        tmdbId: data.tmdbId || null,
        description: data.description || data.plotSummary || data.otherName || 'No description available for this title.',
        type,
        genres,
        year: data.released || data.releasedYear || data.year || '',
        status: data.status || '',
        language: 'Sub',
        sub: episodes.length || data.totalEpisodes || 0,
        dub: data.dub || 0,
        rating: data.tmdbRating || data.rating || data.score || '',
        seasons: [{ name: 'Season 1', episodes }]
    };
}

// Quick add-to-mylist from hero (no page navigation)
function quickToggleMyList(e, id, title, image, type) {
    e.stopPropagation();
    if (!currentUser) { showToast('Sign in to save to your list', 'info', 'fa-lock'); return; }
    const ref = db.collection('users').doc(currentUser.uid).collection('mylist').doc(id);
    ref.get().then(doc => {
        if (doc.exists) {
            ref.delete().then(() => showToast('Removed from My List', 'info', 'fa-heart-broken'));
        } else {
            ref.set({ title, image, type, timestamp: Date.now() })
                .then(() => showToast('Added to My List!', 'success', 'fa-heart'));
        }
    });
}

// ==========================================
// 5. FILTER & GENRE
// ==========================================
let activeGenreFilter = '';

function resetHome() {
    const mainRow = document.getElementById('anime-row');
    const seriesTitle = document.getElementById('series-title');
    const movieTitle = document.getElementById('movie-title');
    const freshRow = document.getElementById('fresh-row');
    const gemsRow = document.getElementById('gems-row');
    const recommendedRow = document.getElementById('recommended-row');
    const navBtns = document.querySelectorAll('.nav-links button');
    navBtns.forEach(b => b.classList.remove('active'));
    navBtns[0]?.classList.add('active');

    // Remove wrap mode, restore horizontal scroll
    mainRow.classList.remove('grid-wrap-mode');
    document.getElementById('row-title').innerText = 'Trending Picks';
    if (seriesTitle) seriesTitle.innerHTML = 'Top <span>Series</span>';
    if (movieTitle) movieTitle.innerHTML = 'Top <span>Movies</span>';
    setHomeSectionsVisibility(true);
    // Use filtered content based on mode
    const displayItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);
    renderGrid(getCuratedRowItems(displayItems, { limit: 7 }), mainRow);

    // Also re-render curated rows
    const seriesRow = document.getElementById('series-row');
    const movieRow = document.getElementById('movie-row');
    if (seriesRow) { seriesRow.innerHTML = ''; }
    if (movieRow) { movieRow.innerHTML = ''; }
    if (freshRow) { freshRow.innerHTML = ''; }
    if (gemsRow) { gemsRow.innerHTML = ''; }
    if (recommendedRow) { recommendedRow.innerHTML = ''; }
    
    const movieData = getCuratedRowItems(displayItems, { type: 'movie', limit: 7 });
    const seriesData = getCuratedRowItems(displayItems, { type: 'series', limit: 7 });
    const freshData = getFreshDropItems(displayItems, 7);
    const gemsData = getHiddenGemItems(displayItems, 7);
    
    movieData.forEach(data => movieRow?.appendChild(createNetflixCard(data)));
    seriesData.forEach(data => seriesRow?.appendChild(createNetflixCard(data)));
    freshData.forEach(data => freshRow?.appendChild(createNetflixCard(data)));
    gemsData.forEach(data => gemsRow?.appendChild(createNetflixCard(data)));

    const freshSection = document.getElementById('fresh-section');
    const gemsSection = document.getElementById('gems-section');
    if (freshSection) freshSection.style.display = freshData.length ? 'block' : 'none';
    if (gemsSection) gemsSection.style.display = gemsData.length ? 'block' : 'none';
    renderPersonalizedRow();
    refreshSidebarModules();

    activeGenreFilter = '';
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterContent(type) {
    const title = document.getElementById('row-title');
    const mainRow = document.getElementById('anime-row');
    const navBtns = document.querySelectorAll('.nav-links button');
    navBtns.forEach(b => b.classList.remove('active'));
    event?.currentTarget?.classList.add('active');

    // Enable wrap mode for grid
    mainRow.classList.add('grid-wrap-mode');

    if (type === 'all') {
        title.innerText = 'All Anime';
        setHomeSectionsVisibility(false);
        renderGrid(allContentCache, mainRow);
    } else {
        title.innerText = type === 'movie' ? 'Movies' : 'Series';
        setHomeSectionsVisibility(false);
        const filtered = allContentCache.filter(item => (item.type || 'series').toLowerCase() === type);
        renderGrid(filtered, mainRow);
    }
    activeGenreFilter = '';
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));

    // Scroll to the section
    document.getElementById('main-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function seeAll(type) {
    const title = document.getElementById('row-title');
    const mainRow = document.getElementById('anime-row');

    mainRow.classList.add('grid-wrap-mode');
    setHomeSectionsVisibility(false);

    if (type === 'all') {
        title.innerText = 'All Anime';
        renderGrid(allContentCache, mainRow);
    } else if (type === 'series') {
        title.innerText = 'All Series';
        const filtered = allContentCache.filter(item => (item.type || 'series').toLowerCase() !== 'movie');
        renderGrid(filtered, mainRow);
    } else if (type === 'movie') {
        title.innerText = 'All Movies';
        const filtered = allContentCache.filter(item => (item.type || '').toLowerCase() === 'movie');
        renderGrid(filtered, mainRow);
    }
    activeGenreFilter = '';
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));

    // Scroll to the section
    document.getElementById('main-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterByGenre(genre, el) {
    const mainRow = document.getElementById('anime-row');
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));

    if (activeGenreFilter === genre) {
        activeGenreFilter = '';
        // Reset to default home view
        mainRow.classList.remove('grid-wrap-mode');
        document.getElementById('row-title').innerText = 'Trending Picks';
        setHomeSectionsVisibility(true);
        renderGrid(getCuratedRowItems(allContentCache, { limit: 7 }), mainRow);
        return;
    }
    activeGenreFilter = genre;
    el.classList.add('active');
    mainRow.classList.add('grid-wrap-mode');
    setHomeSectionsVisibility(false);
    document.getElementById('row-title').innerText = genre;
    const filtered = allContentCache.filter(item => (item.genres || []).includes(genre));
    renderGrid(filtered, mainRow);
}

function renderGrid(items, container) {
    container.innerHTML = '';
    items.forEach(data => container.appendChild(createNetflixCard(data)));
    if (!items.length) container.innerHTML = '<p style="color:#555;padding:20px 0;font-size:0.95rem;">No titles found.</p>';
}

// ==========================================
// 5.5 HORIZONTAL SCROLL ARROWS
// ==========================================
function initScrollArrows() {
    document.querySelectorAll('.grid-scroll').forEach(row => {
        // Skip if already wrapped
        if (row.parentElement.classList.contains('scroll-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'scroll-wrapper';
        
        // Insert wrapper before row in DOM
        row.parentNode.insertBefore(wrapper, row);
        
        const leftBtn = document.createElement('button');
        leftBtn.className = 'scroll-btn scroll-btn-left';
        leftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        leftBtn.style.display = 'none';
        
        const rightBtn = document.createElement('button');
        rightBtn.className = 'scroll-btn scroll-btn-right';
        rightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        rightBtn.style.display = 'none';

        leftBtn.onclick = () => row.scrollBy({ left: -350, behavior: 'smooth' });
        rightBtn.onclick = () => row.scrollBy({ left: 350, behavior: 'smooth' });

        wrapper.appendChild(leftBtn);
        wrapper.appendChild(row);
        wrapper.appendChild(rightBtn);

        const checkScroll = () => {
            if (!row.children.length || row.classList.contains('grid-wrap-mode')) {
                leftBtn.style.display = 'none';
                rightBtn.style.display = 'none';
                return;
            }
            leftBtn.style.display = row.scrollLeft > 0 ? 'flex' : 'none';
            rightBtn.style.display = row.scrollLeft < (row.scrollWidth - row.clientWidth - 5) ? 'flex' : 'none';
        };

        row.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        setTimeout(checkScroll, 100);

        const observer = new MutationObserver(checkScroll);
        observer.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
}
window.addEventListener('DOMContentLoaded', initScrollArrows);

// ==========================================
// 6. CARD CREATION
// ==========================================
function createNetflixCard(data) {
    const card = document.createElement('div');
    card.classList.add('anime-card');
    const randomMatch = Math.floor(Math.random() * 18 + 82);
    const ratingValue = getRatingValue(data);
    const year = getReleaseYearValue(data);
    let seasonText = '';
    if ((data.type || '').toLowerCase() === 'movie') {
        seasonText = 'Movie';
    } else {
        const sCount = data.seasons ? data.seasons.length : 0;
        seasonText = sCount > 1 ? `${sCount} Seasons` : '1 Season';
    }
    const eps = data.sub || 0;
    const lang = data.language || 'Sub';
    const typeLabel = (data.type || '').toLowerCase() === 'movie' ? 'Movie' : 'Series';

    const topBadges = [];
    if (data._isNew) topBadges.push('<div class="card-top-badge new-badge">New</div>');
    if (ratingValue >= 8.5) topBadges.push('<div class="card-top-badge accent-badge">Top Rated</div>');
    else topBadges.push(`<div class="card-top-badge type-badge">${typeLabel}</div>`);

    const metaPills = [
        `<span class="card-pill match-pill">${randomMatch}% Match</span>`,
        `<span class="card-pill season-pill">${seasonText}</span>`
    ];
    if (eps > 0) metaPills.push(`<span class="card-pill ep-pill">${eps} Ep</span>`);
    if (year) metaPills.push(`<span class="card-pill subtle-pill">${year}</span>`);
    metaPills.push(`<span class="card-pill lang-pill">${lang}</span>`);
    if (ratingValue > 0) metaPills.push(`<span class="card-pill rating-pill">&#9733; ${ratingValue.toFixed(1)}</span>`);

    card.innerHTML = `
        ${topBadges.join('')}
        <img src="${data.image || ''}" loading="lazy" alt="${data.title}">
        <div class="card-info">
            <div class="card-kicker">${typeLabel}${year ? ` / ${year}` : ''}</div>
            <div class="card-title">${data.title}</div>
            <div class="card-meta">${metaPills.join('')}</div>
        </div>`;
    card.onclick = () => window.location.href = `detail.html?anime=${data.id}`;
    return card;
}

// ==========================================
// 7. SEARCH
// ==========================================
let searchRequestToken = 0;
let searchDebounceTimer = null;

document.getElementById?.('search-input')?.addEventListener('input', (e) => {
    const grid = document.getElementById('search-results-grid');
    const query = e.target.value.toLowerCase().trim();
    grid.innerHTML = '';
    if (query.length < 2) return;
    grid.innerHTML = '<p style="color:#555;padding:20px;grid-column:span 4;">Searching...</p>';

    clearTimeout(searchDebounceTimer);
    const requestToken = ++searchRequestToken;
    searchDebounceTimer = setTimeout(async () => {
        const sourceItems = getNormalContent(allContentCache);
        const localResults = sourceItems.filter(item =>
            item.title?.toLowerCase().includes(query) ||
            (item.genres || []).some(g => g.toLowerCase().includes(query)) ||
            item.description?.toLowerCase().includes(query)
        );

        const apiData = await getJson(`/gogoanime/search?keyword=${encodeURIComponent(query)}&page=1`, { animes: [] });
        if (requestToken !== searchRequestToken) return;

        const apiResults = (apiData.animes || apiData || []).map(item => normalizeGogoAnimeItem(item));
        const seen = new Set();
        const results = [...apiResults, ...localResults].filter(item => {
            if (!item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });

        grid.innerHTML = '';
        if (!results.length) {
            grid.innerHTML = '<p style="color:#555;padding:20px;grid-column:span 4;">No results found.</p>';
            return;
        }
        results.forEach(item => grid.appendChild(createNetflixCard(item)));
    }, 250);
});

// Allow ESC to close search
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('search-overlay');
        if (overlay?.classList.contains('active')) closeSearch?.();
    }
});

// ==========================================
// 8. PLAYER
// ==========================================
window.togglePriority = function() {
    let current = localStorage.getItem('anistream_priority') || 'sub';
    let next = current === 'sub' ? 'dub' : 'sub';
    localStorage.setItem('anistream_priority', next);
    const label = document.getElementById('priority-label');
    if (label) label.innerText = next.toUpperCase();
    showToast(`Priority set to ${next.toUpperCase()}`, 'success', 'fa-language');
    
    // If on watch page, re-play episode with new priority
    if (typeof currentSeasonIndex !== 'undefined' && typeof currentEpisodeIndex !== 'undefined') {
        playEpisode(currentSeasonIndex, currentEpisodeIndex);
    } else {
        location.reload();
    }
};

async function initPlayer() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('anime');
    const startSeason = parseInt(params.get('season') || '0');
    const startEp     = parseInt(params.get('ep')     || '0');
    
    const priorityLabel = document.getElementById('priority-label');
    if (priorityLabel) priorityLabel.innerText = (localStorage.getItem('anistream_priority') || 'SUB').toUpperCase();

    if (!id) return;

    try {
        let subId = id.endsWith('-dub') ? id.replace('-dub', '') : id;
        let dubId = subId + '-dub';
        
        const [subData, dubData] = await Promise.all([
            getJson(`/gogoanime/anime/${subId}`, null),
            getJson(`/gogoanime/anime/${dubId}`, null)
        ]);

        if (!subData && !dubData) return;

        const mainData = subData || dubData;
        const mappedData = {
            id: subId,
            title: mainData.animeTitle || mainData.name,
            image: mainData.animeImg || mainData.img,
            description: mainData.description,
            type: mainData.type || 'series',
            genres: mainData.genres || [],
            seasons: [{ episodes: [] }]
        };

        const subEpisodes = subData ? subData.episodes || [] : [];
        const dubEpisodes = dubData ? dubData.episodes || [] : [];
        
        const maxEp = Math.max(subEpisodes.length, dubEpisodes.length);
        for (let i = 1; i <= maxEp; i++) {
            const subEp = subEpisodes.find(e => e.episodeNo == i);
            const dubEp = dubEpisodes.find(e => e.episodeNo == i);
            
            mappedData.seasons[0].episodes.push({
                title: subEp?.title || dubEp?.title || `Episode ${i}`,
                episodeNo: i,
                subEpisodeId: subEp?.episodeId || null,
                dubEpisodeId: dubEp?.episodeId || null
            });
        }

        if (window.setupPlayer !== setupPlayer) window.setupPlayer(mappedData, subId, startSeason, startEp); else setupPlayer(mappedData, subId, startSeason, startEp);
    } catch(err) { console.error(err); }
}

function setupPlayer(content, id, startSeason=0, startEp=0) {
    currentAnimeData = content;
    currentAnimeData.id = id;

    const titleEl = document.getElementById('anime-title');
    if (titleEl) titleEl.innerText = content.title;
    document.title = `${content.title} - AniStream`;

    const descEl = document.getElementById('watch-desc');
    if (descEl && content.description) {
        descEl.innerText = content.description;
        const descContainer = document.getElementById('watch-desc-container');
        if (descContainer) descContainer.style.display = 'block';
    }

    const sideTitle = document.getElementById('sidebar-anime-name');
    if (sideTitle) sideTitle.innerText = content.title;

    const vp = document.getElementById('video-player');
    const epTitle = document.getElementById('ep-title');

    // Use CSS for layout instead of hardcoded JS styles
    const container = document.querySelector('.watch-container');
    const leftSidebar = document.querySelector('.ep-sidebar');
    const rightSidebar = document.querySelector('.info-sidebar');
    
    if ((content.type || '').toLowerCase() === 'movie') {
        const disclaimer = document.getElementById('player-disclaimer');
        const mUrl = (content.videoUrl || '').trim();
        
        if (container) container.style.gridTemplateColumns = '0 1fr 320px';
        if (leftSidebar) leftSidebar.style.display = 'none';

        if (!mUrl) {
            const firstEp = content.seasons?.[0]?.episodes?.[0];
            if (firstEp) {
                if (window.playEpisode !== playEpisode) window.playEpisode(0, 0); else playEpisode(0, 0);
            } else {
                if (disclaimer) disclaimer.style.display = 'flex';
                if (vp) { vp.style.display = 'none'; vp.src = ''; }
            }
        } else {
            if (disclaimer) disclaimer.style.display = 'none';
            window.loadVideo(mUrl);
        }
        if (epTitle) epTitle.innerText = 'Full Movie';
    } else {
        const sTabs = document.getElementById('season-tabs');
        const epList = document.getElementById('ep-list-scroll');
        
        if (sTabs) {
            sTabs.innerHTML = '';
            content.seasons.forEach((season, idx) => {
                const btn = document.createElement('button');
                btn.className = `season-tab ${idx === startSeason ? 'active' : ''}`;
                btn.innerText = season.name || `Season ${idx + 1}`;
                btn.onclick = () => renderEpisodes(idx);
                sTabs.appendChild(btn);
            });
        }

        window.renderEpisodes = (idx) => {
            if (!epList) return;
            epList.innerHTML = '';
            currentSeasonIndex = idx;
            document.querySelectorAll('.season-tab').forEach((b, i) => {
                b.classList.toggle('active', i === idx);
            });
            content.seasons[idx].episodes.forEach((ep, eIdx) => {
                const div = document.createElement('div');
                div.id = `ep-item-${idx}-${eIdx}`;
                div.className = `ep-item ${ (idx === startSeason && eIdx === startEp) ? 'active' : '' }`;
                div.onclick = () => {
                   if (window.playEpisode !== playEpisode) window.playEpisode(idx, eIdx); else playEpisode(idx, eIdx);
                };
                
                div.innerHTML = `
                    <div class="ep-num">${eIdx + 1}</div>
                    <div class="ep-info">
                        <div class="ep-name">${ep.title || `Episode ${eIdx + 1}`}</div>
                    </div>
                    <i class="fas fa-play ep-play-icon"></i>
                `;
                epList.appendChild(div);
            });
        };

        if (content.seasons && content.seasons[startSeason]) {
            renderEpisodes(startSeason);
            if (window.playEpisode !== playEpisode) window.playEpisode(startSeason, startEp); else playEpisode(startSeason, startEp);
        }
    }
}

// â”€â”€ PLAYER IFRAME HELPER â”€â”€
// Transform gogoanime streaming.php URLs to direct megaplay.buzz URLs
// streaming.php is just a wrapper that embeds megaplay.buzz in another iframe,
// causing a double-iframe nesting and a play button overlay.
// By going direct to megaplay.buzz, we get autoPlay: "1" built-in.
function _transformEmbedUrl(url) {
    try {
        const urlObj = new URL(url);
        // Match gogoanime streaming.php pattern
        if (urlObj.pathname.includes('/streaming.php') || urlObj.pathname.includes('/streaming')) {
            const ep = urlObj.searchParams.get('ep');
            const type = urlObj.searchParams.get('type') || 'sub';
            if (ep) {
                // Map server param: hd-1 â†’ s-2, hd-2 â†’ s-3, etc. Default to s-2
                const server = urlObj.searchParams.get('server') || 'hd-1';
                const serverNum = parseInt(server.replace(/\D/g, '') || '1') + 1;
                return `https://megaplay.buzz/stream/s-${serverNum}/${ep}/${type}`;
            }
        }
    } catch(e) { /* not a valid URL, return as-is */ }
    return url;
}

let currentHls = null;

window.loadVideo = function(url) {
    if (!url) return;
    const iframe = document.getElementById('video-player');
    const video = document.getElementById('video-html-player');
    if (!iframe) return;

    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }

    if (url.includes('.m3u8')) {
        if (iframe) iframe.style.display = 'none';
        if (video) video.style.display = 'block';

        if (window.Hls && Hls.isSupported()) {
            currentHls = new Hls();
            currentHls.loadSource(url);
            currentHls.attachMedia(video);
            currentHls.on(Hls.Events.MANIFEST_PARSED, function () {
                video.play().catch(()=>{});
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', function () {
                video.play().catch(()=>{});
            });
        }
    } else {
        if (video) {
            video.style.display = 'none';
            video.pause();
        }
        if (iframe) {
            iframe.style.display = 'block';
            let finalUrl = _transformEmbedUrl(url);
            iframe.src = finalUrl;
        }
    }
};

function normalizeServerLanguage(type, fallbackLang) {
    const value = String(type || '').toUpperCase();
    if (value.includes('DUB')) return 'DUB';
    if (value.includes('SUB') || value.includes('HSUB')) return 'SUB';
    return String(fallbackLang || 'SUB').toUpperCase();
}

function getServerTypePriority(type) {
    const value = String(type || '').toUpperCase();
    if (value === 'SUB') return 3;
    if (value === 'DUB') return 3;
    if (value === 'HSUB') return 2;
    return 1;
}

window.renderServerSwitcher = function(partitions) {
    const container = document.getElementById('nw-servers-list');
    if (!container) return;

    container.innerHTML = '';
    let activeSet = false;

    ['SUB', 'DUB'].forEach(lang => {
        const servers = partitions[lang];
        if (!servers || !servers.length) return;

        const labelText = lang === 'SUB' ? 'Sub:' : 'Dub:';
        const icon = lang === 'SUB' ? 'fa-closed-captioning' : 'fa-microphone';

        const row = document.createElement('div');
        row.className = `nw-server-row ${lang.toLowerCase()}-server-row`;
        row.dataset.lang = lang.toLowerCase();

        const label = document.createElement('span');
        label.className = 'nw-server-label';
        label.innerHTML = `<i class="fas ${icon}"></i> ${labelText}`;
        row.appendChild(label);

        servers.forEach((server) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'server-pill';
            button.textContent = server.name || 'Server';
            if (!activeSet && server.isDefault) {
                button.classList.add('active');
                activeSet = true;
            }
            button.addEventListener('click', () => window.changeServer(server.url, button));
            row.appendChild(button);
        });

        container.appendChild(row);
    });

    if (!container.children.length) {
        container.innerHTML = '<p style="font-size:0.8rem; color:#555; padding: 5px;">No servers found for this episode.</p>';
    }
};

window.changeServer = function(url, btn) {
    document.querySelectorAll('#nw-servers-list .server-pill').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    window.loadVideo(url);
};

async function playEpisode(sIdx, eIdx) {
    if (!currentAnimeData || !currentAnimeData.seasons) return;
    const ep = currentAnimeData.seasons[sIdx].episodes[eIdx];
    if (!ep) return;
    
    const disclaimer = document.getElementById('player-disclaimer');
    if (disclaimer) disclaimer.style.display = 'none';
    
    const vp = document.getElementById('video-player');
    const htmlVp = document.getElementById('video-html-player');
    if (vp) vp.src = '';
    if (htmlVp) { htmlVp.pause(); htmlVp.src = ''; }

    const preferred = localStorage.getItem('anistream_priority') || 'sub';
    let partitions = { 'SUB': [], 'DUB': [] };

    const addServerToPartition = (bucket, server) => {
        if (!server?.url) return;
        const lang = normalizeServerLanguage(server.language, 'SUB');
        const servers = bucket[lang] || [];
        const priority = getServerTypePriority(server.sourceType || server.language);
        const normalizedName = String(server.name || 'Server').trim().toLowerCase();
        const normUrl = server.url.split('?')[0].split('#')[0];
        const duplicateIndex = servers.findIndex(item => (
            item.normalizedName === normalizedName ||
            (
                item.url.split('?')[0].split('#')[0] === normUrl &&
                item.name === server.name
            )
        ));

        if (duplicateIndex >= 0) {
            if (priority > (servers[duplicateIndex].priority || 0)) {
                servers[duplicateIndex] = {
                    name: server.name || 'Server',
                    normalizedName,
                    priority,
                    url: server.url
                };
            }
        } else if (servers.length < 10) {
            servers.push({
                name: server.name || 'Server',
                normalizedName,
                priority,
                url: server.url
            });
        }
        bucket[lang] = servers;
    };

    const mergePartitions = (incoming) => {
        ['SUB', 'DUB'].forEach(lang => {
            (incoming[lang] || []).forEach(server => {
                addServerToPartition(partitions, { ...server, language: lang });
            });
        });
    };

    const chooseAndLoadDefault = (preferredLang) => {
        const fallbackLang = preferredLang === 'SUB' ? 'DUB' : 'SUB';
        const defaultLang = partitions[preferredLang]?.length ? preferredLang : fallbackLang;
        const defaultServer = partitions[defaultLang]?.[0];
        if (!defaultServer) return false;

        Object.values(partitions).flat().forEach(server => { server.isDefault = false; });
        defaultServer.isDefault = true;
        window.renderServerSwitcher(partitions);
        window.loadVideo(defaultServer.url);
        return true;
    };

    const fetchSources = async (episodeId, fallbackLang) => {
        const buckets = { 'SUB': [], 'DUB': [] };
        if (!episodeId) return buckets;
        try {
            const data = await getJson(`/gogoanime/episode-srcs?id=${encodeURIComponent(episodeId)}`, {});
            if (Array.isArray(data.servers)) {
                data.servers.forEach(s => {
                    addServerToPartition(buckets, {
                        name: s.name,
                        url: s.url,
                        language: normalizeServerLanguage(s.type, fallbackLang),
                        sourceType: s.type
                    });
                });
            }
            if (Array.isArray(data.sources)) {
                data.sources.forEach(s => {
                    addServerToPartition(buckets, {
                        name: s.name || s.quality || 'Source',
                        url: s.url || s.file,
                        language: normalizeServerLanguage(s.type || s.language, fallbackLang),
                        sourceType: s.type || s.language
                    });
                });
            }
            if (data.iframe && !buckets.SUB.length && !buckets.DUB.length) {
                addServerToPartition(buckets, {
                    name: 'Embed',
                    url: data.iframe,
                    language: fallbackLang,
                    sourceType: fallbackLang
                });
            }
            return buckets;
        } catch(e) { return buckets; }
    };

    try {
        const pLang = preferred.toUpperCase();
        let sLang = pLang === 'SUB' ? 'DUB' : 'SUB';
        const preferredId = preferred === 'sub' ? ep.subEpisodeId : ep.dubEpisodeId;
        const fallbackId = preferred === 'sub' ? ep.dubEpisodeId : ep.subEpisodeId;
        const pId = preferredId || fallbackId;
        const sId = fallbackId && fallbackId !== pId ? fallbackId : null;

        // Fetch primary sources
        if (pId) {
            const primaryPartitions = await fetchSources(pId, pLang);
            mergePartitions(primaryPartitions);
            chooseAndLoadDefault(pLang);
        }

        // Fetch secondary sources in background
        if (sId && sId !== pId) {
            fetchSources(sId, sLang).then(secPartitions => {
                mergePartitions(secPartitions);
                const hasActiveServer = Object.values(partitions).flat().some(server => server.isDefault);
                if (!hasActiveServer) {
                    chooseAndLoadDefault(pLang);
                } else {
                    window.renderServerSwitcher(partitions);
                }
            });
        }

        if (!pId && !sId) {
             if (disclaimer) disclaimer.style.display = 'flex';
        }

    } catch(e) {
        console.error(e);
    }

    const et = document.getElementById('ep-title');
    if (et) et.innerText = `Episode ${ep.episodeNo}: ${ep.title}`;
    currentSeasonIndex = sIdx;
    currentEpisodeIndex = eIdx;
    
    document.querySelectorAll('.ep-item').forEach((btn, i) => {
        btn.classList.toggle('active', i === eIdx);
    });
    const activeCard = document.querySelector('.ep-item.active');
    activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    if (currentUser) saveHistory(currentAnimeData.id, currentAnimeData, `Episode ${ep.episodeNo}`, sIdx, eIdx);
}

function playNextEpisode() {
    if (!currentAnimeData || (currentAnimeData.type || '').toLowerCase() === 'movie') {
        showToast('No next episode for movies', 'info');
        return;
    }
    const season = currentAnimeData.seasons[currentSeasonIndex];
    if (currentEpisodeIndex + 1 < season.episodes.length) {
        if (window.playEpisode !== playEpisode) window.playEpisode(currentSeasonIndex, currentEpisodeIndex + 1); else playEpisode(currentSeasonIndex, currentEpisodeIndex + 1);
        showToast('Playing next episode', 'success', 'fa-forward');
    } else if (currentSeasonIndex + 1 < currentAnimeData.seasons.length) {
        renderEpisodes(currentSeasonIndex + 1);
        if (window.playEpisode !== playEpisode) window.playEpisode(currentSeasonIndex + 1, 0); else playEpisode(currentSeasonIndex + 1, 0);
        showToast('Playing next season', 'success', 'fa-forward');
    } else {
        showToast('You have finished the series!', 'success', 'fa-trophy');
    }
}

function shareAnime() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: currentAnimeData?.title || 'Watch', url });
    } else {
        navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success', 'fa-link'));
    }
}

// ==========================================
// 9. MY LIST
// ==========================================
function toggleMyList() {
    if (!currentUser) { showToast('Sign in to use My List', 'info', 'fa-lock'); return; }
    const id = new URLSearchParams(window.location.search).get('anime');
    const ref = db.collection('users').doc(currentUser.uid).collection('mylist').doc(id);
    ref.get().then(doc => {
        if (doc.exists) {
            ref.delete().then(() => {
                showToast('Removed from My List', 'info', 'fa-heart-broken');
                checkMyListStatus(id);
            });
        } else {
            ref.set({
                title: currentAnimeData.title,
                image: currentAnimeData.image,
                type: currentAnimeData.type,
                sub: currentAnimeData.sub || 0,
                dub: currentAnimeData.dub || 0,
                timestamp: Date.now()
            }).then(() => {
                showToast('Added to My List!', 'success', 'fa-heart');
                checkMyListStatus(id);
            });
        }
    });
}

function checkMyListStatus(id) {
    if (!currentUser) return;
    const icon = document.getElementById('mylist-icon');
    const btn = document.getElementById('mylist-btn');
    db.collection('users').doc(currentUser.uid).collection('mylist').doc(id).get().then(doc => {
        if (doc.exists) {
            if (icon) { icon.classList.replace('far', 'fas'); icon.style.color = '#e50914'; }
            btn?.classList.add('active-heart');
        } else {
            if (icon) { icon.classList.replace('fas', 'far'); icon.style.color = ''; }
            btn?.classList.remove('active-heart');
        }
    });
}

// ==========================================
// 10. HISTORY / CONTINUE WATCHING
// ==========================================
function saveHistory(id, content, label, seasonIndex = 0, episodeIndex = 0) {
    db.collection('users').doc(currentUser.uid).collection('history').doc(id).set({
        animeTitle: content.title,
        animeImage: content.image,
        lastEpisode: label,
        seasonIndex,
        episodeIndex,
        timestamp: Date.now(),
        type: content.type
    });
}

function loadHistory(uid) {
    db.collection('users').doc(uid).collection('history')
        .orderBy('timestamp', 'desc').limit(25).get().then(snap => {
        let fullHistory = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let filteredHistory = [];
        fullHistory.forEach(item => {
            const anime = allContentCache.find(a => a.id === item.id);
            if (anime) {
                const isAdult = anime.is18Plus === true;
                if ((incognitoActive && isAdult) || (!incognitoActive && !isAdult)) {
                    filteredHistory.push(item);
                }
            }
        });

        filteredHistory = filteredHistory.slice(0, 8);
        userHistoryCache = fullHistory; // Keep the full history for recommendation logic
        
        renderPersonalizedRow();
        if (filteredHistory.length > 0) {
            const row = document.getElementById('continue-watching-row');
            const grid = document.getElementById('history-grid');
            if (!row || !grid) return;
            row.style.display = 'block';
            grid.innerHTML = '';
            filteredHistory.forEach(d => {
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <img src="${d.animeImage || ''}" alt="${d.animeTitle}">
                    <div class="history-card-info">
                        <div class="history-ep-label">${d.lastEpisode || ''}</div>
                        <div class="history-card-title">${d.animeTitle}</div>
                        <div class="history-progress"><div class="history-progress-fill" style="width:${Math.random()*60+10}%"></div></div>
                    </div>`;
                const seasonIndex = Number.isFinite(d.seasonIndex) ? d.seasonIndex : 0;
                const episodeIndex = Number.isFinite(d.episodeIndex) ? d.episodeIndex : 0;
                card.onclick = () => window.location.href = `watch.html?anime=${d.id}&season=${seasonIndex}&ep=${episodeIndex}`;
                grid.appendChild(card);
            });
        } else {
            const row = document.getElementById('continue-watching-row');
            if (row) row.style.display = 'none';
        }
    });
}
// ==========================================
// 11. DESCRIPTION EXPAND/COLLAPSE
// ==========================================
function toggleDesc() {
    const el = document.getElementById('watch-desc');
    const btn = document.getElementById('expand-desc-btn');
    if (!el) return;
    if (el.style.webkitLineClamp === 'unset') {
        el.style.webkitLineClamp = '3';
        btn.innerText = 'Read more';
    } else {
        el.style.webkitLineClamp = 'unset';
        btn.innerText = 'Show less';
    }
}

// ==========================================
// 12. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('anime-row')) loadHomePage();
    if (document.getElementById('video-player')) initPlayer();
});

// ==========================================
// 13. GLOBAL SYSTEM CONTROLS (Live Listeners)
// ==========================================
let lastRefreshId = null;
db.collection('system').doc('status').onSnapshot((doc) => {
    if (doc.exists) {
        const data = doc.data();
        
        // 1. Maintenance Mode
        if (data.maintenanceMode && !window.location.pathname.endsWith('admin.html')) {
            let mOverlay = document.getElementById('maintenance-overlay');
            if (!mOverlay) {
                mOverlay = document.createElement('div');
                mOverlay.id = 'maintenance-overlay';
                mOverlay.innerHTML = `
                    <div style="position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:#04040a;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:20px;">
                        <i class="fas fa-tools" style="font-size:4rem;color:#e50914;margin-bottom:20px;"></i>
                        <h1 style="font-family:'Syne',sans-serif;font-size:2.5rem;margin-bottom:10px;">We'll be right back</h1>
                        <p style="color:#a1a1aa;max-width:400px;line-height:1.6;">AniStream is currently undergoing scheduled maintenance. Please check back soon!</p>
                    </div>
                `;
                document.body.appendChild(mOverlay);
                document.body.style.overflow = 'hidden';
            }
        } else {
            const mOverlay = document.getElementById('maintenance-overlay');
            if (mOverlay) {
                mOverlay.remove();
                document.body.style.overflow = '';
            }
        }

        // 2. Force Refresh (Hard Cache Bypass)
        if (data.forceRefreshId) {
            if (!lastRefreshId) {
                lastRefreshId = data.forceRefreshId; 
            } else if (lastRefreshId !== data.forceRefreshId) {
                lastRefreshId = data.forceRefreshId;
                
                // Force genuine hard refresh by bypassing browser cache
                fetch(window.location.href, {
                    cache: 'reload',
                    mode: 'no-cors'
                }).then(() => {
                    // Fallback to query string cache buster if fetch cache-reload fails
                    const url = new URL(window.location.href);
                    url.searchParams.set('_bypassUpdate', data.forceRefreshId);
                    window.location.replace(url.toString());
                }).catch(() => window.location.reload(true));
            }
        }
    }
}, (error) => {
    console.error("System status listener error:", error);
});


// ==========================================
// 14. INCOGNITO MODE
// ==========================================
const INCOGNITO_PASSCODE = '696969';
let incognitoActive = false;

// Check if incognito was previously activated (persists in session)
function checkIncognitoState() {
    const stored = sessionStorage.getItem('anistream_incognito');
    if (stored === 'active') {
        activateIncognitoMode(false); // silent activation, no toast
    }
    // Sync toggle state
    const toggle = document.getElementById('incognito-toggle');
    if (toggle) toggle.checked = incognitoActive;
}

// Handle toggle click
function handleIncognitoToggle(checkbox) {
    if (checkbox.checked) {
        // Turning ON - ask for password
        checkbox.checked = false; // revert until confirmed
        openIncognitoModal();
    } else {
        // Turning OFF - deactivate immediately
        deactivateIncognitoMode();
    }
}

// Open the pin modal
function openIncognitoModal() {
    const modal = document.getElementById('incognito-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    clearIncognitoPins();
    document.getElementById('incognito-error').style.display = 'none';
    // Focus first pin
    setTimeout(() => {
        const firstPin = document.querySelector('.incognito-pin-input[data-index="0"]');
        if (firstPin) firstPin.focus();
    }, 200);
}

function closeIncognitoModal() {
    const modal = document.getElementById('incognito-modal');
    if (modal) modal.style.display = 'none';
    clearIncognitoPins();
    const errEl = document.getElementById('incognito-error');
    if (errEl) errEl.style.display = 'none';
    // Ensure toggle stays in sync
    const toggle = document.getElementById('incognito-toggle');
    if (toggle) toggle.checked = incognitoActive;
}

function clearIncognitoPins() {
    document.querySelectorAll('.incognito-pin-input').forEach(input => {
        input.value = '';
        input.classList.remove('error-shake');
    });
}

// Pin input behavior
document.addEventListener('DOMContentLoaded', () => {
    const pins = document.querySelectorAll('.incognito-pin-input');
    if (!pins.length) return;

    pins.forEach((pin, idx) => {
        pin.addEventListener('input', (e) => {
            const val = e.target.value;
            // Only allow digits
            if (val && !/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }
            if (val && idx < pins.length - 1) {
                pins[idx + 1].focus();
            }
            // Auto-submit when all 6 digits entered
            if (idx === pins.length - 1 && val) {
                const code = getIncognitoCode();
                if (code.length === 6) {
                    confirmIncognitoCode();
                }
            }
        });

        pin.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !pin.value && idx > 0) {
                pins[idx - 1].focus();
                pins[idx - 1].value = '';
            }
            if (e.key === 'Enter') {
                confirmIncognitoCode();
            }
            if (e.key === 'Escape') {
                closeIncognitoModal();
            }
        });

        // Handle paste
        pin.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((char, i) => {
                if (pins[i]) pins[i].value = char;
            });
            if (pasted.length > 0) {
                const focusIdx = Math.min(pasted.length, pins.length - 1);
                pins[focusIdx].focus();
            }
            if (pasted.length === 6) {
                setTimeout(() => confirmIncognitoCode(), 100);
            }
        });
    });
});

function getIncognitoCode() {
    return [...document.querySelectorAll('.incognito-pin-input')]
        .map(pin => pin.value)
        .join('');
}

function confirmIncognitoCode() {
    const code = getIncognitoCode();
    if (code.length < 6) {
        showToast('Enter all 6 digits', 'info', 'fa-exclamation-circle');
        return;
    }

    if (code === INCOGNITO_PASSCODE) {
        // Correct password
        closeIncognitoModal();
        closeEditProfile();
        activateIncognitoMode(true);
    } else {
        // Wrong password
        document.getElementById('incognito-error').style.display = 'flex';
        document.querySelectorAll('.incognito-pin-input').forEach(pin => {
            pin.classList.add('error-shake');
            pin.value = '';
        });
        setTimeout(() => {
            document.querySelectorAll('.incognito-pin-input').forEach(pin => {
                pin.classList.remove('error-shake');
            });
            const firstPin = document.querySelector('.incognito-pin-input[data-index="0"]');
            if (firstPin) firstPin.focus();
        }, 500);
    }
}

function activateIncognitoMode(showNotification = true) {
    incognitoActive = true;
    sessionStorage.setItem('anistream_incognito', 'active');
    document.body.classList.add('incognito-mode');
    
    // Sync toggle
    const toggle = document.getElementById('incognito-toggle');
    if (toggle) toggle.checked = true;

    // Hide request links in incognito
    document.querySelectorAll('.request-link').forEach(el => el.style.display = 'none');

    if (showNotification) {
        showToast('Incognito mode activated', 'success', 'fa-user-secret');
    }

    // Re-filter content if home page is loaded
    if (allContentCache.length && document.getElementById('anime-row')) {
        applyIncognitoFilter();
    }
    
    // Refresh history grid based on the new mode
    if (currentUser) {
        loadHistory(currentUser.uid);
    }
}

function deactivateIncognitoMode() {
    incognitoActive = false;
    sessionStorage.removeItem('anistream_incognito');
    document.body.classList.remove('incognito-mode');
    
    // Sync toggle
    const toggle = document.getElementById('incognito-toggle');
    if (toggle) toggle.checked = false;

    // Show request links again
    document.querySelectorAll('.request-link').forEach(el => el.style.display = '');

    showToast('Incognito mode deactivated', 'info', 'fa-user');

    // Reload content with normal filter (exclude 18+)
    if (allContentCache.length && document.getElementById('anime-row')) {
        const normalContent = getNormalContent(allContentCache);
        resetHome();
        renderHeroSlider(getLatestHeroItems(normalContent));
        renderPersonalizedRow();
        refreshSidebarModules();
    }
    
    // Refresh history grid based on the new mode
    if (currentUser) {
        loadHistory(currentUser.uid);
    }
}

// Filter content to show ONLY 18+ items (for incognito mode)
function getIncognitoContent(items) {
    return items.filter(item => item.is18Plus === true);
}

// Filter OUT 18+ content (for normal mode)
function getNormalContent(items) {
    return items.filter(item => !item.is18Plus);
}

function applyIncognitoFilter() {
    if (!incognitoActive) return;

    const mainRow = document.getElementById('anime-row');
    const seriesRow = document.getElementById('series-row');
    const movieRow = document.getElementById('movie-row');
    const freshRow = document.getElementById('fresh-row');
    const gemsRow = document.getElementById('gems-row');

    const adultContent = getIncognitoContent(allContentCache);

    // Clear and re-render all rows with filtered content
    if (mainRow) {
        mainRow.innerHTML = '';
        const topItems = getCuratedRowItems(adultContent, { limit: 7 });
        topItems.forEach(data => mainRow.appendChild(createNetflixCard(data)));
        if (!topItems.length) mainRow.innerHTML = '<p style="color:#555;padding:20px 0;font-size:0.95rem;">No 18+ content available.</p>';
    }

    if (seriesRow) {
        seriesRow.innerHTML = '';
        getCuratedRowItems(adultContent, { type: 'series', limit: 7 }).forEach(data => seriesRow.appendChild(createNetflixCard(data)));
    }

    if (movieRow) {
        movieRow.innerHTML = '';
        getCuratedRowItems(adultContent, { type: 'movie', limit: 7 }).forEach(data => movieRow.appendChild(createNetflixCard(data)));
    }

    if (freshRow) {
        freshRow.innerHTML = '';
        getFreshDropItems(adultContent, 7).forEach(data => freshRow.appendChild(createNetflixCard(data)));
    }

    if (gemsRow) {
        gemsRow.innerHTML = '';
        getHiddenGemItems(adultContent, 7).forEach(data => gemsRow.appendChild(createNetflixCard(data)));
    }

    // Re-render hero with adult content
    const heroItems = getLatestHeroItems(adultContent);
    if (heroItems.length) {
        renderHeroSlider(heroItems);
    }

    // Re-render sidebar
    refreshSidebarModules();

    // Hide sections with no content
    ['series-section', 'movie-section', 'fresh-section', 'gems-section'].forEach(id => {
        const section = document.getElementById(id);
        const rowId = id.replace('-section', '-row');
        const row = document.getElementById(rowId);
        if (section && row) {
            section.style.display = row.children.length ? 'block' : 'none';
        }
    });
}



// Override filterContent and seeAll to respect incognito
const _originalFilterContent = filterContent;
window.filterContent = filterContent = function(type) {
    const title = document.getElementById('row-title');
    const mainRow = document.getElementById('anime-row');
    const navBtns = document.querySelectorAll('.nav-links button');
    navBtns.forEach(b => b.classList.remove('active'));
    event?.currentTarget?.classList.add('active');

    mainRow.classList.add('grid-wrap-mode');

    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);

    if (type === 'all') {
        title.innerText = 'All Anime';
        setHomeSectionsVisibility(false);
        renderGrid(sourceItems, mainRow);
    } else {
        title.innerText = type === 'movie' ? 'Movies' : 'Series';
        setHomeSectionsVisibility(false);
        const filtered = sourceItems.filter(item => (item.type || 'series').toLowerCase() === type);
        renderGrid(filtered, mainRow);
    }
    activeGenreFilter = '';
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('main-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const _originalSeeAll = seeAll;
window.seeAll = seeAll = function(type) {
    const title = document.getElementById('row-title');
    const mainRow = document.getElementById('anime-row');

    mainRow.classList.add('grid-wrap-mode');
    setHomeSectionsVisibility(false);

    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);

    if (type === 'all') {
        title.innerText = 'All Anime';
        renderGrid(sourceItems, mainRow);
    } else if (type === 'series') {
        title.innerText = 'All Series';
        const filtered = sourceItems.filter(item => (item.type || 'series').toLowerCase() !== 'movie');
        renderGrid(filtered, mainRow);
    } else if (type === 'movie') {
        title.innerText = 'All Movies';
        const filtered = sourceItems.filter(item => (item.type || '').toLowerCase() === 'movie');
        renderGrid(filtered, mainRow);
    }
    activeGenreFilter = '';
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('main-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const _originalFilterByGenre = filterByGenre;
window.filterByGenre = filterByGenre = function(genre, el) {
    const mainRow = document.getElementById('anime-row');
    document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));

    const sourceItems = incognitoActive ? getIncognitoContent(allContentCache) : getNormalContent(allContentCache);

    if (activeGenreFilter === genre) {
        activeGenreFilter = '';
        mainRow.classList.remove('grid-wrap-mode');
        document.getElementById('row-title').innerText = 'Trending Picks';
        setHomeSectionsVisibility(true);
        renderGrid(getCuratedRowItems(sourceItems, { limit: 7 }), mainRow);
        if (incognitoActive) applyIncognitoFilter();
        return;
    }
    activeGenreFilter = genre;
    el.classList.add('active');
    mainRow.classList.add('grid-wrap-mode');
    setHomeSectionsVisibility(false);
    document.getElementById('row-title').innerText = genre;
    const filtered = sourceItems.filter(item => (item.genres || []).includes(genre));
    renderGrid(filtered, mainRow);
};

// Override search to respect incognito mode
const _searchInput = document.getElementById?.('search-input');
if (_searchInput) {
    _searchInput.addEventListener('input', function _incognitoSearch(e) {
        if (!incognitoActive) return; // Let original handler run
        e.stopImmediatePropagation();
        const grid = document.getElementById('search-results-grid');
        const query = e.target.value.toLowerCase().trim();
        grid.innerHTML = '';
        if (query.length < 2) return;
        const sourceItems = getIncognitoContent(allContentCache);
        const results = sourceItems.filter(item =>
            item.title?.toLowerCase().includes(query) ||
            (item.genres || []).some(g => g.toLowerCase().includes(query)) ||
            item.description?.toLowerCase().includes(query)
        );
        if (!results.length) {
            grid.innerHTML = '<p style="color:#555;padding:20px;grid-column:span 4;">No results found.</p>';
            return;
        }
        results.forEach(item => grid.appendChild(createNetflixCard(item)));
    });
}

// Initialize incognito state on page load
document.addEventListener('DOMContentLoaded', checkIncognitoState);
