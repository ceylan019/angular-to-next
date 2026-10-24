"use client";

import { buttonVariants } from "@/components/ui/button-variants";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p>Something went wrong. Please try again.</p>
      <button
        data-slot="button"
        data-variant="default"
        data-size="default"
        className={buttonVariants()}
        type="button"
        onClick={() => {
          retry();
        }}
      >
        Try again
      </button>
    </div>
  );
}
