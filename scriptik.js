// ---------- Данные ----------
let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let currentFilter = "all";
let calDate = new Date();
let selected = today();

const PRIORITY_NAMES = { low: "Низкий", med: "Средний", high: "Высокий" };
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Короткие помощники, чтобы не писать длинное document.getElementById
const $ = id => document.getElementById(id);

function onClick(id, handler) {
  const el = $(id);
  if (el) el.onclick = handler;
}

function onSubmit(id, handler) {
  const form = $(id);
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      handler();
    };
  }
}

// ---------- Тема ----------
function setTheme(name) {
  document.body.classList.toggle("dark", name === "dark");
  localStorage.setItem("theme", name);
}
setTheme(localStorage.getItem("theme"));

// ---------- Работа с датами ----------
function dateKey(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function today() {
  return dateKey(new Date());
}

// ---------- Работа с задачами ----------
function save() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function addTask(title, priority, date) {
  if (title.trim() === "") return;
  tasks.push({ id: Date.now(), title: title.trim(), priority, date, done: false });
  save();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    save();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
}

// Сколько дней подряд были выполненные задачи (сегодня без задач серию не обрывает)
function getStreak() {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (tasks.some(t => t.date === key && t.done)) {
      streak++;
    } else if (key !== today()) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ---------- Отрисовка списков ----------
// Защита: чтобы название задачи с символами < > не ломало страницу
function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function taskHTML(t) {
  const badge = t.date && t.date !== today()
    ? `<div class="task-date">${t.date}</div>` : "";
  return `
    <div class="task ${t.done ? "done" : ""}">
      <input type="checkbox" class="task-check" data-id="${t.id}" ${t.done ? "checked" : ""}>
      <div class="task-title">${escapeHTML(t.title)}</div>
      ${badge}
      <div class="task-priority ${t.priority}">${PRIORITY_NAMES[t.priority]}</div>
      <button class="task-del" data-del="${t.id}">×</button>
    </div>`;
}

// Вешаем клики на чекбоксы и кнопки удаления внутри списка
function bind(list) {
  list.querySelectorAll(".task-check").forEach(box => {
    box.onclick = () => {
      toggleTask(Number(box.dataset.id));
      refresh();
    };
  });
  list.querySelectorAll(".task-del").forEach(btn => {
    btn.onclick = () => {
      deleteTask(Number(btn.dataset.del));
      refresh();
    };
  });
}

// Показывает задачи в списке или текст-заглушку, если задач нет
function showTasks(list, items, emptyText) {
  if (items.length === 0) {
    list.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }
  list.innerHTML = items.map(taskHTML).join("");
  bind(list);
}

// Перерисовывает только те блоки, которые есть на текущей странице
function refresh() {
  if ($("todayList")) renderToday();
  if ($("allList")) renderAll();
  if ($("days")) renderCalendar();
  if ($("progressBox")) renderProgress();
  if ($("settingsBox")) renderSettings();
}

// ---------- Страница «Сегодня» ----------
function renderToday() {
  const todayTasks = tasks.filter(t => t.date === today());

  // Задачи на будущие даты — чтобы было видно, что задача добавлена
  const later = tasks.filter(t => t.date > today() && !t.done)
                     .sort((a, b) => a.date.localeCompare(b.date));

  // Статистика считается по всем задачам, которые видны на странице
  const shown = [...todayTasks, ...later];
  const done = shown.filter(t => t.done).length;
  const total = shown.length;

  $("done").textContent = done;
  $("left").textContent = total - done;
  $("total").textContent = total;
  $("percent").textContent = (total ? Math.round(done / total * 100) : 0) + "%";

  const hour = new Date().getHours();
  $("hello").textContent =
    hour < 6 ? "Доброй ночи!" :
    hour < 12 ? "Доброе утро!" :
    hour < 18 ? "Добрый день!" :
    "Добрый вечер!";

  showTasks($("todayList"), todayTasks, "Нет задач на сегодня. Добавьте первую!");

  if (later.length && $("todayList")) {
    $("todayList").innerHTML += `<h3 class="section-title">Позже</h3>` +
      later.map(taskHTML).join("");
    bind($("todayList"));
  }
}

// ---------- Страница «Все задачи» ----------
function renderAll() {
  const text = $("search").value.toLowerCase();

  const shown = tasks.filter(t => {
    if (!t.title.toLowerCase().includes(text)) return false;
    if (currentFilter === "active") return !t.done;
    if (currentFilter === "done") return t.done;
    if (currentFilter === "today") return t.date === today();
    if (currentFilter === "overdue") return !t.done && t.date < today();
    return true;
  });

  showTasks($("allList"), shown, "Задач не найдено");
}

// ---------- Страница «Календарь» ----------
function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  $("monthName").textContent = `${MONTHS[month]} ${year}`;

  // getDay(): 0 = воскресенье, а неделя у нас начинается с понедельника
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '<div class="day"></div>'.repeat(offset); // пустые клетки до 1-го числа
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(year, month, d));
    let cls = "day";
    if (key === today()) cls += " today";
    if (key === selected) cls += " selected";
    if (tasks.some(t => t.date === key)) cls += " has";
    html += `<div class="${cls}" data-date="${key}">${d}</div>`;
  }
  $("days").innerHTML = html;

  document.querySelectorAll(".day[data-date]").forEach(cell => {
    cell.onclick = () => {
      selected = cell.dataset.date;
      renderCalendar();
    };
  });

  $("dayTitle").textContent = "Задачи на " + selected;
  showTasks($("dayList"), tasks.filter(t => t.date === selected), "Задач нет");
}

