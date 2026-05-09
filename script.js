// =============================================
//   TASKMASTER PRO — Upgraded Script
// =============================================

// ===== STATE =====
let tasks = JSON.parse(localStorage.getItem('tm_tasks')) || [];
let currentEditId = null;
let currentSort = 'default';
let chartRange = 7;
let deletedTask = null;
let undoTimer = null;

// Pomodoro State
let pomoMode = 'work';
let pomoRunning = false;
let pomoInterval = null;
let pomoSession = 1;
let pomoSecondsLeft = 25 * 60;
let pomoSelectedTaskId = null;
let pomosCompletedToday = parseInt(localStorage.getItem('tm_pomos_today') || '0');
let pomoTotalAll = parseInt(localStorage.getItem('tm_pomos_total') || '0');
let pomoLastDate = localStorage.getItem('tm_pomo_date') || '';

// Streak State
let streak = parseInt(localStorage.getItem('tm_streak') || '0');
let lastActiveDate = localStorage.getItem('tm_last_active') || '';

// Analytics
let completionChart = null;
let priorityChart = null;
let categoryChart = null;

// ===== DOM SHORTCUTS =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ===== SPLASH =====
$('continueBtn').addEventListener('click', () => {
    const splash = $('greetingPage');
    splash.style.opacity = '0';
    setTimeout(() => {
        splash.classList.add('hidden');
        $('mainApp').classList.remove('hidden');
        init();
    }, 600);
});

// ===== INIT =====
function init() {
    loadTheme();
    updateStreak();
    updateGreeting();
    updateStats();
    renderTasks();
    renderDashboard();
    setupPomodoro();
    initCharts();
    setDefaultDate();
    updateStreakBadge();
    checkPomoDayReset();
}

// ===== GREETING =====
function updateGreeting() {
    const hour = new Date().getHours();
    let greet = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';
    const el = $('greetingText');
    if (el) el.textContent = greet;

    const dateEl = $('greetingDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// ===== STREAK =====
function updateStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const hasCompletedToday = tasks.some(t =>
        t.completed && t.completedAt &&
        new Date(t.completedAt).toDateString() === today
    );

    if (hasCompletedToday) {
        if (lastActiveDate === yesterday) streak++;
        else if (lastActiveDate !== today) streak = 1;
        lastActiveDate = today;
    } else if (lastActiveDate !== today && lastActiveDate !== yesterday) {
        streak = 0;
    }

    localStorage.setItem('tm_streak', streak);
    localStorage.setItem('tm_last_active', lastActiveDate);
}

function updateStreakBadge() {
    const el = $('streakCount');
    if (el) el.textContent = streak;
}

// ===== THEME =====
function loadTheme() {
    if (localStorage.getItem('tm_theme') === 'dark') {
        document.body.classList.add('dark');
        $('themeToggle').innerHTML = '<i class="fas fa-sun"></i><span>Light Mode</span>';
    }
}

$('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('tm_theme', isDark ? 'dark' : 'light');
    $('themeToggle').innerHTML = isDark
        ? '<i class="fas fa-sun"></i><span>Light Mode</span>'
        : '<i class="fas fa-moon"></i><span>Dark Mode</span>';
    setTimeout(() => { if (completionChart) initCharts(); }, 200);
});

// ===== PANEL NAVIGATION =====
$$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const panel = btn.dataset.panel;
        $$('.panel').forEach(p => p.classList.remove('active'));
        $('panel-' + panel).classList.add('active');
        const titles = { dashboard: 'Dashboard', tasks: 'Tasks', analytics: 'Analytics', pomodoro: 'Pomodoro Timer' };
        $('topbarTitle').textContent = titles[panel] || panel;
        if (panel === 'analytics') initCharts();
        if (panel === 'dashboard') renderDashboard();
        if (panel === 'pomodoro') renderPomoTaskList();
        // Close sidebar on mobile
        if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('open');
    });
});

// Sidebar toggle
$('menuBtn').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
});

// Quick add
$('quickAddTrigger').addEventListener('click', () => {
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-panel="tasks"]').classList.add('active');
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('panel-tasks').classList.add('active');
    $('topbarTitle').textContent = 'Tasks';
    setTimeout(() => { if ($('taskInput')) $('taskInput').focus(); }, 100);
});

