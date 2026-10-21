import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

import { CartComponent } from './cart.component';
import { ShopService } from '../shop.service';

const DESCRIPTION =
  'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.';

function product(overrides: any = {}): any {
  return {
    id: 1,
    slug: 'lavender-dusk',
    name: 'Lavender Dusk',
    family: 'floral',
    priceCents: 1800,
    stock: 25,
    imageUrl: '/images/lavender-dusk.jpg',
    ...overrides,
  };
}

const FIG = product({
  id: 8,
  slug: 'fig-cassis',
  name: 'Fig & Cassis',
  priceCents: 1615,
});
const CEDAR = product({
  id: 5,
  slug: 'cedar-smoke',
  name: 'Cedar Smoke',
  priceCents: 2500,
  stock: 20,
});
const ROSE = product({
  id: 7,
  slug: 'rose-garden',
  name: 'Rose Garden',
  priceCents: 2525,
  stock: 20,
});

describe('CartComponent', () => {
  let fixture: ComponentFixture<CartComponent>;
  let shop: ShopService;

  function setup(lines: { product: any; quantity: number }[] = []): void {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [FormsModule, HttpClientTestingModule, RouterTestingModule],
      declarations: [CartComponent],
    });
    shop = TestBed.inject(ShopService);
    lines.forEach((l) => shop.addToCart(l.product, l.quantity));
    fixture = TestBed.createComponent(CartComponent);
    fixture.detectChanges();
  }

  afterEach(() => localStorage.clear());

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function text(selector: string): string {
    return el().querySelector(selector)!.textContent!.trim();
  }

  function summary(): { [label: string]: string } {
    const terms = Array.from(el().querySelectorAll('dt'));
    const values = Array.from(el().querySelectorAll('dd'));
    const out: { [label: string]: string } = {};
    terms.forEach((t, i) => {
      out[t.textContent!.trim()] = values[i].textContent!.trim();
    });
    return out;
  }

  function qty(name: string): HTMLInputElement {
    const label = Array.from(el().querySelectorAll('label')).find(
      (l) => l.textContent!.trim() === 'Quantity for ' + name,
    ) as HTMLLabelElement;
    return el().querySelector('#' + label.htmlFor) as HTMLInputElement;
  }

  function change(name: string, value: string): void {
    const input = qty(name);
    input.value = value;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function status(): string {
    return text('[role="status"]');
  }

  it('[BR-C7] shows the empty state without table or checkout link', () => {
    setup();
    expect(text('h1')).toBe('Your cart');
    expect(el().textContent).toContain('Your cart is empty');
    const link = el().querySelector('a') as HTMLAnchorElement;
    expect(link.textContent!.trim()).toBe('Continue shopping');
    expect(link.getAttribute('href')).toBe('/');
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelector('dl')).toBeNull();
    expect(
      Array.from(el().querySelectorAll('a')).some(
        (a) => a.textContent!.trim() === 'Checkout',
      ),
    ).toBe(false);
  });

  it('[BR-C7] keeps a single empty status region in the empty state', () => {
    setup();
    expect(el().querySelectorAll('[role="status"]').length).toBe(1);
    expect(status()).toBe('');
  });

  it('[BR-C5] renders the table headers and a row per line', () => {
    setup([
      { product: product(), quantity: 3 },
      { product: CEDAR, quantity: 1 },
    ]);
    const headers = Array.from(el().querySelectorAll('table th')).map((h) =>
      h.textContent!.trim(),
    );
    expect(headers).toEqual([
      'Candle',
      'Price',
      'Quantity',
      'Total',
      'Actions',
    ]);
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
    const row = el().querySelector('tbody tr') as HTMLElement;
    const link = row.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent!.trim()).toBe('Lavender Dusk');
    expect(link.getAttribute('href')).toBe('/products/lavender-dusk');
    const cells = Array.from(row.querySelectorAll('td')).map((c) =>
      c.textContent!.trim(),
    );
    expect(cells[1]).toBe('$18.00');
    expect(cells[3]).toBe('$54.00');
    expect(el().querySelector('table')!.classList).toContain('table');
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    expect(el().textContent).not.toContain('Your cart is empty');
  });

  it('[BR-C5] labels each quantity input and sets its bounds', () => {
    setup([
      { product: product(), quantity: 3 },
      {
        product: product({ id: 11, name: 'Last Light', stock: 4 }),
        quantity: 2,
      },
    ]);
    const lavender = qty('Lavender Dusk');
    expect(lavender.type).toBe('number');
    expect(lavender.value).toBe('3');
    expect(lavender.min).toBe('1');
    expect(lavender.max).toBe('10');
    expect(qty('Last Light').max).toBe('4');
    expect(lavender.id).not.toBe(qty('Last Light').id);
  });

  it('[BR-C5] [KD-01] shows a correct line total beside a truncated subtotal', () => {
    setup([{ product: FIG, quantity: 2 }]);
    const cells = Array.from(el().querySelectorAll('tbody td')).map((c) =>
      c.textContent!.trim(),
    );
    expect(cells[3]).toBe('$32.30');
    expect(summary()).toEqual({
      Subtotal: '$32.29',
      Shipping: '$5.95',
      Total: '$38.24',
    });
  });

  it('[BR-C5] [KD-01] shows an exact subtotal when nothing truncates', () => {
    setup([{ product: FIG, quantity: 3 }]);
    expect(summary().Subtotal).toBe('$48.45');
  });

  it('[BR-C5] [KD-03] charges shipping at exactly $50.00', () => {
    setup([{ product: CEDAR, quantity: 2 }]);
    expect(summary()).toEqual({
      Subtotal: '$50.00',
      Shipping: '$5.95',
      Total: '$55.95',
    });
  });

  it('[BR-C5] shows Free above $50.00', () => {
    setup([
      { product: CEDAR, quantity: 1 },
      { product: ROSE, quantity: 1 },
    ]);
    expect(summary()).toEqual({
      Subtotal: '$50.25',
      Shipping: 'Free',
      Total: '$50.25',
    });
  });

  it('[BR-C5] shows shipping below $50.00', () => {
    setup([{ product: product(), quantity: 1 }]);
    expect(summary()).toEqual({
      Subtotal: '$18.00',
      Shipping: '$5.95',
      Total: '$23.95',
    });
  });

  it('[BR-C5] formats thousands separators', () => {
    setup([
      {
        product: product({ id: 20, name: 'Grand', priceCents: 123456 }),
        quantity: 1,
      },
    ]);
    expect(summary().Subtotal).toBe('$1,234.56');
    expect(el().textContent).toContain('$1,234.56');
  });

  it('[BR-C5] links to checkout', () => {
    setup([{ product: product(), quantity: 1 }]);
    const checkout = Array.from(el().querySelectorAll('a')).find(
      (a) => a.textContent!.trim() === 'Checkout',
    ) as HTMLAnchorElement;
    expect(checkout.getAttribute('href')).toBe('/checkout');
    expect(
      Array.from(el().querySelectorAll('a')).some(
        (a) => a.textContent!.trim() === 'Continue shopping',
      ),
    ).toBe(false);
  });

  it('[BR-C2] commits a typed quantity and updates totals', () => {
    setup([{ product: product(), quantity: 1 }]);
    change('Lavender Dusk', '4');
    expect(shop.cart[0].quantity).toBe(4);
    expect(qty('Lavender Dusk').value).toBe('4');
    expect(
      el().querySelector('tbody td:nth-child(4)')!.textContent!.trim(),
    ).toBe('$72.00');
    expect(summary().Subtotal).toBe('$72.00');
    expect(summary().Shipping).toBe('Free');
    expect(status()).toBe('');
  });

  it('[BR-C2] clamps a typed quantity above the cap', () => {
    setup([{ product: product(), quantity: 1 }]);
    change('Lavender Dusk', '15');
    expect(qty('Lavender Dusk').value).toBe('10');
    expect(status()).toBe('You can buy at most 10 of Lavender Dusk.');
  });

  it('[BR-C2] clamps to the stock when below ten', () => {
    setup([
      {
        product: product({ id: 11, name: 'Last Light', stock: 4 }),
        quantity: 1,
      },
    ]);
    change('Last Light', '5');
    expect(qty('Last Light').value).toBe('4');
    expect(status()).toBe('You can buy at most 4 of Last Light.');
  });

  it('[BR-C2] accepts exactly the cap without a message', () => {
    setup([{ product: product(), quantity: 1 }]);
    change('Lavender Dusk', '10');
    expect(qty('Lavender Dusk').value).toBe('10');
    expect(status()).toBe('');
  });

  it('[BR-C2] clears an earlier cap message after a valid change', () => {
    setup([{ product: product(), quantity: 1 }]);
    change('Lavender Dusk', '15');
    change('Lavender Dusk', '2');
    expect(status()).toBe('');
  });

  ['0', '-3', '', 'abc', '2.5'].forEach((typed) => {
    it('[BR-C3] resets the typed value "' + typed + '" to 1', () => {
      setup([{ product: product(), quantity: 5 }]);
      change('Lavender Dusk', typed);
      expect(qty('Lavender Dusk').value).toBe('1');
      expect(shop.cart[0].quantity).toBe(1);
      expect(status()).toBe('');
    });
  });

  it('[BR-C2] drops the line when its stock has fallen to zero', () => {
    setup([{ product: product(), quantity: 2 }]);
    shop.cart[0].product.stock = 0;
    change('Lavender Dusk', '3');
    expect(shop.cart.length).toBe(0);
    expect(el().textContent).toContain('Your cart is empty');
    expect(status()).toBe('You can buy at most 0 of Lavender Dusk.');
  });

  it('[BR-C3] removes a line with the Remove button', () => {
    setup([
      { product: product(), quantity: 2 },
      { product: CEDAR, quantity: 1 },
    ]);
    const button = Array.from(el().querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === 'Remove Lavender Dusk',
    ) as HTMLButtonElement;
    expect(button.querySelector('.sr-only')!.textContent).toBe(
      ' Lavender Dusk',
    );
    expect(button.firstChild!.textContent!.trim()).toBe('Remove');
    button.click();
    fixture.detectChanges();
    expect(shop.cart.length).toBe(1);
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect(el().textContent).not.toContain('Lavender Dusk');
  });

  it('[BR-C3] shows the empty state after removing the last line', () => {
    setup([{ product: product(), quantity: 2 }]);
    (el().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().textContent).toContain('Your cart is empty');
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelectorAll('[role="status"]').length).toBe(1);
  });

  it('[BR-C3] removes the cap message with the line', () => {
    setup([{ product: product(), quantity: 2 }]);
    change('Lavender Dusk', '15');
    (el().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(status()).toBe('');
  });

  it('[BR-C4] re-renders when the cart changes elsewhere', () => {
    setup([{ product: product(), quantity: 1 }]);
    shop.addToCart(CEDAR, 1);
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
  });

  it('[BR-C5] sets the cart title and default description', () => {
    setup();
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Your cart | Wick & Co. Candles',
    );
    expect(TestBed.inject(Meta).getTag('name="description"')!.content).toBe(
      DESCRIPTION,
    );
  });
});