// ---------- Страница «Прогресс» ----------
function renderProgress() {
  const done = tasks.filter(t => t.done).length;
  $("pStreak").textContent = getStreak();
  $("pDone").textContent = done;
  $("pLeft").textContent = tasks.length - done;
  $("pTotal").textContent = tasks.length;

  // Выполненные задачи за последние 7 дней
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    days.push({
      name: WEEKDAYS[d.getDay()],
      count: tasks.filter(t => t.date === key && t.done).length
    });
  }

  const max = Math.max(1, ...days.map(d => d.count));
  $("bars").innerHTML = days.map(d => `
    <div class="bar-col">
      <div class="bar-value">${d.count}</div>
      <div class="bar" style="height:${Math.round(d.count / max * 80)}px"></div>
      <div class="bar-label">${d.name}</div>
    </div>`).join("");
}

// ---------- Страница «Настройки» ----------
function renderSettings() {
  const done = tasks.filter(t => t.done).length;
  $("dataInfo").textContent =
    `Всего: ${tasks.length} · Выполнено: ${done} · Осталось: ${tasks.length - done}`;
}

// ---------- Обработчики событий ----------
onSubmit("addForm", () => {
  const date = $("date") && $("date").value ? $("date").value : today();
  addTask($("title").value, $("priority").value, date);
  $("title").value = "";
  if ($("date")) $("date").value = today();
  renderToday();
});

onSubmit("allForm", () => {
  addTask($("allTitle").value, $("allPriority").value, today());
  $("allTitle").value = "";
  renderAll();
});

onSubmit("calForm", () => {
  addTask($("calTitle").value, "med", selected);
  $("calTitle").value = "";
  renderCalendar();
});

if ($("search")) $("search").oninput = renderAll;

const filterBtns = document.querySelectorAll(".filter-btn");
filterBtns.forEach(btn => {
  btn.onclick = () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderAll();
  };
});

onClick("prevBtn", () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});

onClick("nextBtn", () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

onClick("clearDone", () => {
  if (confirm("Удалить все выполненные задачи?")) {
    tasks = tasks.filter(t => !t.done);
    save();
    renderSettings();
  }
});

onClick("clearAll", () => {
  if (confirm("Удалить ВСЕ задачи?")) {
    tasks = [];
    save();
    renderSettings();
  }
});

onClick("lightBtn", () => setTheme("light"));
onClick("darkBtn", () => setTheme("dark"));

if ($("date")) $("date").value = today();

refresh();
