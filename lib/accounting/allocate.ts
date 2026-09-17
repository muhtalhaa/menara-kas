import type { Money } from "./money";
import { AccountingError } from "./errors";

export function allocateByWeights(total: Money, weights: Money[]): Money[] {
  const weightSum = weights.reduce((a, b) => a + b, 0n);
  if (weightSum === 0n) {
    throw new AccountingError(
      "Bobot alokasi tidak boleh nol seluruhnya. Isi nilai pada setidaknya satu project.",
    );
  }

  const base = weights.map((w) => (total * w) / weightSum);
  let remainder = total - base.reduce((a, b) => a + b, 0n);

  const order = weights
    .map((w, i) => ({ i, rest: (total * w) % weightSum }))
    .sort((a, b) =>
      b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : a.i - b.i,
    );

  const result = [...base];
  for (let k = 0; remainder > 0n; k++, remainder--) {
    result[order[k % order.length].i] += 1n;
  }
  return result;
}
