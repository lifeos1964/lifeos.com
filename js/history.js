import { formatCurrency, formatDate, showToast } from './utils.js';

const MAX_HISTORY_YEARS = 3;

function toDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(date) {
    return date.toISOString().slice(0, 10);
}

function getDateBounds() {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - MAX_HISTORY_YEARS);
    return { start: dateInputValue(start), end: dateInputValue(end) };
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>\'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function downloadCsv(title, columns, rows) {
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    link.click();
}

export function openHistoricalStatement({ title, description, records, getRecordDate, getColumns, getRow, getSummary }) {
    const bounds = getDateBounds();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card history-modal-card">
            <div class="modal-header">
                <div>
                    <span class="eyebrow">Historical statement</span>
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <p class="history-intro">${escapeHtml(description)} Choose any period from the last ${MAX_HISTORY_YEARS} years.</p>
                <div class="history-filters">
                    <label>From<input id="history-start" class="form-control" type="date" min="${bounds.start}" max="${bounds.end}" value="${bounds.start}"></label>
                    <label>To<input id="history-end" class="form-control" type="date" min="${bounds.start}" max="${bounds.end}" value="${bounds.end}"></label>
                </div>
                <div id="history-summary" class="history-summary"></div>
                <div id="history-table" class="history-table-wrap"></div>
                <div class="history-actions">
                    <button type="button" class="btn-secondary" id="history-csv"><i class="fa-solid fa-download"></i> Download CSV</button>
                    <button type="button" class="btn-primary" id="history-print"><i class="fa-solid fa-print"></i> Print statement</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };

    const startInput = overlay.querySelector('#history-start');
    const endInput = overlay.querySelector('#history-end');
    const summary = overlay.querySelector('#history-summary');
    const table = overlay.querySelector('#history-table');
    let currentRows = [];

    const render = () => {
        const start = new Date(`${startInput.value}T00:00:00`);
        const end = new Date(`${endInput.value}T23:59:59`);
        const selected = start > end ? [] : records.filter(record => {
            const date = toDate(getRecordDate(record));
            return date && date >= start && date <= end;
        });
        currentRows = selected.map(getRow);
        summary.innerHTML = getSummary(selected, startInput.value, endInput.value);
        const columns = getColumns();
        table.innerHTML = selected.length ? `<table><thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${currentRows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty-state">No records found for this period.</div>';
    };

    startInput.onchange = render;
    endInput.onchange = render;
    overlay.querySelector('#history-csv').onclick = () => {
        if (!currentRows.length) return showToast('There is no data to export for this period.');
        downloadCsv(title, getColumns(), currentRows);
        showToast('Statement downloaded.');
    };
    overlay.querySelector('#history-print').onclick = () => {
        if (!currentRows.length) return showToast('There is no data to print for this period.');
        const printWindow = window.open('', '_blank');
        if (!printWindow) return showToast('Please allow pop-ups to print the statement.');
        printWindow.document.write(`<html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172033}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ccd3df;text-align:left}th{background:#eef2f7}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(startInput.value)} to ${escapeHtml(endInput.value)}</p><table><thead><tr>${getColumns().map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${currentRows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    render();
}

export { formatDate, formatCurrency };
