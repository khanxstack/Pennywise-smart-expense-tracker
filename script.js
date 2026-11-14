const expenseStorageKey = "pennywiseExpenses";
const budgetStorageKey = "pennywiseBudgets";
const categories = {
    Food: { color: "#e5a667", soft: "#fbf1e5", icon: "◌" },
    Transport: { color: "#7897b5", soft: "#edf2f7", icon: "↑" },
    Shopping: { color: "#b38cb5", soft: "#f5eff6", icon: "◇" },
    Bills: { color: "#d58a78", soft: "#faefec", icon: "▤" },
    Health: { color: "#7eb19b", soft: "#edf5f1", icon: "+" },
    Entertainment: { color: "#c5a352", soft: "#f8f4e7", icon: "♪" },
    Other: { color: "#9ba7a0", soft: "#f0f2f0", icon: "•" }
};

const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});
const shortCurrency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: "compact"
});

const monthFilter = document.getElementById("month-filter");
const expenseForm = document.getElementById("expense-form");
const budgetForm = document.getElementById("budget-form");
const transactionList = document.getElementById("transaction-list");
const emptyState = document.getElementById("empty-state");
const formMessage = document.getElementById("form-message");
const storageWarning = document.getElementById("storage-warning");
const budgetInput = document.getElementById("budget-input");
const expenseDateInput = document.getElementById("date-input");

const today = new Date();
const todayString = toDateInputValue(today);
monthFilter.value = todayString.slice(0, 7);
expenseDateInput.value = todayString;
document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
}).format(today);

let expenses = loadStoredValue(expenseStorageKey, [], isExpenseList);
let budgets = loadStoredValue(budgetStorageKey, {}, isBudgetMap);

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isExpenseList(value) {
    return Array.isArray(value) && value.every((expense) =>
        expense &&
        typeof expense.id === "string" &&
        typeof expense.description === "string" &&
        Number.isFinite(expense.amount) &&
        expense.amount > 0 &&
        Object.prototype.hasOwnProperty.call(categories, expense.category) &&
        isValidDate(expense.date)
    );
}

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && toDateInputValue(date) === value;
}

function isValidMonth(value) {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
    const [year, month] = value.split("-").map(Number);
    return year >= 1 && month >= 1 && month <= 12;
}

function isBudgetMap(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.entries(value).every(([month, amount]) =>
            /^\d{4}-\d{2}$/.test(month) && Number.isFinite(amount) && amount >= 0
        );
}

function showStorageWarning(message) {
    storageWarning.textContent = message;
    storageWarning.hidden = false;
}

function loadStoredValue(key, fallback, isValid) {
    try {
        const stored = localStorage.getItem(key);
        if (stored === null) return fallback;
        const value = JSON.parse(stored);
        if (!isValid(value)) throw new Error("Stored data has an unexpected format.");
        return value;
    } catch (error) {
        showStorageWarning(`Saved data could not be loaded (${error.message}). Changes may not persist in this browser.`);
        return fallback;
    }
}

function saveStoredValue(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        showStorageWarning(`Could not save your changes (${error.message}). Keep this page open or try another browser.`);
        return false;
    }
}

function money(amount, compact) {
    return (compact ? shortCurrency : currency).format(amount);
}

function selectedMonthExpenses() {
    const month = monthFilter.value;
    return expenses.filter((expense) => expense.date.slice(0, 7) === month);
}

function totalAmount(items) {
    const cents = items.reduce((total, item) => total + Math.round(item.amount * 100), 0);
    return cents / 100;
}

function renderSummary(items) {
    const total = totalAmount(items);
    const budget = budgets[monthFilter.value];
    document.getElementById("monthly-total").textContent = money(total);
    document.getElementById("month-caption").textContent = new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric"
    }).format(new Date(`${monthFilter.value}-01T12:00:00`));
    document.getElementById("transaction-count").textContent = String(items.length);

    const budgetLeft = document.getElementById("budget-left");
    const budgetCaption = document.getElementById("budget-caption");
    if (budget === undefined) {
        budgetLeft.classList.remove("over-budget");
        budgetLeft.textContent = "Set a budget";
        budgetCaption.textContent = "Set a monthly budget to track your limit";
    } else {
        const remaining = Math.round((budget - total) * 100) / 100;
        budgetLeft.textContent = money(remaining);
        budgetLeft.classList.toggle("over-budget", remaining < 0);
        budgetCaption.textContent = remaining < 0
            ? `${money(Math.abs(remaining))} over your monthly limit`
            : `${money(budget)} monthly limit`;
    }
}