// ===== SAVE / UPDATE =====
function saveTasks() {
    localStorage.setItem('tm_tasks', JSON.stringify(tasks));
    updateStreak();
    updateStreakBadge();
    updateStats();
    renderTasks();
    renderDashboard();
    updatePomoTaskList();
}

// ===== STATS =====
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const today = new Date().toDateString();
    const overdue = tasks.filter(t =>
        !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    ).length;

    setText('totalTasks', total);
    setText('completedTasks', completed);
    setText('pendingTasks', pending);
    setText('overdueTasks', overdue);

    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const offset = 314 - (314 * rate / 100);
    const ring = $('ringFill');
    if (ring) ring.style.strokeDashoffset = offset;
    const ringPct = $('ringPct');
    if (ringPct) ringPct.textContent = rate + '%';

    // Priority counts
    ['high', 'med', 'low'].forEach(p => {
        const key = p === 'med' ? 'medium' : p;
        const count = tasks.filter(t => t.priority === key).length;
        setText(p + 'Count', count);
    });
}

function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val;
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
    renderTodayTasks();
    renderCatBars();
    renderWeekMini();
}

function renderTodayTasks() {
    const today = new Date().toDateString();
    const todayTasks = tasks.filter(t =>
        (t.dueDate && new Date(t.dueDate).toDateString() === today) ||
        (!t.completed && !t.dueDate)
    ).slice(0, 5);

    const el = $('todayTasks');
    if (!el) return;
    const count = $('todayCount');
    if (count) count.textContent = todayTasks.length;

    if (todayTasks.length === 0) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No tasks for today 🎉</div>';
        return;
    }
    el.innerHTML = todayTasks.map(t => `
        <div class="today-task ${t.completed ? 'done' : ''}">
            <span class="tt-dot" style="background:${priorityColor(t.priority)}"></span>
            <span>${escapeHtml(t.text)}</span>
        </div>
    `).join('');
}

function renderCatBars() {
    const el = $('catBars');
    if (!el) return;
    const cats = ['work', 'personal', 'shopping', 'health', 'other'];
    const icons = { work: 'fa-briefcase', personal: 'fa-house', shopping: 'fa-cart-shopping', health: 'fa-heart-pulse', other: 'fa-tag' };
    const colors = { work: '#5b4fcf', personal: '#22c98e', shopping: '#f5a623', health: '#f04b6b', other: '#7b82a0' };
    const max = Math.max(...cats.map(c => tasks.filter(t => t.category === c).length), 1);

    el.innerHTML = cats.map(c => {
        const count = tasks.filter(t => t.category === c).length;
        const pct = Math.round((count / max) * 100);
        return `
            <div class="cat-bar-row">
                <div class="cat-bar-label"><i class="fas ${icons[c]}"></i> ${c}</div>
                <div class="cat-bar-track">
                    <div class="cat-bar-fill" style="width:${pct}%;background:${colors[c]}"></div>
                </div>
                <div class="cat-bar-count">${count}</div>
            </div>`;
    }).join('');
}

function renderWeekMini() {
    const canvas = $('weekMiniChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
        data.push(tasks.filter(t =>
            t.completed && t.completedAt &&
            new Date(t.completedAt).toDateString() === d.toDateString()
        ).length);
    }

    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: 'rgba(91,79,207,0.65)',
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, beginAtZero: true }
            }
        }
    });
}

