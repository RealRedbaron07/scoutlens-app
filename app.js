/**
 * ScoutLens - Undervalued Football Player Finder
 * Main Application Logic
 */

(function() {
    'use strict';

    // ============================================
    // STATE
    // ============================================
    const state = {
        currentView: 'dashboard',
        watchlist: [],
        emailSubmitted: false
    };

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
            const hasTransferFee = player.transfer_fee_paid_eur_m > 0;
            const isFromTM = player.value_source === 'transfermarkt';
            
            return `
                <div class="player-card ${undervalued ? 'undervalued' : ''}" data-player-id="${player.id}">
                    ${index !== null ? `<div class="player-rank">${index + 1}</div>` : ''}
                    
                    <div class="player-card-main">
                        ${Avatar.render(player.name, player.position, 48)}
                        
                        <div class="player-info">
                            <div class="player-name">${player.name}</div>
                            <div class="player-meta">
                                <span class="player-team">${player.team}</span>
                                <span class="player-league">${player.league}</span>
                                ${isFromTM ? '<span class="tm-badge" title="Transfermarkt verified">TM</span>' : ''}
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
                        ${hasTransferFee ? `
                        <div class="player-stat">
                            <span class="stat-value">${Format.value(player.transfer_fee_paid_eur_m)}</span>
                            <span class="stat-label">Paid</span>
                        </div>
                        ` : `
                        <div class="player-stat">
                            <span class="stat-value">${player.xgi_per_90.toFixed(2)}</span>
                            <span class="stat-label">xGI/90</span>
                        </div>
                        `}
                        <div class="player-stat">
                            <span class="stat-value">${player.goals}G ${player.assists}A</span>
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

            // Delegated events
            document.addEventListener('click', (e) => {
                // Player card click
                const card = e.target.closest('.player-card');
                if (card && !e.target.closest('.player-save-btn')) {
                    const playerId = parseInt(card.dataset.playerId);
                    this.showPlayerDetail(playerId);
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
            });
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
        
        showUpgrade() {
            // STRIPE PAYMENT LINKS - Replace these with your actual Stripe links
            const STRIPE_MONTHLY = 'https://buy.stripe.com/test_monthly'; // Replace with real link
            const STRIPE_ANNUAL = 'https://buy.stripe.com/test_annual';   // Replace with real link
            
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
                            <div onclick="window.open('${STRIPE_MONTHLY}', '_blank')" style="flex:1;background:#1c232d;border:2px solid #333;border-radius:10px;padding:1.5rem;cursor:pointer;transition:all 0.2s;">
                                <div style="font-size:2rem;font-weight:700;color:#f1f5f9;">$9<span style="font-size:0.9rem;font-weight:400;color:#94a3b8;">/mo</span></div>
                                <div style="color:#64748b;font-size:0.85rem;margin-top:0.25rem;">Monthly</div>
                            </div>
                            <div onclick="window.open('${STRIPE_ANNUAL}', '_blank')" style="flex:1;background:linear-gradient(135deg,rgba(251,191,36,0.1),transparent);border:2px solid #fbbf24;border-radius:10px;padding:1.5rem;cursor:pointer;position:relative;">
                                <div style="position:absolute;top:-10px;right:10px;background:#fbbf24;color:#000;font-size:0.7rem;padding:3px 8px;border-radius:10px;font-weight:700;">BEST VALUE</div>
                                <div style="font-size:2rem;font-weight:700;color:#f1f5f9;">$72<span style="font-size:0.9rem;font-weight:400;color:#94a3b8;">/yr</span></div>
                                <div style="color:#fbbf24;font-size:0.85rem;margin-top:0.25rem;">$6/mo - Save 33%</div>
                            </div>
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
        }
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => App.init());
})();
