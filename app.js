'use strict';

const STORAGE_KEY = 'rishi_budget_data_v1';

const CATEGORIES = [
  'Food', 'Groceries', 'Flat Rent', 'Electricity', 'Water',
  'Wi-Fi / Internet', 'Maintenance', 'Transport', 'Education',
  'Mobile', 'Personal Care', 'Entertainment', 'Health', 'Other'
];

const FLAT_CATEGORIES = [
  'Flat Rent', 'Electricity', 'Water',
  'Wi-Fi / Internet', 'Maintenance', 'Groceries'
];

const CATEGORY_ICONS = {
  'Food':'🍲',
  'Groceries':'🛒',
  'Flat Rent':'🏠',
  'Electricity':'💡',
  'Water':'🚿',
  'Wi-Fi / Internet':'📶',
  'Maintenance':'🧰',
  'Transport':'🚌',
  'Education':'📚',
  'Mobile':'📱',
  'Personal Care':'🧴',
  'Entertainment':'🎬',
  'Health':'💊',
  'Other':'•'
};

const COLORS = [
  '#6378f4','#35ad8a','#e6a34f','#e47d70',
  '#9b80e8','#48a9c7','#d27cae','#8796a8'
];

const $ = id => document.getElementById(id);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const monthISO = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;

const money = value =>
  new Intl.NumberFormat('en-IN', {
    style:'currency',
    currency:'INR',
    maximumFractionDigits:2
  }).format(Number(value)||0);

const monthName = key => {
  if (!key) return '';
  const [y,m] = key.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleDateString('en-IN',{
    month:'long',
    year:'numeric'
  });
};

const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));

function emptyData() {
  return {
    version:1,
    expenses:[],
    income:[],
    plans:{}
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();

    const parsed = JSON.parse(raw);

    return {
      version:1,
      expenses:Array.isArray(parsed.expenses) ? parsed.expenses : [],
      income:Array.isArray(parsed.income) ? parsed.income : [],
      plans:parsed.plans && typeof parsed.plans === 'object'
        ? parsed.plans
        : {}
    };
  } catch (err) {
    console.error('Could not read saved data',err);
    return emptyData();
  }
}

let data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  renderAll();
}

function sum(items) {
  return items.reduce((total,item) =>
    total + (Number(item.amount)||0),0
  );
}

function expensesForMonth(month) {
  return data.expenses.filter(item =>
    item.date && item.date.startsWith(month)
  );
}

function incomeForMonth(month) {
  return data.income.filter(item =>
    item.date && item.date.startsWith(month)
  );
}

function planForMonth(month) {
  return data.plans[month] || {income:0,budget:0};
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() =>
    el.classList.remove('show'),2600
  );
}

function setView(view) {
  const valid = [
    'dashboard','daily','flat',
    'reports','history','settings'
  ];

  if (!valid.includes(view)) return;

  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active',el.id === `view-${view}`);
  });

  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active',el.dataset.view === view);
  });

  $('page-title').textContent = ({
    dashboard:'Dashboard',
    daily:'Daily expenses',
    flat:'Flat management',
    reports:'Reports & insights',
    history:'Transaction history',
    settings:'Settings & backup'
  })[view];

  if (view === 'settings') loadPlanForm();

  renderAll();
  window.scrollTo({top:0,behavior:'smooth'});
}

function showDialog(id) {
  const dlg = $(id);

  if (dlg && typeof dlg.showModal === 'function') {
    dlg.showModal();
  } else if (dlg) {
    dlg.setAttribute('open','');
  }
}

function closeDialog(id) {
  const dlg = $(id);

  if (dlg?.open) {
    dlg.close();
  } else {
    dlg?.removeAttribute('open');
  }
}

