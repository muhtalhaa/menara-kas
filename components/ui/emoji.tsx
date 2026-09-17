import { emoji } from "@/lib/ui/emoji";

type EmojiProps = {
  children: string;
};

export function Emoji({ children }: EmojiProps) {
  return (
    <span aria-hidden="true" className="mr-1.5 inline-block leading-none">
      {children}
    </span>
  );
}

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-white">
      <Emoji>{emoji.kasBank}</Emoji>
      Menara Kas
    </span>
  );
}
