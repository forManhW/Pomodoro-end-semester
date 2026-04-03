import './pomodoro.css';
import CircleBack   from '../../assets/images/circle_back.svg';
import LogoBg       from '../../assets/images/logo_background.svg';
import RestartImg   from '../../assets/images/restart.svg';
import PauseImg   from '../../assets/images/stop.svg';
import RunningImg     from '../../assets/images/pause.svg';
import TomatoFull   from '../../assets/images/Logo.svg';
import TomatoEmpty  from '../../assets/images/Logo_transfer.svg';
import chime from '../../assets/sounds/chime.mp3';
import lofi  from '../../assets/sounds/lofi.mp3';
import bell from '../../assets/sounds/bell.mp3';

// [pomodoro, short break] × 4, last short replaced by long break
const SEQUENCE = ['pomodoro', 'short', 'pomodoro', 'short', 'pomodoro', 'short', 'pomodoro', 'long'];
const POMODOROS_PER_CYCLE = SEQUENCE.filter(s => s === 'pomodoro').length; // 4

class PomodoroTimer {
    // DOM refs
    #main;
    #progressPath;
    #timerLabel;
    #modeLabel;
    #btnStop;
    #btnStopImg;
    #tomatoRow;
    #sectionsEl;
    #pathLength;

    // settings (read from localStorage)
    #pomodoroSecs;
    #shortSecs;
    #longSecs;
    #useSequence;
    #endlessMode;
    #alertSound;
    #playSound;
    #alertVolume;
    #customSounds;
    #notify;

    // state
    #totalTime;
    #timePassed       = 0;
    #timer            = null;
    #isRunning        = false;
    #sessionIndex     = 0;
    #completedInCycle = 0;
    #isCounting       = false; // endless count-up mode
    #pauseCount       = 0;

