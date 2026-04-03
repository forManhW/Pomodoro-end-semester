import LogoTransfer from '../../assets/images/Logo_transfer.svg';
import TomatoImg from '../../assets/images/tomato.svg';
import ChevronLeft from '../../assets/images/chevron_left.svg';
import ChevronRight from '../../assets/images/chevron_right.svg';
import Fire from '../../assets/images/fire.svg';

class StatisticsManager {
    // ── DOM Elements ──────────────────────────────────────────────────────────
    #todayTotalTimeDisplay = document.getElementById('today_total_time_value');
    #progressPercentageText = document.getElementById('progress_percentage');
    #currentProgressContainer = document.getElementById('current_progress_container');
    #currentTaskText = document.getElementById('current_task_name');
    #heatmapSvg = document.querySelector('#heatmap_svg');
    #displayDate = new Date();
    #pieChartInstance = null;
    #efficientChartInstance = null;

    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.#init());
        } else {
            this.#init();
        }
    }

    #init() {
        this.#recordVisit();
        this.#updateAll();

        // Listen for stats or account changes
        window.addEventListener('stats-updated', () => this.#updateAll());
        window.addEventListener('settings-saved', () => this.#updateAll());
    }

    #recordVisit() {
        try {
            const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
            const currentName = localStorage.getItem('currentAccount') || 'guest';
            const accountIndex = accounts.findIndex(a => a.name === currentName);
            
            if (accountIndex === -1) return;

            const account = accounts[accountIndex];
            if (!account.stats) account.stats = {};
            if (!Array.isArray(account.stats.visitedDays)) account.stats.visitedDays = [];

            const todayStr = new Date().toDateString();
            if (!account.stats.visitedDays.includes(todayStr)) {
                account.stats.visitedDays.push(todayStr);
                localStorage.setItem('accounts', JSON.stringify(accounts));
            }
        } catch (e) {
            console.error('Failed to record visit:', e);
        }
    }

    // ── Data Getters ──────────────────────────────────────────────────────────

    get #account() {
        const accounts    = JSON.parse(localStorage.getItem('accounts') ?? '[]');
        const currentName = localStorage.getItem('currentAccount') ?? 'guest';
        return accounts.find(a => a.name === currentName) || null;
    }

    get #sessions() {
        return this.#account?.stats?.sessions ?? [];
    }

    get #stats() {
        return this.#account?.stats ?? { tasksPlanned: 0, tasksDone: 0 };
    }

    // ── Updaters ──────────────────────────────────────────────────────────────

    #updateAll() {
        this.#updateTodayTotalTime();
        this.#updateTomatoProgress();
        this.#updateCurrentTask();
        this.#renderHeatMap();
        this.#renderCalendar();
        this.#renderPieChart();
        this.#renderTimeOfDayChart();
        this.#renderEfficientChart();
    }

    #updateTodayTotalTime() {
        const todayStr = new Date().toDateString();
        
        // Sum durations (in seconds) for sessions completed today
        const totalSecondsToday = this.#sessions
            .filter(s => new Date(s.completedAt).toDateString() === todayStr && s.mode === 'pomodoro')
            .reduce((sum, s) => sum + (s.duration || 0), 0);

        const totalMinutes = Math.floor(totalSecondsToday / 60);
        const hours = Math.floor(totalMinutes / 60); 
        const minutes = totalMinutes % 60; 
        
        if (this.#todayTotalTimeDisplay) {
            this.#todayTotalTimeDisplay.innerText = `${hours} hours ${minutes} minutes`;
        }
    }

    #updateTomatoProgress() {
        const dailyProgressGoal = parseInt(this.#account?.settings?.dailyProgressGoal || '10', 10);
        
        const todayStr = new Date().toDateString();
        const done = this.#sessions.filter(s =>
            s.mode === 'pomodoro' &&
            s.completed &&
            new Date(s.completedAt).toDateString() === todayStr
        ).length;
        
        let percent = dailyProgressGoal > 0 ? (done / dailyProgressGoal) * 100 : 0;
        percent = Math.max(0, Math.min(100, Math.round(percent))); 
        
        if (this.#progressPercentageText) {
            this.#progressPercentageText.innerText = `${percent}%`;
        }

        if (this.#currentProgressContainer) {
            this.#currentProgressContainer.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block'; 
            wrapper.style.height = '50px';
            
            const emptyTomatoesLayer = document.createElement('div');
            emptyTomatoesLayer.style.display = 'flex';
            emptyTomatoesLayer.style.gap = '10px';
            
            const fullTomatoesLayer = document.createElement('div');
            fullTomatoesLayer.style.position = 'absolute';
            fullTomatoesLayer.style.top = '0';
            fullTomatoesLayer.style.left = '0';
            fullTomatoesLayer.style.display = 'flex';
            fullTomatoesLayer.style.gap = '10px';
            fullTomatoesLayer.style.overflow = 'hidden'; 
            fullTomatoesLayer.style.width = `${percent}%`;
            fullTomatoesLayer.style.transition = 'width 0.5s ease-in-out';
            
            for (let i = 0; i < dailyProgressGoal; i++) {
                const emptyImg = document.createElement('img');
                emptyImg.src = LogoTransfer;
                emptyImg.style.width = '50px'; 
                emptyImg.style.height = '50px';
                
                const fullImg = document.createElement('img');
                fullImg.src = TomatoImg;
                fullImg.style.width = '50px';
                fullImg.style.height = '50px';
                
                emptyTomatoesLayer.appendChild(emptyImg);
                fullTomatoesLayer.appendChild(fullImg);
            }
            
            wrapper.appendChild(emptyTomatoesLayer);
            wrapper.appendChild(fullTomatoesLayer);
            this.#currentProgressContainer.appendChild(wrapper);
        }
    }

    #updateCurrentTask() {
        const title = this.#account?.focusTask?.title;
        if (!this.#currentTaskText) return;
        
        if (title) {
            this.#currentTaskText.innerText = title;
            this.#currentTaskText.style.color = '#B52222';
            this.#currentTaskText.style.fontStyle = 'normal';
        } else {
            this.#currentTaskText.innerText = "No task selected";
            this.#currentTaskText.style.color = '#7F7F7F';
            this.#currentTaskText.style.fontStyle = 'italic';
        }
        
        this.#currentTaskText.style.textShadow = '0px 4px 4px rgba(0, 0, 0, 0.25)';
        this.#currentTaskText.style.fontWeight = 'bold';
        this.#currentTaskText.style.fontSize = '40px';
    }

    #getColorForHours(hours) {
        if (hours <= 0) return '#FFFBFB'; 
        if (hours <= 1) return '#FFF7D5'; 
        if (hours <= 2) return '#FFC2C2'; 
        if (hours <= 4) return '#FF7C7C'; 
        return '#BF1919';                 
    }

    #renderHeatMap() {
        if (!this.#heatmapSvg) return;

        const NS      = 'http://www.w3.org/2000/svg';
        const DAY_W   = 28, MONTH_H = 20;

        // Pre-compute daily counts and hours
        const dailyCount = {}, dailyHours = {};
        this.#sessions.forEach(s => {
            if (!s.completed || s.mode !== 'pomodoro') return;
            const d   = new Date(s.completedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dailyCount[key] = (dailyCount[key] || 0) + 1;
            dailyHours[key] = (dailyHours[key] || 0) + (s.duration || 0) / 3600;
        });

        // Jan 1 → Dec 31 of the current year
        const year      = new Date().getFullYear();
        const totalDays = (new Date(year, 11, 31) - new Date(year, 0, 1)) / 86400000 + 1;
        const startDOW  = (new Date(year, 0, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
        const totalCols = Math.ceil((startDOW + totalDays) / 7);

        // Fit STEP to container width so the SVG fills it exactly
        const containerW = this.#heatmapSvg.parentElement.clientWidth || 800;
        const STEP = Math.floor((containerW - DAY_W) / totalCols);
        const CELL = STEP - 3;

        const W = DAY_W + totalCols * STEP;
        const H = MONTH_H + 7 * STEP;
        this.#heatmapSvg.setAttribute('width',  W);
        this.#heatmapSvg.setAttribute('height', H);
        this.#heatmapSvg.removeAttribute('viewBox');
        this.#heatmapSvg.innerHTML = '';

        // Day labels
        ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].forEach((label, row) => {
            if (!label) return;
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', 0);
            t.setAttribute('y', MONTH_H + row * STEP + CELL - 1);
            t.setAttribute('font-size', '10');
            t.setAttribute('fill', '#888');
            t.setAttribute('font-family', 'Inter, sans-serif');
            t.textContent = label;
            this.#heatmapSvg.appendChild(t);
        });

        // Month labels
        let lastMonth = -1;
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(year, 0, 1 + i);
            if (d.getMonth() !== lastMonth) {
                lastMonth = d.getMonth();
                const col = Math.floor((startDOW + i) / 7);
                const t   = document.createElementNS(NS, 'text');
                t.setAttribute('x', DAY_W + col * STEP);
                t.setAttribute('y', 13);
                t.setAttribute('font-size', '11');
                t.setAttribute('font-weight', 'bold');
                t.setAttribute('fill', '#471515');
                t.setAttribute('font-family', 'Inter, sans-serif');
                t.textContent = d.toLocaleDateString('en-US', { month: 'short' });
                this.#heatmapSvg.appendChild(t);
            }
        }

        // Tooltip element
        let tooltip = document.getElementById('heatmap-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id        = 'heatmap-tooltip';
            tooltip.className = 'heatmap-tooltip';
            document.body.appendChild(tooltip);
        }

        // Squares
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        for (let i = 0; i < totalDays; i++) {
            const date  = new Date(year, 0, 1 + i);
            const key   = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const col   = Math.floor((startDOW + i) / 7);
            const row   = (startDOW + i) % 7;
            const count = dailyCount[key] || 0;
            const fill  = date > todayEnd ? '#f5f5f5' : this.#getColorForHours(dailyHours[key] || 0);

            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x',            DAY_W + col * STEP);
            rect.setAttribute('y',            MONTH_H + row * STEP);
            rect.setAttribute('width',        CELL);
            rect.setAttribute('height',       CELL);
            rect.setAttribute('rx',           3);
            rect.setAttribute('fill',         fill);
            rect.setAttribute('stroke',       '#e0e0e0');
            rect.setAttribute('stroke-width', '0.5');
            rect.style.cursor = 'pointer';

            const label     = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const countText = count === 0 ? 'No pomodoros' : count === 1 ? '1 pomodoro' : `${count} pomodoros`;

            rect.addEventListener('mouseenter', (e) => {
                tooltip.innerHTML = `<strong>${countText}</strong> on ${label}`;
                tooltip.classList.add('visible');
                this.#positionTooltip(tooltip, e);
            });
            rect.addEventListener('mousemove',  (e) => this.#positionTooltip(tooltip, e));
            rect.addEventListener('mouseleave', ()  => tooltip.classList.remove('visible'));

            this.#heatmapSvg.appendChild(rect);
        }
    }

    #positionTooltip(tooltip, e) {
        const offset = 12;
        let x = e.clientX + offset;
        let y = e.clientY - tooltip.offsetHeight - offset;
        if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - offset;
        if (y < 0) y = e.clientY + offset;
        tooltip.style.left = `${x}px`;
        tooltip.style.top  = `${y}px`;
    }

    #renderCalendar() {
        const dayContainer = document.getElementById('day_in_month');
        const headerTitle = document.getElementById('calendar_and_streak');
        if (!dayContainer || !headerTitle) return;
        
        const year = this.#displayDate.getFullYear();
        const month = this.#displayDate.getMonth(); 
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        headerTitle.innerHTML = `${monthNames[month]} ${year} 
            <span>
                <img src="${ChevronLeft}" id="go_back" alt="back">
                <img src="${ChevronRight}" id="go_forward" alt="next">
            </span>`;
            
        const firstDayIndex = new Date(year, month, 1).getDay(); 
        const lastDay = new Date(year, month + 1, 0).getDate(); 

        dayContainer.innerHTML = '';
        const shiftClick = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
        for (let i = 0; i < shiftClick; i++) {
            const emptySpan = document.createElement('span');
            dayContainer.appendChild(emptySpan); 
        }
        
        const today = new Date();
        const accountStats = this.#account?.stats || {};
        const visitedDays = Array.isArray(accountStats.visitedDays) ? accountStats.visitedDays : [];
        
        for (let i = 1; i <= lastDay; i++) {
            const daySpan = document.createElement('span');
            daySpan.className = 'day';
            daySpan.style.display = 'flex';
            daySpan.style.justifyContent = 'center';
            daySpan.style.alignItems = 'center';
            
            const iterationDateStr = new Date(year, month, i).toDateString();
            if (visitedDays.includes(iterationDateStr)) {
                daySpan.innerHTML = `<img src="${Fire}" style="width:20px;height:20px;" title="${iterationDateStr}" alt="Streak">`;
            } else {
                daySpan.innerText = i;
            }
            
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                daySpan.style.backgroundColor = '#FF7C7C';
                daySpan.style.borderRadius = '50%';
                daySpan.style.color = visitedDays.includes(iterationDateStr) ? 'transparent' : '#342B25';
            }
            dayContainer.appendChild(daySpan);
        }
        
        document.getElementById('go_back').onclick = () => {
            this.#displayDate.setMonth(this.#displayDate.getMonth() - 1);
            this.#renderCalendar();
        };
        document.getElementById('go_forward').onclick = () => {
            this.#displayDate.setMonth(this.#displayDate.getMonth() + 1);
            this.#renderCalendar();
        };
    }

    #renderPieChart() {
        const rightCol = document.querySelector('.right_col');
        if (!rightCol) return;

        const flagLabels = this.#account?.flagLabels || {};
        
        // Define standard colors array explicitly referencing colors used in TasksManager
        const standardColors = ['red', 'yellow', 'purple', 'green', 'blue'];
        
        // Check if any standard color is actually customized (has a non-empty label that diffs from default)
        const hasLabels = standardColors.some(color => {
            const label = flagLabels[color];
            return label && label.trim() !== '';
        });

        if (!hasLabels) {
            rightCol.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; flex:1; text-align:center; padding: 20px; font-style:italic; color:#7F7F7F; font-size:14px; line-height: 1.5;">Please label at least one Flag type in the Tasks page so we can analyze your time distribution.</div>';
            return;
        }

        const tasks = this.#account?.tasks || [];
        const colorCounts = {};
        let totalPomodoros = 0;
        
        tasks.forEach(t => {
            const c = t.color || 'red';
            const done = t.pomodorosDone || 0;
            if (!colorCounts[c]) colorCounts[c] = 0;
            colorCounts[c] += done;
            totalPomodoros += done;
        });

        if (totalPomodoros === 0) {
            rightCol.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; flex:1; text-align:center; padding: 20px; font-style:italic; color:#7F7F7F; font-size:14px;">No Pomodoros completed yet to show category stats.</div>';
            return;
        }

        // Restore canvas if it was replaced by message previously
        if (!document.getElementById('myDonutCanvas')) {
            rightCol.innerHTML = '<canvas id="myDonutCanvas"></canvas><div id="task_label"></div>';
        }

        const canvas = document.getElementById('myDonutCanvas');
        const ctx = canvas.getContext('2d');

        const labels = [];
        const data = [];
        const bgColors = [];

        const mapColor = {
            red: '#FF7C7C',
            yellow: '#FFF7D5',
            purple: '#E6E6FA',
            green: '#C2F0C2',
            blue: '#C2E0FF'
        };

        for (const color of standardColors) {
            const count = colorCounts[color] || 0;
            if (count > 0) {
                // Use custom label if preset, else capitalize color
                const labelStr = flagLabels[color] && flagLabels[color].trim() !== '' 
                    ? flagLabels[color] 
                    : color.charAt(0).toUpperCase() + color.slice(1);
                    
                labels.push(`${labelStr} (${count})`);
                data.push(count);
                bgColors.push(mapColor[color] || mapColor.red);
            }
        }

        if (this.#pieChartInstance) {
            this.#pieChartInstance.destroy();
        }

        // Make canvas responsive
        canvas.style.maxHeight = "300px";

        this.#pieChartInstance = new window.Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 1,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: { family: 'Inter, sans-serif', size: 12 },
                            color: '#471515'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    // ── Time-of-day bar chart ─────────────────────────────────────────────────

    #renderTimeOfDayChart() {
        const barChart = document.getElementById('bar_chart');
        if (!barChart) return;

        const slots = [
            { start: 6,  end: 12 },
            { start: 12, end: 18 },
            { start: 18, end: 24 },
            { start: 0,  end: 6  },
        ];

        const todayStr = new Date().toDateString();
        const todaySessions = this.#sessions.filter(s =>
            s.mode === 'pomodoro' &&
            s.completed &&
            new Date(s.completedAt).toDateString() === todayStr
        );

        const allTasks = this.#account?.tasks || [];
        const mapColor = {
            red: '#FF7C7C',
            yellow: '#FFF7D5',
            purple: '#E6E6FA',
            green: '#C2F0C2',
            blue: '#C2E0FF'
        };

        const slotData = slots.map(({ start, end }) => {
            const sessionsInSlot = todaySessions.filter(s => { 
                const h = new Date(s.completedAt).getHours(); 
                return h >= start && h < end; 
            });
            
            let totalMins = 0;
            const tasksMap = {};
            
            sessionsInSlot.forEach(s => {
                const mins = (s.duration || 0) / 60;
                totalMins += mins;
                
                const taskId = s.taskId || "unknown";
                if (!tasksMap[taskId]) {
                    const t = allTasks.find(x => x.id === taskId);
                    tasksMap[taskId] = {
                        name: s.taskTitle || "Unknown Task",
                        mins: 0,
                        color: t ? (mapColor[t.color] || mapColor.red) : '#cccccc'
                    };
                }
                tasksMap[taskId].mins += mins;
            });
            
            return { totalMins, tasksMap };
        });

        const maxMins = Math.max(...slotData.map(d => d.totalMins), 1);

        let tooltip = document.getElementById('barchart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'barchart-tooltip';
            tooltip.className = 'heatmap-tooltip'; 
            document.body.appendChild(tooltip);
        }

        barChart.querySelectorAll('.bar').forEach((bar, i) => {
            const barFrame = bar.querySelector('.bar_frame');
            if (!barFrame) return;

            barFrame.innerHTML = ''; 
            barFrame.style.display = 'flex';
            barFrame.style.alignItems = 'center';
            barFrame.style.borderRadius = '3px';
            barFrame.style.overflow = 'hidden';

            const trackWrap = document.createElement('div');
            trackWrap.style.height = '100%';
            trackWrap.style.display = 'flex';
            trackWrap.style.width = `${(slotData[i].totalMins / maxMins) * 100}%`;
            trackWrap.style.transition = 'width 0.6s ease';
            trackWrap.style.borderRadius = '3px';
            trackWrap.style.overflow = 'hidden';

            const existingLabel = bar.querySelector('.bar-minutes');
            if (existingLabel) existingLabel.remove();
            
            if (slotData[i].totalMins > 0) {
                const span = document.createElement('span');
                span.className = 'bar-minutes';
                span.textContent = `${Math.round(slotData[i].totalMins)}m`;
                bar.appendChild(span);
            }

            const tMap = slotData[i].tasksMap;
            for (let tid in tMap) {
                const tData = tMap[tid];
                const pctOfSlot = (tData.mins / slotData[i].totalMins) * 100;
                
                const segment = document.createElement('div');
                segment.style.height = '100%';
                segment.style.width = `${pctOfSlot}%`;
                segment.style.backgroundColor = tData.color;
                segment.style.borderRight = '1px solid rgba(255,255,255,0.3)';
                segment.style.cursor = 'pointer';
                
                segment.addEventListener('mouseenter', (e) => {
                    tooltip.innerHTML = `<strong>${tData.name}</strong><br/>${Math.round(tData.mins)} mins`;
                    tooltip.classList.add('visible');
                    this.#positionTooltip(tooltip, e);
                });
                segment.addEventListener('mousemove', (e) => this.#positionTooltip(tooltip, e));
                segment.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
                
                trackWrap.appendChild(segment);
            }

            barFrame.appendChild(trackWrap);
        });
    }

    // ── Efficient chart ───────────────────────────────────────────────────────

    #renderEfficientChart() {
        const container = document.getElementById('efficient-chart');
        if (!container) return;

        const labels = [];
        const focusedData = [];
        const interruptedData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStr = d.toDateString();
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }));

            const daySessions = this.#sessions.filter(s =>
                s.mode === 'pomodoro' &&
                s.completed &&
                new Date(s.completedAt).toDateString() === dayStr
            );
            focusedData.push(daySessions.filter(s => (s.pauseCount ?? 0) === 0).length);
            interruptedData.push(daySessions.filter(s => (s.pauseCount ?? 0) > 0).length);
        }

        const hasData = focusedData.some(v => v > 0) || interruptedData.some(v => v > 0);

        container.innerHTML = `
            <h2 class="efficient-chart-title">Focus Quality — Last 7 Days</h2>
            <p class="efficient-chart-description">
                Each bar shows how many Pomodoros you completed per day.
                <span class="efficient-legend-dot" style="background:#FF7C7C;"></span><strong>Red</strong> = fully focused (zero pauses) &nbsp;
                <span class="efficient-legend-dot" style="background:#FFD8D8;"></span><strong>Pink</strong> = interrupted (at least one pause).
                Hover a bar to see your focus rate for that day.
            </p>
            ${hasData
                ? '<div class="efficient-chart-canvas-wrap"><canvas id="efficientCanvas"></canvas></div>'
                : '<p class="efficient-chart-empty">Complete some Pomodoros to see your focus quality here.</p>'}
        `;

        if (!hasData) return;

        if (this.#efficientChartInstance) {
            this.#efficientChartInstance.destroy();
            this.#efficientChartInstance = null;
        }

        const ctx = document.getElementById('efficientCanvas').getContext('2d');
        this.#efficientChartInstance = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Focused (no pauses)',
                        data: focusedData,
                        backgroundColor: '#FF7C7C',
                        borderRadius: 6,
                        borderSkipped: false,
                        stack: 'sessions',
                    },
                    {
                        label: 'Interrupted',
                        data: interruptedData,
                        backgroundColor: '#FFD8D8',
                        borderRadius: 6,
                        borderSkipped: false,
                        stack: 'sessions',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { font: { family: 'Inter, sans-serif', size: 11 }, color: '#666' },
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { family: 'Inter, sans-serif', size: 11 }, color: '#666' },
                        title: { display: true, text: 'Pomodoros', font: { family: 'Inter, sans-serif', size: 12 }, color: '#471515' },
                        grid: { color: '#f0f0f0' },
                    },
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Inter, sans-serif', size: 12 },
                            color: '#471515',
                            usePointStyle: true,
                            pointStyleWidth: 12,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            footer: (items) => {
                                const total = items.reduce((s, i) => s + i.parsed.y, 0);
                                const focused = items.find(i => i.datasetIndex === 0)?.parsed.y ?? 0;
                                const pct = total > 0 ? Math.round(focused / total * 100) : 0;
                                return `Focus rate: ${pct}%`;
                            },
                        },
                    },
                },
            },
        });
    }
}

new StatisticsManager();