function populateCategories() {
  const options = CATEGORIES.map(c =>
    `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
  ).join('');

  $('expense-category').innerHTML = options;

  $('history-category').innerHTML =
    '<option value="">All categories</option>' + options;
}

function openExpense(item=null,category=null) {
  $('expense-form').reset();

  $('expense-id').value = item?.id || '';
  $('expense-description').value = item?.description || '';
  $('expense-amount').value = item?.amount ?? '';
  $('expense-category').value =
    item?.category || category || 'Food';
  $('expense-date').value = item?.date || todayISO();
  $('expense-payment').value = item?.payment || 'UPI';
  $('expense-notes').value = item?.notes || '';

  $('expense-modal-title').textContent =
    item ? 'Edit expense' : 'Add expense';

  showDialog('expense-dialog');

  setTimeout(() =>
    $('expense-description').focus(),80
  );
}

function addExpenseFromForm(event) {
  event.preventDefault();

  const id = $('expense-id').value;
  const amount = Number($('expense-amount').value);

  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Enter an amount greater than zero.');
    return;
  }

  const item = {
    id:id || (crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now())),
    description:$('expense-description').value.trim(),
    amount,
    category:$('expense-category').value,
    date:$('expense-date').value,
    payment:$('expense-payment').value,
    notes:$('expense-notes').value.trim(),
    updatedAt:new Date().toISOString()
  };

  if (!item.description || !item.date) {
    toast('Please complete the required fields.');
    return;
  }

  if (id) {
    const index = data.expenses.findIndex(x => x.id === id);
    if (index >= 0) data.expenses[index] = item;
  } else {
    data.expenses.push(item);
  }

  closeDialog('expense-dialog');
  saveData();
  toast(id ? 'Expense updated.' : 'Expense saved.');
}

function deleteExpense(id) {
  const item = data.expenses.find(x => x.id === id);
  if (!item) return;

  if (!confirm(`Delete "${item.description}" (${money(item.amount)})?`)) {
    return;
  }

  data.expenses = data.expenses.filter(x => x.id !== id);
  saveData();
  toast('Transaction deleted.');
}

function transactionHTML(item,actions=false) {
  return `
    <div class="transaction-item">
      <div class="transaction-icon">
        ${CATEGORY_ICONS[item.category] || '•'}
      </div>

      <div class="transaction-main">
        <strong>${escapeHTML(item.description)}</strong>
        <small>
          ${escapeHTML(item.category)} ·
          ${escapeHTML(item.date)} ·
          ${escapeHTML(item.payment || '')}
        </small>
      </div>

      <div class="transaction-amount">
        −${money(item.amount)}
      </div>

      ${actions ? `
        <div class="row-actions">
          <button class="icon-btn"
            data-edit="${escapeHTML(item.id)}"
            title="Edit" aria-label="Edit">✎</button>

          <button class="icon-btn"
            data-delete="${escapeHTML(item.id)}"
            title="Delete" aria-label="Delete">×</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderDashboard() {
  const month = $('dashboard-month').value || monthISO();
  const expenses = expensesForMonth(month);
  const plan = planForMonth(month);

  const income =
    sum(incomeForMonth(month)) + Number(plan.income || 0);

  const spent = sum(expenses);
  const balance = income - spent;

  const todayItems = data.expenses.filter(x =>
    x.date === todayISO()
  );

  $('stat-balance').textContent = money(balance);
  $('stat-income').textContent = money(income);
  $('stat-expenses').textContent = money(spent);
  $('stat-today').textContent = money(sum(todayItems));

  $('today-count').textContent =
    `${todayItems.length} transaction${todayItems.length === 1 ? '' : 's'}`;

  $('budget-spent').textContent = money(spent);
  $('budget-limit').textContent = money(plan.budget);

  const pct = plan.budget > 0
    ? Math.min(100,spent/plan.budget*100)
    : 0;

  $('budget-progress').style.width = `${pct}%`;
  $('budget-progress').classList.toggle('warn',pct >= 75);

  $('budget-percent').textContent = plan.budget
    ? `${Math.round(spent/plan.budget*100)}% used`
    : 'No budget set';

  $('budget-remaining').textContent = plan.budget
    ? `${money(plan.budget-spent)} remaining`
    : 'Set a budget in Settings';

  $('budget-status').textContent =
    !plan.budget ? 'No budget set' :
    pct >= 100 ? 'Budget exceeded' :
    pct >= 90 ? 'Near limit' :
    pct >= 75 ? 'Watch spending' :
    'On track';

  $('savings-value').textContent = money(balance);
  $('savings-income').textContent = money(income);
  $('savings-expenses').textContent = money(spent);

  $('savings-note').textContent =
    income === 0 && spent === 0
      ? 'Add income and expenses to get started.'
      : balance >= 0
        ? 'This is your remaining balance for the month.'
        : 'You have spent more than your recorded income.';

  renderCategoryBars('dashboard-categories',expenses);

  const recent = [...data.expenses]
    .sort((a,b) =>
      b.date.localeCompare(a.date) ||
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )
    .slice(0,5);

  $('recent-list').innerHTML = recent.length
    ? recent.map(x => transactionHTML(x)).join('')
    : '<div class="empty-state">No transactions yet. Add your first expense.</div>';
}

function renderDaily() {
  const date = $('daily-date').value || todayISO();

  const list = data.expenses
    .filter(x => x.date === date)
    .sort((a,b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );

  $('daily-total').textContent = money(sum(list));

  $('daily-summary').textContent = list.length
    ? `${list.length} transaction${list.length === 1 ? '' : 's'} recorded on ${new Date(`${date}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}.`
    : 'No expenses recorded for this date.';

  $('daily-list').innerHTML = list.length
    ? list.map(x => transactionHTML(x,true)).join('')
    : '<div class="empty-state">Nothing recorded for this day.</div>';
}

function renderFlat() {
  const month = $('flat-month').value || monthISO();

  const items = expensesForMonth(month).filter(x =>
    FLAT_CATEGORIES.includes(x.category)
  );

  $('flat-cards').innerHTML = FLAT_CATEGORIES.map(cat => {
    const matching = items.filter(x => x.category === cat);
    const total = sum(matching);

    return `
      <div class="flat-card">
        <span>${CATEGORY_ICONS[cat]} &nbsp;${escapeHTML(cat)}</span>
        <strong>${money(total)}</strong>
        <small>${matching.length} record(s) · ${escapeHTML(monthName(month))}</small>
      </div>
    `;
  }).join('');

  $('flat-list').innerHTML = items.length
    ? [...items]
        .sort((a,b) => b.date.localeCompare(a.date))
        .map(x => transactionHTML(x,true)).join('')
    : '<div class="empty-state">No household bills recorded for this month. Use "Add flat bill" to record one.</div>';
}

function renderCategoryBars(targetId,items) {
  const totals = {};

  items.forEach(x => {
    totals[x.category] =
      (totals[x.category] || 0) + Number(x.amount);
  });

  const entries = Object.entries(totals)
    .sort((a,b) => b[1]-a[1]);

  const max = entries[0]?.[1] || 1;

  $(targetId).innerHTML = entries.length
    ? entries.map(([name,value],i) => `
        <div class="category-row">
          <span class="category-name">
            ${CATEGORY_ICONS[name] || ''} ${escapeHTML(name)}
          </span>
          <div class="bar-track">
            <div class="bar-fill"
              style="width:${value/max*100}%;--bar:${COLORS[i%COLORS.length]}">
            </div>
          </div>
          <span class="category-amount">${money(value)}</span>
        </div>
      `).join('')
    : '<div class="empty-state">No expenses for this month yet.</div>';
}

function renderReports() {
  const month = $('report-month').value || monthISO();
  const items = expensesForMonth(month);
  const spent = sum(items);
  const plan = planForMonth(month);

  const income =
    sum(incomeForMonth(month)) + Number(plan.income || 0);

  const previous = new Date(
    Number(month.slice(0,4)),
    Number(month.slice(5,7))-2,
    1
  );

  const prevKey = monthISO(previous);
  const prevSpent = sum(expensesForMonth(prevKey));

  const delta = prevSpent
    ? ((spent-prevSpent)/prevSpent*100)
    : null;

  $('report-summary').innerHTML = `
    <div class="report-kpi">
      <small>TOTAL SPENT · ${escapeHTML(monthName(month).toUpperCase())}</small>
      <strong>${money(spent)}</strong>
    </div>
    <div class="report-kpi">
      <small>RECORDED INCOME</small>
      <strong>${money(income)}</strong>
    </div>
    <div class="report-kpi">
      <small>VS PREVIOUS MONTH</small>
      <strong>${delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}</strong>
    </div>
  `;

  renderCategoryBars('report-categories',items);

  const keys = [];

  for (let i=5; i>=0; i--) {
    const d = new Date(
      Number(month.slice(0,4)),
      Number(month.slice(5,7))-1-i,
      1
    );
    keys.push(monthISO(d));
  }

  const values = keys.map(k => sum(expensesForMonth(k)));
  const max = Math.max(...values,1);

  $('monthly-chart').innerHTML = keys.map((k,i) => `
    <div class="month-col">
      <div class="month-bar-wrap">
        <div class="month-bar"
          style="height:${Math.max(2,values[i]/max*100)}%"
          title="${money(values[i])}">
        </div>
      </div>
      <em>${moneyCompact(values[i])}</em>
      <small>${new Date(
        Number(k.slice(0,4)),
        Number(k.slice(5,7))-1,
        1
      ).toLocaleDateString('en-IN',{month:'short'})}</small>
    </div>
  `).join('');
}

function moneyCompact(value) {
  const n = Number(value) || 0;

  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n/1000).toFixed(1)}k`;

  return `₹${Math.round(n)}`;
}

function renderHistory() {
  const query = $('history-search').value.trim().toLowerCase();
  const category = $('history-category').value;
  const month = $('history-month').value;

  const items = [...data.expenses]
    .filter(x =>
      (!query || `${x.description} ${x.category} ${x.notes || ''}`.toLowerCase().includes(query)) &&
      (!category || x.category === category) &&
      (!month || x.date.startsWith(month))
    )
    .sort((a,b) => b.date.localeCompare(a.date));

  $('history-list').innerHTML = items.length
    ? items.map(x => transactionHTML(x,true)).join('')
    : '<div class="empty-state">No matching transactions found.</div>';

  $('history-count').textContent =
    `Showing ${items.length} of ${data.expenses.length} expense record(s).`;

  $('history-count').style.paddingTop = '12px';
}

function renderAll() {
  if (!$('dashboard-month')) return;

  renderDashboard();
  renderDaily();
  renderFlat();
  renderReports();
  renderHistory();
}

function loadPlanForm() {
  const month = $('plan-month').value || monthISO();
  const plan = planForMonth(month);

  $('plan-income').value = plan.income || '';
  $('plan-budget').value = plan.budget || '';
}

function savePlan(event) {
  event.preventDefault();

  const month = $('plan-month').value;
  const income = Number($('plan-income').value) || 0;
  const budget = Number($('plan-budget').value) || 0;

  if (!month || income < 0 || budget < 0) {
    toast('Please enter a valid month and amounts.');
    return;
  }

  data.plans[month] = {income,budget};

  saveData();

  $('plan-message').textContent = 'Monthly plan saved.';
  toast('Monthly plan saved.');
}

function openIncome() {
  $('income-form').reset();
  $('income-date').value = todayISO();
  showDialog('income-dialog');
}

function saveIncome(event) {
  event.preventDefault();

  const amount = Number($('income-amount').value);

  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Enter an income amount greater than zero.');
    return;
  }

  data.income.push({
    id:crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),
    source:$('income-source').value.trim(),
    amount,
    date:$('income-date').value
  });

  closeDialog('income-dialog');
  saveData();
  toast('Income saved.');
}

function downloadFile(filename,content,type) {
  const blob = new Blob([content],{type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportJSON() {
  const backup = {
    ...data,
    exportedAt:new Date().toISOString(),
    app:'RISHI_budget'
  };

  downloadFile(
    `RISHI_budget_backup_${todayISO()}.json`,
    JSON.stringify(backup,null,2),
    'application/json'
  );

  toast('Full backup downloaded.');
}

function exportCSV() {
  const rows = [
    ['Date','Description','Category','Amount INR','Payment method','Notes'],
    ...data.expenses.map(x => [
      x.date,x.description,x.category,x.amount,
      x.payment || '',x.notes || ''
    ])
  ];

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? '').replace(/"/g,'""')}"`
    ).join(',')
  ).join('\r\n');

  downloadFile(
    `RISHI_budget_expenses_${todayISO()}.csv`,
    '\ufeff' + csv,
    'text/csv;charset=utf-8'
  );

  toast('Expense CSV downloaded.');
}

