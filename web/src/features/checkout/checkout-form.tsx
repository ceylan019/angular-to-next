"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type SubmitEvent,
  type ReactNode,
} from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useHydrated } from "@/components/use-hydrated";
import { alertMessages } from "./checkout-messages";
import {
  buildCheckoutSchema,
  type CheckoutInput,
  type CheckoutValues,
} from "./checkout-schema";
import { COUNTRIES } from "./countries";
import type { PlaceOrderActionResult } from "./place-order-action";

type PlaceOrder = (values: CheckoutValues) => Promise<PlaceOrderActionResult>;

const EMPTY: CheckoutValues = {
  email: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  country: "",
  cardNumber: "",
  expiry: "",
  cvc: "",
};

const resolver: Resolver<CheckoutInput, unknown, CheckoutValues> = (
  values,
  context,
  options,
) => zodResolver(buildCheckoutSchema(new Date()))(values, context, options);

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function errorProps(id: string, error: string | undefined) {
  return error === undefined
    ? {}
    : { "aria-invalid": true, "aria-describedby": `${id}-error` };
}

const FIELDSET = "flex flex-col gap-4";
const LEGEND = "mb-4 text-lg font-semibold text-ink";
const CONTROL = "h-10 bg-surface text-ink";

export function CheckoutForm({ action }: { action: PlaceOrder }) {
  const hydrated = useHydrated();
  const idPrefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const placeOrderRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, submitCount },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
    defaultValues: EMPTY,
  });
  const [result, dispatch, pending] = useActionState(
    async (
      _previous: PlaceOrderActionResult | null,
      values: CheckoutValues,
    ) => {
      try {
        return await action(values);
      } finally {
        submitting.current = false;
      }
    },
    null,
  );

  useEffect(() => {
    if (submitCount === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [submitCount]);

  useEffect(() => {
    if (pending || result === null) return;
    placeOrderRef.current?.focus();
  }, [pending, result]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    if (submitting.current) {
      event.preventDefault();
      return;
    }
    submitting.current = true;
    void handleSubmit(
      (values) => {
        startTransition(() => {
          dispatch(values);
        });
      },
      () => {
        submitting.current = false;
      },
    )(event);
  };

  const messages = pending || result === null ? [] : alertMessages(result);

  const text = (
    name: keyof CheckoutValues,
    label: string,
    props: ComponentProps<"input">,
  ) => {
    const id = `${idPrefix}-${name}`;
    const error = errors[name]?.message;
    return (
      <Field id={id} label={label} error={error}>
        <Input
          id={id}
          type="text"
          {...props}
          {...register(name)}
          {...errorProps(id, error)}
          className={CONTROL}
        />
      </Field>
    );
  };

  const countryId = `${idPrefix}-country`;
  const countryError = errors.country?.message;

  return (
    <div className="flex flex-col gap-4">
      <div role="alert" className="text-sm font-medium text-destructive">
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-8 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border"
      >
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>Contact</legend>
          {text("email", "Email", { type: "email", autoComplete: "email" })}
        </fieldset>
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>Shipping address</legend>
          {text("fullName", "Full name", { autoComplete: "name" })}
          {text("line1", "Address line 1", { autoComplete: "address-line1" })}
          {text("line2", "Address line 2 (optional)", {
            autoComplete: "address-line2",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("city", "City", { autoComplete: "address-level2" })}
            {text("postalCode", "Postal code", { autoComplete: "postal-code" })}
          </div>
          <Field id={countryId} label="Country" error={countryError}>
            <NativeSelect
              id={countryId}
              autoComplete="country"
              {...register("country")}
              {...errorProps(countryId, countryError)}
              className="w-full [&_select]:h-10 [&_select]:bg-surface [&_select]:text-ink"
            >
              <NativeSelectOption value="">Select a country</NativeSelectOption>
              {COUNTRIES.map((country) => (
                <NativeSelectOption key={country.code} value={country.code}>
                  {country.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </fieldset>
        <fieldset className={FIELDSET}>
          <legend className={LEGEND}>Payment</legend>
          {text("cardNumber", "Card number", {
            inputMode: "numeric",
            autoComplete: "cc-number",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("expiry", "Expiry (MM/YY)", { autoComplete: "cc-exp" })}
            {text("cvc", "CVC", {
              inputMode: "numeric",
              autoComplete: "cc-csc",
            })}
          </div>
        </fieldset>
        <Button
          ref={placeOrderRef}
          type="submit"
          disabled={!hydrated || pending}
          focus="outline"
          className="h-11 w-full text-base sm:w-auto sm:self-start sm:px-8"
        >
          {pending ? "Placing order..." : "Place order"}
        </Button>
      </form>
    </div>
  );
}
