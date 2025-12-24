/**
 * ScoutLens - Undervalued Football Player Finder
 * Main Application Logic
 */

(function() {
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
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
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
        isPro: false,     // Pro user status
        proEmail: null    // Email for Pro access
    };
    
    // Load Pro status from localStorage
    const savedProStatus = localStorage.getItem('scoutlens_pro');
    if (savedProStatus) {
        const proData = JSON.parse(savedProStatus);
        state.isPro = proData.isPro;
        state.proEmail = proData.email;
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
            return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        },

        getColor(position) {
            const pos = position ? position[0].toUpperCase() : 'M';
            return this.colors[pos] || this.colors['M'];
        },

        render(name, position, size = 48) {
            const initials = this.getInitials(name);
            const color = this.getColor(position);
            const fontSize = size * 0.4;
            
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
                ">${initials}</div>
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
            // Check if this is a locked PRO player
            if (player.locked) {
                return this.renderLockedCard(player, index);
            }
            
            const isInWatchlist = state.watchlist.some(p => p.id === player.id);
            const undervalued = player.undervaluation_pct > 0;
            const hasReleaseClause = player.release_clause_eur_m && player.release_clause_eur_m > 0;
            const hasContractExpiry = player.contract_expiry;
            const isExpiring = player.contract_status === 'expiring';
            const isVerified = player.valuation_confidence === 'verified' || player.tm_verified;
            const confidence = player.valuation_confidence || (player.tm_verified ? 'verified' : 'estimated');
            const isHiddenGem = player.is_hidden_gem || player.league_tier >= 2;
            
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
                           onclick="event.stopPropagation(); App.toggleCompare(${player.id})" 
                           title="Add to comparison">
                    ${index !== null ? `<div class="player-rank">${index + 1}</div>` : ''}
                    
                    <div class="player-card-main">
                        ${Avatar.render(player.name, player.position, 48)}
                        
                        <div class="player-info">
                            <div class="player-name">${player.name} ${gemBadge}</div>
                            <div class="player-meta">
                                <span class="player-team">${player.team}</span>
                                <span class="player-league">${player.league}</span>
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
            const name = player.name || 'Hidden Player';
            const team = player.team || '???';
            const league = player.league || '???';
            
            return `
                <div class="player-card locked" onclick="App.showUpgrade()">
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
                <div class="upgrade-card" onclick="App.showUpgrade()" style="background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(0,212,170,0.1));border:2px dashed #fbbf24;border-radius:16px;padding:2rem;text-align:center;cursor:pointer;margin:1.5rem 0;transition:all 0.25s ease;">
                    <div class="upgrade-content">
                        <div class="upgrade-icon" style="font-size:2.5rem;margin-bottom:1rem;">🔓</div>
                        <h3 style="color:#fbbf24;font-size:1.3rem;margin-bottom:0.5rem;">Unlock All 150+ Players</h3>
                        <p style="color:#94a3b8;margin-bottom:1.5rem;">Full access to undervalued players, transfer fees, export reports & alerts</p>
                        <button class="btn btn-primary" style="background:#00d4aa;color:#000;padding:12px 24px;border:none;border-radius:8px;font-weight:600;font-size:1rem;cursor:pointer;">Upgrade to Pro - $9/mo</button>
                    </div>
                </div>
            `;
        },

        renderPlayerDetail(player) {
            const isInWatchlist = state.watchlist.some(p => p.id === player.id);
            const undervalued = player.undervaluation_pct > 0;
            
            return `
                <div class="player-detail">
                    <div class="player-detail-header">
                        ${Avatar.render(player.name, player.position, 80)}
                        <div class="player-detail-info">
                            <h2>${player.name}</h2>
                            <p>${player.team} · ${player.league}</p>
                            <div class="player-detail-tags">
                                <span class="tag">${Format.position(player.position)}</span>
                                <span class="tag">${player.age} years</span>
                                <span class="tag">${player.nationality}</span>
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
                                <span class="stat-box-value">${player.xgi_per_90.toFixed(2)}</span>
                                <span class="stat-box-label">xGI per 90</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.goals}</span>
                                <span class="stat-box-label">Goals</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.assists}</span>
                                <span class="stat-box-label">Assists</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.games}</span>
                                <span class="stat-box-label">Games</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.xG.toFixed(1)}</span>
                                <span class="stat-box-label">xG</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box-value">${player.xA.toFixed(1)}</span>
                                <span class="stat-box-label">xA</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="player-detail-actions">
                        <button class="btn btn-primary btn-lg watchlist-detail-btn" data-player-id="${player.id}">
                            ${isInWatchlist ? '★ In Watchlist' : '☆ Save to Watchlist'}
                        </button>
                        <button class="btn btn-ghost btn-lg share-btn" data-player="${encodeURIComponent(player.name)}">
                            📤 Share
                        </button>
                    </div>
                </div>
            `;
        },

        showNotification(message, type = 'info') {
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();
            
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = message;
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
    
    const App = {
        async init() {
            console.log('🔭 ScoutLens initializing...');
            
            // Check if user has visited before
            const hasVisited = localStorage.getItem('scoutlens_visited');
            if (!hasVisited) {
                // Show landing page for first-time visitors
                document.getElementById('landing').classList.remove('hidden');
                document.getElementById('app').classList.add('hidden');
                document.getElementById('loader').classList.add('hidden');
                return;
            }
            
            // Returning user - go straight to app
            this.enterApp();
        },
        
        enterApp() {
            // Hide landing, show app
            document.getElementById('landing')?.classList.add('hidden');
            document.getElementById('app')?.classList.remove('hidden');
            
            // Mark as visited
            localStorage.setItem('scoutlens_visited', 'true');
            
            // Continue initialization
            this.initApp();
        },
        
        async initApp() {
            console.log('🔭 Loading ScoutLens app...');
            
            this.loadState();
            this.bindEvents();
            
            // Render immediately with static data
            this.renderView('dashboard');
            this.showDataFreshness();
            
            // Register service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').catch(() => {});
            }
            
            // Hide loader
            setTimeout(() => {
                document.getElementById('loader').classList.add('fade-out');
                document.getElementById('app').classList.remove('hidden');
            }, 1200);
            
            // Try to fetch LIVE data in background (non-blocking)
            this.fetchLiveData();
            
            console.log('✅ ScoutLens ready');
        },
        
        async fetchLiveData() {
            // Try to fetch live data from API (non-blocking)
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
                }
            } catch (e) {
                console.log('📦 Using static data:', e.message || 'API timeout');
            }
        },
        
        getData() {
            // Return live data if available, otherwise static
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
                    badge.innerHTML = `<span class="freshness-dot"></span>${freshnessText}`;
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
                    
                    const dot = badge.querySelector('.freshness-dot');
                    if (dot) {
                        dot.style.cssText = `
                            width: 6px;
                            height: 6px;
                            border-radius: 50%;
                            background: currentColor;
                            ${freshnessClass !== 'old' ? 'animation: pulse 2s infinite;' : ''}
                        `;
                    }
                    
                    heroStats.parentNode.insertBefore(badge, heroStats.nextSibling);
                }
            }
        },

        loadState() {
            const saved = localStorage.getItem('scoutlens_watchlist');
            if (saved) {
                try {
                    state.watchlist = JSON.parse(saved);
                } catch (e) {
                    state.watchlist = [];
                }
            }
        },

        saveState() {
            localStorage.setItem('scoutlens_watchlist', JSON.stringify(state.watchlist));
        },

        bindEvents() {
            // Navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const view = e.currentTarget.dataset.view;
                    this.switchView(view);
                });
            });

            // Newsletter button
            document.getElementById('newsletter-btn')?.addEventListener('click', () => {
                this.openModal('newsletter-modal');
            });

            // Methodology link
            document.getElementById('methodology-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal('methodology-modal');
            });

            // Email forms
            document.querySelectorAll('#email-form-1, #email-form-2, .newsletter-form').forEach(form => {
                form.addEventListener('submit', (e) => this.handleEmailSubmit(e));
            });

            // Modal closes
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                });
            });

            document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                backdrop.addEventListener('click', () => {
                    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                });
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                }
            });

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
                
                // Upgrade card
                const upgradeCard = e.target.closest('.upgrade-card');
                if (upgradeCard) {
                    this.showUpgrade();
                }
                
                // Modal backdrop close
                const backdrop = e.target.closest('.modal-backdrop');
                if (backdrop) {
                    const modal = backdrop.closest('.modal');
                    if (modal) modal.remove();
                }
            };
            
            document.addEventListener('click', handleInteraction);
            document.addEventListener('touchend', handleInteraction, { passive: false });
        },

        switchView(viewId) {
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
            
            const data = this.getData();
            const allPlayers = data.free?.undervalued || data.undervalued || [];
            
            // FREE: Show only first 5
            const freePlayers = allPlayers.slice(0, 5);
            // PRO: Everything else is locked
            const proPlayers = allPlayers.slice(5);
            
            let html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
            
            // ALWAYS show upgrade card after free players
            html += UI.renderUpgradeCard();
            
            if (proPlayers.length > 0) {
                html += `<div class="pro-section-header">🔒 ${proPlayers.length} more undervalued players with Pro</div>`;
                // Show locked previews
                html += proPlayers.slice(0, 5).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
            }
            
            container.innerHTML = html;
        },

        renderPerformers() {
            const container = document.getElementById('performers-list');
            if (!container) return;
            
            const data = this.getData();
            const allPlayers = data.free?.topPerformers || data.topPerformers || [];
            
            const freePlayers = allPlayers.slice(0, 5);
            const proPlayers = allPlayers.slice(5);
            
            let html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
            
            if (proPlayers.length > 0) {
                html += `<div class="pro-section-header">🔒 ${proPlayers.length} more top performers with Pro</div>`;
                html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                html += UI.renderUpgradeCard();
            }
            
            container.innerHTML = html;
        },

        renderRising() {
            const container = document.getElementById('rising-list');
            if (!container) return;
            
            const data = this.getData();
            const allPlayers = data.free?.risingStars || data.risingStars || [];
            
            const freePlayers = allPlayers.slice(0, 5);
            const proPlayers = allPlayers.slice(5);
            
            let html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
            
            if (proPlayers.length > 0) {
                html += `<div class="pro-section-header">🔒 ${proPlayers.length} more rising stars with Pro</div>`;
                html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                html += UI.renderUpgradeCard();
            }
            
            container.innerHTML = html;
        },
        
        renderGems() {
            const container = document.getElementById('gems-list');
            if (!container) return;
            
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
            
            const freePlayers = allGems.slice(0, 5);
            const proPlayers = allGems.slice(5);
            
            let html = '';
            
            if (freePlayers.length === 0) {
                html = `
                    <div class="empty-state">
                        <span class="empty-state-icon">💎</span>
                        <h3>Hidden Gems Coming Soon</h3>
                        <p>We're adding Championship, Eredivisie, Portuguese & Brazilian league data.</p>
                    </div>
                `;
            } else {
                html = freePlayers.map((p, i) => UI.renderPlayerCard(p, i)).join('');
                
                if (proPlayers.length > 0) {
                    html += `<div class="pro-section-header">🔒 ${proPlayers.length} more hidden gems with Pro</div>`;
                    html += proPlayers.slice(0, 3).map((p, i) => UI.renderLockedCard(p, freePlayers.length + i)).join('');
                }
                
                html += UI.renderUpgradeCard();
            }
            
            container.innerHTML = html;
        },
        
        renderBargains() {
            const container = document.getElementById('bargains-list');
            if (!container) return;
            
            const data = this.getData();
            
            // Get players with expiring contracts
            let allBargains = [];
            
            if (data.bargains) {
                allBargains = data.bargains;
            } else if (data.expiringContracts) {
                allBargains = data.expiringContracts;
            } else {
                // Filter from all lists for players with contract_expiry
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
            
            // Remove duplicates and sort by value
            const seen = new Set();
            allBargains = allBargains.filter(p => {
                if (seen.has(p.name)) return false;
                seen.add(p.name);
                return true;
            }).sort((a, b) => (b.market_value_eur_m || 0) - (a.market_value_eur_m || 0));
            
            const freePlayers = allBargains.slice(0, 5);
            const proPlayers = allBargains.slice(5);
            
            let html = '';
            
            if (freePlayers.length === 0) {
                html = `
                    <div class="empty-state">
                        <span class="empty-state-icon">⏰</span>
                        <h3>Contract Data Coming Soon</h3>
                        <p>We're adding contract expiry dates to identify free transfer bargains.</p>
                    </div>
                `;
            } else {
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
            
            container.innerHTML = html;
        },
        
        renderRumors() {
            const container = document.getElementById('rumors-list');
            if (!container) return;
            
            // Transfer rumors data (in production, fetch from API)
            const rumors = [
                {
                    player: 'Mohamed Salah',
                    from: 'Liverpool',
                    to: 'Saudi Pro League / PSG',
                    fee: 'Free (contract expires 2025)',
                    status: 'hot',
                    source: 'Fabrizio Romano',
                    date: '2024-12-20'
                },
                {
                    player: 'Trent Alexander-Arnold',
                    from: 'Liverpool', 
                    to: 'Real Madrid',
                    fee: 'Free (contract expires 2025)',
                    status: 'hot',
                    source: 'Multiple Sources',
                    date: '2024-12-19'
                },
                {
                    player: 'Joshua Kimmich',
                    from: 'Bayern Munich',
                    to: 'Barcelona / Man City',
                    fee: 'Free (contract expires 2025)',
                    status: 'hot',
                    source: 'Sky Germany',
                    date: '2024-12-18'
                },
                {
                    player: 'Alphonso Davies',
                    from: 'Bayern Munich',
                    to: 'Real Madrid',
                    fee: 'Free (contract expires 2025)',
                    status: 'warm',
                    source: 'Marca',
                    date: '2024-12-17'
                },
                {
                    player: 'Viktor Gyökeres',
                    from: 'Sporting CP',
                    to: 'Arsenal / Man United / Chelsea',
                    fee: '€100M release clause',
                    status: 'hot',
                    source: 'Record Portugal',
                    date: '2024-12-16'
                },
                {
                    player: 'Florian Wirtz',
                    from: 'Bayer Leverkusen',
                    to: 'Real Madrid / Bayern',
                    fee: '€150M+',
                    status: 'warm',
                    source: 'Kicker',
                    date: '2024-12-15'
                },
                {
                    player: 'Omar Marmoush',
                    from: 'Eintracht Frankfurt',
                    to: 'Liverpool / Arsenal',
                    fee: '€40-50M',
                    status: 'warm',
                    source: 'Bild',
                    date: '2024-12-14'
                },
                {
                    player: 'Nico Williams',
                    from: 'Athletic Bilbao',
                    to: 'Barcelona / Chelsea',
                    fee: '€58M release clause',
                    status: 'warm',
                    source: 'Sport',
                    date: '2024-12-13'
                }
            ];
            
            let html = `
                <div class="email-capture" style="margin-bottom: 2rem;">
                    <h3>🔔 Get Transfer Alerts</h3>
                    <p>Be first to know when big transfers happen. Daily updates in your inbox.</p>
                    <form class="email-form" onsubmit="App.submitEmail(event)">
                        <input type="email" placeholder="your@email.com" required>
                        <button type="submit">Subscribe Free</button>
                    </form>
                </div>
            `;
            
            html += rumors.map(r => `
                <div class="rumor-card">
                    <div class="rumor-header">
                        <div>
                            <div class="rumor-player">${r.player}</div>
                            <div class="rumor-details">${r.from} → ${r.to}</div>
                        </div>
                        <span class="rumor-badge ${r.status}">${r.status === 'hot' ? '🔥 HOT' : '⚡ WARM'}</span>
                    </div>
                    <div class="rumor-details" style="margin-top: 0.5rem;">
                        <strong>Fee:</strong> ${r.fee}
                    </div>
                    <div class="rumor-source">
                        📰 ${r.source} • ${new Date(r.date).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
            
            html += `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <p>Want more rumors and exclusive transfer intel?</p>
                    <button class="btn btn-primary" onclick="App.showUpgrade()">
                        Upgrade to Pro →
                    </button>
                </div>
            `;
            
            container.innerHTML = html;
        },
        
        showUpgrade() {
            // PAYMENT OPTIONS - PayPal.me links
            const PAYPAL_USERNAME = 'MustafaAlpARI';
            const PAYPAL_MONTHLY = `https://paypal.me/${PAYPAL_USERNAME}/9.99`;
            const PAYPAL_ANNUAL = `https://paypal.me/${PAYPAL_USERNAME}/79`;
            
            // Or use Stripe if you prefer
            const STRIPE_MONTHLY = 'https://buy.stripe.com/test_monthly';
            const STRIPE_ANNUAL = 'https://buy.stripe.com/test_annual';
            
            // Choose payment provider (change to 'stripe' if using Stripe)
            const PAYMENT_PROVIDER = 'paypal';
            const MONTHLY_LINK = PAYMENT_PROVIDER === 'paypal' ? PAYPAL_MONTHLY : STRIPE_MONTHLY;
            const ANNUAL_LINK = PAYMENT_PROVIDER === 'paypal' ? PAYPAL_ANNUAL : STRIPE_ANNUAL;
            
            // Show upgrade modal
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'upgrade-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div class="modal-backdrop" onclick="this.parentElement.remove()" style="position:absolute;inset:0;background:rgba(0,0,0,0.8);"></div>
                <div class="modal-content upgrade-modal-content" style="position:relative;background:#151a21;border-radius:16px;max-width:480px;width:90%;max-height:90vh;overflow:auto;">
                    <button class="modal-close" onclick="this.closest('.modal').remove()" style="position:absolute;top:15px;right:15px;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">×</button>
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
                        
                        <div class="upgrade-pricing" style="display:flex;gap:1rem;margin-bottom:1.5rem;">
                            <a href="${MONTHLY_LINK}" target="_blank" rel="noopener" style="flex:1;background:#1c232d;border:2px solid #333;border-radius:10px;padding:1.5rem;cursor:pointer;transition:all 0.2s;text-decoration:none;display:block;touch-action:manipulation;">
                                <div style="font-size:2rem;font-weight:700;color:#f1f5f9;">$9<span style="font-size:0.9rem;font-weight:400;color:#94a3b8;">/mo</span></div>
                                <div style="color:#64748b;font-size:0.85rem;margin-top:0.25rem;">Monthly</div>
                            </a>
                            <a href="${ANNUAL_LINK}" target="_blank" rel="noopener" style="flex:1;background:linear-gradient(135deg,rgba(251,191,36,0.1),transparent);border:2px solid #fbbf24;border-radius:10px;padding:1.5rem;cursor:pointer;position:relative;text-decoration:none;display:block;touch-action:manipulation;">
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
        },

        renderWatchlist() {
            const container = document.getElementById('watchlist-list');
            if (!container) return;
            
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
            
            container.innerHTML = state.watchlist.map((p, i) => UI.renderPlayerCard(p, i)).join('');
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
                UI.showNotification(`Removed ${player.name} from watchlist`);
            } else {
                state.watchlist.push(player);
                UI.showNotification(`Saved ${player.name} to watchlist ★`);
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
            localStorage.setItem('scoutlens_email', email);
            
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
                navigator.share({ title: 'ScoutLens', text, url }).catch(() => {});
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
                    UI.showNotification('📋 Copied to clipboard!');
                });
            }
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
                    <button class="compare-btn" onclick="App.showComparison()" disabled>Compare</button>
                    <button class="btn btn-ghost" onclick="App.clearCompare()">Clear</button>
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
                <button class="compare-close-btn" onclick="App.closeComparison()">✕</button>
                <div class="compare-grid">
                    ${state.compareList.map(player => `
                        <div class="compare-card">
                            <h3>${player.name} ${player.is_hidden_gem ? '💎' : ''}</h3>
                            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">${player.team} • ${player.league}</p>
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
                searchInput.addEventListener('input', (e) => {
                    // Sanitize search input to prevent XSS
                    state.searchQuery = Security.sanitizeSearch(e.target.value);
                    this.renderView(state.currentView);
                });
            }
            
            // Filter range displays
            const ageRange = document.getElementById('filter-age');
            const valueRange = document.getElementById('filter-value');
            
            if (ageRange) {
                ageRange.addEventListener('input', (e) => {
                    document.getElementById('age-value').textContent = e.target.value;
                });
            }
            
            if (valueRange) {
                valueRange.addEventListener('input', (e) => {
                    document.getElementById('value-display').textContent = `€${e.target.value}M`;
                });
            }
        },
        
        toggleFilters() {
            const panel = document.getElementById('filter-panel');
            const btn = document.getElementById('filter-toggle');
            panel?.classList.toggle('hidden');
            btn?.classList.toggle('active');
        },
        
        applyFilters() {
            state.filters = {
                league: document.getElementById('filter-league')?.value || '',
                position: document.getElementById('filter-position')?.value || '',
                maxAge: parseInt(document.getElementById('filter-age')?.value) || 40,
                maxValue: parseInt(document.getElementById('filter-value')?.value) || 200,
                sortBy: document.getElementById('sort-by')?.value || 'undervaluation'
            };
            
            this.toggleFilters();
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
            document.getElementById('filter-league').value = '';
            document.getElementById('filter-position').value = '';
            document.getElementById('filter-age').value = 40;
            document.getElementById('filter-value').value = 200;
            document.getElementById('sort-by').value = 'undervaluation';
            document.getElementById('player-search').value = '';
            document.getElementById('age-value').textContent = '40';
            document.getElementById('value-display').textContent = '€200M';
            
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
                    p.league?.toLowerCase().includes(state.searchQuery)
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
            if (!player) return;
            
            const currentValue = player.market_value_eur_m || 0;
            const targetPrice = prompt(`Set alert when ${player.name}'s value drops below (€M):`, Math.floor(currentValue * 0.8));
            
            if (targetPrice && !isNaN(parseFloat(targetPrice))) {
                state.priceAlerts.push({
                    playerId,
                    playerName: player.name,
                    targetPrice: parseFloat(targetPrice),
                    currentValue,
                    createdAt: new Date().toISOString()
                });
                
                localStorage.setItem('scoutlens_alerts', JSON.stringify(state.priceAlerts));
                UI.showNotification(`🔔 Alert set: ${player.name} < €${targetPrice}M`);
            }
        },
        
        loadPriceAlerts() {
            const saved = localStorage.getItem('scoutlens_alerts');
            if (saved) {
                state.priceAlerts = JSON.parse(saved);
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
            localStorage.setItem('scoutlens_email', Security.escapeHtml(email));
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
            return state.isPro;
        },
        
        activatePro(email) {
            state.isPro = true;
            state.proEmail = email;
            localStorage.setItem('scoutlens_pro', JSON.stringify({
                isPro: true,
                email: email,
                activatedAt: new Date().toISOString()
            }));
            
            UI.showNotification('🎉 Pro activated! Enjoy unlimited access.');
            this.renderView(state.currentView);
            this.updateProBadge();
        },
        
        showProActivation() {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'pro-activate-modal';
            modal.innerHTML = `
                <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
                <div class="modal-content" style="max-width:400px;padding:2rem;text-align:center;">
                    <button onclick="this.closest('.modal').remove()" style="position:absolute;top:10px;right:15px;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;">×</button>
                    <h2 style="margin-bottom:1rem;">🔓 Activate Pro</h2>
                    <p style="color:var(--text-secondary);margin-bottom:1.5rem;">Enter the email you used to purchase Pro access:</p>
                    <form onsubmit="App.verifyProEmail(event)" style="display:flex;flex-direction:column;gap:1rem;">
                        <input type="email" placeholder="your@email.com" required style="padding:0.8rem;border:1px solid var(--border-default);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:1rem;">
                        <button type="submit" class="btn btn-primary" style="padding:0.8rem;">Activate Pro Access</button>
                    </form>
                    <p style="color:var(--text-muted);font-size:0.8rem;margin-top:1rem;">
                        Don't have Pro? <a href="#" onclick="App.showUpgrade();this.closest('.modal').remove();" style="color:var(--accent-primary);">Upgrade now →</a>
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
            
            // For demo purposes, we'll activate
            // REPLACE THIS with actual server verification in production!
            console.warn('⚠️ Pro verification is in demo mode. Implement server-side verification for production.');
            
            this.activatePro(Security.escapeHtml(email));
            e.target.closest('.modal').remove();
        },
        
        updateProBadge() {
            const badge = document.getElementById('pro-badge');
            if (state.isPro && badge) {
                badge.style.display = 'flex';
            }
        },
        
        renderProGate() {
            if (state.isPro) return '';
            
            return `
                <div class="pro-gate" style="background:linear-gradient(135deg,rgba(251,191,36,0.1),rgba(0,212,170,0.1));border:2px solid var(--accent-gold);border-radius:12px;padding:2rem;text-align:center;margin:1rem 0;">
                    <h3 style="color:var(--accent-gold);margin-bottom:0.5rem;">🔒 Pro Content</h3>
                    <p style="color:var(--text-secondary);margin-bottom:1rem;">Unlock all players, export data, and get price alerts</p>
                    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                        <button onclick="App.showUpgrade()" class="btn btn-primary">Upgrade to Pro</button>
                        <button onclick="App.showProActivation()" class="btn btn-ghost">I already have Pro</button>
                    </div>
                </div>
            `;
        }
    };
    
    // Initialize search on load
    document.addEventListener('DOMContentLoaded', () => {
        App.initSearch();
        App.loadPriceAlerts();
    });

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => App.init());
})();
