const taskTabs = [...document.querySelectorAll('.daily-tasks-tab')];
const taskPanels = [...document.querySelectorAll('[data-task-panel]')];
const taskIndicator = document.querySelector('.daily-tasks-tab-indicator');
const progressTitle = document.querySelector('[data-progress-title]');
const progressCount = document.querySelector('[data-progress-count]');
const progressFill = document.querySelector('[data-progress-fill]');
const progressReward = document.querySelector('[data-progress-reward]');
const taskStatus = document.querySelector('.daily-tasks-demo-note');
const taskLists = new Map([...document.querySelectorAll('[data-task-list]')]
  .map((list) => [list.dataset.taskList, list]));
const taskResets = new Map([...document.querySelectorAll('[data-period-reset]')]
  .map((element) => [element.dataset.periodReset, element]));

let taskBoard;
let refreshTimer;
let isLoadingTaskBoard = false;

const updateTaskIndicator = (tab) => {
  if (!tab || !taskIndicator) return;
  taskIndicator.style.width = `${tab.offsetWidth}px`;
  taskIndicator.style.transform = `translateX(${tab.offsetLeft}px)`;
};

const getPeriodTasks = (period) => taskBoard?.[period]?.tasks || [];

const updateProgress = (period) => {
  const tasks = getPeriodTasks(period);
  const completed = tasks.filter((task) => task.completed);
  const totalReward = completed.reduce((sum, task) => sum + Number(task.reward || 0), 0);
  const weekly = period === 'weekly';
  if (progressTitle) progressTitle.textContent = weekly ? 'Твой прогресс за неделю' : 'Твой прогресс сегодня';
  if (progressCount) progressCount.textContent = `${completed.length} / ${tasks.length}`;
  if (progressFill) progressFill.style.width = `${tasks.length ? completed.length / tasks.length * 100 : 0}%`;
  if (progressReward) progressReward.textContent = `+${totalReward}`;
  updateTaskIndicator(taskTabs.find((tab) => tab.dataset.taskPeriod === period));
};

const renderTask = (task, period) => {
  const card = document.createElement('article');
  card.className = `daily-task-card${task.completed ? ' is-complete' : ''}`;

  const icon = document.createElement('span');
  icon.className = `daily-task-icon${task.completed ? ' is-complete' : ''}`;
  icon.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.src = './assets/svg/task.svg';
  image.alt = '';
  icon.append(image);

  const copy = document.createElement('div');
  copy.className = 'daily-task-copy';
  const title = document.createElement('h3');
  title.textContent = task.title;
  const description = document.createElement('p');
  description.textContent = task.description || `Прогресс: ${task.progress} / ${task.target}`;
  copy.append(title, description);

  const action = document.createElement('div');
  action.className = 'daily-task-action';
  const reward = document.createElement('span');
  reward.className = 'daily-task-reward';
  const rewardIcon = document.createElement('img');
  rewardIcon.src = './assets/stars.png';
  rewardIcon.alt = '';
  rewardIcon.setAttribute('aria-hidden', 'true');
  reward.append(rewardIcon, document.createTextNode(String(task.reward)));

  const progress = document.createElement('span');
  progress.className = 'daily-task-progress-mini';
  progress.textContent = `${task.progress} / ${task.target}`;

  action.append(reward, progress);
  if (!task.completed) {
    const checkButton = document.createElement('button');
    checkButton.className = 'daily-task-check';
    checkButton.type = 'button';
    checkButton.textContent = 'Проверить';
    checkButton.addEventListener('click', async () => {
      checkButton.disabled = true;
      taskStatus.textContent = 'Проверяем выполнение…';
      try {
        const result = await window.VyrnApi.checkDailyTask(task.id);
        if (result.result.completed) {
          task.completed = true;
          taskStatus.textContent = result.result.already_completed
            ? 'Награда за это задание уже получена.'
            : `Задание выполнено! Начислено ${result.result.reward} ⭐`;
          if (!result.result.already_completed && typeof window.refreshVyrnAccount === 'function') {
            try {
              await window.refreshVyrnAccount();
            } catch (error) {
              console.warn('Не удалось обновить баланс после получения награды за задание:', error);
            }
          }
        } else {
          taskStatus.textContent = `Задание пока не выполнено: ${result.result.progress} / ${result.result.target}.`;
        }
        await loadTaskBoard();
      } catch (error) {
        taskStatus.textContent = error.message || 'Не удалось проверить задание.';
        checkButton.disabled = false;
      }
    });
    action.append(checkButton);
  }

  card.append(icon, copy, action);
  return card;
};