function importJSON(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      if (
        !parsed ||
        !Array.isArray(parsed.expenses) ||
        !Array.isArray(parsed.income) ||
        !parsed.plans ||
        typeof parsed.plans !== 'object'
      ) {
        throw new Error('Invalid backup format');
      }

      const validExpenses = parsed.expenses.every(x =>
        x &&
        typeof x.id === 'string' &&
        typeof x.description === 'string' &&
        Number.isFinite(Number(x.amount)) &&
        typeof x.date === 'string' &&
        typeof x.category === 'string'
      );

      const validIncome = parsed.income.every(x =>
        x &&
        typeof x.id === 'string' &&
        Number.isFinite(Number(x.amount)) &&
        typeof x.date === 'string'
      );

      if (!validExpenses || !validIncome) {
        throw new Error('Backup contains invalid records');
      }

      if (!confirm(
        `Restore ${parsed.expenses.length} expenses and ${parsed.income.length} income records? This replaces the data currently stored in this browser.`
      )) {
        return;
      }

      data = {
        version:1,
        expenses:parsed.expenses,
        income:parsed.income,
        plans:parsed.plans
      };

      saveData();
      toast('Backup restored successfully.');

    } catch (err) {
      alert(`Could not restore backup: ${err.message}`);
    } finally {
      $('import-file').value = '';
    }
  };

  reader.readAsText(file);
}