function renderTransactions(items) {
    const sortedItems = [...items].sort((a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
    );
    transactionList.replaceChildren();
    emptyState.classList.toggle("visible", sortedItems.length === 0);

    for (const expense of sortedItems) {
        const category = categories[expense.category];
        const row = document.createElement("article");
        row.className = "transaction-row";

        const main = document.createElement("div");
        main.className = "transaction-main";
        const mark = document.createElement("span");
        mark.className = "category-mark";
        mark.style.setProperty("--category-color", category.color);
        mark.style.setProperty("--category-soft", category.soft);
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = category.icon;

        const text = document.createElement("div");
        text.className = "transaction-text";
        const description = document.createElement("strong");
        description.textContent = expense.description;
        const details = document.createElement("span");
        details.textContent = `${expense.category} · ${formatDate(expense.date)}`;
        text.append(description, details);
        main.append(mark, text);

        const amount = document.createElement("strong");
        amount.className = "transaction-amount";
        amount.textContent = `− ${money(expense.amount)}`;

        const remove = document.createElement("button");
        remove.className = "delete-button";
        remove.type = "button";
        remove.dataset.expenseId = expense.id;
        remove.setAttribute("aria-label", `Delete ${expense.description}`);
        remove.title = "Delete expense";
        remove.textContent = "×";
        row.append(main, amount, remove);
        transactionList.append(row);
    }
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" })
        .format(new Date(`${value}T12:00:00`));
}

function renderCategories(items) {
    const totals = new Map();
    for (const expense of items) {
        totals.set(expense.category, (totals.get(expense.category) || 0) + Math.round(expense.amount * 100));
    }

    const sortedCategories = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const totalCents = sortedCategories.reduce((sum, entry) => sum + entry[1], 0);
    const chart = document.getElementById("category-chart");
    const chartTotal = document.getElementById("chart-total");
    const legend = document.getElementById("category-legend");
    chartTotal.textContent = money(totalCents / 100, true);
    legend.replaceChildren();

    if (totalCents === 0) {
        chart.style.background = "conic-gradient(#e9eee9 0deg 360deg)";
        chart.setAttribute("aria-label", "No expenses in this month");
        const message = document.createElement("p");
        message.className = "legend-empty";
        message.textContent = "Your category breakdown will show here.";
        legend.append(message);
        return;
    }

    let currentDegree = 0;
    const segments = sortedCategories.map(([name, amountCents]) => {
        const nextDegree = currentDegree + amountCents / totalCents * 360;
        const segment = `${categories[name].color} ${currentDegree}deg ${nextDegree}deg`;
        currentDegree = nextDegree;
        return segment;
    });
    chart.style.background = `conic-gradient(${segments.join(", ")})`;
    chart.setAttribute("aria-label", `Spending by category, total ${money(totalCents / 100)}`);

    for (const [name, amountCents] of sortedCategories) {
        const amount = amountCents / 100;
        const row = document.createElement("div");
        row.className = "legend-row";
        const label = document.createElement("span");
        label.className = "legend-name";
        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";
        swatch.style.setProperty("--category-color", categories[name].color);
        swatch.setAttribute("aria-hidden", "true");
        label.append(swatch, document.createTextNode(name));
        const value = document.createElement("strong");
        value.textContent = money(amount, true);
        const percent = document.createElement("span");
        percent.className = "legend-percent";
        percent.textContent = `${Math.round(amountCents / totalCents * 100)}%`;
        row.append(label, value, percent);
        legend.append(row);
    }
}

function renderBudgetInput() {
    budgetInput.value = budgets[monthFilter.value] === undefined
        ? ""
        : String(budgets[monthFilter.value]);
}

function render() {
    const items = selectedMonthExpenses();
    renderSummary(items);
    renderTransactions(items);
    renderCategories(items);
    renderBudgetInput();
}

expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const description = document.getElementById("description-input").value.trim();
    const amount = Number(document.getElementById("amount-input").value);
    const category = document.getElementById("category-input").value;
    const date = expenseDateInput.value;

    if (!description || description.length > 60) {
        formMessage.textContent = "Enter a description of 1–60 characters.";
        formMessage.classList.remove("success");
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        formMessage.textContent = "Enter an amount greater than zero.";
        formMessage.classList.remove("success");
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(categories, category) || !isValidDate(date)) {
        formMessage.textContent = "Choose a valid category and date.";
        formMessage.classList.remove("success");
        return;
    }

    expenses.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        description,
        amount: Math.round(amount * 100) / 100,
        category,
        date,
        createdAt: Date.now()
    });
    const saved = saveStoredValue(expenseStorageKey, expenses);
    monthFilter.value = date.slice(0, 7);
    expenseForm.reset();
    expenseDateInput.value = todayString;
    formMessage.textContent = saved
        ? "Expense added."
        : "Expense added for this session, but could not be saved.";
    formMessage.classList.toggle("success", saved);
    render();
});

budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rawValue = budgetInput.value.trim();
    if (rawValue === "") {
        delete budgets[monthFilter.value];
    } else {
        const amount = Number(rawValue);
        if (!Number.isFinite(amount) || amount < 0) {
            formMessage.textContent = "Enter a valid budget of zero or more.";
            formMessage.classList.remove("success");
            budgetInput.focus();
            return;
        }
        budgets[monthFilter.value] = Math.round(amount * 100) / 100;
    }

    const saved = saveStoredValue(budgetStorageKey, budgets);
    formMessage.textContent = saved
        ? (rawValue === "" ? "Monthly budget removed." : "Monthly budget saved.")
        : "Budget updated for this session, but could not be saved.";
    formMessage.classList.toggle("success", saved);
    render();
});

monthFilter.addEventListener("change", () => {
    if (!isValidMonth(monthFilter.value)) monthFilter.value = todayString.slice(0, 7);
    formMessage.textContent = "";
    formMessage.classList.remove("success");
    render();
});

transactionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-expense-id]");
    if (!button) return;
    expenses = expenses.filter((expense) => expense.id !== button.dataset.expenseId);
    const saved = saveStoredValue(expenseStorageKey, expenses);
    formMessage.textContent = saved
        ? "Expense deleted."
        : "Expense deleted for this session, but the change could not be saved.";
    formMessage.classList.toggle("success", saved);
    render();
});

render();
