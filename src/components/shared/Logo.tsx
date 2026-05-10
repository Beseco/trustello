import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showText?: boolean;
};

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
        <path
          d="M16 7L24 11V21L16 25L8 21V11L16 7Z"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M16 11L20 13V19L16 21L12 19V13L16 11Z"
          fill="white"
          opacity="0.8"
        />
      </svg>
      {showText && (
        <span className="text-xl font-semibold tracking-tight">Trustello</span>
      )}
    </div>
  );
}
