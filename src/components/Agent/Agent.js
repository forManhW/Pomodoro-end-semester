import './Agent.css';
import { marked } from 'marked';

marked.setOptions({ breaks: true });

const IDLE_ANIMS = [
    { cls: 'idle-blink',  dur: 500  },
    { cls: 'idle-bounce', dur: 700  },
    { cls: 'idle-wiggle', dur: 900  },
    { cls: 'idle-spin',   dur: 800  },
    { cls: 'idle-pulse',  dur: 700  },
    { cls: 'idle-look',   dur: 1400 },
    { cls: 'idle-float',  dur: 1100 },
    { cls: 'idle-dizzy',  dur: 1000 },
];

const FACE_MESSAGES = {
    pomodoro: [
        'Pomodoro done! Take a breather 🍅',
        'Crushed it! Rest up 💪',
        'Great focus! Break time!',
        'One more down! You rock 🎉',
        'Awesome work! You earned it!',
    ],
    short: [
        "Break over — back to it! 💪",
        'Ready to focus again?',
        "Let's go! Time to grind!",
    ],
    long: [
        "Long break over! You got this!",
        'Rested up? Let\'s crush it!',
        'Back to the grind! 🔥',
    ],
};

export default class Agent {
    #panel;
    #messagesEl;
    #inputEl;
    #bubbleEl;
    #bubbleTimer = null;
    #idleTimer   = null;
    #idlePlaying = false;
    #apiKey = null;
    #history = []; // { role, content }