// ===== RENDER TASKS =====
function getFiltered() {
    let f = [...tasks];
    const search = ($('searchInput') || {}).value?.toLowerCase() || '';
    if (search) f = f.filter(t => t.text.toLowerCase().includes(search));
    const fp = ($('filterPriority') || {}).value || 'all';
    if (fp !== 'all') f = f.filter(t => t.priority === fp);
    const fc = ($('filterCategory') || {}).value || 'all';
    if (fc !== 'all') f = f.filter(t => t.category === fc);
    const fs = ($('filterStatus') || {}).value || 'all';
    if (fs !== 'all') f = f.filter(t => t.completed === (fs === 'completed'));

    if (currentSort === 'date') {
        f.sort((a, b) => {
            if (!a.dueDate) return 1; if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    } else if (currentSort === 'priority') {
        const o = { high: 3, medium: 2, low: 1 };
        f.sort((a, b) => o[b.priority] - o[a.priority]);
    } else if (currentSort === 'category') {
        f.sort((a, b) => a.category.localeCompare(b.category));
    }
    return f;
}

function renderTasks() {
    const list = $('todoList');
    const empty = $('emptyState');
    if (!list) return;

    const filtered = getFiltered();
    if (filtered.length === 0) {
        list.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    list.innerHTML = filtered.map(task => {
        const overdue = isOverdue(task);
        const todayFlag = isDueToday(task);
        let dueBadge = '';
        if (task.dueDate) {
            const cls = overdue ? 'overdue' : todayFlag ? 'today' : '';
            const label = overdue
                ? '<i class="fas fa-triangle-exclamation"></i> Overdue'
                : todayFlag
                    ? '<i class="fas fa-calendar-day"></i> Today'
                    : '<i class="fas fa-calendar"></i> ' + formatDate(task.dueDate);
            dueBadge = `<span class="task-due ${cls}">${label}</span>`;
        }
        return `
        <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
            <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-text">${escapeHtml(task.text)}</div>
                <div class="task-meta">
                    <span class="badge badge-${task.priority}">${getPrioLabel(task.priority)}</span>
                    <span class="badge badge-cat">${getCatLabel(task.category)}</span>
                    ${dueBadge}
                    ${task.notes ? `<span class="task-due" title="${escapeHtml(task.notes)}"><i class="fas fa-note-sticky"></i> Note</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="action-btn pomo-pick" data-id="${task.id}" title="Focus on this"><i class="fas fa-clock"></i></button>
                <button class="action-btn edit" data-id="${task.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete" data-id="${task.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');

    // Events
    list.querySelectorAll('.task-check').forEach(cb => {
        cb.addEventListener('change', e => toggleTask(e.target.closest('.task-card').dataset.id));
    });
    list.querySelectorAll('.action-btn.edit').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
    });
    list.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteTask(btn.dataset.id); });
    });
    list.querySelectorAll('.action-btn.pomo-pick').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            selectPomoTask(btn.dataset.id);
            // Navigate to pomodoro
            $$('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-panel="pomodoro"]').classList.add('active');
            $$('.panel').forEach(p => p.classList.remove('active'));
            $('panel-pomodoro').classList.add('active');
            $('topbarTitle').textContent = 'Pomodoro Timer';
            renderPomoTaskList();
        });
    });
}

// ===== CRUD =====
function addTask() {
    const text = ($('taskInput') || {}).value?.trim();
    if (!text) { showToastMsg('Please enter a task!'); return; }

    const newTask = {
        id: Date.now().toString(),
        text,
        completed: false,
        priority: ($('prioritySelect') || {}).value || 'medium',
        category: ($('categorySelect') || {}).value || 'work',
        dueDate: ($('dueDateInput') || {}).value || null,
        notes: '',
        createdAt: new Date().toISOString(),
        completedAt: null
    };
    tasks.unshift(newTask);
    saveTasks();

    $('taskInput').value = '';
    $('dueDateInput').value = '';
    $('prioritySelect').value = 'medium';
    $('categorySelect').value = 'work';
    setDefaultDate();
}

function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.completed = !t.completed;
    t.completedAt = t.completed ? new Date().toISOString() : null;
    saveTasks();
    if (t.completed) {
        updateStreak();
        updateStreakBadge();
        spawnConfetti();
    }
}

function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    deletedTask = { task: tasks[idx], index: idx };
    tasks.splice(idx, 1);
    saveTasks();
    showUndoToast('Task deleted');
}

function clearCompleted() {
    const has = tasks.some(t => t.completed);
    if (!has) return;
    if (confirm('Clear all completed tasks?')) {
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
    }
}

// ===== MODAL =====
function openEditModal(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    currentEditId = id;
    $('editTaskInput').value = t.text;
    $('editPriority').value = t.priority;
    $('editCategory').value = t.category;
    $('editDueDate').value = t.dueDate || '';
    $('editNotes').value = t.notes || '';
    $('editModal').style.display = 'flex';
    $('editModal').classList.add('show');
    setTimeout(() => $('editTaskInput').focus(), 100);
}

