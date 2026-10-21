import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { FormsModule, NgForm } from '@angular/forms';
import {
  HttpClientTestingModule,
  HttpTestingController,
  TestRequest,
} from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { CheckoutComponent } from './checkout.component';
import { CheckoutFieldValidatorDirective } from './checkout-validators';
import { ShopService } from '../shop.service';

const NOW = new Date('2026-10-21T12:00:00Z');
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

const LAVENDER = product();
const CEDAR = product({
  id: 5,
  slug: 'cedar-smoke',
  name: 'Cedar Smoke',
  family: 'woody',
  priceCents: 2500,
  stock: 20,
});
const ROSE = product({
  id: 7,
  slug: 'rose-quartz',
  name: 'Rose Quartz',
  priceCents: 2525,
  stock: 20,
});
const FIG = product({
  id: 8,
  slug: 'fig-cassis',
  name: 'Fig & Cassis',
  family: 'gourmand',
  priceCents: 1615,
});
const EMBER = product({
  id: 9,
  slug: 'ember-clove',
  name: 'Ember & Clove',
  family: 'spicy',
  priceCents: 2000,
  stock: 10,
});
const LAST_LIGHT = product({
  id: 11,
  slug: 'last-light',
  name: 'Last Light',
  priceCents: 2200,
  stock: 1,
});

const VALID: { [label: string]: string } = {
  Email: 'ada@example.com',
  'Full name': 'Ada Lovelace',
  'Address line 1': '12 Analytical Way',
  'Address line 2 (optional)': '',
  City: 'London',
  'Postal code': 'SW1A 1AA',
  Country: 'GB',
  'Card number': '4242 4242 4242 4242',
  'Expiry (MM/YY)': '12/40',
  CVC: '123',
};

const VALID_BODY = {
  contact: { email: 'ada@example.com' },
  shipping: {
    fullName: 'Ada Lovelace',
    line1: '12 Analytical Way',
    city: 'London',
    postalCode: 'SW1A 1AA',
    country: 'GB',
  },
  payment: { cardNumber: '4242 4242 4242 4242', expiry: '12/40', cvc: '123' },
  lines: [{ productId: 1, quantity: 1, unitPriceCents: 1800 }],
};

const ORDER = {
  orderNumber: 'WC-ABC123',
  email: 'ada@example.com',
  shipping: {
    fullName: 'Ada Lovelace',
    line1: '12 Analytical Way',
    line2: null,
    city: 'London',
    postalCode: 'SW1A 1AA',
    country: 'GB',
  },
  lines: [
    {
      productId: 1,
      name: 'Lavender Dusk',
      quantity: 1,
      unitPriceCents: 1800,
      lineTotalCents: 1800,
    },
  ],
  subtotalCents: 1800,
  shippingCents: 595,
  totalCents: 2395,
  createdAt: '2026-10-21T12:00:00.000Z',
};

const OUT_OF_STOCK_SENTENCE =
  ' is no longer available in the quantity you chose. We updated your cart.';

interface ContractCase {
  label: string;
  input: string;
  value: string;
  message: string;
}

function chars(count: number): string {
  return 'a'.repeat(count);
}

