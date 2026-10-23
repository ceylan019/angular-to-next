import { act } from "@testing-library/react";
import { startTransition } from "react";
import { vi } from "vitest";

export const push = vi.fn<(href: string) => void>();

const pending: (() => void)[] = [];

export function holdNavigation(): void {
  push.mockImplementation(() => {
    startTransition(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );
  });
}

export async function landNavigation(): Promise<void> {
  await act(async () => {
    for (const resolve of pending.splice(0)) resolve();
    await new Promise((settled) => setTimeout(settled, 0));
  });
}
