import "server-only";
import { cookies } from "next/headers";
import {
  CART_COOKIE,
  parseCartCookie,
  serializeCart,
  type CartLine,
} from "./cart-cookie";

const THIRTY_DAYS_IN_SECONDS = 2592000;

export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCartCookie(store.get(CART_COOKIE)?.value);
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_IN_SECONDS,
  });
}