const renderTaskList = (period) => {
  const list = taskLists.get(period);
  if (!list) return;
  const tasks = getPeriodTasks(period);
  list.replaceChildren();
  if (!tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'daily-tasks-empty';
    empty.textContent = 'На этот период пока нет заданий. Загляни позже.';
    list.append(empty);
    return;
  }
  list.append(...tasks.map((task) => renderTask(task, period)));
};

const formatReset = (value) => {
  const milliseconds = Date.parse(value) - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'Обновление скоро';
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `Обновление через ${days} д ${hours} ч`;
  if (hours) return `Обновление через ${hours} ч ${minutes} мин`;
  return `Обновление через ${minutes} мин`;
};

const updateResetLabels = () => {
  for (const [period, element] of taskResets) {
    if (taskBoard?.[period]?.reset_at) element.textContent = formatReset(taskBoard[period].reset_at);
  }
};

const scheduleRefresh = () => {
  window.clearTimeout(refreshTimer);
  const nextReset = Math.min(...['daily', 'weekly']
    .map((period) => Date.parse(taskBoard?.[period]?.reset_at || ''))
    .filter(Number.isFinite));
  if (!Number.isFinite(nextReset)) return;
  refreshTimer = window.setTimeout(loadTaskBoard, Math.max(1000, nextReset - Date.now() + 1000));
};

async function loadTaskBoard() {
  if (isLoadingTaskBoard) return;
  if (!window.VyrnApi?.dailyTaskBoard) {
    taskStatus.textContent = 'Не удалось подключить задания. Обновите страницу.';
    return;
  }
  isLoadingTaskBoard = true;
  try {
    const result = await window.VyrnApi.dailyTaskBoard();
    if (!result.board?.daily || !result.board?.weekly) {
      throw new Error('Сервер вернул некорректный список заданий.');
    }
    taskBoard = result.board;
    renderTaskList('daily');
    renderTaskList('weekly');
    updateProgress(taskTabs.find((tab) => tab.classList.contains('is-active'))?.dataset.taskPeriod || 'daily');
    updateResetLabels();
    scheduleRefresh();
    if (taskStatus.textContent === 'Загружаем задания…') {
      taskStatus.textContent = '';
    }
  } catch (error) {
    taskStatus.textContent = error.message || 'Не удалось загрузить задания.';
  } finally {
    isLoadingTaskBoard = false;
  }
}

const setTaskPeriod = (period) => {
  const activeTab = taskTabs.find((tab) => tab.dataset.taskPeriod === period);
  if (!activeTab) return;
  taskTabs.forEach((tab) => {
    const isActive = tab === activeTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  taskPanels.forEach((panel) => {
    panel.hidden = panel.dataset.taskPanel !== period;
  });
  updateProgress(period);
};

taskTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setTaskPeriod(tab.dataset.taskPeriod));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + taskTabs.length) % taskTabs.length;
    taskTabs[nextIndex].focus();
    setTaskPeriod(taskTabs[nextIndex].dataset.taskPeriod);
  });
});

window.setInterval(updateResetLabels, 60_000);
window.addEventListener('resize', () => {
  updateTaskIndicator(taskTabs.find((tab) => tab.classList.contains('is-active')));
});
window.addEventListener('focus', loadTaskBoard);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadTaskBoard();
});

taskStatus.textContent = 'Загружаем задания…';
if (window.VyrnApi?.recordDailyTaskEvent) {
  window.VyrnApi.recordDailyTaskEvent('visit_daily_tasks')
    .catch((error) => console.warn('Не удалось записать посещение страницы заданий:', error))
    .finally(loadTaskBoard);
} else {
  loadTaskBoard();
}
