"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import type {
  CartActionState,
  QuantityChange,
} from "@/features/cart/cart-actions";

type CartAction = (
  state: CartActionState,
  formData: FormData,
) => Promise<CartActionState>;

type QuantityAction = (change: QuantityChange) => Promise<CartActionState>;

const IDLE: CartActionState = { status: "idle" };

const StatusContext = createContext<CartActionState | null>(null);

const FormActionContext = createContext<((formData: FormData) => void) | null>(
  null,
);

const QuantityActionContext = createContext<
  ((change: QuantityChange) => void) | null
>(null);

function provided<Value>(value: Value | null, provider: string): Value {
  if (value === null) {
    throw new Error(`Cart status needs a ${provider} above it`);
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
    <StatusContext value={state}>
      <FormActionContext value={formAction}>{children}</FormActionContext>
    </StatusContext>
  );
}

export function CartQuantityProvider({
  action,
  children,
}: {
  action: QuantityAction;
  children: ReactNode;
}) {
  const [state, dispatch] = useActionState(
    (_state: CartActionState, change: QuantityChange) => action(change),
    IDLE,
  );
  const commit = (change: QuantityChange) => {
    startTransition(() => {
      dispatch(change);
    });
  };
  return (
    <StatusContext value={state}>
      <QuantityActionContext value={commit}>{children}</QuantityActionContext>
    </StatusContext>
  );
}

export function useCartFormAction(): (formData: FormData) => void {
  return provided(use(FormActionContext), "StatusRegionProvider");
}

export function useCartQuantityAction(): (change: QuantityChange) => void {
  return provided(use(QuantityActionContext), "CartQuantityProvider");
}

export function useCartActionState(): CartActionState {
  return provided(use(StatusContext), "StatusRegionProvider");
}

export function StatusRegion() {
  const state = useCartActionState();
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
