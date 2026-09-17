import { fromDbNumeric } from "@/lib/accounting/money";
import { formatMoneyDisplay, formatDateId } from "@/lib/ui/format";

export type CompanyBlock = {
  name: string;
  companyCode: string;
  address: string | null;
  npwp: string | null;
  phone: string | null;
  email: string | null;
  bankAccountLabel: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function companyHeader(company: CompanyBlock, title: string): string {
  return `
  <header class="doc-head">
    <div>
      <p class="brand">${escapeHtml(company.name)}</p>
      <p class="meta">${escapeHtml(company.address ?? "")}</p>
      <p class="meta">NPWP: ${escapeHtml(company.npwp ?? "-")} · Tel: ${escapeHtml(company.phone ?? "-")}</p>
    </div>
    <div class="title-block">
      <h1>${escapeHtml(title)}</h1>
    </div>
  </header>`;
}

const baseCss = `
  :root { --teal: #018081; --ink: #0B0B0F; --mist: #C9DEDC; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Plus Jakarta Sans", system-ui, sans-serif; color: var(--ink); background: #fff; }
  .page { padding: 24px; max-width: 800px; margin: 0 auto; }
  .page-a5 { max-width: 420px; }
  .doc-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid var(--teal); padding-bottom: 12px; margin-bottom: 16px; }
  .brand { margin: 0; font-size: 20px; font-weight: 700; color: var(--teal); }
  .meta { margin: 2px 0; font-size: 12px; color: #4A4954; }
  .title-block h1 { margin: 0; font-size: 22px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--mist); padding: 8px 6px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; color: #4A4954; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 12px; width: 280px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .toolbar { position: sticky; top: 0; background: #E1F7F4; padding: 12px 24px; display: flex; gap: 8px; }
  .toolbar button, .toolbar a { border: 1px solid var(--teal); background: var(--teal); color: #fff; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-size: 13px; cursor: pointer; }
  .toolbar a.secondary { background: #fff; color: var(--teal); }
  @media print {
    .toolbar { display: none; }
    .page { max-width: none; padding: 0; }
  }
`;

export function wrapDocumentHtml(input: {
  title: string;
  body: string;
  a5?: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Cetak PDF</button>
    <a class="secondary" href="javascript:history.back()">Kembali</a>
  </div>
  <div class="page ${input.a5 ? "page-a5" : ""}">${input.body}</div>
</body>
</html>`;
}

export function renderQuotationHtml(data: {
  company: CompanyBlock;
  documentNo: string;
  quoteDate: string;
  validUntil: string | null;
  customerName: string;
  customerAddress: string | null;
  notes: string | null;
  subtotal: string;
  discount: string;
  taxAmount: string;
  total: string;
  items: Array<{
    lineNo: number;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
}): string {
  const rows = data.items
    .map(
      (item) => `<tr>
      <td>${item.lineNo}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      <td class="num">${formatMoneyDisplay(fromDbNumeric(item.unitPrice))}</td>
      <td class="num">${formatMoneyDisplay(fromDbNumeric(item.amount))}</td>
    </tr>`,
    )
    .join("");
  const body = `
    ${companyHeader(data.company, "Quotation")}
    <p><strong>${escapeHtml(data.documentNo)}</strong> · ${formatDateId(data.quoteDate)}
    ${data.validUntil ? ` · Berlaku s.d. ${formatDateId(data.validUntil)}` : ""}</p>
    <p>Kepada: <strong>${escapeHtml(data.customerName)}</strong><br/>
    ${escapeHtml(data.customerAddress ?? "")}</p>
    <table>
      <thead><tr><th>No</th><th>Uraian</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.subtotal))}</span></div>
      <div><span>Diskon</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.discount))}</span></div>
      <div><span>PPN</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.taxAmount))}</span></div>
      <div><strong>Total</strong><strong class="num">${formatMoneyDisplay(fromDbNumeric(data.total))}</strong></div>
    </div>
    ${data.notes ? `<p class="meta">${escapeHtml(data.notes)}</p>` : ""}
  `;
  return wrapDocumentHtml({ title: data.documentNo, body });
}

export function renderInvoiceHtml(data: {
  company: CompanyBlock;
  documentNo: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string | null;
  notes: string | null;
  subtotal: string;
  discount: string;
  taxAmount: string;
  retentionAmount: string;
  total: string;
  items: Array<{
    lineNo: number;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
}): string {
  const rows = data.items
    .map(
      (item) => `<tr>
      <td>${item.lineNo}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      <td class="num">${formatMoneyDisplay(fromDbNumeric(item.unitPrice))}</td>
      <td class="num">${formatMoneyDisplay(fromDbNumeric(item.amount))}</td>
    </tr>`,
    )
    .join("");
  const body = `
    ${companyHeader(data.company, "Invoice")}
    <p><strong>${escapeHtml(data.documentNo)}</strong> · ${formatDateId(data.invoiceDate)}
    · Jatuh tempo ${formatDateId(data.dueDate)}</p>
    <p>Kepada: <strong>${escapeHtml(data.customerName)}</strong><br/>
    ${escapeHtml(data.customerAddress ?? "")}</p>
    <table>
      <thead><tr><th>No</th><th>Uraian</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.subtotal))}</span></div>
      <div><span>Diskon</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.discount))}</span></div>
      <div><span>PPN</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.taxAmount))}</span></div>
      <div><span>Retensi</span><span class="num">${formatMoneyDisplay(fromDbNumeric(data.retentionAmount))}</span></div>
      <div><strong>Total</strong><strong class="num">${formatMoneyDisplay(fromDbNumeric(data.total))}</strong></div>
    </div>
    ${data.company.bankAccountLabel ? `<p class="meta">Transfer ke: ${escapeHtml(data.company.bankAccountLabel)}</p>` : ""}
    ${data.notes ? `<p class="meta">${escapeHtml(data.notes)}</p>` : ""}
  `;
  return wrapDocumentHtml({ title: data.documentNo, body });
}

export function renderBaHtml(data: {
  company: CompanyBlock;
  document_no: string;
  ba_date: string;
  project_code: string;
  project_name: string;
  customer_name: string;
  description: string;
  acknowledgedValue: string | null;
  signatory_client: string | null;
  signatory_ours: string | null;
  notes: string | null;
}): string {
  const body = `
    ${companyHeader(data.company, "Berita Acara")}
    <p><strong>${escapeHtml(data.document_no)}</strong> · ${formatDateId(data.ba_date)}</p>
    <p>Project: <strong>${escapeHtml(data.project_code)} ${escapeHtml(data.project_name)}</strong></p>
    <p>Pelanggan: <strong>${escapeHtml(data.customer_name)}</strong></p>
    <p>${escapeHtml(data.description)}</p>
    ${
      data.acknowledgedValue
        ? `<p>Nilai diakui: <strong class="num">${formatMoneyDisplay(fromDbNumeric(data.acknowledgedValue))}</strong></p>`
        : ""
    }
    <div style="display:flex;justify-content:space-between;margin-top:48px;font-size:13px;">
      <div>
        <p>Pihak pemberi kerja</p>
        <p style="margin-top:48px;">${escapeHtml(data.signatory_client ?? "........................")}</p>
      </div>
      <div>
        <p>Pihak pelaksana</p>
        <p style="margin-top:48px;">${escapeHtml(data.signatory_ours ?? data.company.name)}</p>
      </div>
    </div>
    ${data.notes ? `<p class="meta">${escapeHtml(data.notes)}</p>` : ""}
  `;
  return wrapDocumentHtml({ title: data.document_no, body });
}

export function renderKwitansiHtml(data: {
  company: CompanyBlock;
  documentNo: string;
  kwDate: string;
  contactName: string;
  description: string;
  amount: string;
  paymentMethod: string | null;
  projectCode: string | null;
}): string {
  const body = `
    ${companyHeader(data.company, "Kwitansi")}
    <p><strong>${escapeHtml(data.documentNo)}</strong> · ${formatDateId(data.kwDate)}</p>
    <p>Telah terima dari: <strong>${escapeHtml(data.contactName)}</strong></p>
    <p>Uang sejumlah: <strong class="num" style="font-size:20px;">${formatMoneyDisplay(fromDbNumeric(data.amount))}</strong></p>
    <p>Untuk: ${escapeHtml(data.description)}</p>
    ${data.projectCode ? `<p>Project: ${escapeHtml(data.projectCode)}</p>` : ""}
    ${data.paymentMethod ? `<p>Metode: ${escapeHtml(data.paymentMethod)}</p>` : ""}
    <p style="margin-top:48px;font-size:13px;">Penerima,<br/><br/><br/>${escapeHtml(data.company.name)}</p>
  `;
  return wrapDocumentHtml({ title: data.documentNo, body, a5: true });
}
