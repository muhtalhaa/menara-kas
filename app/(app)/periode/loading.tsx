import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";

export default function PeriodeLoading() {
  return (
    <div className="rounded-xl border border-mist-300 bg-mint p-8 text-sm text-ink-muted">
      <Emoji>{emoji.muat}</Emoji>
      Memuat periode...
    </div>
  );
}
