import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  message,
  href,
  action,
}: {
  message: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface px-6 py-16 text-center shadow-sm ring-1 ring-border">
      <p className="text-lg text-ink">{message}</p>
      <Button asChild focus="outline" className="h-9 px-4">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