    constructor() {
        this.#main = document.querySelector('main');
        this.#loadSettings();
        this.#buildDOM();
        this.#pathLength = this.#progressPath.getTotalLength();
        this.#progressPath.style.strokeDasharray = this.#pathLength;
        this.#applyMode();
        this.#tryRestoreState();
        this.#bindEvents();
        this.#renderFocusTask();
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    #loadSettings() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const s           = accounts.find(a => a.name === currentName)?.settings ?? {};

        this.#pomodoroSecs = parseInt(s.pomodoroMinutes   ?? '25', 10) * 60;
        this.#shortSecs    = parseInt(s.shortBreakMinutes ?? '5',  10) * 60;
        this.#longSecs     = parseInt(s.longBreakMinutes  ?? '15', 10) * 60;
        this.#useSequence  = (s.usePomodoroSequence ?? 'true')  === 'true';
        this.#endlessMode  = (s.endlessMode        ?? 'false') === 'true';
        this.#alertSound   = s.soundsAlertSound ?? 'Lofi';
        this.#playSound    = (s.playSoundWhenTimerFinish  ?? 'true') === 'true';
        this.#alertVolume  = parseInt(s.alertVolume       ?? '50', 10) / 100;
        this.#customSounds = JSON.parse(s.customSounds    ?? '{}');
        this.#notify       = (s.endTimerNotification      ?? 'true') === 'true';
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    #buildDOM() {
        this.#main.innerHTML = `
            <img src="${CircleBack}" id="circle_back" />
            <div id="clock">
                <img src="${LogoBg}" />
                <div id="timer_label">00:00</div>
                <div id="mode_label"></div>
            </div>
            <div id="circle_countdown_wrap">
            <svg width="655" height="632" viewBox="0 0 655 632" fill="none"
                 xmlns="http://www.w3.org/2000/svg" id="circle_countdown">
                <g filter="url(#filter_pomodoro)">
                    <path id="progress_path"
                        d="M327.383 15C497.108 15.0002 635.764 147.177 635.765 311.515C635.765 475.853 497.108 608.03 327.383 608.03C157.658 608.03 19 475.853 19 311.515C19.0002 147.176 157.658 15 327.383 15Z"
                        stroke="#FF7C7C" stroke-width="30" shape-rendering="crispEdges"/>
                </g>
                <defs>
                    <filter id="filter_pomodoro" x="0" y="0" width="654.765" height="631.03"
                            filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                        <feColorMatrix in="SourceAlpha" type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                        <feOffset dy="4"/>
                        <feGaussianBlur stdDeviation="2"/>
                        <feComposite in2="hardAlpha" operator="out"/>
                        <feColorMatrix type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
                        <feBlend mode="normal" in2="BackgroundImageFix"
                            result="effect1_dropShadow"/>
                        <feBlend mode="normal" in="SourceGraphic"
                            in2="effect1_dropShadow" result="shape"/>
                    </filter>
                </defs>
            </svg>
            </div>
            <div id="icons">
                <div id="btn_restart" class="btn">
                    <img src="${RestartImg}"/>
                </div>
                <div id="pomodoro">
                    <div id="tomato_row"></div>
                    <div id="sections"></div>
                </div>
                <div id="btn_stop" class="btn">
                    <img src="${RunningImg}" />
                </div>
            </div>
            <div id="focus_task"></div>
        `;

        this.#progressPath = this.#main.querySelector('#progress_path');
        this.#timerLabel   = this.#main.querySelector('#timer_label');
        this.#modeLabel    = this.#main.querySelector('#mode_label');
        this.#btnStop      = this.#main.querySelector('#btn_stop');
        this.#btnStopImg   = this.#btnStop.querySelector('img');
        this.#tomatoRow    = this.#main.querySelector('#tomato_row');
        this.#sectionsEl   = this.#main.querySelector('#sections');
    }

    // ── Session management ────────────────────────────────────────────────────

    #currentMode() {
        return this.#useSequence ? SEQUENCE[this.#sessionIndex] : 'pomodoro';
    }

    #durationFor(mode) {
        return { pomodoro: this.#pomodoroSecs, short: this.#shortSecs, long: this.#longSecs }[mode];
    }

    #applyMode() {
        this.#loadSettings();
        this.#isCounting = false;
        this.#timePassed = 0;
        this.#pauseCount = 0;

        const pomodoroEl = this.#main.querySelector('#pomodoro');

        const svgEl = this.#main.querySelector('#circle_countdown');
        if (this.#endlessMode) {
            this.#isCounting = true;
            this.#modeLabel.textContent = 'Endless';
            this.#progressPath.style.strokeDashoffset = 0;
            this.#timerLabel.textContent = '00:00';
            pomodoroEl.style.visibility = 'hidden';
            svgEl.classList.add('endless-spin');
        } else {
            svgEl.classList.remove('endless-spin');
            const mode = this.#currentMode();
            this.#totalTime = this.#durationFor(mode);
            const labels = { pomodoro: 'Pomodoro', short: 'Short Break', long: 'Long Break' };
            this.#modeLabel.textContent = labels[mode];
            this.#updateVisual();
            this.#updateTomatos();
            pomodoroEl.style.visibility = 'visible';
        }
    }

    #advanceSession() {
        if (this.#currentMode() === 'pomodoro') {
            this.#completedInCycle++;
            if (this.#completedInCycle >= POMODOROS_PER_CYCLE) {
                this.#completedInCycle = 0;
            }
        }
        if (this.#useSequence) {
            this.#sessionIndex = (this.#sessionIndex + 1) % SEQUENCE.length;
        }
        this.#applyMode();
        this.#start();
    }

    // ── Timer ─────────────────────────────────────────────────────────────────

    #start() {
        if (this.#isRunning) return;
        this.#isRunning = true;
        this.#timer = setInterval(() => {
            this.#timePassed++;
            if (this.#isCounting) {
                this.#timerLabel.textContent = this.#formatTime(this.#timePassed);
            } else {
                this.#updateVisual();
                if (this.#timePassed >= this.#totalTime) {
                    this.#stop();
                    this.#onTimerEnd();
                }
            }
        }, 1000);
    }

    #stop() {
        this.#isRunning = false;
        clearInterval(this.#timer);
        this.#timer = null;
    }

    #restart() {
        this.#stop();
        this.#setRunningIcon(false);
        this.#sessionIndex     = 0;
        this.#completedInCycle = 0;
        this.#applyMode();
        this.#clearSavedState();
    }

    #onTimerEnd() {
        if (this.#playSound) this.#playAlert();
        if (this.#notify)    this.#sendNotification();
        const mode = this.#currentMode();
        this.#recordSession(mode, true);
        window.dispatchEvent(new CustomEvent('pomodoro-session-end', { detail: { mode } }));
        if (!this.#endlessMode) {
            this.#advanceSession();
        }
    }

    // ── Session recording ─────────────────────────────────────────────────────

    #recordSession(mode, completed) {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        let account       = accounts.find(a => a.name === currentName);
        if (!account) {
            account = { name: currentName, settings: {}, tasks: [], stats: {} };
            accounts.push(account);
        }
        if (!account.stats) account.stats = {};
        if (!account.stats.sessions) account.stats.sessions = [];

        const focusTask = account?.focusTask ?? null;
        account.stats.sessions.push({
            mode,
            completed,
            duration:    this.#timePassed,
            pauseCount:  this.#pauseCount,
            completedAt: new Date().toISOString(),
            taskTitle:   focusTask?.title ?? null,
            taskId:      focusTask?.id ?? null,
        });

        if (completed && mode === 'pomodoro') {
            this.#updateStreak(account.stats);

            // Increment pomodorosDone on the active focus task
            if (focusTask?.id) {
                const taskIdx = (account.tasks ?? []).findIndex(t => t.id === focusTask.id);
                if (taskIdx !== -1) {
                    account.tasks[taskIdx].pomodorosDone =
                        (account.tasks[taskIdx].pomodorosDone ?? 0) + 1;
                }
            }
        }

        localStorage.setItem('accounts', JSON.stringify(accounts));
        window.dispatchEvent(new CustomEvent('stats-updated'));
    }

    #updateStreak(stats) {
        const today     = new Date().toDateString();
        const lastDate  = stats.lastActiveDate ?? '';
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (lastDate === today) {
            // already counted today, no change
        } else if (lastDate === yesterday) {
            stats.streak = (stats.streak ?? 0) + 1;
        } else {
            stats.streak = 1;
        }
        stats.lastActiveDate = today;
        if ((stats.streak ?? 0) > (stats.highestStreak ?? 0)) {
            stats.highestStreak = stats.streak;
        }
    }

    // ── Visuals ───────────────────────────────────────────────────────────────

    #formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    #updateVisual() {
        this.#timerLabel.textContent = this.#formatTime(this.#totalTime - this.#timePassed);
        this.#progressPath.style.strokeDashoffset =
            (this.#timePassed / this.#totalTime) * this.#pathLength;
    }

    #setRunningIcon(running) {
        this.#btnStopImg.src = running ? PauseImg : RunningImg;
    }

    #updateTomatos() {
        this.#tomatoRow.innerHTML = '';
        for (let i = 0; i < POMODOROS_PER_CYCLE; i++) {
            const img = document.createElement('img');
            img.src = i < this.#completedInCycle ? TomatoFull : TomatoEmpty;
            img.classList.add('tomato');
            this.#tomatoRow.appendChild(img);
        }
        this.#sectionsEl.innerHTML = `
            <p>${this.#completedInCycle}</p>
            <p>of</p>
            <p>${POMODOROS_PER_CYCLE}</p>
            <p>sections</p>
        `;
    }

    // ── Audio ─────────────────────────────────────────────────────────────────

    #playAlert() {
        if (this.#alertSound === 'None') return;

        const builtIn = { Lofi: lofi, Bell: bell, Chime: chime };
        const src = this.#customSounds[this.#alertSound] ?? builtIn[this.#alertSound];
        if (!src) return;

        const audio = new Audio(src);
        audio.volume = this.#alertVolume;
        audio.play().catch(() => {});
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    #requestNotifyPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    #sendNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const bodies = {
            pomodoro: 'Pomodoro complete! Time for a break.',
            short:    'Break over. Back to work!',
            long:     'Long break over. Ready for the next round?',
        };
        new Notification('Pomodoro Timer', {
            body: bodies[this.#currentMode()],
            icon: '/logo.svg',
        });
    }

    // ── Focus task ────────────────────────────────────────────────────────────

    #renderFocusTask() {
        const el = this.#main.querySelector('#focus_task');
        if (!el) return;

        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        if (!account) { el.innerHTML = ''; return; }

        const tasks = account.tasks ?? [];

        // Use stored focusTask if it still exists and isn't done,
        // otherwise fall back to highest-priority uncompleted task
        const pinned = account.focusTask
            ? tasks.find(t => t.id === account.focusTask.id && !t.completed)
            : null;

        const task = pinned ?? tasks
            .filter(t => !t.completed)
            .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))[0]
            ?? null;

        if (!task) { el.innerHTML = ''; return; }

        // Persist fallback choice so other pages stay in sync
        if (!pinned) {
            account.focusTask = { id: task.id, title: task.title, mode: task.mode };
            localStorage.setItem('accounts', JSON.stringify(accounts));
        }

        el.innerHTML = `
            <div id="focus_task_card">
                <span class="focus_task_label">Now Focusing</span>
                <div class="focus_task_row">
                    <input type="checkbox" id="focus_task_check">
                    <label for="focus_task_check" class="focus_task_title">${this.#escHtml(task.title)}</label>
                </div>
            </div>
        `;

        el.querySelector('#focus_task_check').addEventListener('change', () => {
            const titleEl = el.querySelector('.focus_task_title');
            const card    = el.querySelector('#focus_task_card');

            // 1) Strike through the title
            titleEl.classList.add('struck');

            // 2) Fade out card after strike finishes
            setTimeout(() => card.classList.add('fade-out'), 380);

            // 3) Mutate data and load next task after fade completes
            setTimeout(() => {
                const allAccounts = JSON.parse(localStorage.getItem('accounts') ?? '[]');
                const userName    = localStorage.getItem('currentAccount') ?? 'guest';
                const userAccount = allAccounts.find(a => a.name === userName);
                if (!userAccount) return;

                const userTasks = userAccount.tasks ?? [];
                const idx       = userTasks.findIndex(t => t.id === task.id);
                if (idx !== -1) userTasks[idx].completed = true;

                const next = userTasks
                    .filter(t => !t.completed)
                    .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))[0] ?? null;

                userAccount.focusTask = next ? { id: next.id, title: next.title, mode: next.mode } : null;
                localStorage.setItem('accounts', JSON.stringify(allAccounts));
                this.#renderFocusTask();
            }, 720);
        });
    }

    #escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ── Events ────────────────────────────────────────────────────────────────

    #bindEvents() {
        this.#btnStop.addEventListener('click', () => {
            if (this.#isRunning) {
                this.#stop();
                this.#setRunningIcon(false);
                this.#pauseCount++;
                this.#saveState();
            } else {
                this.#requestNotifyPermission();
                this.#start();
                this.#setRunningIcon(true);
                this.#saveState();
            }
        });

        this.#main.querySelector('#btn_restart').addEventListener('click', () => {
            if (this.#timePassed > 0) {
                this.#recordSession(this.#currentMode(), false);
            }
            this.#restart();
        });

        window.addEventListener('settings-saved', () => this.#restart());
        window.addEventListener('beforeunload', () => this.#saveState());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.#saveState();
        });
    }

    // ── State persistence ─────────────────────────────────────────────────────

    #saveState() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        if (!account) return;
        account.pomodoroState = {
            timePassed:       this.#timePassed,
            sessionIndex:     this.#sessionIndex,
            completedInCycle: this.#completedInCycle,
            pauseCount:       this.#pauseCount,
            savedAt:          new Date().toISOString(),
        };
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }

    #tryRestoreState() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        const state       = account?.pomodoroState;
        if (!state?.savedAt) return;
        // Discard states older than 24 hours
        if (Date.now() - new Date(state.savedAt).getTime() > 86_400_000) return;

        this.#sessionIndex     = state.sessionIndex     ?? 0;
        this.#completedInCycle = state.completedInCycle ?? 0;
        this.#timePassed       = state.timePassed       ?? 0;
        this.#pauseCount       = state.pauseCount       ?? 0;

        if (this.#endlessMode) {
            this.#timerLabel.textContent = this.#formatTime(this.#timePassed);
        } else {
            this.#totalTime = this.#durationFor(this.#currentMode());
            if (this.#timePassed >= this.#totalTime) return;
            const labels = { pomodoro: 'Pomodoro', short: 'Short Break', long: 'Long Break' };
            this.#modeLabel.textContent = labels[this.#currentMode()];
            this.#updateVisual();
            this.#updateTomatos();
        }
    }

    #clearSavedState() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        if (!account) return;
        delete account.pomodoroState;
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }
}

new PomodoroTimer();