function closeModal() {
    $('editModal').style.display = 'none';
    $('editModal').classList.remove('show');
    currentEditId = null;
}

function saveEdit() {
    if (!currentEditId) return;
    const text = $('editTaskInput').value.trim();
    if (!text) { showToastMsg('Task cannot be empty!'); return; }
    const t = tasks.find(t => t.id === currentEditId);
    if (t) {
        t.text = text;
        t.priority = $('editPriority').value;
        t.category = $('editCategory').value;
        t.dueDate = $('editDueDate').value || null;
        t.notes = $('editNotes').value || '';
        saveTasks();
    }
    closeModal();
}

$('saveEditBtn').addEventListener('click', saveEdit);
$('cancelEditBtn').addEventListener('click', closeModal);
$('closeModalBtn').addEventListener('click', closeModal);
window.addEventListener('click', e => { if (e.target === $('editModal')) closeModal(); });

// ===== UNDO TOAST =====
function showUndoToast(msg) {
    $('undoMsg').textContent = msg;
    $('undoToast').classList.remove('hidden');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
        $('undoToast').classList.add('hidden');
        deletedTask = null;
    }, 5000);
}

$('undoBtn').addEventListener('click', () => {
    if (deletedTask) {
        tasks.splice(deletedTask.index, 0, deletedTask.task);
        deletedTask = null;
        saveTasks();
    }
    $('undoToast').classList.add('hidden');
    clearTimeout(undoTimer);
});

function showToastMsg(msg) {
    $('undoMsg').textContent = msg;
    $('undoToast').classList.remove('hidden');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => $('undoToast').classList.add('hidden'), 3000);
}

