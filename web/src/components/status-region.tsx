"use client";

import {
  createContext,
  use,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import type { CartActionState } from "@/features/cart/cart-actions";

type CartAction = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

type StatusContextValue = {
  state: CartActionState;
  formAction: (formData: FormData) => void;
};

const IDLE: CartActionState = { status: "idle" };

const StatusContext = createContext<StatusContextValue | null>(null);

function useStatusContext(): StatusContextValue {
  const value = use(StatusContext);
  if (value === null) {
    throw new Error("Cart status needs a StatusRegionProvider above it");
  }
  return value;
}

export function StatusRegionProvider({
  action,
  children,
}: {
  action: CartAction;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <StatusContext value={{ state, formAction }}>{children}</StatusContext>
  );
}

export function useCartFormAction(): (formData: FormData) => void {
  return useStatusContext().formAction;
}

export function useCartActionState(): CartActionState {
  return useStatusContext().state;
}

export function StatusRegion() {
  const { state } = useStatusContext();
  const [shown, setShown] = useState(state);
  const [version, setVersion] = useState(0);
  if (shown !== state) {
    setShown(state);
    setVersion(version + 1);
  }
  const message = "message" in state ? state.message : "";
  return (
    <div role="status" className="min-h-6 text-sm font-medium text-ink">
      {message === "" ? null : <span key={version}>{message}</span>}
    </div>
  );
}
