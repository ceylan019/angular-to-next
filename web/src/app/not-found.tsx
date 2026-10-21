import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found | Wick & Co. Candles",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface px-6 py-16 text-center shadow-sm ring-1 ring-border">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="text-lg text-muted-foreground">
        {"We couldn't find that page."}
      </p>
      <Button
        asChild
        className="h-9 px-4 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
      >
        <Link href="/">Back to shop</Link>
      </Button>
    </div>
  );
}
