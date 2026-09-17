import { Emoji } from "@/components/ui/emoji";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brand" | "outline" | "ghost" | "danger";
  emojiChar?: string;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-teal-500 text-white hover:bg-teal-400 active:bg-teal-600 disabled:bg-mist-100 disabled:text-mist-500",
  brand:
    "bg-teal-700 text-white hover:bg-teal-600 disabled:bg-mist-100 disabled:text-mist-500",
  outline:
    "bg-white text-teal-500 border border-mist-400 hover:bg-mist-50 disabled:text-mist-500",
  ghost: "bg-transparent text-ink-muted hover:bg-mist-100",
  danger:
    "bg-white text-deficit border border-deficit hover:bg-deficit-bg",
};

export function Button({
  variant = "primary",
  emojiChar,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-[38px] items-center justify-center rounded-lg px-4 text-sm font-semibold outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {emojiChar ? <Emoji>{emojiChar}</Emoji> : null}
      {children}
    </button>
  );
}
