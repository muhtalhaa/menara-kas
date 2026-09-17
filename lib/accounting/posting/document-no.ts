export function formatDocumentNo(input: {
  seq: number;
  prefix: string;
  companyCode: string;
  month: number;
  year: number;
}): string {
  const seq = String(input.seq).padStart(3, "0");
  const month = String(input.month).padStart(2, "0");
  return `${seq}/${input.prefix}-${input.companyCode}/${month}/${input.year}`;
}