const CONTRACT_FIELD_CASES: ContractCase[] = [
  {
    label: 'Email',
    input: 'only spaces',
    value: '   ',
    message: 'Enter your email address',
  },
  {
    label: 'Email',
    input: 'ada@example',
    value: 'ada@example',
    message: 'Enter a valid email address',
  },
  {
    label: 'Full name',
    input: 'only spaces',
    value: '  ',
    message: 'Enter your full name',
  },
  {
    label: 'Full name',
    input: '101 characters',
    value: chars(101),
    message: 'Use 100 characters or fewer',
  },
  {
    label: 'Address line 1',
    input: 'nothing',
    value: '',
    message: 'Enter your address',
  },
  {
    label: 'Address line 1',
    input: '201 characters',
    value: chars(201),
    message: 'Use 200 characters or fewer',
  },
  {
    label: 'Address line 2 (optional)',
    input: '201 characters',
    value: chars(201),
    message: 'Use 200 characters or fewer',
  },
  {
    label: 'City',
    input: 'nothing',
    value: '',
    message: 'Enter your city',
  },
  {
    label: 'City',
    input: '101 characters',
    value: chars(101),
    message: 'Use 100 characters or fewer',
  },
  {
    label: 'Postal code',
    input: 'nothing',
    value: '',
    message: 'Enter your postal code',
  },
  {
    label: 'Postal code',
    input: 'AB',
    value: 'AB',
    message: 'Enter a valid postal code',
  },
  {
    label: 'Country',
    input: 'Select a country',
    value: '',
    message: 'Select your country',
  },
  {
    label: 'Card number',
    input: 'nothing',
    value: '',
    message: 'Enter your card number',
  },
  {
    label: 'Card number',
    input: '4242 4242 4242 4241',
    value: '4242 4242 4242 4241',
    message: 'Enter a valid card number',
  },
  {
    label: 'Expiry (MM/YY)',
    input: 'nothing',
    value: '',
    message: 'Enter the card expiry date',
  },
  {
    label: 'Expiry (MM/YY)',
    input: '13/40',
    value: '13/40',
    message: 'Enter the expiry as MM/YY',
  },
  {
    label: 'Expiry (MM/YY)',
    input: '09/26',
    value: '09/26',
    message: 'Your card has expired',
  },
  {
    label: 'CVC',
    input: 'nothing',
    value: '',
    message: 'Enter the CVC',
  },
  {
    label: 'CVC',
    input: '12',
    value: '12',
    message: 'Enter a valid 3 digit CVC',
  },
];

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let shop: ShopService;
  let router: Router;
  let httpMock: HttpTestingController;

  function setup(
    lines: { product: any; quantity: number }[] = [
      { product: LAVENDER, quantity: 1 },
    ],
  ): void {
    jasmine.clock().mockDate(NOW);
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [FormsModule, HttpClientTestingModule, RouterTestingModule],
      declarations: [CheckoutComponent, CheckoutFieldValidatorDirective],
    });
    shop = TestBed.inject(ShopService);
    lines.forEach((l) => shop.addToCart(l.product, l.quantity));
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function control(label: string): HTMLInputElement {
    const found = Array.from(el().querySelectorAll('label')).find(
      (l) => l.textContent!.trim() === label,
    ) as HTMLLabelElement;
    return el().querySelector('#' + found.htmlFor) as HTMLInputElement;
  }

  function type(label: string, value: string): void {
    const input = control(label);
    input.value = value;
    input.dispatchEvent(
      new Event(input.tagName === 'SELECT' ? 'change' : 'input'),
    );
    fixture.detectChanges();
  }

  function fill(overrides: { [label: string]: string } = {}): void {
    const values: { [label: string]: string } = { ...VALID, ...overrides };
    Object.keys(values).forEach((label) => type(label, values[label]));
  }

  function button(): HTMLButtonElement {
    return Array.from(el().querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === 'Place order',
    ) as HTMLButtonElement;
  }

  function submit(): void {
    button().click();
    fixture.detectChanges();
  }

  function errorFor(label: string): string | null {
    const id = control(label).getAttribute('aria-describedby');
    const node = id ? el().querySelector('#' + id) : null;
    return node ? node.textContent!.trim() : null;
  }

  function errors(): string[] {
    return Array.from(el().querySelectorAll('.invalid-feedback')).map((e) =>
      e.textContent!.trim(),
    );
  }

  function alertText(): string {
    return (
      el().querySelector('[role="alert"]') as HTMLElement
    ).textContent!.trim();
  }

  function summaryLines(): string[][] {
    return Array.from(
      el().querySelectorAll('aside[aria-label="Order summary"] li'),
    ).map((li) =>
      Array.from(li.querySelectorAll('span')).map((s) => s.textContent!.trim()),
    );
  }

  function summary(): { [label: string]: string } {
    const aside = el().querySelector('aside[aria-label="Order summary"]')!;
    const terms = Array.from(aside.querySelectorAll('dt'));
    const values = Array.from(aside.querySelectorAll('dd'));
    const out: { [label: string]: string } = {};
    terms.forEach((t, i) => {
      out[t.textContent!.trim()] = values[i].textContent!.trim();
    });
    return out;
  }

  function pending(): TestRequest {
    return httpMock.expectOne({ method: 'POST', url: '/api/orders' });
  }

  function noPost(): void {
    httpMock.expectNone({ method: 'POST', url: '/api/orders' });
  }

  function storedCart(): any[] {
    return JSON.parse(localStorage.getItem('cart') as string);
  }

  function expectValuesKept(values: { [label: string]: string }): void {
    Object.keys(values).forEach((label) => {
      expect(control(label).value).toBe(values[label]);
    });
  }

  it('[BR-K2] renders the heading, fieldsets and labelled fields in order', fakeAsync(() => {
    setup();
    expect(el().querySelector('h1')!.textContent!.trim()).toBe('Checkout');
    const fieldsets = Array.from(el().querySelectorAll('form fieldset'));
    const structure = fieldsets.map((f) => ({
      legend: f.querySelector('legend')!.textContent!.trim(),
      labels: Array.from(f.querySelectorAll('label')).map((l) =>
        l.textContent!.trim(),
      ),
    }));
    expect(structure).toEqual([
      { legend: 'Contact', labels: ['Email'] },
      {
        legend: 'Shipping address',
        labels: [
          'Full name',
          'Address line 1',
          'Address line 2 (optional)',
          'City',
          'Postal code',
          'Country',
        ],
      },
      {
        legend: 'Payment',
        labels: ['Card number', 'Expiry (MM/YY)', 'CVC'],
      },
    ]);
    const ids = Object.keys(VALID).map((label) => {
      const input = control(label);
      expect(input).not.toBeNull();
      expect(input.closest('fieldset')).not.toBeNull();
      return input.id;
    });
    expect(new Set(ids).size).toBe(10);
    expect(control('Country').tagName).toBe('SELECT');
    expect(el().querySelectorAll('form input').length).toBe(9);
  }));

  it('[BR-K2] offers the countries in contract order after a placeholder', fakeAsync(() => {
    setup();
    const options = Array.from(
      (control('Country') as any).options as HTMLOptionElement[],
    ).map((o) => [o.textContent!.trim(), o.value]);
    expect(options).toEqual([
      ['Select a country', ''],
      ['United States', 'US'],
      ['Canada', 'CA'],
      ['United Kingdom', 'GB'],
      ['Germany', 'DE'],
      ['Netherlands', 'NL'],
    ]);
    expect(control('Country').value).toBe('');
  }));

  it('[BR-K2] places one empty alert region above the form', fakeAsync(() => {
    setup();
    const alerts = el().querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(1);
    expect(alertText()).toBe('');
    const form = el().querySelector('form')!;
    expect(
      alerts[0].compareDocumentPosition(form) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(form.contains(alerts[0])).toBe(false);
  }));

  it('[BR-K6] [KD-05] renders an enabled Place order submit button', fakeAsync(() => {
    setup();
    expect(button().type).toBe('submit');
    expect(button().disabled).toBe(false);
    expect(button().hasAttribute('disabled')).toBe(false);
    expect(el().querySelector('form')!.contains(button())).toBe(true);
  }));

  it('[BR-B9] sets the checkout title and default description', fakeAsync(() => {
    setup();
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Checkout | Wick & Co. Candles',
    );
    expect(TestBed.inject(Meta).getTag('name="description"')!.content).toBe(
      DESCRIPTION,
    );
  }));

  it('[BR-K2] shows no errors before submit, then every required error, and focuses Email', fakeAsync(() => {
    setup();
    expect(errors()).toEqual([]);
    expect(el().querySelectorAll('[aria-invalid]').length).toBe(0);
    expect(el().querySelectorAll('[aria-describedby]').length).toBe(0);

    submit();

    const expected: { [label: string]: string } = {
      Email: 'Enter your email address',
      'Full name': 'Enter your full name',
      'Address line 1': 'Enter your address',
      City: 'Enter your city',
      'Postal code': 'Enter your postal code',
      Country: 'Select your country',
      'Card number': 'Enter your card number',
      'Expiry (MM/YY)': 'Enter the card expiry date',
      CVC: 'Enter the CVC',
    };
    Object.keys(expected).forEach((label) => {
      const input = control(label);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(errorFor(label)).toBe(expected[label]);
      const error = el().querySelector(
        '#' + input.getAttribute('aria-describedby'),
      ) as HTMLElement;
      expect(input.parentElement!.contains(error)).toBe(true);
      expect(
        input.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(errors()).toEqual(Object.keys(expected).map((l) => expected[l]));
    const line2 = control('Address line 2 (optional)');
    expect(line2.hasAttribute('aria-invalid')).toBe(false);
    expect(line2.hasAttribute('aria-describedby')).toBe(false);
    expect(document.activeElement).toBe(control('Email'));
    expect(alertText()).toBe('');
    noPost();
  }));

  it('[BR-K2] keeps errors hidden while typing before the first submit', fakeAsync(() => {
    setup();
    type('Email', 'ada@example');
    type('Card number', '1234');
    expect(errors()).toEqual([]);
    expect(el().querySelectorAll('[aria-invalid]').length).toBe(0);
  }));

  it('[BR-K2] clears a field error on change after the first submit', fakeAsync(() => {
    setup();
    submit();
    type('Email', 'ada@example');
    expect(errorFor('Email')).toBe('Enter a valid email address');
    type('Email', 'ada@example.com');
    expect(errorFor('Email')).toBeNull();
    expect(control('Email').hasAttribute('aria-invalid')).toBe(false);
    expect(errors().length).toBe(8);
    type('Country', 'GB');
    expect(errorFor('Country')).toBeNull();
    type('Country', '');
    expect(errorFor('Country')).toBe('Select your country');
    type('Address line 2 (optional)', chars(201));
    expect(errorFor('Address line 2 (optional)')).toBe(
      'Use 200 characters or fewer',
    );
    noPost();
  }));

  CONTRACT_FIELD_CASES.forEach((c) => {
    it(
      '[BR-K2] ' + c.label + ' with ' + c.input + ' shows ' + c.message,
      fakeAsync(() => {
        setup();
        fill({ [c.label]: c.value });
        submit();
        const input = control(c.label);
        expect(errors()).toEqual([c.message]);
        expect(errorFor(c.label)).toBe(c.message);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(el().querySelectorAll('[aria-invalid]').length).toBe(1);
        expect(document.activeElement).toBe(input);
        noPost();
      }),
    );
  });

  it('[BR-K2] accepts values at every limit', fakeAsync(() => {
    setup();
    fill({
      Email: chars(242) + '@example.com',
      'Full name': chars(100),
      'Address line 1': chars(200),
      'Address line 2 (optional)': chars(200),
      City: chars(100),
      'Postal code': '1234567890',
      'Expiry (MM/YY)': '10/26',
    });
    submit();
    const body = pending().request.body;
    expect(errors()).toEqual([]);
    expect(body.contact.email.length).toBe(254);
    expect(body.shipping.fullName).toBe(chars(100));
    expect(body.shipping.line2).toBe(chars(200));
    expect(body.payment.expiry).toBe('10/26');
  }));

  it('[BR-K2] posts trimmed values and omits an empty line 2', fakeAsync(() => {
    setup();
    fill({
      Email: '  ada@example.com  ',
      'Full name': '  Zoë Ångström  ',
      'Address line 1': ' 12 Analytical Way ',
      'Address line 2 (optional)': '   ',
      City: ' London ',
      'Postal code': ' SW1A 1AA ',
      'Card number': ' 4242 4242 4242 4242 ',
      'Expiry (MM/YY)': ' 12/40 ',
      CVC: ' 123 ',
    });
    submit();
    const body = pending().request.body;
    expect(body).toEqual({
      ...VALID_BODY,
      shipping: { ...VALID_BODY.shipping, fullName: 'Zoë Ångström' },
    });
    expect('line2' in body.shipping).toBe(false);
  }));

  it('[BR-K2] posts line 2 when it is given', fakeAsync(() => {
    setup();
    fill({ 'Address line 2 (optional)': '  Flat 3  ' });
    submit();
    expect(pending().request.body.shipping).toEqual({
      ...VALID_BODY.shipping,
      line2: 'Flat 3',
    });
  }));

  it('sends prices as received in cents', fakeAsync(() => {
    setup([
      { product: FIG, quantity: 2 },
      { product: LAVENDER, quantity: 1 },
    ]);
    fill();
    submit();
    expect(pending().request.body.lines).toEqual([
      { productId: 8, quantity: 2, unitPriceCents: 1615 },
      { productId: 1, quantity: 1, unitPriceCents: 1800 },
    ]);
  }));

  it('[BR-K3] shows the declined alert and keeps cart and values', fakeAsync(() => {
    setup();
    const typed = { ...VALID, 'Card number': '4000 0000 0000 0002' };
    fill(typed);
    submit();
    pending().flush(
      { error: 'CARD_DECLINED' },
      { status: 402, statusText: 'Payment Required' },
    );
    fixture.detectChanges();
    expect(alertText()).toBe('Your card was declined.');
    expect(shop.cart.length).toBe(1);
    expect(storedCart().length).toBe(1);
    expect(summaryLines()).toEqual([['Lavender Dusk × 1', '$18.00']]);
    expectValuesKept(typed);
    expect(errors()).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('[BR-K3] clears the alert when the order is placed again', fakeAsync(() => {
    setup();
    fill();
    submit();
    pending().flush(
      { error: 'CARD_DECLINED' },
      { status: 402, statusText: 'Payment Required' },
    );
    fixture.detectChanges();
    submit();
    expect(alertText()).toBe('');
    pending().flush(ORDER, { status: 201, statusText: 'Created' });
    expect(router.navigate).toHaveBeenCalledWith(['/order', 'WC-ABC123']);
  }));

  it('[BR-K4] adjusts the cart and names the item when stock is short', fakeAsync(() => {
    setup([
      { product: LAVENDER, quantity: 1 },
      { product: EMBER, quantity: 5 },
    ]);
    fill();
    submit();
    pending().flush(
      { error: 'OUT_OF_STOCK', items: [{ productId: 9, available: 3 }] },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(alertText()).toBe(
      'Ember & Clove is no longer available in the quantity you chose. We updated your cart.',
    );
    expect(shop.cart.find((l) => l.product.id === 9)!.quantity).toBe(3);
    expect(summaryLines()).toEqual([
      ['Lavender Dusk × 1', '$18.00'],
      ['Ember & Clove × 3', '$60.00'],
    ]);
    expectValuesKept(VALID);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('[BR-K4] names every short item in one alert, removed lines included', fakeAsync(() => {
    setup([
      { product: LAVENDER, quantity: 4 },
      { product: EMBER, quantity: 5 },
      { product: LAST_LIGHT, quantity: 1 },
    ]);
    fill();
    submit();
    pending().flush(
      {
        error: 'OUT_OF_STOCK',
        items: [
          { productId: 9, available: 3 },
          { productId: 11, available: 0 },
          { productId: 99, available: 0 },
          { productId: 1, available: 2 },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(alertText()).toBe(
      [
        'Ember & Clove' + OUT_OF_STOCK_SENTENCE,
        'Last Light' + OUT_OF_STOCK_SENTENCE,
        'Lavender Dusk' + OUT_OF_STOCK_SENTENCE,
      ].join(' '),
    );
    expect(summaryLines()).toEqual([
      ['Lavender Dusk × 2', '$36.00'],
      ['Ember & Clove × 3', '$60.00'],
    ]);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('[BR-K4] navigates to the cart when stock adjustment empties it', fakeAsync(() => {
    setup([{ product: LAST_LIGHT, quantity: 1 }]);
    fill();
    submit();
    pending().flush(
      { error: 'OUT_OF_STOCK', items: [{ productId: 11, available: 0 }] },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(shop.cart).toEqual([]);
    expect(storedCart()).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/cart']);
    expect(alertText()).toBe('');
  }));

  it('[BR-K4] updates prices and shows the price alert', fakeAsync(() => {
    setup();
    fill();
    submit();
    pending().flush(
      {
        error: 'PRICE_CHANGED',
        items: [{ productId: 1, unitPriceCents: 1900 }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect(alertText()).toBe(
      'Prices changed for some items. Please review your order and place it again.',
    );
    expect(summaryLines()).toEqual([['Lavender Dusk × 1', '$19.00']]);
    expect(summary()).toEqual({
      Subtotal: '$19.00',
      Shipping: '$5.95',
      Total: '$24.95',
    });
    expectValuesKept(VALID);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('[BR-K4] posts the new price when the order is placed again', fakeAsync(() => {
    setup();
    fill();
    submit();
    pending().flush(
      {
        error: 'PRICE_CHANGED',
        items: [{ productId: 1, unitPriceCents: 1900 }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    submit();
    expect(pending().request.body.lines).toEqual([
      { productId: 1, quantity: 1, unitPriceCents: 1900 },
    ]);
  }));

  it('[BR-K2] shows the backend validation alert on a 400', fakeAsync(() => {
    setup();
    fill();
    submit();
    pending().flush(
      { error: 'VALIDATION', fields: ['contact.email'] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(alertText()).toBe('Please check your details and try again.');
    expect(shop.cart.length).toBe(1);
    expectValuesKept(VALID);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  [
    { status: 500, statusText: 'Server Error', body: null },
    {
      status: 503,
      statusText: 'Service Unavailable',
      body: 'Service Unavailable',
    },
    { status: 409, statusText: 'Conflict', body: { error: 'SOMETHING_ELSE' } },
  ].forEach((c) => {
    it(
      '[BR-K2] shows the same alert for an unexpected ' + c.status,
      fakeAsync(() => {
        setup();
        fill();
        submit();
        pending().flush(c.body, { status: c.status, statusText: c.statusText });
        fixture.detectChanges();
        expect(alertText()).toBe('Please check your details and try again.');
        expect(shop.cart.length).toBe(1);
        expect(router.navigate).not.toHaveBeenCalled();
      }),
    );
  });

  it('[BR-K5] clears the cart and opens the confirmation on success', fakeAsync(() => {
    setup();
    spyOn(shop, 'clearCart').and.callThrough();
    fill();
    submit();
    const request = pending();
    expect(request.request.body).toEqual(VALID_BODY);
    request.flush(ORDER, { status: 201, statusText: 'Created' });
    expect(shop.cart).toEqual([]);
    expect(storedCart()).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/order', 'WC-ABC123']);
    expect(shop.clearCart).toHaveBeenCalledBefore(router.navigate as any);
  }));

  it('[BR-K6] [KD-05] posts twice when Place order is clicked twice', fakeAsync(() => {
    setup();
    fill();
    button().click();
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
    expect(button().textContent!.trim()).toBe('Place order');
    button().click();
    fixture.detectChanges();
    const requests = httpMock.match({ method: 'POST', url: '/api/orders' });
    expect(requests.length).toBe(2);
    expect(requests[0].request.body).toEqual(VALID_BODY);
    expect(requests[1].request.body).toEqual(VALID_BODY);
  }));

  it('[BR-K2] does not post when the form is invalid even if no control is marked', fakeAsync(() => {
    setup();
    fill();
    const before = document.activeElement;
    fixture.componentInstance.placeOrder({ invalid: true } as NgForm);
    expect(document.activeElement).toBe(before);
    noPost();
  }));

  it('[BR-C5] lists each item with its line total', fakeAsync(() => {
    setup([
      { product: LAVENDER, quantity: 3 },
      { product: CEDAR, quantity: 1 },
    ]);
    expect(summaryLines()).toEqual([
      ['Lavender Dusk × 3', '$54.00'],
      ['Cedar Smoke × 1', '$25.00'],
    ]);
    expect(summary()).toEqual({
      Subtotal: '$79.00',
      Shipping: 'Free',
      Total: '$79.00',
    });
  }));

  it('[BR-C5] [KD-03] checkout summary charges shipping at exactly $50.00', fakeAsync(() => {
    setup([{ product: CEDAR, quantity: 2 }]);
    expect(summaryLines()).toEqual([['Cedar Smoke × 2', '$50.00']]);
    expect(summary()).toEqual({
      Subtotal: '$50.00',
      Shipping: '$5.95',
      Total: '$55.95',
    });
  }));

  it('[BR-C5] checkout summary ships free above $50.00', fakeAsync(() => {
    setup([
      { product: CEDAR, quantity: 1 },
      { product: ROSE, quantity: 1 },
    ]);
    expect(summary()).toEqual({
      Subtotal: '$50.25',
      Shipping: 'Free',
      Total: '$50.25',
    });
  }));

  it('[BR-C5] [KD-01] checkout summary truncates the subtotal beside a correct line total', fakeAsync(() => {
    setup([{ product: FIG, quantity: 2 }]);
    expect(summaryLines()).toEqual([['Fig & Cassis × 2', '$32.30']]);
    expect(summary()).toEqual({
      Subtotal: '$32.29',
      Shipping: '$5.95',
      Total: '$38.24',
    });
  }));

  it('[BR-C5] [KD-03] copies the shipping rule into the component', fakeAsync(() => {
    setup();
    const component = fixture.componentInstance;
    expect(component.calcShipping(50)).toBe(5.95);
    expect(component.calcShipping(50.01)).toBe(0);
    expect(component.calcShipping(0)).toBe(5.95);
  }));

  it('[BR-C5] updates the summary when the cart changes', fakeAsync(() => {
    setup();
    shop.addToCart(CEDAR, 2);
    fixture.detectChanges();
    expect(summaryLines().length).toBe(2);
    expect(summary().Shipping).toBe('Free');
  }));
});
