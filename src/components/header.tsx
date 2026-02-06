import Link from "next/link";

export function Header() {
  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border bg-surface px-4">
      <Link href="/" className="flex items-center gap-2">
        <svg
          className="h-6 w-6 text-accent"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
        </svg>
        <span className="text-xl font-bold text-foreground">AICast</span>
      </Link>

      <div className="hidden w-full max-w-md px-8 md:block">
        <div className="flex items-center rounded-lg bg-background px-3 py-1.5 ring-1 ring-border focus-within:ring-accent">
          <input
            type="text"
            placeholder="Search channels..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
            disabled
          />
          <svg
            className="h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <button className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
        Go Live
      </button>
    </header>
  );
}
