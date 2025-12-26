/**
 * ScoutLens - Undervalued Football Player Finder
 * Main Application Logic
 */

(function () {
    'use strict';

    // ============================================
    // SECURITY UTILITIES
    // ============================================
    const Security = {
        // Sanitize HTML to prevent XSS
        escapeHtml(text) {
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // Validate email format
        isValidEmail(email) {
            if (!email || typeof email !== 'string') return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        // Safe storage wrapper (prevents crashes in some browsers/private modes)
        storage: {
            getItem(key) {
                try { return localStorage.getItem(key); }
                catch (e) { return null; }
            },
            setItem(key, value) {
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (e) { return false; }
            },
            removeItem(key) {
                try { localStorage.removeItem(key); }
                catch (e) { }
            }
        },

        // Sanitize search input
        sanitizeSearch(input) {
            if (typeof input !== 'string') return '';
            // Remove any HTML tags and limit length
            return input.replace(/<[^>]*>/g, '').substring(0, 100).toLowerCase();
        },

        // Generate simple hash for verification (not cryptographic)
        simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        }
    };

    // ============================================
    // STATE
    // ============================================
    const state = {
        currentView: 'dashboard',
        watchlist: [],
        emailSubmitted: false,
        compareList: [],  // Players selected for comparison
        compareMode: false,
        searchQuery: '',
        filters: {
            league: '',
            position: '',
            maxAge: 40,
            maxValue: 200,
            sortBy: 'undervaluation'
        },
        priceAlerts: [],  // {playerId, targetPrice}
        isPro: false,     // Pro user status (client-side only - not trusted)
        proEmail: null,   // Email for Pro access
        proToken: null,   // Server-verified Pro token (trusted)
        pagination: {
            currentPage: 1,
            itemsPerPage: 20
        }
    };

    // Development mode check (for testing only)
    const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Load Pro status from localStorage safely
    const savedProStatus = Security.storage.getItem('scoutlens_pro');
    if (savedProStatus) {
        try {
            const proData = JSON.parse(savedProStatus);
            state.isPro = !!proData.isPro;
            state.proEmail = proData.email;
        } catch (e) {
            console.warn('Invalid Pro data in storage, resetting');
            Security.storage.removeItem('scoutlens_pro');
            state.isPro = false;
            state.proEmail = null;
        }
    }

    // ============================================
    // AVATAR GENERATOR
    // ============================================
    const Avatar = {
        colors: {
            'F': { bg: '#ef4444', text: '#fff' },  // Forward - Red
            'M': { bg: '#f59e0b', text: '#000' },  // Midfielder - Gold
            'D': { bg: '#22c55e', text: '#fff' },  // Defender - Green
            'GK': { bg: '#6366f1', text: '#fff' }, // Goalkeeper - Purple
        },

        getInitials(name) {
            // Utility function - receives raw data, no sanitization here
            // Sanitization happens at DOM insertion points
            const safeName = name || '';
            return safeName.split(' ').map(n => n[0] || '').slice(0, 2).join('').toUpperCase();
        },

        getColor(position) {
            const pos = position ? position[0].toUpperCase() : 'M';
            return this.colors[pos] || this.colors['M'];
        },

        render(name, position, size = 48) {
            // Receives raw data - sanitization happens at DOM insertion
            const initials = this.getInitials(name);
            const color = this.getColor(position);
            const fontSize = size * 0.4;
            // Escape initials for safe HTML insertion
            const safeInitials = Security.escapeHtml(initials);

            return `
                <div class="player-avatar" style="
                    width: ${size}px;
                    height: ${size}px;
                    min-width: ${size}px;
                    background: ${color.bg};
                    color: ${color.text};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: ${fontSize}px;
                    font-family: var(--font-sans);
                ">${safeInitials}</div>
            `;
        }
    };

    // ============================================
    // FORMATTERS
    // ============================================
    const Format = {
        value(millions) {
            if (millions >= 100) return `€${Math.round(millions)}M`;
            if (millions >= 10) return `€${millions.toFixed(0)}M`;
            return `€${millions.toFixed(1)}M`;
        },

        percent(value) {
            const sign = value >= 0 ? '+' : '';
            return `${sign}${value.toFixed(0)}%`;
        },

        position(pos) {
            const map = { 'F': 'Forward', 'M': 'Midfielder', 'D': 'Defender', 'GK': 'Goalkeeper' };
            return map[pos] || pos;
        }
    };

    // ============================================
    // UI RENDERING
    // ============================================
    const UI = {
        renderPlayerCard(player, index = null) {
            // Guard against null/undefined player
            if (!player || !player.id) {
                console.warn('Invalid player data in renderPlayerCard');
                return '';
            }

            // Check if this is a locked PRO player
            if (player.locked) {
                return this.renderLockedCard(player, index);
            }

            const isInWatchlist = state.watchlist.some(p => p && p.id === player.id);
            const undervalued = player.undervaluation_pct > 0;
            const hasReleaseClause = player.release_clause_eur_m && player.release_clause_eur_m > 0;
            const hasContractExpiry = player.contract_expiry;
            const isExpiring = player.contract_status === 'expiring';
            const isVerified = player.valuation_confidence === 'verified' || player.tm_verified;
            const confidence = player.valuation_confidence || (player.tm_verified ? 'verified' : 'estimated');
            const isHiddenGem = player.is_hidden_gem || player.league_tier >= 2;

            // League tier badge
            const tier = player.tier || (player.league_tier || 1);
            let tierBadge = '';
            if (tier === 2) {
                tierBadge = '<span class="tier-badge tier-2" title="Tier 2 League">T2</span>';
            } else if (tier === 3) {
                tierBadge = '<span class="tier-badge tier-3" title="Tier 3 League">T3</span>';
            }

            // Confidence badge
            const confidenceBadge = confidence === 'verified' ?
                '<span class="confidence-badge verified" title="Transfermarkt verified">✓ TM</span>' :
                confidence === 'high' ?
                    '<span class="confidence-badge high" title="High confidence">TM</span>' :
                    '<span class="confidence-badge estimated" title="Estimated value">~</span>';

            // Contract badge
            const contractBadge = isExpiring ?
                '<span class="contract-badge expiring" title="Contract expiring 2025!">⏰ 2025</span>' :
                hasContractExpiry && player.contract_expiry <= 2026 ?
                    `<span class="contract-badge short" title="Contract until ${player.contract_expiry}">${player.contract_expiry}</span>` : '';

            // Hidden gem badge
            const gemBadge = isHiddenGem ? '<span class="gem-badge" title="Hidden Gem">💎</span>' : '';

            const isComparing = state.compareList.some(p => p.id === player.id);

            return `
                <div class="player-card ${undervalued ? 'undervalued' : ''} ${isComparing ? 'selected-compare' : ''}" data-player-id="${player.id}">
                    <input type="checkbox" class="compare-checkbox" data-player-id="${player.id}" 
                           ${isComparing ? 'checked' : ''} 
                           data-action="toggle-compare"
                           title="Add to comparison">
                    ${index !== null ? `<div class="player-rank">${index + 1}</div>` : ''}
                    
                    <div class="player-card-main">
                        ${Avatar.render(player.name || '', player.position, 48)}
                        
                        <div class="player-info">
                            <div class="player-name">${Security.escapeHtml(player.name || '')} ${gemBadge}</div>
                            <div class="player-meta">
                                <span class="player-team">${Security.escapeHtml(player.team || '')}</span>
                                <span class="player-league">${Security.escapeHtml(player.league || '')} ${tierBadge}</span>
                                ${confidenceBadge}
                                ${contractBadge}
                            </div>
                        </div>
                        
                        <div class="player-value-box">
                            <div class="player-underval ${undervalued ? 'positive' : 'negative'}">
                                ${Format.percent(player.undervaluation_pct)}
                            </div>
                            <div class="player-value-label">undervalued</div>
                        </div>
                    </div>
                    
                    <div class="player-card-stats">
                        <div class="player-stat">
                            <span class="stat-value">${Format.value(player.market_value_eur_m)}</span>
                            <span class="stat-label">Market Value</span>
                        </div>
                        <div class="player-stat">
                            <span class="stat-value">${Format.value(player.fair_value_eur_m)}</span>
                            <span class="stat-label">Fair Value</span>
                        </div>
                        ${hasReleaseClause ? `
                        <div class="player-stat release-clause">
                            <span class="stat-value">${Format.value(player.release_clause_eur_m)}</span>
                            <span class="stat-label">Release Clause</span>
                        </div>
                        ` : `
                        <div class="player-stat">
                            <span class="stat-value">${(player.xgi_per_90 || 0).toFixed(2)}</span>
                            <span class="stat-label">xGI/90</span>
                        </div>
                        `}
                        <div class="player-stat">
                            <span class="stat-value">${player.goals || 0}G ${player.assists || 0}A</span>
                            <span class="stat-label">Output</span>
                        </div>
                    </div>
                    
                    <button class="player-save-btn ${isInWatchlist ? 'active' : ''}" 
                            data-player-id="${player.id}"
                            title="${isInWatchlist ? 'Remove from watchlist' : 'Save to watchlist'}">
                        ${isInWatchlist ? '★' : '☆'}
                    </button>
                </div>
            `;
        },

        renderLockedCard(player, index = null) {
            const name = Security.escapeHtml(player.name || 'Hidden Player');
            const team = Security.escapeHtml(player.team || '???');
            const league = Security.escapeHtml(player.league || '???');

            return `
                <div class="player-card locked" data-action="upgrade">
                    ${index !== null ? `<div class="player-rank">${index + 1}</div>` : ''}
                    
                    <div class="player-card-main">
                        <div class="player-avatar locked-avatar" style="width:48px;height:48px;min-width:48px;background:var(--bg-elevated);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🔒</div>
                        
                        <div class="player-info">
                            <div class="player-name" style="filter: blur(3px);">${name}</div>
                            <div class="player-meta">
                                <span class="player-team">${team}</span>
                                <span class="player-league">${league}</span>
                            </div>
                        </div>
                        
                        <div class="player-value-box">
                            <div class="pro-badge" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;font-size:0.7rem;padding:4px 10px;border-radius:4px;font-weight:700;">PRO</div>
                        </div>
                    </div>
                    
                    <div class="locked-overlay" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.9),transparent);padding:1rem;text-align:center;border-radius:0 0 10px 10px;">
                        <span style="color:#00d4aa;font-weight:600;font-size:0.9rem;">🔓 Unlock with Pro →</span>
                    </div>
                </div>
            `;
        },

        renderUpgradeCard() {
            return `
                <div class="upgrade-card" data-action="upgrade" style="background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(0,212,170,0.1));border:2px dashed #fbbf24;border-radius:16px;padding:2rem;text-align:center;cursor:pointer;margin:1.5rem 0;transition:all 0.25s ease;">
                    <div class="upgrade-content">
                        <div class="upgrade-icon" style="font-size:2.5rem;margin-bottom:1rem;">🔓</div>
                        <h3 style="color:#fbbf24;font-size:1.3rem;margin-bottom:0.5rem;">Unlock All 150+ Players</h3>
                        <p style="color:#94a3b8;margin-bottom:1.5rem;">Full access to undervalued players, transfer fees, export reports & alerts</p>
                        <button class="btn btn-primary upgrade-btn" data-action="upgrade" style="background:#00d4aa;color:#000;padding:12px 24px;border:none;border-radius:8px;font-weight:600;font-size:1rem;cursor:pointer;">Upgrade to Pro - $9/mo</button>
                    </div>
                </div>
            `;
        },

        renderPlayerDetail(player) {
            // Guard against null/undefined player
            if (!player || !player.id) {
                console.warn('Invalid player data in renderPlayerDetail');
                return '<div class="error">Invalid player data</div>';
            }

            const isInWatchlist = state.watchlist.some(p => p && p.id === player.id);
            const undervalued = (player.undervaluation_pct || 0) > 0;

            return `
                <div class="player-detail">
                    <div class="player-detail-header">
                        ${Avatar.render(player.name || '', player.position, 80)}
                        <div class="player-detail-info">
                            <h2>${Security.escapeHtml(player.name || '')}</h2>
                            <p>${Security.escapeHtml(player.team || '')} · ${Security.escapeHtml(player.league || '')}</p>
                            <div class="player-detail-tags">
                                <span class="tag">${Security.escapeHtml(Format.position(player.position || ''))}</span>
                                <span class="tag">${Security.escapeHtml(String(player.age || ''))} years</span>
                                <span class="tag">${Security.escapeHtml(player.nationality || '')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="player-detail-valuation ${undervalued ? 'positive' : 'negative'}">
                        <div class="valuation-header">
                            <span class="valuation-label">${undervalued ? '📈 UNDERVALUED' : '📉 OVERVALUED'}</span>
                            <span class="valuation-percent">${Format.percent(player.undervaluation_pct)}</span>
                        </div>
                        <div class="valuation-comparison">
                            <div class="valuation-item">
                                <span class="valuation-value">${Format.value(player.fair_value_eur_m)}</span>
                                <span class="valuation-sublabel">Our Fair Value</span>
                            </div>
                            <div class="valuation-vs">vs</div>
                            <div class="valuation-item">
                                <span class="valuation-value">${Format.value(player.market_value_eur_m)}</span>
                                <span class="valuation-sublabel">Market Value</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="player-detail-stats">
                        <h3>Performance This Season</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <span class="stat-box-value">${((player.xgi_per_90 != null && !isNaN(player.xgi_per_90)) ? player.xgi_per_90 : 0).toFixed(2)}</span>
                                <span class="stat-box-label">xGI per 90</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.goals != null ? player.goals : 0}</span>
                                <span class="stat-box-label">Goals</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.assists != null ? player.assists : 0}</span>
                                <span class="stat-box-label">Assists</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.games != null ? player.games : 0}</span>
                                <span class="stat-box-label">Games</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${((player.xG != null && !isNaN(player.xG)) ? player.xG : 0).toFixed(1)}</span>
                                <span class="stat-box-label">xG</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${((player.xA != null && !isNaN(player.xA)) ? player.xA : 0).toFixed(1)}</span>
                                <span class="stat-box-label">xA</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="player-detail-actions">
                        <button class="btn btn-primary btn-lg watchlist-detail-btn" data-player-id="${player.id}">
                            ${isInWatchlist ? '★ In Watchlist' : '☆ Save to Watchlist'}
                        </button>
                        <button class="btn btn-ghost btn-lg share-btn" data-player="${encodeURIComponent(player.name || '')}">
                            📤 Share
                        </button>
                    </div>
                </div>
            `;
        },

        showNotification(message, type = 'info') {
            // Always escaped - textContent automatically prevents XSS
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = typeof message === 'string' ? message : String(message);
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 300);
            }, 2500);
        }
    };

    // ============================================
    // APP
    // ============================================
    let liveData = null; // Store live data when fetched
    let fetchInProgress = false; // Prevent race conditions
    let eventsBound = false; // Prevent duplicate event listeners
    let eventAbortController = new AbortController(); // For cleanup

    const App = {
        async init() {
            console.log('🔭 ScoutLens initializing...');

            // Safety failsafe: ensure loader is hidden eventually even if script hangs
            setTimeout(() => {
                const loader = document.getElementById('loader');
                if (loader && !loader.classList.contains('fade-out')) {
                    console.warn('Failsafe: hiding loader after timeout');
                    this.enterApp();
                }
            }, 6000);

            // On mobile, ALWAYS skip landing page and go straight to app
            const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile) {
                this.enterApp();
                return;
            }

            // Desktop: Check if user has visited before
            const hasVisited = Security.storage.getItem('scoutlens_visited');
            if (!hasVisited) {
                // Show landing page for first-time visitors (desktop only)
                const landing = document.getElementById('landing');
                const app = document.getElementById('app');
                const loader = document.getElementById('loader');

                if (landing) landing.classList.remove('hidden');
                if (app) app.classList.add('hidden');
                if (loader) loader.classList.add('hidden');
                return;
            }

            // Returning user - go straight to app
            this.enterApp();
        },

        enterApp() {
            // Hide landing, show app
            const landing = document.getElementById('landing');
            const app = document.getElementById('app');
            const loader = document.getElementById('loader');

            if (landing) landing.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            if (loader) loader.classList.add('fade-out');

            // Mark as visited
            Security.storage.setItem('scoutlens_visited', 'true');

            // Continue initialization
            this.initApp();
        },

        async initApp() {
            // Safety timeout: always hide loader after 5 seconds max
            const safetyTimeout = setTimeout(() => {
                const loader = document.getElementById('loader');
                const app = document.getElementById('app');
                if (loader) loader.classList.add('fade-out');
                if (app) app.classList.remove('hidden');
            }, 5000);

            try {
                console.log('🔭 Loading ScoutLens app...');

                // Cleanup any existing event listeners before re-binding (allows re-init)
                this.cleanupEvents();

                this.loadState();
                this.bindEvents();

                // Render immediately with static data
                this.renderView('dashboard');
                this.showDataFreshness();

                // Register service worker
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('sw.js').catch(() => { });
                }

                // Hide loader (always hide, even on error)
                clearTimeout(safetyTimeout);
                setTimeout(() => {
                    const loader = document.getElementById('loader');
                    const app = document.getElementById('app');
                    if (loader) loader.classList.add('fade-out');
                    if (app) app.classList.remove('hidden');
                }, 1200);

                // Try to fetch LIVE data in background (non-blocking)
                this.fetchLiveData();

                console.log('✅ ScoutLens ready');
            } catch (error) {
                console.error('❌ Failed to initialize ScoutLens:', error);
                clearTimeout(safetyTimeout);

                // Always hide loader and show app, even on error
                const loader = document.getElementById('loader');
                const app = document.getElementById('app');
                if (loader) loader.classList.add('fade-out');
                if (app) app.classList.remove('hidden');

                // Show error message to user
                const container = document.getElementById('undervalued-list');
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="empty-state-icon">⚠️</span>
                            <h3>Failed to Load</h3>
                            <p>Unable to load player data. Please refresh the page.</p>
                            <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem;">Error: ${Security.escapeHtml(error.message || 'Unknown error')}</p>
                            <button data-action="refresh" class="btn btn-primary" style="margin-top:1rem;">Refresh Page</button>
                        </div>
                    `;
                }
            }
        },

        async fetchLiveData() {
            // Prevent race conditions: only one fetch at a time
            if (fetchInProgress) {
                return;
            }

            fetchInProgress = true;
            const maxRetries = 2;
            let retryCount = 0;

            while (retryCount <= maxRetries) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

                    const response = await fetch('/api/players', { signal: controller.signal });
                    clearTimeout(timeout);

                    if (response.ok) {
                        liveData = await response.json();
                        console.log('📡 Live data loaded!', liveData.lastUpdated);
                        // Re-render with live data
                        this.renderView(state.currentView);
                        this.showDataFreshness();
                        fetchInProgress = false;
                        return; // Success, exit retry loop
                    } else if (response.status >= 500 && response.status < 600 && retryCount < maxRetries) {
                        // Server error (5xx only), retry
                        retryCount++;
                        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else {
                        // Client error (4xx) or other non-retryable error, don't retry
                        console.log('📦 API returned error:', response.status);
                        fetchInProgress = false;
                        return;
                    }
                } catch (e) {
                    // Network error or timeout only - retry these
                    const isNetworkError = e.name === 'AbortError' || e.name === 'TypeError' ||
                        (e.message && e.message.includes('fetch'));
                    if (isNetworkError && retryCount < maxRetries) {
                        retryCount++;
                        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else {
                        // Not a network error or max retries reached
                        console.log('📦 Using static data:', e.message || 'API timeout');
                        fetchInProgress = false;
                        return;
                    }
                }
            }

            fetchInProgress = false;
        },

        getData() {
            // Return live data if available, otherwise static
            // Safety check: ensure PLAYER_DATA is defined
            if (typeof PLAYER_DATA === 'undefined') {
                console.error('❌ PLAYER_DATA not loaded. Check if data/player_data.js is accessible.');
                return { undervalued: [], topPerformers: [], risingStars: [], hiddenGems: [], bargains: [] };
            }
            return liveData || PLAYER_DATA;
        },

        showDataFreshness() {
            // Show when data was last updated
            const data = this.getData();
            if (data.lastUpdated) {
                const lastUpdate = new Date(data.lastUpdated);
                const now = new Date();
                const daysDiff = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));

                let freshnessText = '';
                let freshnessClass = '';

                // Check if using live data
                const isLive = data.updateFrequency === 'live';

                if (isLive) {
                    freshnessText = '🟢 Live data';
                    freshnessClass = 'fresh';
                } else if (daysDiff === 0) {
                    freshnessText = 'Updated today';
                    freshnessClass = 'fresh';
                } else if (daysDiff <= 3) {
                    freshnessText = `Updated ${daysDiff} day${daysDiff > 1 ? 's' : ''} ago`;
                    freshnessClass = 'fresh';
                } else if (daysDiff <= 7) {
                    freshnessText = `Updated ${daysDiff} days ago`;
                    freshnessClass = 'stale';
                } else {
                    freshnessText = `⚠️ Data ${daysDiff} days old - may be outdated`;
                    freshnessClass = 'old';
                }

                // Add freshness indicator to hero
                const heroStats = document.querySelector('.hero-stats');
                if (heroStats && !document.querySelector('.data-freshness')) {
                    const badge = document.createElement('div');
                    badge.className = `data-freshness ${freshnessClass}`;
                    const dot = document.createElement('span');
                    dot.className = 'freshness-dot';
                    badge.appendChild(dot);
                    badge.appendChild(document.createTextNode(Security.escapeHtml(freshnessText)));
                    badge.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        background: ${freshnessClass === 'old' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(0, 212, 170, 0.1)'};
                        border-radius: 20px;
                        font-size: 0.75rem;
                        color: ${freshnessClass === 'old' ? '#f87171' : 'var(--accent-primary)'};
                        margin-top: 1rem;
                    `;

                    // Style the dot element we created above
                    dot.style.cssText = `
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: currentColor;
                        ${freshnessClass !== 'old' ? 'animation: pulse 2s infinite;' : ''}
                    `;

                    heroStats.parentNode.insertBefore(badge, heroStats.nextSibling);
                }
            }
        },

        loadState() {
            const saved = Security.storage.getItem('scoutlens_watchlist');
            if (saved) {
                try {
                    state.watchlist = JSON.parse(saved);
                } catch (e) {
                    state.watchlist = [];
                }
            }
        },

        saveState() {
            Security.storage.setItem('scoutlens_watchlist', JSON.stringify(state.watchlist));
        },

        cleanupEvents() {
            // Cleanup all event listeners and reset for potential re-init
            if (eventsBound) {
                eventAbortController.abort();
                eventAbortController = new AbortController(); // Create new controller for re-init
                eventsBound = false;
            }
        },

        bindEvents() {
            // Prevent duplicate event listeners
            if (eventsBound) {
                return;
            }
            eventsBound = true;

            const signal = eventAbortController.signal;

            // Helper to handle both click and touch
            const addMobileHandler = (element, handler) => {
                if (!element) return;
                element.addEventListener('click', handler, { signal });
                element.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    handler(e);
                }, { passive: false, signal });
            };

            // Mobile hamburger menu
            this.initMobileMenu();

            // Navigation - with mobile touch support
            document.querySelectorAll('.nav-link').forEach(link => {
                const handleNav = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const view = e.currentTarget.dataset.view;
                    this.switchView(view);
                };
                addMobileHandler(link, handleNav);
            });

            // Landing page buttons - replace inline onclick
            document.querySelectorAll('[onclick*="enterApp"], .btn[onclick*="enterApp"]').forEach(btn => {
                const onclick = btn.getAttribute('onclick');
                if (onclick && onclick.includes('enterApp')) {
                    btn.removeAttribute('onclick');
                    addMobileHandler(btn, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.enterApp();
                    });
                }
            });

            // Also handle any remaining onclick handlers
            document.querySelectorAll('button[onclick]').forEach(btn => {
                const onclick = btn.getAttribute('onclick');
                if (onclick && onclick.includes('enterApp')) {
                    btn.removeAttribute('onclick');
                    addMobileHandler(btn, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.enterApp();
                    });
                }
            });

            // Upgrade buttons - replace inline onclick
            document.querySelectorAll('[onclick*="showUpgrade"]').forEach(btn => {
                btn.removeAttribute('onclick');
                addMobileHandler(btn, () => this.showUpgrade());
            });

            // Filter buttons - initialize after DOM is ready
            // Use setTimeout to ensure button exists (it's in the nav which renders after init)
            setTimeout(() => {
                this.initFilterButtons(signal);
            }, 200);

            // Export button
            const exportBtn = document.querySelector('[onclick*="exportToCSV"]');
            if (exportBtn) {
                exportBtn.removeAttribute('onclick');
                addMobileHandler(exportBtn, () => this.exportToCSV());
            }

            // Newsletter button
            addMobileHandler(document.getElementById('newsletter-btn'), () => {
                this.openModal('newsletter-modal');
            });

            // Methodology link
            const methodologyLink = document.getElementById('methodology-link');
            if (methodologyLink) {
                methodologyLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openModal('methodology-modal');
                });
            }

            // Email forms
            document.querySelectorAll('#email-form-1, #email-form-2, .newsletter-form').forEach(form => {
                form.addEventListener('submit', (e) => this.handleEmailSubmit(e));
            });

            // Modal closes - use delegation for dynamically created modals
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-close') || e.target.closest('.modal-close')) {
                    const modal = e.target.closest('.modal') || document.querySelector('.modal.active');
                    if (modal) modal.remove();
                }
            }, { signal });

            document.addEventListener('touchend', (e) => {
                if (e.target.classList.contains('modal-close') || e.target.closest('.modal-close')) {
                    e.preventDefault();
                    const modal = e.target.closest('.modal') || document.querySelector('.modal.active');
                    if (modal) modal.remove();
                }
            }, { passive: false, signal });

            document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                addMobileHandler(backdrop, () => {
                    const modal = backdrop.closest('.modal');
                    if (modal) modal.remove();
                });
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.modal.active').forEach(m => m.remove());
                }
            }, { signal });

            // Delegated events - use both click and touchend for mobile
            const handleInteraction = (e) => {
                // Prevent double-firing on touch devices
                if (e.type === 'touchend') {
                    e.preventDefault();
                }

                // Player card click
                const card = e.target.closest('.player-card');
                if (card && !e.target.closest('.player-save-btn') && !e.target.closest('.compare-checkbox')) {
                    const playerId = parseInt(card.dataset.playerId);
                    // Check if it's a locked card
                    if (card.classList.contains('locked')) {
                        this.showUpgrade();
                    } else {
                        this.showPlayerDetail(playerId);
                    }
                }

                // Save button
                const saveBtn = e.target.closest('.player-save-btn, .watchlist-detail-btn');
                if (saveBtn) {
                    e.stopPropagation();
                    const playerId = parseInt(saveBtn.dataset.playerId);
                    this.toggleWatchlist(playerId);
                }

                // Share button
                const shareBtn = e.target.closest('.share-btn');
                if (shareBtn) {
                    const playerName = decodeURIComponent(shareBtn.dataset.player);
                    this.sharePlayer(playerName);
                }

                // Upgrade card or button
                const upgradeCard = e.target.closest('.upgrade-card, .upgrade-btn, [data-action="upgrade"]');
                if (upgradeCard) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showUpgrade();
                    return;
                }

                // Compare checkbox
                const compareCheckbox = e.target.closest('.compare-checkbox[data-action="toggle-compare"]');
                if (compareCheckbox) {
                    e.stopPropagation();
                    const playerId = parseInt(compareCheckbox.dataset.playerId);
                    this.toggleCompare(playerId);
                    return;
                }

                // Data-action handlers
                const actionElement = e.target.closest('[data-action]');
                if (actionElement) {
                    const action = actionElement.dataset.action;
                    e.preventDefault();
                    e.stopPropagation();

                    switch (action) {
                        case 'show-comparison':
                            this.showComparison();
                            break;
                        case 'clear-compare':
                            this.clearCompare();
                            break;
                        case 'close-comparison':
                            this.closeComparison();
                            break;
                        case 'show-pro-activation':
                            this.showProActivation();
                            break;
                        case 'upgrade':
                            const modal = actionElement.closest('.modal');
                            if (modal) modal.remove();
                            this.showUpgrade();
                            break;
                        case 'page-prev':
                            if (state.pagination.currentPage > 1) {
                                state.pagination.currentPage--;
                                this.renderView(state.currentView);
                            }
                            break;
                        case 'refresh':
                            window.location.reload();
                            break;
                        case 'apply-filters':
                            this.applyFilters();
                            break;
                        case 'reset-filters':
                            this.resetFilters();
                            break;
                        case 'toggle-filters':
                            this.toggleFilters();
                            break;
                        case 'page-next':
                            let totalItems = 0;
                            if (state.currentView === 'gems') {
                                const data = this.getData();
                                const lowerLeagues = ['Championship', 'Eredivisie', 'Primeira Liga', 'Serie A Brasil', 'Série A'];
                                let allGems = data.hiddenGems || [];
                                if (!allGems.length) {
                                    const allPlayers = [
                                        ...(data.undervalued || []),
                                        ...(data.topPerformers || []),
                                        ...(data.risingStars || [])
                                    ];
                                    allGems = allPlayers.filter(p =>
                                        lowerLeagues.some(l => p.league?.includes(l)) ||
                                        p.tier === 2 ||
                                        p.is_hidden_gem
                                    );
                                }
                                totalItems = allGems.length;
                            } else if (state.currentView === 'watchlist') {
                                totalItems = state.watchlist.length;
                            }
                            const maxPage = Math.ceil(totalItems / state.pagination.itemsPerPage);
                            if (state.pagination.currentPage < maxPage) {
                                state.pagination.currentPage++;
                                this.renderView(state.currentView);
                            }
                            break;
                    }
                    return;
                }

                // Form submissions
                const form = e.target.closest('form[data-action]');
                if (form) {
                    e.preventDefault();
                    const action = form.dataset.action;
                    if (action === 'submit-email') {
                        this.submitEmail(e);
                    } else if (action === 'verify-pro-email') {
                        this.verifyProEmail(e);
                    }
                    return;
                }

                // Modal backdrop close
                const backdrop = e.target.closest('.modal-backdrop');
                if (backdrop) {
                    const modal = backdrop.closest('.modal');
                    if (modal) {
                        modal.remove();
                        // Cleanup modal-specific event listeners if needed
                        // (Global listeners remain bound for app lifetime)
                    }
                }
            };

            document.addEventListener('click', handleInteraction, { signal });
            document.addEventListener('touchend', handleInteraction, { passive: false, signal });

            // Also handle upgrade cards that might be dynamically added
            document.addEventListener('click', (e) => {
                if (e.target.closest('.upgrade-card, .upgrade-btn, [data-action="upgrade"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showUpgrade();
                }
            }, { signal });

            document.addEventListener('touchend', (e) => {
                if (e.target.closest('.upgrade-card, .upgrade-btn, [data-action="upgrade"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showUpgrade();
                }
            }, { passive: false, signal });
        },

        switchView(viewId) {
            // Reset pagination when switching views
            state.pagination.currentPage = 1;

            // Update nav
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('active', link.dataset.view === viewId);
            });

            // Update views
            document.querySelectorAll('.view').forEach(view => {
                view.classList.toggle('active', view.id === `view-${viewId}`);
            });

            // Show/hide hero
            const hero = document.getElementById('hero');
            if (hero) {
                hero.style.display = viewId === 'dashboard' ? 'block' : 'none';
            }

            state.currentView = viewId;
            this.renderView(viewId);
        },

        renderView(viewId) {
            switch (viewId) {
                case 'dashboard':
                    this.renderUndervalued();
                    break;
                case 'performers':
                    this.renderPerformers();
                    break;
                case 'rising':
                    this.renderRising();
                    break;
                case 'gems':
                    this.renderGems();
                    break;
                case 'bargains':
                    this.renderBargains();
                    break;
                case 'rumors':
                    this.renderRumors();
                    break;
                case 'watchlist':
                    this.renderWatchlist();
                    break;
            }
        },

        renderUndervalued() {
            const container = document.getElementById('undervalued-list');
            if (!container) return;

            try {
                const data = this.getData();
                let allPlayers = data.free?.undervalued || data.undervalued || [];

                // Apply filters and search
                allPlayers = this.filterAndSortPlayers(allPlayers);

                let html = '';

                if (state.isPro) {
                    html = allPlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
                } else {
                    // FREE: Show only first 5
                    const freePlayers = allPlayers.slice(0, 5);
                    const proPlayers = allPlayers.slice(5);

                    html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');

                    // ALWAYS show upgrade card after free players
                    html += UI.renderUpgradeCard();

                    if (proPlayers.length > 0) {
                        html += `<div class="pro-section-header">🔒 ${proPlayers.length} more undervalued players with Pro</div>`;
                        // Show locked previews
                        html += proPlayers.slice(0, 5).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                    }
                }

                if (allPlayers.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No players found</h3>
                            <p>Try adjusting your filters or search terms.</p>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering undervalued players:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load players. Please refresh the page.</p></div>';
            }
        },

        renderPerformers() {
            const container = document.getElementById('performers-list');
            if (!container) return;

            try {
                const data = this.getData();
                let allPlayers = data.free?.topPerformers || data.topPerformers || [];

                // Apply filters and search
                allPlayers = this.filterAndSortPlayers(allPlayers);

                let html = '';

                if (state.isPro) {
                    html = allPlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
                } else {
                    const freePlayers = allPlayers.slice(0, 5);
                    const proPlayers = allPlayers.slice(5);

                    html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');

                    if (proPlayers.length > 0) {
                        html += `<div class="pro-section-header">🔒 ${proPlayers.length} more top performers with Pro</div>`;
                        html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                        html += UI.renderUpgradeCard();
                    }
                }

                if (allPlayers.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No performers found</h3>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering performers:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load players. Please refresh the page.</p></div>';
            }
        },

        renderRising() {
            const container = document.getElementById('rising-list');
            if (!container) return;

            try {
                const data = this.getData();
                let allPlayers = data.free?.risingStars || data.risingStars || [];

                // Apply filters and search
                allPlayers = this.filterAndSortPlayers(allPlayers);

                let html = '';

                if (state.isPro) {
                    html = allPlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
                } else {
                    const freePlayers = allPlayers.slice(0, 5);
                    const proPlayers = allPlayers.slice(5);

                    html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');

                    if (proPlayers.length > 0) {
                        html += `<div class="pro-section-header">🔒 ${proPlayers.length} more rising stars with Pro</div>`;
                        html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                        html += UI.renderUpgradeCard();
                    }
                }

                if (allPlayers.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No rising stars found</h3>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering rising stars:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load players. Please refresh the page.</p></div>';
            }
        },

        renderGems() {
            const container = document.getElementById('gems-list');
            if (!container) return;

            try {
                const data = this.getData();
                // Hidden gems = players from lower leagues (Championship, Eredivisie, Portugal, Brazil, etc.)
                const lowerLeagues = ['Championship', 'Eredivisie', 'Primeira Liga', 'Serie A Brasil', 'Série A'];

                let allGems = [];

                // Get gems from API structure or static data
                if (data.free?.hiddenGems) {
                    allGems = [...(data.free.hiddenGems || []), ...(data.pro?.hiddenGems || [])];
                } else if (data.hiddenGems) {
                    allGems = data.hiddenGems;
                } else {
                    // Filter from undervalued/performers for lower league players
                    const allPlayers = [
                        ...(data.undervalued || []),
                        ...(data.topPerformers || []),
                        ...(data.risingStars || [])
                    ];
                    allGems = allPlayers.filter(p =>
                        lowerLeagues.some(l => p.league?.includes(l)) ||
                        p.tier === 2 ||
                        p.is_hidden_gem
                    );
                }

                // Remove duplicates
                const seen = new Set();
                allGems = allGems.filter(p => {
                    if (seen.has(p.name)) return false;
                    seen.add(p.name);
                    return true;
                });

                // Apply filters and search
                allGems = this.filterAndSortPlayers(allGems);

                // Show ALL hidden gems (they're from lower leagues - main value prop)
                // Add pagination for large lists
                const itemsPerPage = state.pagination.itemsPerPage;
                const currentPage = state.pagination.currentPage;
                const totalPages = Math.ceil(allGems.length / itemsPerPage);
                const startIdx = (currentPage - 1) * itemsPerPage;
                const endIdx = startIdx + itemsPerPage;
                const paginatedGems = allGems.slice(startIdx, endIdx);

                let html = '';

                if (allGems.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No hidden gems found</h3>
                            <p>Try adjusting your filters or search terms.</p>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                } else {
                    // Show paginated gems
                    html = paginatedGems.map((p, i) => UI.renderPlayerCard(p, startIdx + i)).join('');

                    // Add pagination controls if more than one page
                    if (totalPages > 1) {
                        html += `<div class="pagination-controls" style="display:flex;justify-content:center;align-items:center;gap:1rem;margin:2rem 0;padding:1rem;">
                            <button class="btn btn-ghost" data-action="page-prev" ${currentPage === 1 ? 'disabled' : ''} style="min-width:44px;min-height:44px;">←</button>
                            <span style="color:var(--text-secondary);">Page ${currentPage} of ${totalPages}</span>
                            <button class="btn btn-ghost" data-action="page-next" ${currentPage === totalPages ? 'disabled' : ''} style="min-width:44px;min-height:44px;">→</button>
                        </div>`;
                    }
                }

                // ALWAYS show upgrade card - even if showing all gems (for other Pro features)
                if (!state.isPro) {
                    html += UI.renderUpgradeCard();
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering hidden gems:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load players. Please refresh the page.</p></div>';
            }
        },

        renderBargains() {
            const container = document.getElementById('bargains-list');
            if (!container) return;

            try {
                const data = this.getData();

                // Get players with expiring contracts
                let allBargains = [];

                if (data.bargains) {
                    allBargains = data.bargains;
                } else if (data.expiringContracts) {
                    allBargains = data.expiringContracts;
                } else {
                    const allPlayers = [
                        ...(data.undervalued || []),
                        ...(data.topPerformers || []),
                        ...(data.risingStars || []),
                        ...(data.hiddenGems || [])
                    ];
                    allBargains = allPlayers.filter(p =>
                        p.contract_expiry && p.contract_expiry <= 2026
                    );
                }

                const seen = new Set();
                allBargains = allBargains.filter(p => {
                    if (seen.has(p.name)) return false;
                    seen.add(p.name);
                    return true;
                });

                // Apply filters and search
                allBargains = this.filterAndSortPlayers(allBargains);

                let html = '';

                if (state.isPro) {
                    html = allBargains.map((p, i) => UI.renderPlayerCard(p, i)).join('');
                } else {
                    const freePlayers = allBargains.slice(0, 5);
                    const proPlayers = allBargains.slice(5);

                    if (freePlayers.length > 0) {
                        html = `<div class="bargains-info" style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:1rem;margin-bottom:1rem;">
                            <strong style="color:#f87171;">⏰ Expiring 2025</strong> = Free agent soon! Clubs can negotiate pre-contracts now.
                        </div>`;
                        html += freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');

                        if (proPlayers.length > 0) {
                            html += `<div class="pro-section-header">🔒 ${proPlayers.length} more bargains with Pro</div>`;
                            html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                        }
                        html += UI.renderUpgradeCard();
                    }
                }

                if (allBargains.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No bargains found</h3>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering bargains:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load players. Please refresh the page.</p></div>';
            }
        },

        async renderRumors() {
            const container = document.getElementById('rumors-list');
            if (!container) return;

            try {
                // Fetch rumors from live API (automatic updates)
                let rumors = [];
                try {
                    // Try API endpoint first (live data)
                    const response = await fetch('/api/rumors');
                    if (response.ok) {
                        const data = await response.json();
                        rumors = data.rumors || [];

                        // Filter expired rumors
                        const today = new Date();
                        rumors = rumors.filter(r => {
                            if (!r.expires) return true; // Keep if no expiry
                            const expiry = new Date(r.expires);
                            return expiry > today;
                        }).sort((a, b) => {
                            // Sort by date (newest first)
                            return new Date(b.date) - new Date(a.date);
                        });
                    } else {
                        throw new Error('API returned error');
                    }
                } catch (error) {
                    console.warn('Could not fetch live rumors, trying fallback:', error);
                    // Fallback: Try static JSON file
                    try {
                        const response = await fetch('/data/rumors.json');
                        const data = await response.json();
                        const today = new Date();
                        rumors = (data.rumors || []).filter(r => {
                            if (!r.expires) return true;
                            const expiry = new Date(r.expires);
                            return expiry > today;
                        }).sort((a, b) => new Date(b.date) - new Date(a.date));
                    } catch (fallbackError) {
                        console.warn('Could not load rumors.json, using minimal fallback');
                        // Minimal fallback
                        rumors = [];
                    }
                }

                let html = `
                    <div class="email-capture" style="margin-bottom: 2rem;">
                        <h3>🔔 Get Transfer Alerts</h3>
                        <p>Be first to know when big transfers happen. Daily updates in your inbox.</p>
                        <form class="email-form" data-action="submit-email">
                            <input type="email" placeholder="your@email.com" required>
                            <button type="submit">Subscribe Free</button>
                        </form>
                    </div>
                `;

                html += rumors.map(r => `
                    <div class="rumor-card">
                        <div class="rumor-header">
                            <div>
                                <div class="rumor-player">
                                    ${Security.escapeHtml(r.player || '')}
                                    ${r.verified ? '<span class="verified-badge" title="Verified source">✓</span>' : ''}
                                </div>
                                <div class="rumor-details">${Security.escapeHtml(r.from || '')} → ${Security.escapeHtml(r.to || '')}</div>
                            </div>
                            <span class="rumor-badge ${Security.escapeHtml(r.status || '')}">${r.status === 'hot' ? '🔥 HOT' : '⚡ WARM'}</span>
                        </div>
                        <div class="rumor-details" style="margin-top: 0.5rem;">
                            <strong>Fee:</strong> ${Security.escapeHtml(r.fee || '')}
                        </div>
                        <div class="rumor-source">
                            📰 ${Security.escapeHtml(r.source || '')} • ${Security.escapeHtml(this.formatRumorDate(r.date || ''))}
                        </div>
                    </div>
                `).join('');

                if (rumors.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">📰</span>
                            <h3>No Active Rumors</h3>
                            <p>Check back soon for the latest transfer news!</p>
                        </div>
                    `;
                }

                html += `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <p>Want more rumors and exclusive transfer intel?</p>
                        <button class="btn btn-primary" data-action="upgrade">
                            Upgrade to Pro →
                        </button>
                    </div>
                `;

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering rumors:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load rumors. Please refresh the page.</p></div>';
            }
        },

        showUpgrade() {
            // PAYMENT OPTIONS - Stripe Payment Links (Anonymous & Professional)
            // To set up: https://dashboard.stripe.com/payment-links
            // 1. Create Payment Link for $9.99/month (recurring)
            // 2. Create Payment Link for $79/year (recurring)
            // 3. Replace the links below with your actual Stripe Payment Link IDs

            const STRIPE_MONTHLY = 'https://buy.stripe.com/[YOUR_MONTHLY_LINK_ID]';
            const STRIPE_ANNUAL = 'https://buy.stripe.com/[YOUR_ANNUAL_LINK_ID]';

            // ============================================
            // PAYPAL HOSTED BUTTONS (ANONYMOUS - NO BUSINESS ACCOUNT NEEDED)
            // ============================================
            // Step 1: Go to https://www.paypal.com → Tools → PayPal Buttons
            // Step 2: Create Subscription button for $9.99/month
            // Step 3: Create Subscription button for $79/year
            // Step 4: Copy the hosted_button_id from each button
            // Step 5: Paste IDs below (replace YOUR_MONTHLY_ID and YOUR_ANNUAL_ID)
            // Step 6: Set USE_PAYPAL_BUTTONS = true
            // See PAYPAL_HOSTED_BUTTONS_SETUP.md for detailed guide

            const PAYPAL_MONTHLY_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PASTE_MONTHLY_ID_HERE';
            const PAYPAL_ANNUAL_BUTTON = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PASTE_ANNUAL_ID_HERE';

            // Fallback: PayPal.me (only used if buttons not configured)
            // NOTE: This will show your personal name - use Hosted Buttons instead!
            // For now, using generic name to hide personal account
            const PAYPAL_BUSINESS_NAME = 'ScoutLensPro';
            const PAYPAL_MONTHLY_ME = `https://paypal.me/${PAYPAL_BUSINESS_NAME}/9.99`;
            const PAYPAL_ANNUAL_ME = `https://paypal.me/${PAYPAL_BUSINESS_NAME}/72`;

            // Set to true after you create PayPal Hosted Buttons and add the IDs above
            // For now, set to false to use PayPal.me with generic name (hides personal account)
            let USE_PAYPAL_BUTTONS = false; // ⬅️ Set to true for total anonymity (requires button IDs)
            const PAYMENT_PROVIDER = 'paypal';

            // Failsafe: Check if IDs are still placeholders
            const isMonthlyPlaceholder = PAYPAL_MONTHLY_BUTTON.includes('PASTE_');
            const isAnnualPlaceholder = PAYPAL_ANNUAL_BUTTON.includes('PASTE_');

            if (USE_PAYPAL_BUTTONS && (isMonthlyPlaceholder || isAnnualPlaceholder)) {
                console.warn('⚠️ PayPal Hosted Button IDs are missing or invalid. Falling back to PayPal.me.');
                USE_PAYPAL_BUTTONS = false;
            }

            const MONTHLY_LINK = USE_PAYPAL_BUTTONS ? PAYPAL_MONTHLY_BUTTON : PAYPAL_MONTHLY_ME;
            const ANNUAL_LINK = USE_PAYPAL_BUTTONS ? PAYPAL_ANNUAL_BUTTON : PAYPAL_ANNUAL_ME;

            // Check if Stripe links are configured
            const isStripeConfigured = !STRIPE_MONTHLY.includes('[YOUR_');
            if (!isStripeConfigured && PAYMENT_PROVIDER === 'stripe') {
                console.warn('⚠️ Stripe Payment Links not configured. Please set up in Stripe Dashboard.');
                // Fallback to PayPal if Stripe not configured
                const MONTHLY_LINK = PAYPAL_MONTHLY_ME;
                const ANNUAL_LINK = PAYPAL_ANNUAL_ME;
            }

            // Remove existing modal if any
            const existingModal = document.getElementById('upgrade-modal');
            if (existingModal) existingModal.remove();

            // Show upgrade modal - MORE VISIBLE
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'upgrade-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
            modal.innerHTML = `
                <div class="modal-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.95);cursor:pointer;"></div>
                <div class="modal-content upgrade-modal-content" style="position:relative;background:#151a21;border:2px solid #00d4aa;border-radius:20px;max-width:500px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,212,170,0.3);">
                    <button class="modal-close" type="button" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.5rem;cursor:pointer;padding:10px;min-width:44px;min-height:44px;border-radius:8px;z-index:10;">×</button>
                    <div class="upgrade-modal-body" style="padding:2rem;text-align:center;">
                        <div class="upgrade-header" style="margin-bottom:2rem;">
                            <span style="font-size:3rem;display:block;margin-bottom:1rem;">🔭</span>
                            <h2 style="font-size:1.8rem;background:linear-gradient(135deg,#fbbf24,#00d4aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem;">ScoutLens Pro</h2>
                            <p style="color:#94a3b8;">Get the edge with complete player intelligence</p>
                        </div>
                        
                        <div class="upgrade-features" style="text-align:left;background:#1c232d;border-radius:10px;padding:1.5rem;margin-bottom:2rem;">
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ 150+ undervalued players (not just top 5)</div>
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ Transfer fee analysis & ROI tracking</div>
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ All 5 major leagues covered</div>
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ Export reports to CSV/PDF</div>
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ Price drop alert notifications</div>
                            <div style="padding:0.5rem 0;color:#f1f5f9;">✅ Historical value trends</div>
                        </div>
                        
                        <div class="upgrade-pricing" style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                            <a href="${MONTHLY_LINK}" target="_blank" rel="noopener noreferrer" class="payment-link" style="flex:1;min-width:140px;background:#1c232d;border:2px solid #333;border-radius:10px;padding:1.5rem;cursor:pointer;transition:all 0.2s;text-decoration:none;display:block;">
                                <div style="font-size:2rem;font-weight:700;color:#f1f5f9;">$9<span style="font-size:0.9rem;font-weight:400;color:#94a3b8;">/mo</span></div>
                                <div style="color:#64748b;font-size:0.85rem;margin-top:0.25rem;">Monthly</div>
                            </a>
                            <a href="${ANNUAL_LINK}" target="_blank" rel="noopener noreferrer" class="payment-link" style="flex:1;min-width:140px;background:linear-gradient(135deg,rgba(251,191,36,0.1),transparent);border:2px solid #fbbf24;border-radius:10px;padding:1.5rem;cursor:pointer;position:relative;text-decoration:none;display:block;">
                                <div style="position:absolute;top:-10px;right:10px;background:#fbbf24;color:#000;font-size:0.7rem;padding:3px 8px;border-radius:10px;font-weight:700;">BEST VALUE</div>
                                <div style="font-size:2rem;font-weight:700;color:#f1f5f9;">$72<span style="font-size:0.9rem;font-weight:400;color:#94a3b8;">/yr</span></div>
                                <div style="color:#fbbf24;font-size:0.85rem;margin-top:0.25rem;">$6/mo - Save 33%</div>
                            </a>
                        </div>
                        
                        <p style="color:#64748b;font-size:0.8rem;">Cancel anytime. 7-day money-back guarantee.</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Add event listeners for mobile compatibility (instead of inline onclick)
            const backdrop = modal.querySelector('.modal-backdrop');
            const closeBtn = modal.querySelector('.modal-close');
            const paymentLinks = modal.querySelectorAll('.payment-link');

            const closeModal = () => modal.remove();

            backdrop.addEventListener('click', closeModal);
            backdrop.addEventListener('touchend', (e) => { e.preventDefault(); closeModal(); });

            closeBtn.addEventListener('click', closeModal);
            closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); closeModal(); });

            // Ensure payment links work on mobile
            paymentLinks.forEach(link => {
                link.addEventListener('touchstart', () => {
                    link.style.opacity = '0.7';
                });
                link.addEventListener('touchend', () => {
                    link.style.opacity = '1';
                });
            });
        },

        renderWatchlist() {
            const container = document.getElementById('watchlist-list');
            if (!container) return;

            try {
                if (state.watchlist.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="empty-state-icon">★</span>
                            <h3>No saved players yet</h3>
                            <p>Click the star on any player to add them here.</p>
                        </div>
                    `;
                    return;
                }

                // Apply filters and search to watchlist too
                let filteredWatchlist = this.filterAndSortPlayers(state.watchlist);

                // Add pagination for large watchlists
                const itemsPerPage = state.pagination.itemsPerPage;
                const currentPage = state.pagination.currentPage;
                const totalPages = Math.ceil(filteredWatchlist.length / itemsPerPage);
                const startIdx = (currentPage - 1) * itemsPerPage;
                const endIdx = startIdx + itemsPerPage;
                const paginatedWatchlist = filteredWatchlist.slice(startIdx, endIdx);

                let html = '';

                if (filteredWatchlist.length === 0) {
                    html = `
                        <div class="empty-state">
                            <span class="empty-state-icon">🔍</span>
                            <h3>No matches in watchlist</h3>
                            <button class="btn btn-ghost" data-action="reset-filters" style="margin-top:1rem;">Reset Filters</button>
                        </div>
                    `;
                } else {
                    html = paginatedWatchlist.map((p, i) => UI.renderPlayerCard(p, startIdx + i)).join('');

                    // Add pagination controls if more than one page
                    if (totalPages > 1) {
                        html += `<div class="pagination-controls" style="display:flex;justify-content:center;align-items:center;gap:1rem;margin:2rem 0;padding:1rem;">
                            <button class="btn btn-ghost" data-action="page-prev" ${currentPage === 1 ? 'disabled' : ''} style="min-width:44px;min-height:44px;">←</button>
                            <span style="color:var(--text-secondary);">Page ${currentPage} of ${totalPages}</span>
                            <button class="btn btn-ghost" data-action="page-next" ${currentPage === totalPages ? 'disabled' : ''} style="min-width:44px;min-height:44px;">→</button>
                        </div>`;
                    }
                }

                container.innerHTML = html;
            } catch (e) {
                console.error('Error rendering watchlist:', e);
                container.innerHTML = '<div class="error-state" style="padding:2rem;text-align:center;color:var(--text-muted);"><p>⚠️ Failed to load watchlist. Please refresh the page.</p></div>';
            }
        },

        showPlayerDetail(playerId) {
            // Find player in all lists
            const data = this.getData();
            const allPlayers = [
                ...(data.undervalued || []),
                ...(data.topPerformers || []),
                ...(data.risingStars || []),
                ...state.watchlist
            ];

            const player = allPlayers.find(p => p.id === playerId);
            if (!player) return;

            const modalBody = document.getElementById('player-modal-body');
            modalBody.innerHTML = UI.renderPlayerDetail(player);
            this.openModal('player-modal');
        },

        toggleWatchlist(playerId) {
            // Find player
            const data = this.getData();
            const allPlayers = [
                ...(data.undervalued || []),
                ...(data.topPerformers || []),
                ...(data.risingStars || [])
            ];

            const player = allPlayers.find(p => p.id === playerId);
            if (!player) return;

            const index = state.watchlist.findIndex(p => p.id === playerId);

            if (index > -1) {
                state.watchlist.splice(index, 1);
                UI.showNotification(`Removed ${player.name || 'player'} from watchlist`);
            } else {
                state.watchlist.push(player);
                UI.showNotification(`Saved ${player.name || 'player'} to watchlist ★`);
            }

            this.saveState();
            this.refreshSaveButtons();

            if (state.currentView === 'watchlist') {
                this.renderWatchlist();
            }
        },

        refreshSaveButtons() {
            document.querySelectorAll('.player-save-btn').forEach(btn => {
                const playerId = parseInt(btn.dataset.playerId);
                const isInWatchlist = state.watchlist.some(p => p.id === playerId);
                btn.classList.toggle('active', isInWatchlist);
                btn.textContent = isInWatchlist ? '★' : '☆';
            });
        },

        handleEmailSubmit(e) {
            e.preventDefault();
            const form = e.target;
            const email = form.querySelector('input[type="email"]').value;

            // In production: Send to Beehiiv, ConvertKit, etc.
            // For now: Store locally and show confirmation
            console.log('Email submitted:', email);
            Security.storage.setItem('scoutlens_email', email);

            UI.showNotification('✅ Subscribed! Check your inbox Monday.');

            // Close modal if open
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));

            // Clear form
            form.reset();
        },

        sharePlayer(playerName) {
            const text = `Check out ${playerName} on ScoutLens - might be undervalued 🔭`;
            const url = window.location.href;

            if (navigator.share) {
                navigator.share({ title: 'ScoutLens', text, url }).catch(() => { });
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
                    UI.showNotification('📋 Copied to clipboard!');
                });
            }
        },

        formatRumorDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            return date.toLocaleDateString();
        },

        openModal(modalId) {
            document.getElementById(modalId)?.classList.add('active');
        },

        // ============================================
        // PLAYER COMPARISON
        // ============================================

        toggleCompare(playerId) {
            const player = this.findPlayer(playerId);
            if (!player) return;

            const index = state.compareList.findIndex(p => p.id === playerId);

            if (index > -1) {
                state.compareList.splice(index, 1);
            } else if (state.compareList.length < 3) {
                state.compareList.push(player);
            } else {
                UI.showNotification('⚠️ Max 3 players to compare');
                return;
            }

            this.updateComparePanel();
            this.refreshCompareCheckboxes();
        },

        findPlayer(playerId) {
            const data = this.getData();
            const allLists = [
                ...(data.undervalued || []),
                ...(data.topPerformers || []),
                ...(data.risingStars || []),
                ...(data.hiddenGems || []),
                ...(data.bargains || []),
                ...(data.expiringContracts || []),
                ...state.watchlist
            ];
            return allLists.find(p => p.id === playerId);
        },

        updateComparePanel() {
            let panel = document.getElementById('compare-panel');

            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'compare-panel';
                panel.className = 'compare-panel hidden';
                panel.innerHTML = `
                    <span class="compare-count">0 selected</span>
                    <button class="compare-btn" data-action="show-comparison" disabled>Compare</button>
                    <button class="btn btn-ghost" data-action="clear-compare">Clear</button>
                `;
                document.body.appendChild(panel);
            }

            const count = state.compareList.length;
            panel.querySelector('.compare-count').textContent = `${count} selected`;
            panel.querySelector('.compare-btn').disabled = count < 2;
            panel.classList.toggle('hidden', count === 0);
        },

        refreshCompareCheckboxes() {
            document.querySelectorAll('.compare-checkbox').forEach(cb => {
                const playerId = parseInt(cb.dataset.playerId);
                cb.checked = state.compareList.some(p => p.id === playerId);
            });

            document.querySelectorAll('.player-card').forEach(card => {
                const playerId = parseInt(card.dataset.playerId);
                card.classList.toggle('selected-compare', state.compareList.some(p => p.id === playerId));
            });
        },

        clearCompare() {
            state.compareList = [];
            this.updateComparePanel();
            this.refreshCompareCheckboxes();
        },

        showComparison() {
            if (state.compareList.length < 2) return;

            const modal = document.createElement('div');
            modal.className = 'compare-modal';
            modal.id = 'compare-modal';

            const stats = ['market_value_eur_m', 'fair_value_eur_m', 'goals', 'assists', 'xgi_per_90', 'age'];
            const labels = ['Market Value', 'Fair Value', 'Goals', 'Assists', 'xGI/90', 'Age'];

            // Find best value for each stat
            const bestValues = {};
            stats.forEach((stat, i) => {
                const values = state.compareList.map(p => p[stat] || 0);
                if (stat === 'age' || stat === 'market_value_eur_m') {
                    bestValues[stat] = Math.min(...values); // Lower is better
                } else {
                    bestValues[stat] = Math.max(...values); // Higher is better
                }
            });

            modal.innerHTML = `
                <button class="compare-close-btn" data-action="close-comparison">✕</button>
                <div class="compare-grid">
                    ${state.compareList.map(player => `
                        <div class="compare-card">
                            <h3>${Security.escapeHtml(player.name || '')} ${player.is_hidden_gem ? '💎' : ''}</h3>
                            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">${Security.escapeHtml(player.team || '')} • ${Security.escapeHtml(player.league || '')}</p>
                            ${stats.map((stat, i) => {
                const value = player[stat] || 0;
                const isBest = value === bestValues[stat];
                let displayValue = value;
                if (stat.includes('value') || stat.includes('clause')) {
                    displayValue = '€' + value + 'M';
                }
                return `
                                    <div class="compare-stat-row">
                                        <span class="compare-stat-label">${labels[i]}</span>
                                        <span class="compare-stat-value ${isBest ? 'best' : ''}">${displayValue}</span>
                                    </div>
                                `;
            }).join('')}
                            ${player.contract_expiry ? `
                                <div class="compare-stat-row">
                                    <span class="compare-stat-label">Contract Until</span>
                                    <span class="compare-stat-value ${player.contract_status === 'expiring' ? 'best' : ''}">${player.contract_expiry}</span>
                                </div>
                            ` : ''}
                            ${player.release_clause_eur_m ? `
                                <div class="compare-stat-row">
                                    <span class="compare-stat-label">Release Clause</span>
                                    <span class="compare-stat-value">€${player.release_clause_eur_m}M</span>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

            document.body.appendChild(modal);
        },

        closeComparison() {
            document.getElementById('compare-modal')?.remove();
        },

        // ============================================
        // SEARCH & FILTER
        // ============================================

        initSearch() {
            const searchInput = document.getElementById('player-search');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    // Debounce search to prevent excessive re-renders
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        // Sanitize search input to prevent XSS
                        state.searchQuery = Security.sanitizeSearch(e.target.value);
                        this.renderView(state.currentView);
                    }, 300); // 300ms debounce
                });
            }

            // Filter range displays
            const ageRange = document.getElementById('filter-age');
            const valueRange = document.getElementById('filter-value');
            const sortSelect = document.getElementById('sort-by');

            if (ageRange) {
                ageRange.addEventListener('input', (e) => {
                    const ageValue = document.getElementById('age-value');
                    if (ageValue) ageValue.textContent = e.target.value;
                }, { signal });
            }

            if (valueRange) {
                valueRange.addEventListener('input', (e) => {
                    const valueDisplay = document.getElementById('value-display');
                    if (valueDisplay) valueDisplay.textContent = `€${e.target.value}M`;
                }, { signal });
            }

            // Sort dropdown - apply immediately on change
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    state.filters.sortBy = e.target.value;
                    this.renderView(state.currentView);
                }, { signal });
            }
        },

        initMobileMenu() {
            const hamburger = document.getElementById('nav-hamburger');
            const menu = document.getElementById('nav-menu');
            const overlay = document.getElementById('nav-menu-overlay');
            const closeBtn = document.getElementById('nav-menu-close');
            const menuLinks = document.querySelectorAll('.nav-menu-link');

            // Show hamburger on mobile
            if (window.innerWidth <= 768) {
                if (hamburger) hamburger.style.display = 'block';
                if (document.querySelector('.nav-links')) {
                    document.querySelector('.nav-links').style.display = 'none';
                }
            }

            // Toggle menu
            const toggleMenu = () => {
                if (menu) menu.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
                document.body.style.overflow = menu?.classList.contains('active') ? 'hidden' : '';
            };

            const closeMenu = () => {
                if (menu) menu.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            };

            if (hamburger) {
                hamburger.addEventListener('click', toggleMenu);
                hamburger.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    toggleMenu();
                }, { passive: false });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', closeMenu);
                closeBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    closeMenu();
                }, { passive: false });
            }

            if (overlay) {
                overlay.addEventListener('click', closeMenu);
            }

            // Handle menu link clicks
            menuLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const view = link.dataset.view;
                    if (view) {
                        this.switchView(view);
                        closeMenu();
                    }
                });
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    if (hamburger) hamburger.style.display = 'none';
                    if (document.querySelector('.nav-links')) {
                        document.querySelector('.nav-links').style.display = 'flex';
                    }
                    closeMenu();
                } else {
                    if (hamburger) hamburger.style.display = 'block';
                    if (document.querySelector('.nav-links')) {
                        document.querySelector('.nav-links').style.display = 'none';
                    }
                }
            });
        },

        initFilterButtons(signal) {
            console.log('🔧 Initializing filter buttons...');

            // Filter toggle button
            const filterToggle = document.getElementById('filter-toggle');
            if (filterToggle) {
                console.log('✅ Filter toggle button found');
                // Remove onclick attribute (we'll use event listener)
                filterToggle.removeAttribute('onclick');

                // Remove any existing listeners by cloning
                const newToggle = filterToggle.cloneNode(true);
                filterToggle.parentNode.replaceChild(newToggle, filterToggle);

                // Add event listeners
                newToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 Filter toggle CLICKED');
                    this.toggleFilters();
                }, { signal });

                newToggle.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 Filter toggle TOUCHED');
                    this.toggleFilters();
                }, { passive: false, signal });
            } else {
                console.error('❌ Filter toggle button NOT found!');
            }

            // Filter close button
            const filterClose = document.querySelector('.filter-close-btn');
            if (filterClose) {
                console.log('✅ Filter close button found');
                filterClose.removeAttribute('onclick');
                const newClose = filterClose.cloneNode(true);
                filterClose.parentNode.replaceChild(newClose, filterClose);

                newClose.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleFilters();
                }, { signal });
            }

            // Verify filter panel
            const filterPanel = document.getElementById('filter-panel');
            if (filterPanel) {
                console.log('✅ Filter panel found');
            } else {
                console.error('❌ Filter panel NOT found!');
            }
        },

        toggleFilters() {
            console.log('🔧 toggleFilters() called');
            const panel = document.getElementById('filter-panel');
            const btn = document.getElementById('filter-toggle');

            if (!panel) {
                console.error('❌ Filter panel not found in toggleFilters()');
                return;
            }

            console.log('📋 Panel current classes:', panel.className);
            const isMobile = window.innerWidth <= 768;
            console.log('📱 Is mobile:', isMobile, 'Width:', window.innerWidth);

            if (isMobile) {
                // Use bottom sheet on mobile
                panel.classList.toggle('filter-bottom-sheet');
                panel.classList.toggle('active');
                panel.classList.toggle('hidden');
            } else {
                // Use sidebar on desktop - just toggle hidden class
                panel.classList.toggle('hidden');
            }

            if (btn) {
                btn.classList.toggle('active');
            }

            const isHidden = panel.classList.contains('hidden');
            console.log('✅ Filter panel toggled. Hidden:', isHidden, 'New classes:', panel.className);

            // Force a reflow to ensure CSS transition works
            void panel.offsetHeight;
        },

        applyFilters() {
            const leagueEl = document.getElementById('filter-league');
            const positionEl = document.getElementById('filter-position');
            const ageEl = document.getElementById('filter-age');
            const valueEl = document.getElementById('filter-value');
            const sortEl = document.getElementById('sort-by');

            state.filters = {
                league: leagueEl?.value || '',
                position: positionEl?.value || '',
                maxAge: parseInt(ageEl?.value) || 40,
                maxValue: parseInt(valueEl?.value) || 200,
                sortBy: sortEl?.value || 'undervaluation'
            };

            console.log('Filters applied:', state.filters);

            // Close filter panel
            this.toggleFilters();

            // Re-render current view with new filters
            this.renderView(state.currentView);

            UI.showNotification('✅ Filters applied');
        },

        resetFilters() {
            state.filters = {
                league: '',
                position: '',
                maxAge: 40,
                maxValue: 200,
                sortBy: 'undervaluation'
            };
            state.searchQuery = '';

            // Reset UI
            const leagueEl = document.getElementById('filter-league');
            const positionEl = document.getElementById('filter-position');
            const ageEl = document.getElementById('filter-age');
            const valueEl = document.getElementById('filter-value');
            const sortEl = document.getElementById('sort-by');
            const searchEl = document.getElementById('player-search');

            if (leagueEl) leagueEl.value = '';
            if (positionEl) positionEl.value = '';
            if (ageEl) ageEl.value = 40;
            if (valueEl) valueEl.value = 200;
            if (sortEl) sortEl.value = 'undervaluation';
            if (searchEl) searchEl.value = '';

            const ageValDisp = document.getElementById('age-value');
            if (ageValDisp) ageValDisp.textContent = '40';

            const valDisp = document.getElementById('value-display');
            if (valDisp) valDisp.textContent = '€200M';

            this.toggleFilters();
            this.renderView(state.currentView);
            UI.showNotification('🔄 Filters reset');
        },

        filterAndSortPlayers(players) {
            let filtered = [...players];

            // Search filter
            if (state.searchQuery) {
                filtered = filtered.filter(p =>
                    p.name?.toLowerCase().includes(state.searchQuery) ||
                    p.team?.toLowerCase().includes(state.searchQuery) ||
                    p.league?.toLowerCase().includes(state.searchQuery) ||
                    p.position?.toLowerCase().includes(state.searchQuery)
                );
            }

            // League filter
            if (state.filters.league) {
                filtered = filtered.filter(p => p.league === state.filters.league);
            }

            // Position filter
            if (state.filters.position) {
                filtered = filtered.filter(p => p.position === state.filters.position);
            }

            // Age filter
            filtered = filtered.filter(p => (p.age || 25) <= state.filters.maxAge);

            // Value filter
            filtered = filtered.filter(p => (p.market_value_eur_m || 0) <= state.filters.maxValue);

            // Sort
            const sortBy = state.filters.sortBy;
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'undervaluation':
                        return (b.undervaluation_pct || 0) - (a.undervaluation_pct || 0);
                    case 'market_value':
                        return (b.market_value_eur_m || 0) - (a.market_value_eur_m || 0);
                    case 'xgi':
                        return (b.xgi_per_90 || 0) - (a.xgi_per_90 || 0);
                    case 'goals':
                        return (b.goals || 0) - (a.goals || 0);
                    case 'age_asc':
                        return (a.age || 99) - (b.age || 99);
                    case 'age_desc':
                        return (b.age || 0) - (a.age || 0);
                    default:
                        return 0;
                }
            });

            return filtered;
        },

        // ============================================
        // EXPORT TO CSV
        // ============================================

        exportToCSV() {
            const data = this.getData();
            let allPlayers = [
                ...(data.undervalued || []),
                ...(data.topPerformers || []),
                ...(data.risingStars || []),
                ...(data.hiddenGems || []),
                ...state.watchlist
            ];

            // Remove duplicates
            const seen = new Set();
            allPlayers = allPlayers.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            // Apply current filters
            allPlayers = this.filterAndSortPlayers(allPlayers);

            // Create CSV
            const headers = ['Name', 'Team', 'League', 'Position', 'Age', 'Market Value (€M)', 'Fair Value (€M)', 'Undervaluation %', 'Goals', 'Assists', 'xGI/90', 'Contract Expiry'];
            const rows = allPlayers.map(p => [
                p.name,
                p.team,
                p.league,
                p.position,
                p.age,
                p.market_value_eur_m,
                p.fair_value_eur_m,
                p.undervaluation_pct,
                p.goals,
                p.assists,
                p.xgi_per_90,
                p.contract_expiry || 'N/A'
            ]);

            const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scoutlens-players-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            UI.showNotification('📥 CSV downloaded!');
        },

        // ============================================
        // PRICE ALERTS
        // ============================================

        setPriceAlert(playerId) {
            const player = this.findPlayer(playerId);
            if (!player || !player.id) {
                UI.showNotification('⚠️ Invalid player selected', 'error');
                return;
            }

            const currentValue = player.market_value_eur_m || 0;
            const defaultPrice = Math.max(0.1, Math.floor(currentValue * 0.8));
            const targetPriceInput = prompt(`Set alert when ${player.name || 'player'}'s value drops below (€M):`, defaultPrice);

            if (!targetPriceInput || targetPriceInput.trim() === '') {
                return; // User cancelled
            }

            const targetPrice = parseFloat(targetPriceInput.trim());

            // Validate input: must be a number, positive, and reasonable
            if (isNaN(targetPrice) || targetPrice <= 0 || targetPrice > 1000) {
                UI.showNotification('⚠️ Invalid price. Please enter a number between 0.1 and 1000 (€M)', 'error');
                return;
            }

            state.priceAlerts.push({
                playerId,
                playerName: player.name || 'Unknown',
                targetPrice: targetPrice,
                currentValue,
                createdAt: new Date().toISOString()
            });

            Security.storage.setItem('scoutlens_alerts', JSON.stringify(state.priceAlerts));
            UI.showNotification(`🔔 Alert set: ${player.name || 'Player'} < €${targetPrice}M`);
        },

        loadPriceAlerts() {
            const saved = Security.storage.getItem('scoutlens_alerts');
            if (saved) {
                try {
                    state.priceAlerts = JSON.parse(saved);
                } catch (e) {
                    console.warn('Invalid price alerts data, resetting');
                    Security.storage.removeItem('scoutlens_alerts');
                    state.priceAlerts = [];
                }
            }
        },

        // ============================================
        // EMAIL CAPTURE
        // ============================================

        showEmailCapture() {
            if (state.emailSubmitted) return '';

            return `
                <div class="email-capture">
                    <h3>📬 Weekly Hidden Gems Report</h3>
                    <p>Get the top 10 undervalued players delivered to your inbox every Monday.</p>
                    <form class="email-form" onsubmit="App.submitEmail(event)">
                        <input type="email" placeholder="your@email.com" required>
                        <button type="submit">Subscribe Free</button>
                    </form>
                </div>
            `;
        },

        submitEmail(e) {
            e.preventDefault();
            const email = e.target.querySelector('input').value.trim();

            // Validate email
            if (!Security.isValidEmail(email)) {
                UI.showNotification('⚠️ Please enter a valid email address', 'error');
                return;
            }

            // Store email (in production, send to your email service)
            Security.storage.setItem('scoutlens_email', Security.escapeHtml(email));
            state.emailSubmitted = true;

            // Hide the form
            document.querySelector('.email-capture')?.remove();

            UI.showNotification('✅ Subscribed! Check your inbox Monday.');

            // Log for later integration
            console.log('Email captured:', email);
        },

        // ============================================
        // PRO USER MANAGEMENT
        // ============================================

        checkProAccess() {
            // SECURITY: Pro access requires server-verified token in production
            // In development mode, allow client-side flag for testing
            if (IS_DEVELOPMENT) {
                return state.isPro;
            }
            // In production, only trust server-verified token
            return state.proToken !== null;
        },

        activatePro(email) {
            // SECURITY: In production, this should only be called after server verification
            // For now, only allow in development mode
            if (!IS_DEVELOPMENT) {
                UI.showNotification('⚠️ Pro activation requires server verification. Please contact support.', 'error');
                return;
            }

            state.isPro = true;
            state.proEmail = email;
            Security.storage.setItem('scoutlens_pro', JSON.stringify({
                isPro: true,
                email: email,
                activatedAt: new Date().toISOString()
            }));

            UI.showNotification('🎉 Pro activated! (Development mode only)');
            this.renderView(state.currentView);
            this.updateProBadge();
        },

        showProActivation() {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'pro-activate-modal';
            modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content" style="max-width:400px;padding:2rem;text-align:center;">
                    <button class="modal-close" style="position:absolute;top:10px;right:15px;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;min-width:44px;min-height:44px;">×</button>
                    <h2 style="margin-bottom:1rem;">🔓 Activate Pro</h2>
                    <p style="color:var(--text-secondary);margin-bottom:1.5rem;">Enter the email you used to purchase Pro access:</p>
                    <form data-action="verify-pro-email" style="display:flex;flex-direction:column;gap:1rem;">
                        <input type="email" placeholder="your@email.com" required style="padding:0.8rem;border:1px solid var(--border-default);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;">
                        <button type="submit" class="btn btn-primary" style="padding:0.8rem;">Activate Pro Access</button>
                    </form>
                    <p style="color:var(--text-muted);font-size:0.8rem;margin-top:1rem;">
                        Don't have Pro? <a href="#" data-action="upgrade" style="color:var(--accent-primary);">Upgrade now →</a>
                    </p>
                </div>
            `;
            document.body.appendChild(modal);
        },

        verifyProEmail(e) {
            e.preventDefault();
            const email = e.target.querySelector('input').value.trim();

            // Validate email format
            if (!Security.isValidEmail(email)) {
                UI.showNotification('⚠️ Please enter a valid email address', 'error');
                return;
            }

            // IMPORTANT: In production, verify against your payment provider:
            // 1. Send email to your server
            // 2. Server checks Stripe/PayPal for payment with this email
            // 3. Server returns verification token
            // 4. Only then activate Pro

            // SECURITY WARNING: This is client-side only verification and can be bypassed.
            // REPLACE THIS with actual server verification in production!
            // 
            // Required implementation:
            // 1. Send email to your server endpoint (e.g., /api/verify-pro)
            // 2. Server checks Stripe/PayPal API for active subscription with this email
            // 3. Server returns signed JWT token or session cookie
            // 4. Client stores token (not just a boolean flag)
            // 5. All Pro features verify token on server before serving content
            //
            // Current implementation is INSECURE and allows free access to Pro features.
            console.error('⚠️ SECURITY: Pro verification is client-side only. Implement server-side verification immediately.');

            // For now, we'll still activate but log the security issue
            // In production, remove this and require server verification
            this.activatePro(Security.escapeHtml(email));
            e.target.closest('.modal').remove();
        },

        updateProBadge() {
            const badge = document.getElementById('pro-badge');
            if (this.checkProAccess() && badge) {
                badge.style.display = 'flex';
            }
        },

        renderProGate() {
            if (this.checkProAccess()) return '';

            return `
                <div class="pro-gate" style="background:linear-gradient(135deg,rgba(251,191,36,0.1),rgba(0,212,170,0.1));border:2px solid var(--accent-gold);border-radius:12px;padding:2rem;text-align:center;margin:1rem 0;">
                    <h3 style="color:var(--accent-gold);margin-bottom:0.5rem;">🔒 Pro Content</h3>
                    <p style="color:var(--text-secondary);margin-bottom:1rem;">Unlock all players, export data, and get price alerts</p>
                    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                        <button data-action="upgrade" class="btn btn-primary">Upgrade to Pro</button>
                        <button data-action="show-pro-activation" class="btn btn-ghost">I already have Pro</button>
                    </div>
                </div>
            `;
        }
    };

    // Initialize on DOM ready or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            App.initSearch();
            App.loadPriceAlerts();
            App.init();
        });
    } else {
        App.initSearch();
        App.loadPriceAlerts();
        App.init();
    }

    // Expose App to window for global access
    window.App = App;
})();
