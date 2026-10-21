"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p>Something went wrong. Please try again.</p>
      <Button
        type="button"
        onClick={() => {
          retry();
        }}
      >
        Try again
      </Button>
    </div>
  );
}
