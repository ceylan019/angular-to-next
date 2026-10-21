import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CartItem, CartResult } from './models';

const CART_KEY = 'cart';
const MAX_PER_LINE = 10;

function toQuantity(value: any): number {
  const parsed =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 1
    ? parsed
    : 1;
}

function capFor(product: any): number {
  return Math.min(MAX_PER_LINE, product.stock);
}

function isFiniteNumber(value: any): boolean {
  return typeof value === 'number' && isFinite(value);
}

function isValidLine(line: any): boolean {
  if (!line || typeof line !== 'object') {
    return false;
  }
  const product = line.product;
  if (!product || typeof product !== 'object') {
    return false;
  }
  return (
    isFiniteNumber(product.id) &&
    isFiniteNumber(product.priceCents) &&
    product.priceCents >= 0 &&
    isFiniteNumber(product.stock) &&
    product.stock >= 0 &&
    typeof product.slug === 'string' &&
    typeof product.name === 'string' &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= MAX_PER_LINE &&
    line.quantity <= product.stock
  );
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  cart: CartItem[] = [];
  cart$ = new BehaviorSubject<CartItem[]>(this.cart);
  cartCount$: Observable<number> = this.cart$.pipe(
    map((items) => items.reduce((sum, item) => sum + item.quantity, 0)),
  );
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: any,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.cart = this.loadCart();
      this.cart$.next(this.cart);
    }
  }

  getFamilies(): Observable<any[]> {
    return this.http.get<any[]>('/api/families');
  }

  getProducts(params: {
    family?: string[];
    sort?: string;
    page?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    (params.family || []).forEach((f) => {
      httpParams = httpParams.append('family', f);
    });
    if (params.sort !== undefined) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    return this.http.get<any>('/api/products', { params: httpParams });
  }

  getProduct(slug: string): Observable<any> {
    return this.http.get<any>('/api/products/' + encodeURIComponent(slug));
  }

  placeOrder(body: any): Observable<any> {
    return this.http.post<any>('/api/orders', body);
  }

  getOrder(orderNumber: string): Observable<any> {
    return this.http.get<any>('/api/orders/' + encodeURIComponent(orderNumber));
  }

  addToCart(product: any, quantity: any): CartResult {
    const requested = toQuantity(quantity);
    const cap = capFor(product);
    const existing = this.cart.find((l) => l.product.id === product.id);
    const desired = (existing ? existing.quantity : 0) + requested;
    const resulting = Math.min(desired, cap);
    if (resulting < 1) {
      return { clamped: true, cap };
    }
    if (existing) {
      existing.product = product;
      existing.quantity = resulting;
    } else {
      this.cart.push({ product, quantity: resulting });
    }
    this.commit();
    return { clamped: desired > cap, cap };
  }

  updateQuantity(productId: number, quantity: any): CartResult {
    const line = this.cart.find((l) => l.product.id === productId);
    if (!line) {
      return { clamped: false, cap: MAX_PER_LINE };
    }
    const requested = toQuantity(quantity);
    const cap = capFor(line.product);
    if (cap < 1) {
      this.removeFromCart(productId);
      return { clamped: true, cap };
    }
    line.quantity = Math.min(requested, cap);
    this.commit();
    return { clamped: requested > cap, cap };
  }

  removeFromCart(productId: number): void {
    this.cart = this.cart.filter((l) => l.product.id !== productId);
    this.commit();
  }

  clearCart(): void {
    this.cart = [];
    this.commit();
  }

  applyStockLimits(items: any[]): void {
    items.forEach((item) => {
      const line = this.cart.find((l) => l.product.id === item.productId);
      if (!line) {
        return;
      }
      if (item.available <= 0) {
        this.cart = this.cart.filter((l) => l !== line);
        return;
      }
      line.product = { ...line.product, stock: item.available };
      line.quantity = Math.min(line.quantity, item.available);
    });
    this.commit();
  }

  applyPriceChanges(items: any[]): void {
    items.forEach((item) => {
      const line = this.cart.find((l) => l.product.id === item.productId);
      if (line) {
        line.product = { ...line.product, priceCents: item.unitPriceCents };
      }
    });
    this.commit();
  }

  getSubtotal(): number {
    const sum = this.cart.reduce(
      (total, l) => total + (l.product.priceCents / 100) * l.quantity,
      0,
    );
    return Math.floor(sum * 100) / 100;
  }

  getShipping(): number {
    if (this.cart.length === 0) {
      return 0;
    }
    return this.getSubtotal() > 50 ? 0 : 5.95;
  }

  getTotal(): number {
    return this.getSubtotal() + this.getShipping();
  }

  private commit(): void {
    this.cart$.next(this.cart);
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(this.cart));
    } catch (e) {}
  }

  private loadCart(): CartItem[] {
    let parsed: any;
    try {
      parsed = JSON.parse(localStorage.getItem(CART_KEY) as string);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen: number[] = [];
    return parsed.filter((line) => {
      if (!isValidLine(line) || seen.indexOf(line.product.id) !== -1) {
        return false;
      }
      seen.push(line.product.id);
      return true;
    });
  }
}