// ===== EXPORT =====
$('exportBtn').addEventListener('click', () => {
    const data = { exportedAt: new Date().toISOString(), tasks, streak, pomosCompleted: pomoTotalAll };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `taskmaster-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
});

// ===== FILTERS & SORT =====
['searchInput','filterPriority','filterCategory','filterStatus'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', renderTasks);
    if (el) el.addEventListener('change', renderTasks);
});

$('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    renderTasks();
});

$('clearCompletedBtn').addEventListener('click', clearCompleted);
$('addBtn').addEventListener('click', addTask);
$('taskInput').addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

// ===== ANALYTICS =====
function initCharts() {
    renderCompletionChart();
    renderPriorityChart();
    renderCategoryChart();
    renderHeatmap();
    renderProductivityScore();
}

function getDateRange(days) {
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        arr.push(d);
    }
    return arr;
}

function renderCompletionChart() {
    const canvas = $('completionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dates = getDateRange(chartRange);
    const labels = dates.map(d => d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));

    const completed = dates.map(d =>
        tasks.filter(t => t.completed && t.completedAt &&
            new Date(t.completedAt).toDateString() === d.toDateString()).length
    );
    const added = dates.map(d =>
        tasks.filter(t => new Date(t.createdAt).toDateString() === d.toDateString()).length
    );

    if (completionChart) completionChart.destroy();
    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#6b7394' : '#7b82a0';

    completionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Completed',
                    data: completed,
                    borderColor: '#5b4fcf',
                    backgroundColor: 'rgba(91,79,207,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#5b4fcf',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                },
                {
                    label: 'Added',
                    data: added,
                    borderColor: '#16a96e',
                    backgroundColor: 'rgba(22,169,110,0.07)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#22c98e',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    borderDash: [5,4],
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, font: { size: 11 } }, beginAtZero: true }
            }
        }
    });
}

function renderPriorityChart() {
    const canvas = $('priorityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = [
        tasks.filter(t => t.priority === 'high').length,
        tasks.filter(t => t.priority === 'medium').length,
        tasks.filter(t => t.priority === 'low').length,
    ];
    if (priorityChart) priorityChart.destroy();
    priorityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{ data, backgroundColor: ['#e8415f', '#e09213', '#16a96e'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 }, color: document.body.classList.contains('dark') ? '#6b7394' : '#7b82a0' } } }
        }
    });
}

function renderCategoryChart() {
    const canvas = $('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cats = ['work', 'personal', 'shopping', 'health', 'other'];
    const data = cats.map(c => tasks.filter(t => t.category === c).length);
    const colors = ['#5b4fcf', '#16a96e', '#e09213', '#e8415f', '#7b82a0'];
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Work', 'Personal', 'Shopping', 'Health', 'Other'],
            datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 }, color: document.body.classList.contains('dark') ? '#6b7394' : '#7b82a0' } } }
        }
    });
}

function renderHeatmap() {
    const el = $('heatmap');
    if (!el) return;
    const cells = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const count = tasks.filter(t =>
            t.completed && t.completedAt &&
            new Date(t.completedAt).toDateString() === d.toDateString()
        ).length;
        const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
        cells.push(`<div class="heat-cell" data-level="${level}" title="${d.toDateString()}: ${count} completed"></div>`);
    }
    el.innerHTML = cells.join('');
}

function renderProductivityScore() {
    const total = tasks.length;
    if (total === 0) {
        setText('prodScore', '—');
        setText('prodGrade', 'N/A');
        return;
    }
    const completed = tasks.filter(t => t.completed).length;
    const compRate = Math.round((completed / total) * 100);

    const withDue = tasks.filter(t => t.completed && t.dueDate);
    const onTime = withDue.filter(t => t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate));
    const ontimeRate = withDue.length ? Math.round((onTime.length / withDue.length) * 100) : 100;

    const highTotal = tasks.filter(t => t.priority === 'high').length;
    const highDone = tasks.filter(t => t.priority === 'high' && t.completed).length;
    const highRate = highTotal ? Math.round((highDone / highTotal) * 100) : 100;

    const streakBonus = Math.min(streak * 2, 20);
    const score = Math.round((compRate * 0.4) + (ontimeRate * 0.3) + (highRate * 0.2) + streakBonus * 0.1);

    setText('prodScore', score);
    const grade = score >= 85 ? '<i class="fas fa-trophy"></i> Excellent' : score >= 70 ? '<i class="fas fa-medal"></i> Great' : score >= 55 ? '<i class="fas fa-star-half-stroke"></i> Good' : score >= 40 ? '<i class="fas fa-thumbs-up"></i> Fair' : '<i class="fas fa-arrow-trend-up"></i> Needs Work';
    setText('prodGrade', grade);
    setText('sb-comp', compRate + '%');
    setText('sb-ontime', ontimeRate + '%');
    setText('sb-high', highRate + '%');
    setText('sb-streak', streak + ' days');
}

// Time range tabs
$$('.tt').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.tt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chartRange = parseInt(btn.dataset.range);
        setText('chartSub', `Last ${chartRange} days`);
        renderCompletionChart();
        renderHeatmap();
    });
});

// ===== POMODORO =====
const pomoDurations = {
    work: () => parseInt($('focusTime').value || 25) * 60,
    short: () => parseInt($('shortTime').value || 5) * 60,
    long: () => parseInt($('longTime').value || 15) * 60,
};

function setupPomodoro() {
    pomoSecondsLeft = pomoDurations[pomoMode]();
    updatePomoDisplay();
    renderPomoDots();
    updatePomoStats();
}

$$('.pomo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        $$('.pomo-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        pomoMode = tab.dataset.mode;
        pomoRunning = false;
        clearInterval(pomoInterval);
        $('pomoIcon').className = 'fas fa-play';
        pomoSecondsLeft = pomoDurations[pomoMode]();
        updatePomoDisplay();
    });
});

$('pomoStartStop').addEventListener('click', () => {
    if (pomoRunning) {
        pomoRunning = false;
        clearInterval(pomoInterval);
        $('pomoIcon').className = 'fas fa-play';
    } else {
        pomoRunning = true;
        $('pomoIcon').className = 'fas fa-pause';
        pomoInterval = setInterval(pomoTick, 1000);
    }
});

$('pomoReset').addEventListener('click', () => {
    clearInterval(pomoInterval);
    pomoRunning = false;
    $('pomoIcon').className = 'fas fa-play';
    pomoSecondsLeft = pomoDurations[pomoMode]();
    updatePomoDisplay();
});

$('pomoSkip').addEventListener('click', () => {
    clearInterval(pomoInterval);
    pomoRunning = false;
    $('pomoIcon').className = 'fas fa-play';
    pomoComplete();
});

function pomoTick() {
    if (pomoSecondsLeft <= 0) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        $('pomoIcon').className = 'fas fa-play';
        pomoComplete();
        return;
    }
    pomoSecondsLeft--;
    updatePomoDisplay();
}

function updatePomoDisplay() {
    const total = pomoDurations[pomoMode]();
    const pct = 1 - (pomoSecondsLeft / total);
    const circumference = 553;
    const offset = circumference * pct;
    const ring = $('pomoRingFill');
    if (ring) ring.style.strokeDashoffset = offset;

    const m = Math.floor(pomoSecondsLeft / 60).toString().padStart(2, '0');
    const s = (pomoSecondsLeft % 60).toString().padStart(2, '0');
    const disp = $('pomoDisplay');
    if (disp) disp.textContent = `${m}:${s}`;
    document.title = pomoRunning ? `${m}:${s} — TaskMaster Pro` : 'TaskMaster Pro';
}

function pomoComplete() {
    pomoSecondsLeft = 0;
    updatePomoDisplay();

    if (pomoMode === 'work') {
        pomosCompletedToday++;
        pomoTotalAll++;
        pomoSession = (pomoSession % 4) + 1;
        localStorage.setItem('tm_pomos_today', pomosCompletedToday);
        localStorage.setItem('tm_pomos_total', pomoTotalAll);
        localStorage.setItem('tm_pomo_date', new Date().toDateString());
        updatePomoStats();
        renderPomoDots();
        // Auto switch to break
        if (pomoSession === 1) {
            pomoMode = 'long';
            $$('.pomo-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-mode="long"]').classList.add('active');
        } else {
            pomoMode = 'short';
            $$('.pomo-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-mode="short"]').classList.add('active');
        }
        showToastMsg('Pomodoro complete! Take a break.');
        spawnConfetti();
    } else {
        pomoMode = 'work';
        $$('.pomo-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-mode="work"]').classList.add('active');
        showToastMsg('Break over! Time to focus.');
    }
    pomoSecondsLeft = pomoDurations[pomoMode]();
    updatePomoDisplay();
}

function renderPomoDots() {
    const el = $('pomoDots');
    if (!el) return;
    let html = '';
    for (let i = 1; i <= 4; i++) {
        html += `<div class="pomo-dot ${i < pomoSession ? 'filled' : ''}"></div>`;
    }
    el.innerHTML = html;
    setText('pomoSession', pomoSession);
}

function updatePomoStats() {
    setText('pomosToday', pomosCompletedToday);
    const focusMin = pomosCompletedToday * parseInt($('focusTime').value || 25);
    setText('focusMinutes', focusMin + 'm');
    setText('pomoTotal', pomoTotalAll);
}

function checkPomoDayReset() {
    const today = new Date().toDateString();
    if (pomoLastDate !== today) {
        pomosCompletedToday = 0;
        localStorage.setItem('tm_pomos_today', 0);
        localStorage.setItem('tm_pomo_date', today);
    }
}

function renderPomoTaskList() {
    updatePomoTaskList();
}

function updatePomoTaskList() {
    const el = $('pomoTaskList');
    if (!el) return;
    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px">No pending tasks 🎉</div>';
        return;
    }
    el.innerHTML = pending.map(t => `
        <div class="pomo-task-item ${t.id === pomoSelectedTaskId ? 'selected' : ''}" data-id="${t.id}">
            <span class="tt-dot" style="background:${priorityColor(t.priority)};width:8px;height:8px;border-radius:50%;flex-shrink:0"></span>
            <span>${escapeHtml(t.text)}</span>
        </div>
    `).join('');

    el.querySelectorAll('.pomo-task-item').forEach(item => {
        item.addEventListener('click', () => selectPomoTask(item.dataset.id));
    });

    updatePomoCurrentTask();
}

function selectPomoTask(id) {
    pomoSelectedTaskId = id;
    updatePomoCurrentTask();
    updatePomoTaskList();
}

function updatePomoCurrentTask() {
    const el = $('pomoCurrentTask');
    if (!el) return;
    if (!pomoSelectedTaskId) {
        el.innerHTML = '<div class="no-task-msg">No task selected</div>';
        return;
    }
    const t = tasks.find(t => t.id === pomoSelectedTaskId);
    if (!t) {
        el.innerHTML = '<div class="no-task-msg">No task selected</div>';
        return;
    }
    el.innerHTML = `<div class="pomo-selected-task">${escapeHtml(t.text)}</div>`;
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
            e.target.blur();
            closeModal();
        }
        return;
    }

    const panelMap = { 'd': 'dashboard', 't': 'tasks', 'a': 'analytics', 'p': 'pomodoro' };
    if (panelMap[e.key.toLowerCase()]) {
        const panel = panelMap[e.key.toLowerCase()];
        $$('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-panel="${panel}"]`).classList.add('active');
        $$('.panel').forEach(p => p.classList.remove('active'));
        $('panel-' + panel).classList.add('active');
        const titles = { dashboard: 'Dashboard', tasks: 'Tasks', analytics: 'Analytics', pomodoro: 'Pomodoro Timer' };
        $('topbarTitle').textContent = titles[panel];
        if (panel === 'analytics') initCharts();
        if (panel === 'dashboard') renderDashboard();
        if (panel === 'pomodoro') renderPomoTaskList();
    }

    if (e.key === 'n' || e.key === 'N') {
        $$('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-panel="tasks"]').classList.add('active');
        $$('.panel').forEach(p => p.classList.remove('active'));
        $('panel-tasks').classList.add('active');
        $('topbarTitle').textContent = 'Tasks';
        setTimeout(() => $('taskInput').focus(), 50);
    }

    if (e.key === ' ') {
        e.preventDefault();
        if ($('panel-pomodoro').classList.contains('active')) {
            $('pomoStartStop').click();
        }
    }

    if (e.key === '?') {
        $('shortcutsPanel').classList.toggle('hidden');
    }

    if (e.key === 'Escape') {
        closeModal();
        $('shortcutsPanel').classList.add('hidden');
    }
});

