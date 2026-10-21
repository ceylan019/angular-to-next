import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { OrderConfirmationComponent } from './order-confirmation.component';
import { NotFoundComponent } from '../not-found/not-found.component';
import { ShopService } from '../shop.service';

const DESCRIPTION =
  'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.';

function order(overrides: any = {}): any {
  return {
    orderNumber: 'WC-ABC123',
    email: 'ada@example.com',
    lines: [
      {
        productId: 1,
        name: 'Lavender Dusk',
        quantity: 2,
        unitPriceCents: 1800,
        lineTotalCents: 3600,
      },
    ],
    subtotalCents: 3600,
    shippingCents: 595,
    totalCents: 4195,
    createdAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
    shipping: {
      fullName: 'Ada Lovelace',
      line1: '12 Analytical Way',
      line2: null,
      city: 'London',
      postalCode: 'SW1A 1AA',
      country: 'GB',
      ...(overrides.shipping || {}),
    },
  };
}

describe('OrderConfirmationComponent', () => {
  let fixture: ComponentFixture<OrderConfirmationComponent>;
  let params: BehaviorSubject<any>;
  let shop: any;

  function setup(response: any = of(order())): void {
    params = new BehaviorSubject(
      convertToParamMap({ orderNumber: 'WC-ABC123' }),
    );
    shop = {
      getOrder: jasmine.createSpy('getOrder').and.returnValue(response),
    };
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [OrderConfirmationComponent, NotFoundComponent],
      providers: [
        { provide: ShopService, useValue: shop },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    fixture = TestBed.createComponent(OrderConfirmationComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function text(selector: string): string {
    return el().querySelector(selector)!.textContent!.trim();
  }

  function items(): string[][] {
    return Array.from(el().querySelectorAll('ul[aria-label="Items"] li')).map(
      (li) =>
        Array.from(li.querySelectorAll('span')).map((s) =>
          s.textContent!.trim(),
        ),
    );
  }

  function totals(): { [label: string]: string } {
    const terms = Array.from(el().querySelectorAll('dt'));
    const values = Array.from(el().querySelectorAll('dd'));
    const out: { [label: string]: string } = {};
    terms.forEach((t, i) => {
      out[t.textContent!.trim()] = values[i].textContent!.trim();
    });
    return out;
  }

  function addressLines(): string[] {
    const heading = Array.from(el().querySelectorAll('h2')).find(
      (h) => h.textContent!.trim() === 'Shipping to',
    ) as HTMLElement;
    const block = heading.nextElementSibling as HTMLElement;
    return Array.from(block.children).map((c) => c.textContent!.trim());
  }

  function notFound(status: number = 404): any {
    return throwError(new HttpErrorResponse({ status }));
  }

  it('[BR-K5] shows order number, items, totals and address', () => {
    setup();
    expect(shop.getOrder).toHaveBeenCalledWith('WC-ABC123');
    expect(text('h1')).toBe('Thank you for your order');
    expect(el().textContent).toContain('Order number: WC-ABC123');
    expect(items()).toEqual([['Lavender Dusk × 2', '$36.00']]);
    expect(totals()).toEqual({
      Subtotal: '$36.00',
      Shipping: '$5.95',
      Total: '$41.95',
    });
    expect(addressLines()).toEqual([
      'Ada Lovelace',
      '12 Analytical Way',
      'London SW1A 1AA',
      'United Kingdom',
    ]);
    const link = Array.from(el().querySelectorAll('a')).find(
      (a) => a.textContent!.trim() === 'Continue shopping',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/');
    expect(el().querySelector('app-not-found')).toBeNull();
  });

  it('[BR-K5] shows Free shipping when the order shipped free', () => {
    setup(
      of(
        order({
          lines: [
            {
              productId: 5,
              name: 'Cedar Smoke',
              quantity: 2,
              unitPriceCents: 2500,
              lineTotalCents: 5000,
            },
          ],
          subtotalCents: 5000,
          shippingCents: 0,
          totalCents: 5000,
        }),
      ),
    );
    expect(totals()).toEqual({
      Subtotal: '$50.00',
      Shipping: 'Free',
      Total: '$50.00',
    });
  });

  it('[BR-K5] lists every line with backend line totals and thousands separators', () => {
    setup(
      of(
        order({
          lines: [
            {
              productId: 8,
              name: 'Fig & Cassis',
              quantity: 2,
              unitPriceCents: 1615,
              lineTotalCents: 3230,
            },
            {
              productId: 99,
              name: 'Grand',
              quantity: 1,
              unitPriceCents: 123456,
              lineTotalCents: 123456,
            },
          ],
          subtotalCents: 126686,
          shippingCents: 0,
          totalCents: 126686,
        }),
      ),
    );
    expect(items()).toEqual([
      ['Fig & Cassis × 2', '$32.30'],
      ['Grand × 1', '$1,234.56'],
    ]);
    expect(totals().Subtotal).toBe('$1,266.86');
    expect(totals().Total).toBe('$1,266.86');
  });

  it('[BR-K5] shows line 2 between line 1 and the city when present', () => {
    setup(
      of(
        order({
          shipping: {
            fullName: 'Zoë Ångström',
            line2: 'Flat 3',
            city: 'Toronto',
            postalCode: 'K1A0B1',
            country: 'CA',
          },
        }),
      ),
    );
    expect(addressLines()).toEqual([
      'Zoë Ångström',
      '12 Analytical Way',
      'Flat 3',
      'Toronto K1A0B1',
      'Canada',
    ]);
  });

  [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'FR', name: 'FR' },
  ].forEach((c) => {
    it('[BR-K5] names the country ' + c.code + ' as ' + c.name, () => {
      setup(of(order({ shipping: { country: c.code } })));
      const lines = addressLines();
      expect(lines[lines.length - 1]).toBe(c.name);
    });
  });

  it('[BR-K7] [KD-02] renders not found inline on a 404', () => {
    setup(notFound());
    expect(el().querySelector('app-not-found')).not.toBeNull();
    expect(el().children.length).toBe(1);
    expect(text('h1')).toBe('Page not found');
    expect(el().textContent).not.toContain('Thank you for your order');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Page not found | Wick & Co. Candles',
    );
  });

  it('[BR-K7] [KD-02] falls back to not found on other errors', () => {
    setup(notFound(500));
    expect(el().querySelector('app-not-found')).not.toBeNull();
    expect(el().querySelector('ul')).toBeNull();
  });

  it('[BR-B9] sets the order title', () => {
    setup();
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Order WC-ABC123 | Wick & Co. Candles',
    );
    expect(TestBed.inject(Meta).getTag('name="description"')!.content).toBe(
      DESCRIPTION,
    );
  });

  it('[BR-K5] loads the new order when the number changes', () => {
    setup(notFound());
    shop.getOrder.and.returnValue(of(order({ orderNumber: 'WC-XYZ789' })));
    params.next(convertToParamMap({ orderNumber: 'WC-XYZ789' }));
    fixture.detectChanges();
    expect(shop.getOrder).toHaveBeenCalledWith('WC-XYZ789');
    expect(el().querySelector('app-not-found')).toBeNull();
    expect(el().textContent).toContain('Order number: WC-XYZ789');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Order WC-XYZ789 | Wick & Co. Candles',
    );
  });

  it('[BR-K5] renders nothing before the order loads', () => {
    setup(of());
    expect(el().querySelector('h1')).toBeNull();
    expect(el().querySelector('app-not-found')).toBeNull();
  });
});
