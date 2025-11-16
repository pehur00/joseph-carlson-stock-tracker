let stockData = [];

const weights = {
  valueRank: 0.25,
  expectedReturn: 0.2,
  fcfQuality: 0.15,
  roicStrength: 0.15,
  balanceSheetStrength: 0.1,
  revenueDurability: 0.1,
  insiderActivity: 0.05,
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

let tableBody;
let sortSelect;
let expandedTicker = null;

function toHundredScale(score) {
  return score * 20;
}

function computeUndervaluationScore(stock) {
  const total =
    weights.valueRank * toHundredScale(stock.valueRank) +
    weights.expectedReturn * toHundredScale(stock.expectedReturn) +
    weights.fcfQuality * toHundredScale(stock.fcfQuality) +
    weights.roicStrength * toHundredScale(stock.roicStrength) +
    weights.balanceSheetStrength * toHundredScale(stock.balanceSheetStrength) +
    weights.revenueDurability * toHundredScale(stock.revenueDurability) +
    weights.insiderActivity * toHundredScale(stock.insiderActivity);

  return Math.round(total);
}

function deriveRiskLevel(stock) {
  const avgQuality =
    (stock.fcfQuality + stock.roicStrength + stock.revenueDurability + stock.balanceSheetStrength) / 4;

  if (avgQuality >= 4.3) return 'Low';
  if (avgQuality >= 3.3) return 'Moderate';
  if (avgQuality >= 2.5) return 'High';
  return 'Speculative';
}

function deriveQualitySummary(stock) {
  return ((stock.fcfQuality + stock.roicStrength) / 2).toFixed(1);
}

function deriveModels(stock) {
  return {
    ...stock,
    undervaluationScore: computeUndervaluationScore(stock),
    riskLevel: deriveRiskLevel(stock),
    qualitySummary: deriveQualitySummary(stock),
  };
}

function renderTable(sortKey = 'undervaluationScore') {
  expandedTicker = null;
  const viewModels = stockData.map(deriveModels);
  viewModels.sort((a, b) => {
    const dir = sortKey === 'price' ? 1 : -1; // price is ascending, scores descending
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === bVal) {
      return a.ticker.localeCompare(b.ticker);
    }
    return dir * (aVal - bVal);
  });

  tableBody.innerHTML = '';
  viewModels.forEach((stock) => {
    const row = document.createElement('tr');
    row.classList.add('data-row');
    row.dataset.ticker = stock.ticker;

    row.innerHTML = `
      <td><span class="badge category-${stock.category.toLowerCase()}">${stock.category}</span></td>
      <td>${stock.ticker}</td>
      <td>${stock.name}</td>
      <td>${currencyFormatter.format(stock.price)}</td>
      <td><span class="badge value">${stock.dcf.base}</span></td>
      <td>${stock.valueRank.toFixed(1)}</td>
      <td>${stock.qualitySummary}</td>
      <td>${stock.undervaluationScore}</td>
      <td>${renderRiskBadge(stock.riskLevel)}</td>
      <td>${stock.lastUpdated}</td>
    `;

    row.addEventListener('click', () => toggleDetailRow(stock, row));
    tableBody.appendChild(row);

    if (expandedTicker === stock.ticker) {
      appendDetailRow(stock, row);
    }
  });
}

function renderRiskBadge(riskLevel) {
  const key = riskLevel.toLowerCase();
  return `<span class="badge risk-${key}">${riskLevel}</span>`;
}

function toggleDetailRow(stock, row) {
  const alreadyExpanded = expandedTicker === stock.ticker;
  collapseDetailRow();

  if (!alreadyExpanded) {
    expandedTicker = stock.ticker;
    appendDetailRow(stock, row);
  }
}

function collapseDetailRow() {
  const detailRow = tableBody.querySelector('tr.detail-row');
  if (detailRow) {
    detailRow.remove();
  }
  expandedTicker = null;
}

function appendDetailRow(stock, row) {
  const detailRow = document.createElement('tr');
  detailRow.classList.add('detail-row');
  const colSpan = document.querySelectorAll('#stock-table thead th').length;
  detailRow.innerHTML = `<td colspan="${colSpan}">${buildDetailCard(stock)}</td>`;
  row.insertAdjacentElement('afterend', detailRow);
}

function buildDetailCard(stock) {
  const factors = [
    ['DCF Conservative', stock.dcf.conservative],
    ['DCF Base', stock.dcf.base],
    ['DCF Aggressive', stock.dcf.aggressive],
    ['FCF Quality', stock.fcfQuality],
    ['ROIC Strength', stock.roicStrength],
    ['Revenue Durability', stock.revenueDurability],
    ['Balance Sheet Strength', stock.balanceSheetStrength],
    ['Insider Activity', stock.insiderActivity],
    ['Value Rank', stock.valueRank],
    ['Expected Return', stock.expectedReturn],
  ];

  return `
    <div class="detail-card">
      <h4>${stock.name} (${stock.ticker})</h4>
      ${factors
        .map(
          ([label, value]) => `
            <div>
              <span class="label">${label}</span>
              <span class="value">${value}</span>
            </div>
          `,
        )
        .join('')}
      <div>
        <span class="label">Undervaluation Score</span>
        <span class="value">${stock.undervaluationScore}</span>
      </div>
      <div>
        <span class="label">Risk Level</span>
        <span class="value">${stock.riskLevel}</span>
      </div>
      <div>
        <span class="label">Last Updated</span>
        <span class="value">${stock.lastUpdated}</span>
      </div>
    </div>
  `;
}

async function fetchStockData() {
  try {
    const response = await fetch('data/stocks.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    stockData = await response.json();
    return true;
  } catch (error) {
    console.error('Failed to load stock data:', error);
    return false;
  }
}

function showError() {
  tableBody = document.querySelector('#stock-table tbody');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="10" style="text-align: center; padding: 2rem; color: var(--muted);">
        Failed to load stock data. Please try refreshing the page.
      </td>
    </tr>
  `;
}

function showLoading() {
  tableBody = document.querySelector('#stock-table tbody');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="10" style="text-align: center; padding: 2rem; color: var(--muted);">
        Loading stock data...
      </td>
    </tr>
  `;
}

async function initUndervaluationTable() {
  tableBody = document.querySelector('#stock-table tbody');
  sortSelect = document.querySelector('#sort-select');
  if (!tableBody || !sortSelect) return;

  showLoading();

  const success = await fetchStockData();
  if (!success) {
    showError();
    return;
  }

  sortSelect.addEventListener('change', (event) => {
    const sortKey = event.target.value;
    renderTable(sortKey);
  });

  renderTable();
}

window.addEventListener('DOMContentLoaded', initUndervaluationTable);
