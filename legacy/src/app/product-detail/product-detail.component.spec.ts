import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { NotFoundComponent } from '../not-found/not-found.component';
import { ShopService } from '../shop.service';

const LISTING_DESCRIPTION =
  'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.';

function detail(overrides: any = {}): any {
  return {
    id: 1,
    slug: 'lavender-dusk',
    name: 'Lavender Dusk',
    family: 'floral',
    priceCents: 1800,
    stock: 25,
    imageUrl: '/images/lavender-dusk.jpg',
    summary: 'A calm evening blend.',
    description: 'Hand poured with soft lavender and warm musk.',
    scentNotes: ['lavender', 'bergamot', 'musk'],
    burnTimeHours: 45,
    sizeOz: 8,
    ...overrides,
  };
}

describe('ProductDetailComponent', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;
  let params: BehaviorSubject<any>;
  let shop: any;
  let title: Title;
  let meta: Meta;

  function setup(
    response: any = of(detail()),
    cartResult: any = { clamped: false, cap: 10 },
  ): void {
    params = new BehaviorSubject(convertToParamMap({ slug: 'lavender-dusk' }));
    shop = {
      getProduct: jasmine.createSpy('getProduct').and.returnValue(response),
      addToCart: jasmine.createSpy('addToCart').and.returnValue(cartResult),
    };
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [ProductDetailComponent, NotFoundComponent],
      providers: [
        { provide: ShopService, useValue: shop },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function input(): HTMLInputElement {
    return el().querySelector('input[type="number"]') as HTMLInputElement;
  }

  function button(): HTMLButtonElement {
    return el().querySelector('button') as HTMLButtonElement;
  }

  function submit(value: string): void {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    button().click();
    fixture.detectChanges();
  }

  function status(): string {
    return (
      el().querySelector('[role="status"]') as HTMLElement
    ).textContent!.trim();
  }

  function notFound(status: number = 404): any {
    return throwError(new HttpErrorResponse({ status }));
  }

  it('[BR-B6] renders the product details and quantity picker', () => {
    setup();
    expect(shop.getProduct).toHaveBeenCalledWith('lavender-dusk');
    expect(el().querySelector('h1')!.textContent!.trim()).toBe('Lavender Dusk');
    const text = el().textContent!;
    expect(text).toContain('$18.00');
    expect(text).toContain('In stock');
    expect(text).toContain('Hand poured with soft lavender and warm musk.');
    expect(text).toContain('Scent notes: lavender, bergamot, musk');
    expect(text).toContain('Burn time: 45 hours');
    expect(text).toContain('Size: 8 oz');
    const label = el().querySelector('label') as HTMLLabelElement;
    expect(label.textContent!.trim()).toBe('Quantity');
    expect(label.htmlFor).toBe(input().id);
    expect(input().value).toBe('1');
    expect(input().min).toBe('1');
    expect(input().max).toBe('10');
    expect(button().textContent!.trim()).toBe('Add to cart');
    expect(el().querySelector('app-not-found')).toBeNull();
  });

  [
    { stock: 1, text: 'Only 1 left', max: '1' },
    { stock: 3, text: 'Only 3 left', max: '3' },
    { stock: 4, text: 'In stock', max: '4' },
    { stock: 10, text: 'In stock', max: '10' },
  ].forEach((c) => {
    it(
      '[BR-B6] shows ' +
        c.text +
        ' with max ' +
        c.max +
        ' for stock ' +
        c.stock,
      () => {
        setup(of(detail({ stock: c.stock })));
        expect(el().textContent).toContain(c.text);
        expect(input().max).toBe(c.max);
        expect(input().disabled).toBe(false);
        expect(button().disabled).toBe(false);
      },
    );
  });

  it('[BR-B8] disables quantity and button when out of stock', () => {
    setup(of(detail({ stock: 0 })));
    expect(el().textContent).toContain('Out of stock');
    expect(input().disabled).toBe(true);
    expect(button().disabled).toBe(true);
  });

  it('[BR-B8] does not add when out of stock', () => {
    setup(of(detail({ stock: 0 })));
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(shop.addToCart).not.toHaveBeenCalled();
  });

  it('[BR-C1] adds the chosen quantity', () => {
    setup();
    submit('3');
    expect(shop.addToCart).toHaveBeenCalledWith(detail(), 3);
    expect(status()).toBe('Added Lavender Dusk to your cart.');
  });

  it('[BR-C1] adds the default quantity of 1', () => {
    setup();
    button().click();
    expect(shop.addToCart).toHaveBeenCalledWith(detail(), 1);
  });

  [
    { typed: '', expected: 0 },
    { typed: 'abc', expected: 0 },
    { typed: '0', expected: 0 },
    { typed: '-2', expected: -2 },
    { typed: '1.5', expected: 1.5 },
  ].forEach((c) => {
    it(
      '[BR-C1] forwards the typed value "' +
        c.typed +
        '" so the cart can treat it as 1',
      () => {
        setup();
        submit(c.typed);
        expect(shop.addToCart).toHaveBeenCalledWith(detail(), c.expected);
      },
    );
  });

  it('[BR-C2] shows the cap message when the request exceeds the cap', () => {
    setup(of(detail()), { clamped: true, cap: 10 });
    submit('12');
    expect(shop.addToCart).toHaveBeenCalledWith(detail(), 12);
    expect(status()).toBe('You can buy at most 10 of Lavender Dusk.');
  });

  it('[BR-C2] reports the stock cap when stock is below ten', () => {
    setup(of(detail({ stock: 4 })), { clamped: true, cap: 4 });
    submit('5');
    expect(status()).toBe('You can buy at most 4 of Lavender Dusk.');
  });

  it('[BR-C1] shows an empty status region before any add', () => {
    setup();
    expect(el().querySelectorAll('[role="status"]').length).toBe(1);
    expect(status()).toBe('');
  });

  it('[BR-B7] [KD-02] renders not found inline on a 404', () => {
    setup(notFound());
    expect(el().querySelector('app-not-found')).not.toBeNull();
    expect(el().querySelector('h1')!.textContent!.trim()).toBe(
      'Page not found',
    );
    expect(title.getTitle()).toBe('Page not found | Wick & Co. Candles');
    expect(meta.getTag('name="description"')!.content).toBe(
      LISTING_DESCRIPTION,
    );
    expect(el().querySelector('form')).toBeNull();
    expect(el().querySelector('[role="status"]')).toBeNull();
  });

  it('[BR-B7] [KD-02] falls back to not found on other errors', () => {
    setup(notFound(500));
    expect(el().querySelector('app-not-found')).not.toBeNull();
    expect(el().querySelector('form')).toBeNull();
  });

  it('[BR-B9] sets the product title and summary description', () => {
    setup();
    expect(title.getTitle()).toBe('Lavender Dusk | Wick & Co. Candles');
    expect(meta.getTag('name="description"')!.content).toBe(
      'A calm evening blend.',
    );
  });

  it('[BR-B9] loads the new product when the slug changes', () => {
    setup();
    shop.getProduct.and.returnValue(
      of(detail({ name: 'Cedar Smoke', summary: 'Smoky.' })),
    );
    params.next(convertToParamMap({ slug: 'cedar-smoke' }));
    fixture.detectChanges();
    expect(shop.getProduct).toHaveBeenCalledWith('cedar-smoke');
    expect(el().querySelector('h1')!.textContent!.trim()).toBe('Cedar Smoke');
    expect(title.getTitle()).toBe('Cedar Smoke | Wick & Co. Candles');
  });

  it('[BR-B6] renders nothing before the product loads', () => {
    setup(of());
    expect(el().querySelector('h1')).toBeNull();
    expect(el().querySelector('app-not-found')).toBeNull();
  });
});