    constructor() {
        this.#apiKey = this.#loadKey();
        if (this.#apiKey) this.#build();

        window.addEventListener('mousemove', (e) => {
            this.#trackEyes(e);
            this.#resetIdleTimer();
        });
        window.addEventListener('pomodoro-session-end', (e) => {
            if (this.#panel) this.#celebrate(e.detail?.mode);
        });

        window.addEventListener('settings-saved', () => {
            const newKey = this.#loadKey();
            if (newKey && !this.#panel) {
                this.#apiKey = newKey;
                this.#history = [];
                this.#build();
            } else if (!newKey && this.#panel) {
                this.#panel.remove();
                this.#panel = null;
            }
        });
    }

    // ── Key ───────────────────────────────────────────────────────────────────

    #loadKey() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        return accounts.find(a => a.name === currentName)?.settings?.groqApiKey || null;
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    #build() {
        this.#panel = document.createElement('div');
        this.#panel.id = 'agent-panel';
        this.#panel.innerHTML = `
            <div class="agent-bubble" id="agent-bubble"></div>
            <div class="agent-fab" id="agent-fab" title="AI Assistant">
                <svg class="agent-face" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                    <!-- cheeks -->
                    <ellipse cx="9"  cy="29" rx="6" ry="4" fill="rgba(255,130,130,0.35)"/>
                    <ellipse cx="43" cy="29" rx="6" ry="4" fill="rgba(255,130,130,0.35)"/>
                    <!-- left eye -->
                    <ellipse class="eye-white" cx="16" cy="20" rx="7" ry="8" fill="rgba(255,255,255,0.95)"/>
                    <circle  class="eye-pupil" id="agent-pupil-left"  cx="16" cy="21" r="4"   fill="#1a1a1a"/>
                    <circle cx="13.5" cy="18"   r="1.8" fill="white"/>
                    <circle cx="18.5" cy="23.5" r="0.9" fill="rgba(255,255,255,0.6)"/>
                    <!-- right eye -->
                    <ellipse class="eye-white" cx="36" cy="20" rx="7" ry="8" fill="rgba(255,255,255,0.95)"/>
                    <circle  class="eye-pupil" id="agent-pupil-right" cx="36" cy="21" r="4"   fill="#1a1a1a"/>
                    <circle cx="33.5" cy="18"   r="1.8" fill="white"/>
                    <circle cx="38.5" cy="23.5" r="0.9" fill="rgba(255,255,255,0.6)"/>
                    <!-- mouth -->
                    <path id="agent-face-mouth" d="M22 34 L30 34" stroke="white" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                </svg>
            </div>
            <div class="agent-popup">
                <div class="agent-header">
                    <span class="agent-title">AI Assistant</span>
                    <div class="agent-header-actions">
                        <button class="agent-clear-btn" title="Clear chat">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="agent-collapse-btn" title="Collapse chat">
                            <svg class="agent-collapse-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 9l-7 7-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="agent-delete-btn" title="Remove AI assistant">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="agent-body">
                    <div class="agent-messages"></div>
                    <div class="agent-input-row">
                        <textarea class="agent-input" placeholder="Ask me anything..." rows="1"></textarea>
                        <button class="agent-send-btn">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.#panel);

        this.#messagesEl = this.#panel.querySelector('.agent-messages');
        this.#inputEl    = this.#panel.querySelector('.agent-input');
        this.#bubbleEl   = this.#panel.querySelector('#agent-bubble');

        const fabEl = this.#panel.querySelector('#agent-fab');
        fabEl.addEventListener('click', () => this.#toggle());
        fabEl.addEventListener('mouseenter', () => this.#setExpression('hover'));
        fabEl.addEventListener('mouseleave', () => this.#setExpression('normal'));

        this.#panel.querySelector('.agent-send-btn')
            .addEventListener('click', () => this.#send());

        this.#panel.querySelector('.agent-clear-btn')
            .addEventListener('click', () => this.#clearChat());

        this.#panel.querySelector('.agent-collapse-btn')
            .addEventListener('click', () => this.#toggle());

        this.#panel.querySelector('.agent-delete-btn')
            .addEventListener('click', () => this.#delete());

        this.#inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.#send();
            }
        });

        // Auto-resize textarea
        this.#inputEl.addEventListener('input', () => {
            this.#inputEl.style.height = 'auto';
            this.#inputEl.style.height = `${Math.min(this.#inputEl.scrollHeight, 120)}px`;
        });

        this.#addMessage('assistant', 'Hi! I\'m your AI assistant. How can I help you stay focused today?');
        this.#resetIdleTimer();
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    #toggle() {
        this.#panel.classList.toggle('open');
    }


    #clearChat() {
        this.#history = [];
        this.#messagesEl.innerHTML = '';
        this.#addMessage('assistant', 'Chat cleared. How can I help you?');
    }

    #delete() {
        // Remove key from current account settings
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        if (account?.settings) {
            account.settings.groqApiKey = '';
            localStorage.setItem('accounts', JSON.stringify(accounts));
        }
        this.#panel.remove();
        this.#panel = null;
    }

    // ── Face ──────────────────────────────────────────────────────────────────

    #trackEyes(e) {
        if (!this.#panel || this.#idlePlaying) return;
        const fab  = this.#panel.querySelector('#agent-fab');
        const rect = fab.getBoundingClientRect();
        const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2),
                                 e.clientX - (rect.left + rect.width  / 2));
        const r  = 2.5;
        const ox = +(Math.cos(angle) * r).toFixed(2);
        const oy = +(Math.sin(angle) * r).toFixed(2);
        this.#panel.querySelector('#agent-pupil-left').setAttribute('cx',  16 + ox);
        this.#panel.querySelector('#agent-pupil-left').setAttribute('cy',  21 + oy);
        this.#panel.querySelector('#agent-pupil-right').setAttribute('cx', 36 + ox);
        this.#panel.querySelector('#agent-pupil-right').setAttribute('cy', 21 + oy);
    }

    #setExpression(type) {
        if (!this.#panel) return;
        const paths = {
            normal:    'M22 34 L30 34',
            hover:     'M22 34 Q26 38 30 34',
            celebrate: 'M17 32 Q26 41 35 32',
        };
        this.#panel.querySelector('#agent-face-mouth')
            .setAttribute('d', paths[type] ?? paths.normal);
    }

    #resetIdleTimer() {
        if (!this.#panel) return;
        clearTimeout(this.#idleTimer);
        this.#idleTimer = setTimeout(() => this.#playIdleAnim(), 5000);
    }

    #playIdleAnim() {
        if (!this.#panel || this.#idlePlaying) return;
        this.#idlePlaying = true;
        const pick = IDLE_ANIMS[Math.floor(Math.random() * IDLE_ANIMS.length)];
        const fab  = this.#panel.querySelector('#agent-fab');
        fab.classList.add(`agent-fab--${pick.cls}`);
        setTimeout(() => {
            if (!this.#panel) return;
            fab.classList.remove(`agent-fab--${pick.cls}`);
            this.#idlePlaying = false;
            this.#idleTimer = setTimeout(() => this.#playIdleAnim(), 1500 + Math.random() * 3000);
        }, pick.dur);
    }

    #celebrate(mode) {
        if (!this.#panel) return;
        this.#setExpression('celebrate');
        const fab = this.#panel.querySelector('#agent-fab');
        fab.classList.add('agent-fab--celebrating');
        fab.addEventListener('animationend', () => {
            fab.classList.remove('agent-fab--celebrating');
            this.#setExpression('normal');
        }, { once: true });

        const pool = FACE_MESSAGES[mode] ?? FACE_MESSAGES.pomodoro;
        this.#speak(pool[Math.floor(Math.random() * pool.length)]);
    }

    #speak(text, duration = 4000) {
        if (!this.#bubbleEl) return;
        if (this.#bubbleTimer) clearTimeout(this.#bubbleTimer);
        this.#bubbleEl.textContent = text;
        this.#bubbleEl.classList.remove('visible');
        void this.#bubbleEl.offsetWidth; // force reflow to restart transition
        this.#bubbleEl.classList.add('visible');
        this.#bubbleTimer = setTimeout(() => {
            this.#bubbleEl.classList.remove('visible');
            this.#bubbleTimer = null;
        }, duration);
    }

    // ── Chat ──────────────────────────────────────────────────────────────────

    async #send() {
        const text = this.#inputEl.value.trim();
        if (!text) return;

        this.#inputEl.value = '';
        this.#inputEl.style.height = 'auto';
        this.#addMessage('user', text);
        this.#history.push({ role: 'user', content: text });

        const typingEl = this.#addMessage('assistant', '…', true);

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${this.#apiKey.replace(/[^\x20-\x7E]/g, '')}`,
                },
                body: JSON.stringify({
                    model:    'llama-3.3-70b-versatile',
                    messages: this.#history,
                    stream:   true,
                }),
            });

            if (!res.ok) throw new Error(res.statusText);

            typingEl.classList.remove('agent-msg--typing');
            typingEl.textContent = '';

            let reply = '';
            let buffer = '';
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // hold incomplete last line for next chunk

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') break;

                    try {
                        const chunk = JSON.parse(payload);
                        const token = chunk.choices?.[0]?.delta?.content ?? '';
                        if (!token) continue;
                        reply += token;
                        typingEl.innerHTML = marked.parse(reply);
                        this.#messagesEl.scrollTop = this.#messagesEl.scrollHeight;
                    } catch { /* skip malformed chunk */ }
                }
            }

            this.#history.push({ role: 'assistant', content: reply });
        } catch (error) {
            console.error('Error:', error);
            typingEl.textContent = 'Error reaching Groq. Check your API key.';
            typingEl.classList.add('agent-msg--error');
        }

        this.#messagesEl.scrollTop = this.#messagesEl.scrollHeight;
    }

    #addMessage(role, text, isTyping = false) {
        const msg = document.createElement('div');
        msg.classList.add('agent-msg', `agent-msg--${role}`);
        if (isTyping) {
            msg.classList.add('agent-msg--typing');
            msg.textContent = text;
        } else {
            msg.innerHTML = marked.parse(text);
        }
        this.#messagesEl.appendChild(msg);
        this.#messagesEl.scrollTop = this.#messagesEl.scrollHeight;
        return msg;
    }
}
