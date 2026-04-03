import './Spotify.css';

const CLIENT_ID    = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const SCOPES = 'user-read-private playlist-read-private playlist-read-collaborative';

export default class Spotify {
    #panel;
    #token = null;

    constructor() {
        this.#panel = document.createElement('div');
        this.#panel.id = 'spotify-panel';
        document.body.appendChild(this.#panel);

        this.#applyVisibility();

        this.#handleCallback().then(() => {
            this.#token = this.#getStoredToken();
            this.#render();
        });

        window.addEventListener('settings-saved', () => this.#applyVisibility());
    }

    #applyVisibility() {
        const accounts = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account = accounts.find(a => a.name === currentName);
        const show = (account?.settings?.showSpotifyPlaylist ?? 'true') === 'true';
        this.#panel.style.display = show ? '' : 'none';
    }

    // ── OAuth callback ────────────────────────────────────────────────────────

    async #handleCallback() {
        const params   = new URLSearchParams(window.location.search);
        const code     = params.get('code');
        const verifier = sessionStorage.getItem('spotify_pkce_verifier');
        if (!code || !verifier) return;

        // Clean URL immediately
        window.history.replaceState({}, '', window.location.pathname);

        const res = await fetch('https://accounts.spotify.com/api/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                redirect_uri:  REDIRECT_URI,
                client_id:     CLIENT_ID,
                code_verifier: verifier,
            }),
        });

        const data = await res.json();
        if (data.access_token) {
            localStorage.setItem('spotify_token',  data.access_token);
            localStorage.setItem('spotify_expiry', Date.now() + data.expires_in * 1000);
            sessionStorage.removeItem('spotify_pkce_verifier');
        }
    }

    // ── PKCE ──────────────────────────────────────────────────────────────────

    async #login() {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        const verifier = btoa(String.fromCharCode(...arr))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const data   = new TextEncoder().encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        sessionStorage.setItem('spotify_pkce_verifier', verifier);

        window.location.href = `https://accounts.spotify.com/authorize?` + new URLSearchParams({
            client_id:             CLIENT_ID,
            response_type:         'code',
            redirect_uri:          REDIRECT_URI,
            scope:                 SCOPES,
            code_challenge_method: 'S256',
            code_challenge:        challenge,
        });
    }

    // ── Token ─────────────────────────────────────────────────────────────────

    #getStoredToken() {
        const expiry = localStorage.getItem('spotify_expiry');
        if (!expiry || Date.now() > parseInt(expiry, 10)) {
            localStorage.removeItem('spotify_token');
            localStorage.removeItem('spotify_expiry');
            return null;
        }
        return localStorage.getItem('spotify_token');
    }

    #logout() {
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_expiry');
        this.#token = null;
        this.#render();
    }

    // ── API ───────────────────────────────────────────────────────────────────

    async #get(url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.#token}` },
        });
        if (res.status === 401) { this.#logout(); return null; }
        return res.ok ? res.json() : null;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    async #render() {
        if (!this.#token) {
            this.#renderLogin();
            return;
        }

        this.#panel.innerHTML = `<div class="spotify-loading"><span></span><span></span><span></span></div>`;

        const [profile, data] = await Promise.all([
            this.#get('https://api.spotify.com/v1/me'),
            this.#get('https://api.spotify.com/v1/me/playlists?limit=50'),
        ]);

        if (!profile) return;
        this.#renderApp(profile, data?.items ?? []);
    }

    #renderLogin() {
        this.#panel.innerHTML = `
            <div class="spotify-header">
                <span class="spotify-username" style="color: #1DB954; font-weight: bold;">Spotify</span>
                <button class="spotify-collapse-btn" title="Collapse">−</button>
            </div>
            <div class="spotify-body">
                <div class="spotify-login">
                    <svg class="spotify-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    <p>Connect Spotify to play your playlists while working</p>
                    <button class="spotify-login-btn">Connect</button>
                </div>
            </div>
        `;
        this.#panel.querySelector('.spotify-login-btn')
            .addEventListener('click', () => this.#login());

        const collapseBtn = this.#panel.querySelector('.spotify-collapse-btn');
        collapseBtn.addEventListener('click', () => {
            const collapsed = this.#panel.classList.toggle('collapsed');
            collapseBtn.textContent = collapsed ? '+' : '−';
        });
    }

    #renderApp(profile, playlists) {
        this.#panel.innerHTML = `
            <div class="spotify-header">
                ${profile.images?.[0]?.url
                    ? `<img src="${profile.images[0].url}" class="spotify-avatar" />`
                    : `<div class="spotify-avatar spotify-avatar--empty"></div>`
                }
                <span class="spotify-username">${profile.display_name}</span>
                <button class="spotify-collapse-btn" title="Collapse">−</button>
                <button class="spotify-logout-btn">Disconnect</button>
            </div>
            <div class="spotify-body">
                <div class="spotify-playlist-list">
                    ${playlists.map(p => `
                        <div class="spotify-playlist-item" data-id="${p.id}">
                            ${p.images?.[0]?.url
                                ? `<img src="${p.images[0].url}" class="spotify-playlist-thumb" />`
                                : `<div class="spotify-playlist-thumb spotify-playlist-thumb--empty"></div>`
                            }
                            <span>${p.name}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="spotify-player"></div>
            </div>
        `;

        this.#panel.querySelectorAll('.spotify-playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                this.#panel.querySelectorAll('.spotify-playlist-item')
                    .forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.#embed(item.dataset.id);
            });
        });

        this.#panel.querySelector('.spotify-logout-btn')
            .addEventListener('click', () => this.#logout());

        const collapseBtn = this.#panel.querySelector('.spotify-collapse-btn');
        collapseBtn.addEventListener('click', () => {
            const collapsed = this.#panel.classList.toggle('collapsed');
            collapseBtn.textContent = collapsed ? '+' : '−';
        });

        this.#panel.querySelector('.spotify-playlist-item')?.click();
    }

    #embed(playlistId) {
        this.#panel.querySelector('.spotify-player').innerHTML = `
            <iframe
                src="https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0"
                width="100%"
                height="160"
                frameborder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
            ></iframe>
        `;
    }
}
