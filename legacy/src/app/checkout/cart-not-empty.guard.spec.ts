import { Location } from '@angular/common';
import { NgZone } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { CartNotEmptyGuard } from './cart-not-empty.guard';
import { CheckoutComponent } from './checkout.component';
import { routes } from '../app-routing.module';
import { OrderConfirmationComponent } from '../order-confirmation/order-confirmation.component';
import { ShopService } from '../shop.service';

const LAVENDER = {
  id: 1,
  slug: 'lavender-dusk',
  name: 'Lavender Dusk',
  family: 'floral',
  priceCents: 1800,
  stock: 25,
  imageUrl: '/images/lavender-dusk.jpg',
};

describe('CartNotEmptyGuard', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
  });

  function guard(platformId: string, cart: any[]): CartNotEmptyGuard {
    return new CartNotEmptyGuard({ cart } as ShopService, router, platformId);
  }

  it('[BR-K1] redirects an empty cart to /cart in the browser only', () => {
    const redirect = guard('browser', []).canActivate();
    expect(redirect instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(redirect as UrlTree)).toBe('/cart');
    expect(guard('server', []).canActivate()).toBe(true);
  });

  it('[BR-K1] lets a cart with items through in the browser', () => {
    expect(
      guard('browser', [{ product: LAVENDER, quantity: 1 }]).canActivate(),
    ).toBe(true);
  });

  it('[BR-K1] lets the server render checkout with items too', () => {
    expect(
      guard('server', [{ product: LAVENDER, quantity: 1 }]).canActivate(),
    ).toBe(true);
  });
});

describe('checkout and confirmation routes', () => {
  function visit(url: string, lines: any[] = []): Router {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes(routes),
        HttpClientTestingModule,
      ],
    });
    const shop = TestBed.inject(ShopService);
    lines.forEach((l) => shop.addToCart(l.product, l.quantity));
    const router = TestBed.inject(Router);
    TestBed.inject(NgZone).run(() => router.navigateByUrl(url));
    tick();
    return router;
  }

  function activeComponent(router: Router): any {
    return router.routerState.snapshot.root.firstChild!.routeConfig!.component;
  }

  afterEach(() => localStorage.clear());

  it('[BR-K1] sends an empty cart from /checkout to /cart', fakeAsync(() => {
    visit('/checkout');
    expect(TestBed.inject(Location).path()).toBe('/cart');
  }));

  it('[BR-K1] opens checkout when the cart has items', fakeAsync(() => {
    const router = visit('/checkout', [{ product: LAVENDER, quantity: 1 }]);
    expect(TestBed.inject(Location).path()).toBe('/checkout');
    expect(activeComponent(router)).toBe(CheckoutComponent);
  }));

  it('[BR-K5] routes an order number to the confirmation page', fakeAsync(() => {
    const router = visit('/order/WC-ABC123');
    expect(TestBed.inject(Location).path()).toBe('/order/WC-ABC123');
    expect(activeComponent(router)).toBe(OrderConfirmationComponent);
    expect(
      router.routerState.snapshot.root.firstChild!.paramMap.get('orderNumber'),
    ).toBe('WC-ABC123');
  }));
});