$('closeShortcuts').addEventListener('click', () => $('shortcutsPanel').classList.add('hidden'));

// ===== CONFETTI =====
function spawnConfetti() {
    const container = $('confettiCanvas');
    const colors = ['#5b4fcf', '#7b6fe8', '#16a96e', '#e8415f', '#e09213'];
    for (let i = 0; i < 30; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.cssText = `
            left: ${Math.random() * 100}%;
            top: -20px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${6 + Math.random() * 8}px;
            height: ${6 + Math.random() * 8}px;
            animation-duration: ${1 + Math.random() * 1.5}s;
            animation-delay: ${Math.random() * 0.5}s;
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        `;
        container.appendChild(piece);
        setTimeout(() => piece.remove(), 2500);
    }
}

// ===== HELPERS =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    const today = new Date();
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tom.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function isOverdue(t) {
    return !t.completed && t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0));
}

function isDueToday(t) {
    return !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString();
}

function priorityColor(p) {
    return p === 'high' ? 'var(--danger)' : p === 'medium' ? 'var(--warning)' : 'var(--success)';
}

function getPrioLabel(p) {
    const icons = { high: 'fa-circle-exclamation', medium: 'fa-circle-minus', low: 'fa-circle-check' };
    const labels = { high: 'High', medium: 'Medium', low: 'Low' };
    return `<i class="fas ${icons[p] || 'fa-circle'}"></i>${labels[p] || p}`;
}

function getCatLabel(c) {
    const icons = { work: 'fa-briefcase', personal: 'fa-house', shopping: 'fa-cart-shopping', health: 'fa-heart-pulse', other: 'fa-tag' };
    const label = c.charAt(0).toUpperCase() + c.slice(1);
    return `<i class="fas ${icons[c] || 'fa-tag'}"></i>${label}`;
}

function setDefaultDate() {
    const el = $('dueDateInput');
    if (el) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        el.value = tom.toISOString().split('T')[0];
    }
}
