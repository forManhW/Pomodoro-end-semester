class TaskManager {
    // ── Private constants ─────────────────────────────────────────────────────

    static #IMG = {
        red:    './src/assets/images/bookmark_red.svg',
        yellow: './src/assets/images/bookmark_yellow.svg',
        purple: './src/assets/images/bookmark_purple.svg',
        green:  './src/assets/images/bookmark_green.svg',
        blue:   './src/assets/images/bookmark_blue.png',
        tFull:  './src/assets/images/Logo.svg',
        tEmpty: './src/assets/images/Logo_transfer.svg',
        del:    './src/assets/images/delete.svg',
        edit:   './src/assets/images/edit.svg',
    };

    static #COLORS = ['red', 'yellow', 'purple', 'green', 'blue'];

    static #QUOTES = [
        '"The secret of getting ahead is getting started."',
        '"Focus on being productive instead of busy."',
        '"Small progress is still progress."',
        '"Done is better than perfect."',
        '"One task at a time. That\'s enough."',
        '"You don\'t have to be great to start, but you have to start to be great."',
        '"Take it one pomodoro at a time."',
        '"Deep work produces great results."',
    ];

    // ── Private fields ────────────────────────────────────────────────────────

    #tasks      = [];
    #selectedId = null;
    #filterVal  = 'all';
    #searchVal  = '';

    // DOM refs (set in #init)
    #taskListEl;
    #detailEl;
    #streakEl;

    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.#init());
        } else {
            this.#init();
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    #init() {
        this.#taskListEl = document.getElementById('task_list');
        this.#detailEl   = document.getElementById('detail');
        this.#streakEl   = document.getElementById('streak');

        this.#tasks = this.#loadTasks();

        document.getElementById('add_new_input')
            .addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                const title = e.target.value.trim();
                if (title) {
                    e.target.value = '';
                    this.#addTask(title);
                }
            });

        document.getElementById('searchInput')
            .addEventListener('input', e => {
                this.#searchVal = e.target.value;
                this.#renderList();
            });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.#filterVal = btn.dataset.filter;
                document.querySelectorAll('.filter-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.#renderList();
            });
        });

        // settings-saved fires inside #saveCurrentAccount(), which runs first
        // in #switchAccount() — before localStorage.setItem('currentAccount').
        // setTimeout(0) lets the synchronous account-switch finish so we always
        // read the correct user's tasks.
        window.addEventListener('settings-saved', () => {
            setTimeout(() => {
                this.#tasks      = this.#loadTasks();
                this.#selectedId = null;
                this.#renderDetail(null);
                this.#renderList();
            }, 0);
        });

        document.getElementById('edit-flag-btn')
            .addEventListener('click', () => this.#openFlagPanel());

        document.querySelector('.flag-panel-cancel')
            .addEventListener('click', () => this.#closeFlagPanel());

        document.querySelector('.flag-panel-save')
            .addEventListener('click', () => {
                const labels = {};
                document.querySelectorAll('#flag-panel input[data-color]').forEach(input => {
                    labels[input.dataset.color] = input.value.trim();
                });
                this.#saveFlagLabels(labels);
                this.#closeFlagPanel();
            });

        document.getElementById('flag-panel')
            .addEventListener('click', e => {
                if (e.target === e.currentTarget) this.#closeFlagPanel();
            });

        const closeBtn = document.getElementById('close-detail-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.#selectTask(null);
            });
        }

        this.#detailEl.style.visibility = 'hidden';
        this.#detailEl.classList.remove('open');
        
        this.#renderList();
        this.#renderQuote();
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    #loadTasks() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        return accounts.find(a => a.name === currentName)?.tasks ?? [];
    }

    #saveTasks() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        let account       = accounts.find(a => a.name === currentName);
        if (!account) {
            account = { name: currentName, settings: {}, tasks: [] };
            accounts.push(account);
        }
        account.tasks = this.#tasks;
        account.stats = {
            tasksPlanned: this.#tasks.length,
            tasksDone:    this.#tasks.filter(t => t.completed).length,
        };
        if (account.focusTask && !this.#tasks.some(t => t.id === account.focusTask.id)) {
            account.focusTask = null;
        }
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    #addTask(title) {
        const colors = TaskManager.#COLORS;
        const task = {
            id:               Date.now().toString(36) + Math.random().toString(36).slice(2),
            title:            title,
            color:            colors[Math.floor(Math.random() * colors.length)],
            pomodorosPlanned: 1,
            pomodorosDone:    0,
            dueDate:          '',
            mode:             'pomodoro',
            notes:            '',
            priority:         3,
            completed:        false,
            createdAt:        new Date().toISOString(),
        };
        this.#tasks.unshift(task);
        this.#saveTasks();
        this.#renderList();
        this.#selectTask(task.id);
    }

    #patch(id, changes) {
        const idx = this.#tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        this.#tasks[idx] = { ...this.#tasks[idx], ...changes };
        this.#saveTasks();
    }

    #deleteTask(id) {
        this.#tasks = this.#tasks.filter(t => t.id !== id);
        this.#saveTasks();
        if (this.#selectedId === id) {
            this.#selectedId = null;
            this.#renderDetail(null);
        }
        this.#renderList();
    }

    #toggleDone(id) {
        const task = this.#tasks.find(t => t.id === id);
        if (!task) return;
        this.#patch(id, { completed: !task.completed });
        this.#renderList();
        if (this.#selectedId === id) {
            this.#renderDetail(this.#tasks.find(t => t.id === id));
        }
    }

    #selectTask(id) {
        this.#selectedId = id;
        this.#renderList();
        this.#renderDetail(this.#tasks.find(t => t.id === id));
    }

    // ── Render: task list ─────────────────────────────────────────────────────

    #getFiltered() {
        let list = [...this.#tasks];
        if (this.#filterVal === 'completed')     list = list.filter(t => t.completed);
        if (this.#filterVal === 'not-completed') list = list.filter(t => !t.completed);
        if (this.#searchVal) {
            const q = this.#searchVal.toLowerCase();
            list = list.filter(t => t.title.toLowerCase().includes(q));
        }
        return list;
    }

    #renderList() {
        const list = this.#getFiltered();

        if (!list.length) {
            this.#taskListEl.innerHTML =
                '<p class="tasks-empty">No tasks found. Add one above!</p>';
            this.#updateTodayStats();
            return;
        }

        const IMG = TaskManager.#IMG;
        this.#taskListEl.innerHTML = list.map(t => `
            <div class="task-card${t.completed ? ' task-completed' : ''}${t.id === this.#selectedId ? ' task-selected' : ''}"
                 data-id="${t.id}">
                <img class="bookmark" src="${IMG[t.color] ?? IMG.red}" alt="">
                <div class="task-content" data-action="select">
                    <div class="task-title${t.completed ? ' task-done' : ''}">${this.#esc(t.title)}</div>
                    <div class="task-bottom">
                        <div class="pomodoro">
                            ${this.#tomatoHTML(t.pomodorosDone, t.pomodorosPlanned)}
                            <span class="pomodoro-text">${t.pomodorosDone}/${t.pomodorosPlanned} Pomodoros</span>
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="check-btn" data-action="check"
                            title="${t.completed ? 'Mark incomplete' : 'Mark complete'}">
                        <input type="checkbox" class="check-default" ${t.completed ? 'checked' : ''}>
                    </button>
                    <button class="delete-btn" data-action="delete" title="Delete">
                        <img src="${IMG.del}" alt="delete">
                    </button>
                    <button class="edit-btn" data-action="edit" title="Edit title">
                        <img src="${IMG.edit}" alt="edit">
                    </button>
                </div>
            </div>
        `).join('');

        this.#taskListEl.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', e => {
                const action = e.target.closest('[data-action]')?.dataset?.action;
                const id     = card.dataset.id;
                if (action === 'check')  return this.#toggleDone(id);
                if (action === 'delete') return this.#deleteTask(id);
                if (action === 'edit')   return this.#startInlineEdit(id, card);
                this.#selectTask(id);
            });
        });

        this.#updateTodayStats();
    }

    // ── Render: detail panel ──────────────────────────────────────────────────

    #renderDetail(task) {
        if (!task) {
            this.#detailEl.style.visibility = 'hidden';
            this.#detailEl.classList.remove('open');
            return;
        }
        this.#detailEl.style.visibility = 'visible';
        this.#detailEl.classList.add('open');

        const IMG = TaskManager.#IMG;

        // Title — contentEditable inline edit
        const h3 = this.#detailEl.querySelector('.title_detail h3');
        h3.contentEditable = 'true';
        h3.style.outline   = 'none';
        h3.style.cursor    = 'text';
        h3.textContent     = task.title;
        h3.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); h3.blur(); } };
        h3.onblur    = () => {
            const v = h3.textContent.trim() || 'Untitled';
            h3.textContent = v;
            this.#patch(task.id, { title: v });
            this.#renderList();
        };

        // Bookmark — hover popup to pick color
        const bmWrapper = this.#detailEl.querySelector('.title_detail div');
        bmWrapper.className = 'bookmark-wrapper';

        const bm = bmWrapper.querySelector('.bookmark');
        bm.src   = IMG[task.color] ?? IMG.red;

        const flagLabels = this.#loadFlagLabels();
        const bmName = bmWrapper.querySelector('.bookmark-name');
        bmName.textContent = flagLabels[task.color] || task.color;

        // Rebuild picker so labels stay fresh
        let picker = bmWrapper.querySelector('.flag-picker');
        if (picker) picker.remove();
        picker = document.createElement('div');
        picker.className = 'flag-picker';
        TaskManager.#COLORS.forEach(c => {
            const opt = document.createElement('div');
            opt.className = 'flag-picker-option';
            opt.innerHTML = `<img src="${IMG[c]}" alt="${c}"><span>${flagLabels[c] || c}</span>`;
            opt.addEventListener('click', e => {
                e.stopPropagation();
                this.#patch(task.id, { color: c });
                this.#renderDetail(this.#tasks.find(t => t.id === task.id));
                this.#renderList();
            });
            picker.appendChild(opt);
        });
        bmWrapper.appendChild(picker);

        // Due date
        const dueDateEl = document.getElementById('due-date-input');
        dueDateEl.value = task.dueDate ?? '';
        dueDateEl.onchange = e => this.#patch(task.id, { dueDate: e.target.value });

        // Mode — single Pomodoro checkbox
        const modeCheck = this.#detailEl.querySelector('.mode_btn input[type="checkbox"]');
        modeCheck.checked  = (task.mode ?? 'pomodoro') === 'pomodoro';
        modeCheck.onchange = () => {
            const newMode = modeCheck.checked ? 'pomodoro' : 'free';
            this.#patch(task.id, { mode: newMode });
            this.#renderPomoSection(this.#tasks.find(t => t.id === task.id));
        };

        // Pomodoro section (visible only in pomodoro mode)
        this.#renderPomoSection(task);

        // Notes (debounced)
        const ta = this.#detailEl.querySelector('textarea');
        ta.value   = task.notes ?? '';
        ta.oninput = this.#debounce(
            () => this.#patch(task.id, { notes: ta.value }), 400
        );

        // Priority
        const sel    = this.#detailEl.querySelector('.priority-select');
        sel.value    = task.priority ?? 3;
        sel.onchange = () => this.#patch(task.id, { priority: +sel.value });

        // Start Focus
        document.getElementById('btn_start').onclick = () => {
            const t        = this.#tasks.find(x => x.id === task.id);
            const accounts = JSON.parse(localStorage.getItem('accounts') ?? '[]');
            const name     = localStorage.getItem('currentAccount') ?? 'guest';
            const account  = accounts.find(a => a.name === name);
            if (account) {
                account.focusTask = { id: t.id, title: t.title, mode: t.mode };
                localStorage.setItem('accounts', JSON.stringify(accounts));
            }
            window.location.href = '/index.html';
        };
    }

    // ── Render: today stats & quote ───────────────────────────────────────────

    #updateTodayStats() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const stats       = accounts.find(a => a.name === currentName)?.stats
                            ?? { tasksPlanned: 0, tasksDone: 0 };

        const bolds = this.#streakEl.querySelectorAll('p b');
        if (bolds[0]) bolds[0].textContent = stats.tasksPlanned;
        if (bolds[1]) bolds[1].textContent = stats.tasksDone;
        if (bolds[2]) bolds[2].textContent = this.#updateStreak();
    }

    // ── Streak ────────────────────────────────────────────────────────────────

    #updateStreak() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        const account     = accounts.find(a => a.name === currentName);
        if (!account) return 0;

        const today     = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const streak    = account.streak ?? { count: 0, lastDate: '' };

        if (streak.lastDate === today) {
            return streak.count;
        }

        streak.count = streak.lastDate === yesterday ? streak.count + 1 : 1;
        streak.lastDate = today;
        account.streak = streak;
        localStorage.setItem('accounts', JSON.stringify(accounts));
        return streak.count;
    }

    #renderQuote() {
        const el = document.getElementById('quote');
        if (!el) return;
        const quotes = TaskManager.#QUOTES;
        el.innerHTML = `<p class="quote-text">${quotes[Math.floor(Math.random() * quotes.length)]}</p>`;
    }

    // ── Inline title edit ─────────────────────────────────────────────────────

    #startInlineEdit(id, card) {
        const titleEl = card.querySelector('.task-title');
        if (!titleEl) return this.#selectTask(id);

        const original  = this.#tasks.find(t => t.id === id)?.title ?? '';
        const input     = document.createElement('input');
        input.type      = 'text';
        input.value     = original;
        input.className = 'task-inline-input';
        titleEl.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
            const val = input.value.trim() || original;
            this.#patch(id, { title: val });
            this.#renderList();
            if (this.#selectedId === id) {
                this.#renderDetail(this.#tasks.find(t => t.id === id));
            }
        };
        input.addEventListener('blur',    commit);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = original; input.blur(); }
        });
    }

    // ── Pomodoro section ─────────────────────────────────────────────────────

    #renderPomoSection(task) {
        const section = this.#detailEl.querySelector('#pomo-section');
        if (!section) return;

        const isPomo = (task.mode ?? 'pomodoro') === 'pomodoro';
        section.style.display = isPomo ? '' : 'none';
        if (!isPomo) return;

        const IMG     = TaskManager.#IMG;
        const done    = task.pomodorosDone    ?? 0;
        const planned = task.pomodorosPlanned ?? 1;
        const cap     = Math.min(planned, 8);
        let tomatoHtml = '';
        for (let i = 0; i < cap; i++) {
            tomatoHtml += `<img src="${i < done ? IMG.tFull : IMG.tEmpty}" class="tomato-icon" alt="">`;
        }

        section.innerHTML = `
            <div class="pomo-tomatoes">${tomatoHtml}</div>
            <div class="pomo-count-row">
                <span class="pomo-count-label">Planned</span>
                <button class="pomo-btn pomo-planned-dec">−</button>
                <span class="pomo-count-val">${planned}</span>
                <button class="pomo-btn pomo-planned-inc">+</button>
            </div>
        `;

        section.querySelector('.pomo-planned-dec').onclick = () => {
            const t = this.#tasks.find(x => x.id === task.id);
            if (t && t.pomodorosPlanned > 1) {
                this.#patch(task.id, { pomodorosPlanned: t.pomodorosPlanned - 1 });
                this.#renderPomoSection(this.#tasks.find(x => x.id === task.id));
                this.#renderList();
            }
        };
        section.querySelector('.pomo-planned-inc').onclick = () => {
            const t = this.#tasks.find(x => x.id === task.id);
            if (t) {
                this.#patch(task.id, { pomodorosPlanned: t.pomodorosPlanned + 1 });
                this.#renderPomoSection(this.#tasks.find(x => x.id === task.id));
                this.#renderList();
            }
        };
    }

    // ── Flag labels ───────────────────────────────────────────────────────────

    #loadFlagLabels() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        return accounts.find(a => a.name === currentName)?.flagLabels ?? {};
    }

    #saveFlagLabels(labels) {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        let account       = accounts.find(a => a.name === currentName);
        if (!account) {
            account = { name: currentName, settings: {}, tasks: [] };
            accounts.push(account);
        }
        account.flagLabels = labels;
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }

    #openFlagPanel() {
        const panel  = document.getElementById('flag-panel');
        const labels = this.#loadFlagLabels();
        panel.querySelectorAll('input[data-color]').forEach(input => {
            input.value = labels[input.dataset.color] ?? '';
        });
        panel.classList.add('open');
    }

    #closeFlagPanel() {
        document.getElementById('flag-panel').classList.remove('open');
    }

    // ── DOM/string helpers ────────────────────────────────────────────────────

    #esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    #tomatoHTML(done, planned) {
        const IMG = TaskManager.#IMG;
        let h = '';
        const cap = Math.min(planned, 8);
        for (let i = 0; i < cap; i++) {
            h += `<img src="${i < done ? IMG.tFull : IMG.tEmpty}" class="tomato-icon" alt="">`;
        }
        return h;
    }

    #debounce(fn, ms) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }
}

new TaskManager();
