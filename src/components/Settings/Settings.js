import './Settings.css';
import Toggle from '../ToggleBtn/ToggleBtn';
import Tomato from '../../assets/images/tomato.svg';
import Close from '../../assets/images/Close.svg';
import chime from '../../assets/sounds/chime.mp3';
import lofi  from '../../assets/sounds/lofi.mp3';
import bell  from '../../assets/sounds/bell.mp3';

export default class Settings {
    #settingsContainer;
    #settingsContent;
    #currentSetting = 'general';
    #draft = {};   // in-memory working copy — only written to localStorage on Save

    #settingKeys = [
        'endTimerNotification',
        'showSpotifyPlaylist',
        'pomodoroMinutes',
        'shortBreakMinutes',
        'longBreakMinutes',
        'usePomodoroSequence',
        'soundsAlertSound',
        'playSoundWhenTimerFinish',
        'alertVolume',
        'groqApiKey',
        'customSounds',
        'endlessMode',
        'dailyProgressGoal',
    ];

    #defaults = {
        account: {
            name:     'guest',
            password: '',
        },
        endTimerNotification:     'true',
        showSpotifyPlaylist:      'true',
        pomodoroMinutes:          '25',
        shortBreakMinutes:        '5',
        longBreakMinutes:         '15',
        usePomodoroSequence:      'true',
        soundsAlertSound:         'Lofi',
        playSoundWhenTimerFinish: 'true',
        alertVolume:              '50',
        groqApiKey:             '',
        customSounds:             '{}',
        endlessMode:              'false',
        dailyProgressGoal:        '10',
    };

    /**
     * @param {HTMLElement|null} container  Mount target. Defaults to the first
     *   `.settings-container` element in the document (the popup on most pages).
     *   Pass an explicit element to mount inline (e.g. the settings page's <main>).
     */
    constructor(container = null) {
        this.#init(container);
    }

    #init(container = null) {
        this.#initLocalStorage();

        this.#settingsContainer = container ?? document.querySelector('.settings-container');

        this.#settingsContainer.innerHTML = `
            <div class="settings-content-container">
                <div class="settings-menu">
                    <div id="general"  class="settings-menu-item active-menu"><img src="${Tomato}" alt="Tomato" />General</div>
                    <div id="timers"   class="settings-menu-item"><img src="${Tomato}" alt="Tomato" />Timers</div>
                    <div id="sounds"   class="settings-menu-item"><img src="${Tomato}" alt="Tomato" />Sounds</div>
                    <div id="accounts" class="settings-menu-item"><img src="${Tomato}" alt="Tomato" />Accounts</div>
                    <div id="agent"    class="settings-menu-item"><img src="${Tomato}" alt="Tomato" />AI Agent</div>
                </div>
                <div class="settings-content"></div>
            </div>
            <div class="settings-actions">
                <button class="settings-reset-btn">Reset all</button>
                <div>
                    <button class="settings-save-btn">Save changes</button>
                </div>
            </div>
        `;

        this.#settingsContent = this.#settingsContainer.querySelector('.settings-content');

        this.#settingsContainer.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => this.#navigate(item.id));
        });

        this.#settingsContainer.querySelector('.settings-reset-btn')
            .addEventListener('click', () => this.#resetAll());

        const saveBtn = this.#settingsContainer.querySelector('.settings-save-btn');
        saveBtn.addEventListener('click', () => {
            this.#saveCurrentAccount();
            saveBtn.textContent = 'Saved';
            saveBtn.disabled = true;
            setTimeout(() => {
                saveBtn.textContent = 'Save changes';
                saveBtn.disabled = false;
            }, 1000);
        });

        this.#navigate('general');
    }

    // ── localStorage ─────────────────────────────────────────────────────────

    #initLocalStorage() {
        try { JSON.parse(localStorage.getItem('accounts')); } catch {
            localStorage.removeItem('accounts');
        }

        if (!localStorage.getItem('accounts')) {
            const guest = this.#buildAccountObject(
                this.#defaults.account.name,
                this.#defaults.account.password,
                this.#defaultSettings()
            );
            localStorage.setItem('accounts', JSON.stringify([guest]));
        }

        if (!localStorage.getItem('currentAccount')) {
            localStorage.setItem('currentAccount', this.#defaults.account.name);
        }

        this.#loadDraft();
        this.#migrateOldFlatKeys();
    }

    /** One-time migration: if old flat keys exist, pull them into the account then delete them. */
    #migrateOldFlatKeys() {
        let migrated = false;
        this.#settingKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                this.#draft[key] = value;
                localStorage.removeItem(key);
                migrated = true;
            }
        });
        if (migrated) this.#saveCurrentAccount();
    }

    #defaultSettings() {
        return Object.fromEntries(
            this.#settingKeys.map(k => [k, this.#defaults[k]])
        );
    }

    #buildAccountObject(name, password, settings) {
        return { name, password, settings };
    }

    #getAccounts() {
        return JSON.parse(localStorage.getItem('accounts') ?? '[]');
    }

    #getCurrentAccountName() {
        return localStorage.getItem('currentAccount') ?? this.#defaults.account.name;
    }

    /** Loads the current account's settings into the in-memory draft. */
    #loadDraft() {
        const account = this.#getAccounts().find(a => a.name === this.#getCurrentAccountName());
        // Merge defaults so new keys added later are always present
        this.#draft = { ...this.#defaultSettings(), ...account?.settings };
    }

    /** Commits the in-memory draft to the current account object in localStorage. */
    #saveCurrentAccount() {
        const accounts = this.#getAccounts();
        const account = accounts.find(a => a.name === this.#getCurrentAccountName());
        if (!account) return;

        account.settings = { ...this.#draft };
        localStorage.setItem('accounts', JSON.stringify(accounts));
        window.dispatchEvent(new CustomEvent('settings-saved'));
    }

    /** Called by Header whenever the popup is opened — resets draft to last saved state. */
    reload() {
        this.#loadDraft();
        this.#navigate(this.#currentSetting);
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    #navigate(id) {
        this.#currentSetting = id;

        this.#settingsContainer.querySelectorAll('.settings-menu-item').forEach(item => {
            item.classList.toggle('active-menu', item.id === id);
        });

        const contentMap = {
            general:  () => this.#renderGeneral(),
            timers:   () => this.#renderTimers(),
            sounds:   () => this.#renderSounds(),
            accounts: () => this.#renderAccounts(),
            agent:    () => this.#renderAIAgent(),
        };

        this.#settingsContent.innerHTML = '';
        contentMap[id]?.();
    }

    // ── Section renderers ─────────────────────────────────────────────────────

    #renderGeneral() {
        [
            { label: 'End timer notification', key: 'endTimerNotification' },
            { label: 'Show Spotify playlist',  key: 'showSpotifyPlaylist'  },
        ].forEach(({ label, key }) => {
            this.#settingsContent.appendChild(this.#createToggleRow(label, key));
        });

        this.#settingsContent.appendChild(
            this.#createRow('Daily progress goal', this.#createNumberInput('dailyProgressGoal', 4, 20))
        );
    }

    #renderTimers() {
        [
            { label: 'Pomodoro (minutes)',    key: 'pomodoroMinutes',   min: 15, max: 60 },
            { label: 'Short break (minutes)', key: 'shortBreakMinutes', min: 5,  max: 10 },
            { label: 'Long break (minutes)',  key: 'longBreakMinutes',  min: 15, max: 20 },
        ].forEach(({ label, key, min, max }) => {
            this.#settingsContent.appendChild(
                this.#createRow(label, this.#createNumberInput(key, min, max))
            );
        });

        this.#settingsContent.appendChild(
            this.#createModeSelector()
        );
    }

    #renderSounds() {
        const builtInOptions = ['Lofi', 'Bell', 'Chime', 'None'];
        const customSounds = JSON.parse(this.#draft['customSounds'] ?? '{}');

        const select = document.createElement('select');
        select.classList.add('settings-select');

        builtInOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            option.selected = this.#draft['soundsAlertSound'] === opt;
            select.appendChild(option);
        });

        Object.keys(customSounds).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            option.selected = this.#draft['soundsAlertSound'] === name;
            select.insertBefore(option, select.lastElementChild); // before 'None'
        });

        select.addEventListener('change', () => {
            this.#draft['soundsAlertSound'] = select.value;
        });

        const testBtn = document.createElement('button');
        testBtn.classList.add('settings-test-sound-btn');
        testBtn.textContent = 'Test';
        testBtn.addEventListener('click', () => {
            const soundName = this.#draft['soundsAlertSound'];
            if (soundName === 'None') return;
            const builtIn = { Lofi: lofi, Bell: bell, Chime: chime };
            const customSounds = JSON.parse(this.#draft['customSounds'] ?? '{}');
            const src = customSounds[soundName] ?? builtIn[soundName];
            if (!src) return;
            const audio = new Audio(src);
            audio.volume = parseInt(this.#draft['alertVolume'] ?? '50', 10) / 100;
            audio.play().catch(() => {});
        });

        const soundSelectWrapper = document.createElement('div');
        soundSelectWrapper.classList.add('settings-sound-select-wrapper');
        soundSelectWrapper.append(select, testBtn);

        this.#settingsContent.appendChild(this.#createRow('Alert sound', soundSelectWrapper));
        this.#settingsContent.appendChild(
            this.#createToggleRow('Play sound when timer finishes', 'playSoundWhenTimerFinish')
        );

        const range = document.createElement('input');
        range.type = 'range';
        range.min = 0;
        range.max = 100;
        range.value = this.#draft['alertVolume'] ?? '50';
        range.classList.add('settings-range');
        range.addEventListener('input', () => {
            this.#draft['alertVolume'] = range.value;
        });

        this.#settingsContent.appendChild(this.#createRow('Alert volume', range));

        // Custom sounds list
        const customSoundKeys = Object.keys(customSounds);
        if (customSoundKeys.length > 0) {
            const list = document.createElement('div');
            list.classList.add('settings-custom-sound-list');

            customSoundKeys.forEach(name => {
                const item = document.createElement('div');
                item.classList.add('settings-custom-sound-item');

                const nameEl = document.createElement('span');
                nameEl.textContent = name;

                const removeBtn = document.createElement('button');
                removeBtn.classList.add('settings-account-switch-btn');
                removeBtn.innerHTML = `<img src="${Close}" alt="Remove" />`;
                removeBtn.addEventListener('click', () => {
                    const sounds = JSON.parse(this.#draft['customSounds'] ?? '{}');
                    delete sounds[name];
                    this.#draft['customSounds'] = JSON.stringify(sounds);
                    if (this.#draft['soundsAlertSound'] === name) {
                        this.#draft['soundsAlertSound'] = 'Lofi';
                    }
                    this.#navigate('sounds');
                });

                item.append(nameEl, removeBtn);
                list.appendChild(item);
            });

            this.#settingsContent.appendChild(
                this.#createRow('Custom sounds', list, 'Your uploaded audio files')
            );
        }

        const uploadBtn = document.createElement('button');
        uploadBtn.classList.add('settings-upload-sound-btn');
        uploadBtn.textContent = 'Upload sound';
        uploadBtn.addEventListener('click', () => this.#showUploadSoundPopup());
        this.#settingsContent.appendChild(
            this.#createRow('Add sound', uploadBtn, 'Upload your own audio file')
        );
    }

    #showUploadSoundPopup() {
        const overlay = document.createElement('div');
        overlay.classList.add('settings-password-overlay');

        const card = document.createElement('div');
        card.classList.add('settings-password-card');

        const title = document.createElement('p');
        title.classList.add('settings-password-title');
        title.textContent = 'Upload custom sound';

        const nameLabel = document.createElement('label');
        nameLabel.classList.add('settings-upload-label');
        nameLabel.textContent = 'Sound name';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'e.g. My alarm';
        nameInput.maxLength = 20;
        nameInput.classList.add('settings-account-input');

        const fileLabel = document.createElement('label');
        fileLabel.classList.add('settings-upload-label');
        fileLabel.textContent = 'Audio file';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.classList.add('settings-file-input');

        const error = document.createElement('span');
        error.classList.add('settings-account-error');

        const actions = document.createElement('div');
        actions.classList.add('settings-password-actions');

        const cancelBtn = document.createElement('button');
        cancelBtn.classList.add('settings-account-switch-btn');
        cancelBtn.textContent = 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.classList.add('settings-account-create-btn');
        confirmBtn.textContent = 'Upload';

        const close = () => overlay.remove();
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        confirmBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const file = fileInput.files[0];

            const existingSounds = JSON.parse(this.#draft['customSounds'] ?? '{}');
            if (!name)              { error.textContent = 'Please enter a sound name.'; return; }
            if (name.length > 20)   { error.textContent = 'Name must be 20 characters or less.'; return; }
            if (!file)              { error.textContent = 'Please select an audio file.'; return; }
            if (Object.keys(existingSounds).length >= 3 && !existingSounds[name]) {
                error.textContent = 'Maximum 3 custom sounds allowed.'; return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const customSounds = JSON.parse(this.#draft['customSounds'] ?? '{}');
                customSounds[name] = ev.target.result;
                this.#draft['customSounds'] = JSON.stringify(customSounds);
                this.#draft['soundsAlertSound'] = name;
                close();
                this.#navigate('sounds');
            };
            reader.onerror = () => { error.textContent = 'Failed to read the file.'; };
            reader.readAsDataURL(file);
        });

        actions.append(cancelBtn, confirmBtn);
        card.append(title, nameLabel, nameInput, fileLabel, fileInput, error, actions);
        overlay.appendChild(card);
        this.#settingsContainer.appendChild(overlay);
        nameInput.focus();
    }

    #renderAccounts() {
        const accounts = this.#getAccounts();
        const currentName = this.#getCurrentAccountName();

        const currentRow = document.createElement('div');
        currentRow.classList.add('settings-row');
        currentRow.innerHTML = `<span>Logged in as</span><strong class="settings-account-name">${currentName}</strong>`;
        this.#settingsContent.appendChild(currentRow);

        const list = document.createElement('div');
        list.classList.add('settings-account-list');

        accounts.forEach(account => {
            const item = document.createElement('div');
            item.classList.add('settings-account-item');

            const nameEl = document.createElement('span');
            nameEl.textContent = account.name;
            item.appendChild(nameEl);

            if (account.name === currentName) {
                const badge = document.createElement('span');
                badge.classList.add('settings-account-badge');
                badge.textContent = 'Active';
                item.appendChild(badge);
            } else {
                const switchBtn = document.createElement('button');
                switchBtn.classList.add('settings-account-switch-btn');
                switchBtn.textContent = 'Switch';
                switchBtn.addEventListener('click', () => this.#showPasswordPrompt(account.name));
                item.appendChild(switchBtn);
            }

            list.appendChild(item);
        });

        this.#settingsContent.appendChild(list);

        const form = document.createElement('div');
        form.classList.add('settings-account-form');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Username';
        nameInput.classList.add('settings-account-input');

        const passInput = document.createElement('input');
        passInput.type = 'password';
        passInput.placeholder = 'Password';
        passInput.classList.add('settings-account-input');

        const createBtn = document.createElement('button');
        createBtn.classList.add('settings-account-create-btn');
        createBtn.textContent = 'Create account';
        createBtn.addEventListener('click', () => {
            this.#createAccount(nameInput.value.trim(), passInput.value, errorEl);
        });

        const errorEl = document.createElement('span');
        errorEl.classList.add('settings-account-error');

        form.append(nameInput, passInput, createBtn, errorEl);
        this.#settingsContent.appendChild(form);
    }

    #renderAIAgent() {
        const notice = document.createElement('div');
        notice.classList.add('settings-agent-notice');
        notice.innerHTML = `
            <strong>Security notice</strong>
            Use a <em>free-tier</em> API key only. Never paste a paid or production key here —
            it is stored in your browser's localStorage and is not encrypted.
            Get a free key at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>.
        `;
        this.#settingsContent.appendChild(notice);

        [
            {
                label:      'Groq API Key',
                key:        'groqApiKey',
                description: 'Stored locally in your browser. Reload the page after saving.',
            },
        ].forEach(({ label, key, description }) => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('settings-api-key-wrapper');

            const input = document.createElement('input');
            input.type = 'password';
            input.classList.add('settings-account-input', 'settings-api-key-input');
            input.placeholder = 'Paste your API key here';
            input.value = this.#draft[key] ?? '';
            input.addEventListener('input', () => {
                this.#draft[key] = input.value;
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.classList.add('settings-api-key-toggle');
            toggleBtn.textContent = 'Show';
            toggleBtn.addEventListener('click', () => {
                const hidden = input.type === 'password';
                input.type = hidden ? 'text' : 'password';
                toggleBtn.textContent = hidden ? 'Hide' : 'Show';
            });

            wrapper.append(input, toggleBtn);
            this.#settingsContent.appendChild(this.#createRow(label, wrapper, description));
        });
    }

    // ── Account actions ───────────────────────────────────────────────────────

    #showPasswordPrompt(name) {
        const account = this.#getAccounts().find(a => a.name === name);

        const overlay = document.createElement('div');
        overlay.classList.add('settings-password-overlay');

        const card = document.createElement('div');
        card.classList.add('settings-password-card');

        const title = document.createElement('p');
        title.classList.add('settings-password-title');
        title.textContent = `Switch to "${name}"`;

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Enter password';
        input.classList.add('settings-account-input');

        const error = document.createElement('span');
        error.classList.add('settings-account-error');

        const actions = document.createElement('div');
        actions.classList.add('settings-password-actions');

        const cancelBtn = document.createElement('button');
        cancelBtn.classList.add('settings-account-switch-btn');
        cancelBtn.textContent = 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.classList.add('settings-account-create-btn');
        confirmBtn.textContent = 'Confirm';

        const close = () => overlay.remove();

        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        confirmBtn.addEventListener('click', () => {
            if (input.value !== account.password) {
                error.textContent = 'Incorrect password.';
                input.value = '';
                input.focus();
                return;
            }
            close();
            this.#switchAccount(name);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  confirmBtn.click();
            if (e.key === 'Escape') close();
        });

        actions.append(cancelBtn, confirmBtn);
        card.append(title, input, error, actions);
        overlay.appendChild(card);
        this.#settingsContainer.appendChild(overlay);
        input.focus();
    }

    #switchAccount(name) {
        this.#saveCurrentAccount();
        localStorage.setItem('currentAccount', name);
        this.#loadDraft();
        this.#navigate('accounts');
    }

    #createAccount(name, password, errorEl) {
        if (!name) {
            errorEl.textContent = 'Username cannot be empty.';
            return;
        }

        const accounts = this.#getAccounts();
        if (accounts.find(a => a.name === name)) {
            errorEl.textContent = `Account "${name}" already exists.`;
            return;
        }

        accounts.push(this.#buildAccountObject(name, password, this.#defaultSettings()));
        localStorage.setItem('accounts', JSON.stringify(accounts));
        this.#navigate('accounts');
    }

    #resetAll() {
        this.#draft = { ...this.#defaultSettings() };
        this.#saveCurrentAccount();
        this.#navigate(this.#currentSetting);
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    #createRow(label, control, description) {
        const row = document.createElement('div');
        row.classList.add('settings-row');

        const labelGroup = document.createElement('div');
        labelGroup.classList.add('settings-row-label-group');

        const labelEl = document.createElement('span');
        labelEl.classList.add('settings-row-label');
        labelEl.textContent = label;
        labelGroup.appendChild(labelEl);

        if (description) {
            const descEl = document.createElement('span');
            descEl.classList.add('settings-row-description');
            descEl.textContent = description;
            labelGroup.appendChild(descEl);
        }

        row.append(labelGroup, control);
        return row;
    }

    #createToggleRow(label, key, description) {
        const toggle = new Toggle('', null, '', key, {
            get: ()  => this.#draft[key],
            set: (v) => { this.#draft[key] = v; },
        });
        return this.#createRow(label, toggle.element, description);
    }

    #createModeSelector() {
        const modes = [
            { key: 'usePomodoroSequence', label: 'Pomodoro sequence', description: 'Pomodoro → short break, repeat 4×, then one long break' },
            { key: 'endlessMode',         label: 'Endless mode',      description: 'No breaks — counts up after each session until you stop' },
        ];

        const activeKey = this.#draft['endlessMode'] === 'true'
            ? 'endlessMode'
            : 'usePomodoroSequence';

        const section = document.createElement('div');
        section.classList.add('settings-mode-section');

        const labelEl = document.createElement('span');
        labelEl.classList.add('settings-row-label');
        labelEl.textContent = 'Mode';
        section.appendChild(labelEl);

        const grid = document.createElement('div');
        grid.classList.add('settings-mode-grid');

        modes.forEach(({ key, label, description }) => {
            const btn = document.createElement('button');
            btn.classList.add('settings-mode-btn');
            if (key === activeKey) btn.classList.add('settings-mode-btn--active');
            btn.innerHTML = `
                <span class="settings-mode-dot"></span>
                <span class="settings-mode-text">
                    <strong>${label}</strong>
                    <span>${description}</span>
                </span>`;
            btn.addEventListener('click', () => {
                this.#draft['usePomodoroSequence'] = key === 'usePomodoroSequence' ? 'true' : 'false';
                this.#draft['endlessMode']         = key === 'endlessMode'         ? 'true' : 'false';
                grid.querySelectorAll('.settings-mode-btn').forEach(b => b.classList.remove('settings-mode-btn--active'));
                btn.classList.add('settings-mode-btn--active');
            });
            grid.appendChild(btn);
        });

        section.appendChild(grid);
        return section;
    }

    #createNumberInput(key, min, max) {
        const input = document.createElement('input');
        input.type = 'number';
        input.classList.add('settings-number-input');
        input.min = min;
        input.max = max;
        input.step = 1;
        input.value = this.#draft[key] ?? this.#defaults[key];
        input.addEventListener('change', () => {
            const val = Math.round(Math.min(max, Math.max(min, Number(input.value))));
            input.value = val;
            this.#draft[key] = String(val);
        });
        return input;
    }
}