function init() {
  const month = monthISO();

  $('dashboard-month').value = month;
  $('flat-month').value = month;
  $('report-month').value = month;
  $('history-month').value = month;
  $('plan-month').value = month;
  $('daily-date').value = todayISO();

  $('today-label').textContent =
    new Date().toLocaleDateString('en-IN',{
      weekday:'short',
      day:'numeric',
      month:'short'
    });

  populateCategories();

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click',() =>
      setView(btn.dataset.view)
    );
  });

  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click',() =>
      setView(btn.dataset.goto)
    );
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click',() =>
      closeDialog(btn.dataset.close)
    );
  });

  $('quick-add').addEventListener('click',() => openExpense());
  $('daily-add').addEventListener('click',() => openExpense());
  $('history-add').addEventListener('click',() => openExpense());
  $('flat-add').addEventListener('click',() => openExpense(null,'Flat Rent'));

  $('expense-form').addEventListener('submit',addExpenseFromForm);
  $('income-form').addEventListener('submit',saveIncome);
  $('plan-form').addEventListener('submit',savePlan);

  $('dashboard-month').addEventListener('change',renderAll);
  $('daily-date').addEventListener('change',renderDaily);
  $('flat-month').addEventListener('change',renderFlat);
  $('report-month').addEventListener('change',renderReports);
  $('history-month').addEventListener('change',renderHistory);
  $('history-search').addEventListener('input',renderHistory);
  $('history-category').addEventListener('change',renderHistory);
  $('plan-month').addEventListener('change',loadPlanForm);

  $('add-income').addEventListener('click',openIncome);
  $('export-json').addEventListener('click',exportJSON);
  $('export-csv').addEventListener('click',exportCSV);
  $('import-trigger').addEventListener('click',() =>
    $('import-file').click()
  );
  $('import-file').addEventListener('change',event =>
    importJSON(event.target.files[0])
  );

  $('clear-data').addEventListener('click',() => {
    if (confirm(
      'Permanently delete all RISHI_budget expenses, income and plans from this browser? Download a backup first if needed.'
    )) {
      data = emptyData();
      saveData();
      toast('All app data cleared.');
    }
  });

  document.body.addEventListener('click',event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');

    if (edit) {
      const item = data.expenses.find(x => x.id === edit.dataset.edit);
      if (item) openExpense(item);
    }

    if (del) deleteExpense(del.dataset.delete);
  });

  renderAll();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load',() => {
      navigator.serviceWorker.register('./sw.js').catch(err =>
        console.warn('Service worker registration failed',err)
      );
    });
  }
}

document.addEventListener('DOMContentLoaded',init);