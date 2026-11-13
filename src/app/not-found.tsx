import Link from "next/link";
import { SearchX } from "lucide-react";

/** 404 screen — unknown paths fall through to here (the app itself lives on "/"). */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <SearchX className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          There&apos;s nothing at this address. The catalog, blog and tools all live on the
          homepage.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to ai tools central
        </Link>
      </div>
    </div>
  );
}
