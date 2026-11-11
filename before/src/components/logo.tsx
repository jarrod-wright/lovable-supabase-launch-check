export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-pulse-ring" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
      </span>
      StorePulse
    </span>
  );
}
