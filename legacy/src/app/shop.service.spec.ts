import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ShopService } from './shop.service';

const catalog: { [slug: string]: [number, number, number] } = {
  lavender: [1, 1800, 25],
  vanilla: [4, 1600, 25],
  cedar: [5, 2500, 20],
  honey: [6, 2475, 20],
  rose: [7, 2525, 20],
  'fig-cassis': [8, 1615, 25],
  'ember-clove': [9, 2000, 3],
  'last-light': [11, 2200, 1],
};

function product(slug: string, overrides: any = {}): any {
  const [id, priceCents, stock] = catalog[slug];
  return {
    id,
    slug,
    name: slug + ' candle',
    family: 'floral',
    priceCents,
    stock,
    imageUrl: '/images/' + slug + '.jpg',
    ...overrides,
  };
}

describe('ShopService', () => {
  let httpMock: HttpTestingController;

  function create(platformId = 'browser'): ShopService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ShopService);
  }

  function fresh(): ShopService {
    localStorage.clear();
    return create();
  }

  function count(service: ShopService): number {
    let value = -1;
    service.cartCount$.subscribe((n) => (value = n)).unsubscribe();
    return value;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('[BR-C1] adds a new line and merges repeated adds', () => {
    const service = create();

    service.addToCart(product('lavender'), 1);
    service.addToCart(product('lavender'), 2);

    expect(service.cart.length).toBe(1);
    expect(service.cart[0].quantity).toBe(3);
    expect(service.cart$.value).toBe(service.cart);
  });

  it('[BR-C1] keeps separate lines for different products', () => {
    const service = create();

    service.addToCart(product('lavender'), 1);
    service.addToCart(product('vanilla'), 1);

    expect(service.cart.map((l) => l.product.slug)).toEqual([
      'lavender',
      'vanilla',
    ]);
  });

  it('[BR-C1] a repeated add takes the current price', () => {
    const service = create();

    service.addToCart(product('lavender'), 1);
    service.addToCart(product('lavender', { priceCents: 1900 }), 1);

    expect(service.cart.length).toBe(1);
    expect(service.cart[0].product.priceCents).toBe(1900);
  });

  it('[BR-C2] adds below the cap without clamping', () => {
    const service = create();

    const result = service.addToCart(product('lavender'), 4);

    expect(result).toEqual({ clamped: false, cap: 10 });
    expect(service.cart[0].quantity).toBe(4);
  });

  it('[BR-C2] allows exactly 10 without clamping', () => {
    const service = create();

    const result = service.addToCart(product('lavender'), 10);

    expect(result).toEqual({ clamped: false, cap: 10 });
    expect(service.cart[0].quantity).toBe(10);
  });

  it('[BR-C2] caps a line at 10', () => {
    const service = create();

    const result = service.addToCart(product('lavender'), 11);

    expect(service.cart[0].quantity).toBe(10);
    expect(result).toEqual({ clamped: true, cap: 10 });
  });

  it('[BR-C2] caps a merged line at 10', () => {
    const service = create();
    service.addToCart(product('lavender'), 8);

    const result = service.addToCart(product('lavender'), 3);

    expect(service.cart[0].quantity).toBe(10);
    expect(result.clamped).toBe(true);
  });

  it('[BR-C2] caps a line at stock', () => {
    const service = create();

    const first = service.addToCart(product('ember-clove'), 2);
    const second = service.addToCart(product('ember-clove'), 2);

    expect(first).toEqual({ clamped: false, cap: 3 });
    expect(service.cart[0].quantity).toBe(3);
    expect(second).toEqual({ clamped: true, cap: 3 });
  });

  it('[BR-C2] adds nothing when the product has no stock', () => {
    const service = create();

    const result = service.addToCart(product('lavender', { stock: 0 }), 1);

    expect(service.cart).toEqual([]);
    expect(result).toEqual({ clamped: true, cap: 0 });
  });

  it('[BR-C2] treats invalid requested quantities as 1', () => {
    [0, -2, 2.5, 'abc', undefined, null, NaN, Infinity, '', ' '].forEach(
      (invalid) => {
        const service = fresh();

        const result = service.addToCart(product('lavender'), invalid);

        expect(service.cart[0].quantity).toBe(1);
        expect(result).toEqual({ clamped: false, cap: 10 });
      },
    );
  });

  it('[BR-C2] treats quantities that are neither numbers nor strings as 1', () => {
    [[3], true, {}].forEach((invalid) => {
      const service = fresh();

      service.addToCart(product('lavender'), invalid);

      expect(service.cart[0].quantity).toBe(1);
    });
  });

  it('[BR-C2] accepts numeric strings as quantities', () => {
    const service = create();

    service.addToCart(product('lavender'), '3');

    expect(service.cart[0].quantity).toBe(3);
  });

  it('[BR-C2] [BR-C3] update clamps to the range 1 to cap', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);

    expect(service.updateQuantity(1, 15)).toEqual({ clamped: true, cap: 10 });
    expect(service.cart[0].quantity).toBe(10);
    expect(service.updateQuantity(1, 0)).toEqual({ clamped: false, cap: 10 });
    expect(service.cart[0].quantity).toBe(1);
    service.updateQuantity(1, 5);
    service.updateQuantity(1, -3);
    expect(service.cart[0].quantity).toBe(1);
    service.updateQuantity(1, 5);
    service.updateQuantity(1, 'x');
    expect(service.cart[0].quantity).toBe(1);
    service.updateQuantity(1, 5);
    service.updateQuantity(1, 2.5);
    expect(service.cart[0].quantity).toBe(1);
  });

  it('[BR-C2] [BR-C3] update caps at stock', () => {
    const service = create();
    service.addToCart(product('ember-clove'), 1);

    const result = service.updateQuantity(9, 4);

    expect(result).toEqual({ clamped: true, cap: 3 });
    expect(service.cart[0].quantity).toBe(3);
  });

  it('[BR-C3] update accepts exactly the cap', () => {
    const service = create();
    service.addToCart(product('ember-clove'), 1);

    const result = service.updateQuantity(9, 3);

    expect(result).toEqual({ clamped: false, cap: 3 });
    expect(service.cart[0].quantity).toBe(3);
  });

  it('[BR-C2] [BR-C3] update keeps a line capped at a stock of 1', () => {
    const service = create();
    service.addToCart(product('last-light'), 1);

    const result = service.updateQuantity(11, 4);

    expect(result).toEqual({ clamped: true, cap: 1 });
    expect(service.cart.map((l) => [l.product.id, l.quantity])).toEqual([
      [11, 1],
    ]);
  });

  it('[BR-C3] update of an unknown product changes nothing', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);

    const result = service.updateQuantity(999, 5);

    expect(result).toEqual({ clamped: false, cap: 10 });
    expect(service.cart[0].quantity).toBe(2);
  });

  it('[BR-C3] update removes a line whose product has no stock', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);
    service.cart[0].product.stock = 0;

    const result = service.updateQuantity(1, 2);

    expect(service.cart).toEqual([]);
    expect(result).toEqual({ clamped: true, cap: 0 });
  });

  it('[BR-C3] removes a line', () => {
    const service = create();
    service.addToCart(product('lavender'), 1);
    service.addToCart(product('vanilla'), 1);

    service.removeFromCart(1);

    expect(service.cart.map((l) => l.product.id)).toEqual([4]);
    expect(JSON.parse(localStorage.getItem('cart')!).length).toBe(1);
  });

  it('[BR-C3] removing an unknown product changes nothing', () => {
    const service = create();
    service.addToCart(product('lavender'), 1);

    service.removeFromCart(999);

    expect(service.cart.length).toBe(1);
  });

  it('[BR-C3] clears the cart', () => {
    const service = create();
    service.addToCart(product('lavender'), 1);

    service.clearCart();

    expect(service.cart).toEqual([]);
    expect(count(service)).toBe(0);
    expect(localStorage.getItem('cart')).toBe('[]');
  });

  it('[BR-C4] counts total quantity', () => {
    const service = create();
    const seen: number[] = [];
    service.cartCount$.subscribe((n) => seen.push(n));

    service.addToCart(product('lavender'), 2);
    service.addToCart(product('vanilla'), 1);

    expect(seen).toEqual([0, 2, 3]);
    expect(count(service)).toBe(3);
  });

  it('[BR-C5] [KD-01] truncates the subtotal of a $16.15 candle to $16.14', () => {
    const service = create();

    service.addToCart(product('fig-cassis'), 1);
    expect(service.getSubtotal()).toBe(16.14);
    service.updateQuantity(8, 2);
    expect(service.getSubtotal()).toBe(32.29);
    service.updateQuantity(8, 4);
    expect(service.getSubtotal()).toBe(64.59);
  });

  it('[BR-C5] [KD-01] the formula does not truncate every quantity of the $16.15 candle', () => {
    const service = create();
    service.addToCart(product('fig-cassis'), 3);

    expect(service.getSubtotal()).toBe(48.45);
  });

  it('[BR-C5] subtotal of an empty cart is 0', () => {
    expect(create().getSubtotal()).toBe(0);
  });

  it('[BR-C5] sums line subtotals', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);
    service.addToCart(product('vanilla'), 1);

    expect(service.getSubtotal()).toBe(52);
  });

  it('[BR-C5] [KD-03] charges shipping at exactly $50.00', () => {
    const service = create();

    service.addToCart(product('cedar'), 2);

    expect(service.getSubtotal()).toBe(50);
    expect(service.getShipping()).toBe(5.95);
    expect(service.getTotal()).toBe(55.95);
  });

  it('[BR-C5] charges shipping below and not above $50.00', () => {
    const below = fresh();
    below.addToCart(product('cedar'), 1);
    below.addToCart(product('honey'), 1);
    expect(below.getShipping()).toBe(5.95);

    const above = fresh();
    above.addToCart(product('cedar'), 1);
    above.addToCart(product('rose'), 1);
    expect(above.getShipping()).toBe(0);
    expect(above.getTotal()).toBe(50.25);

    expect(fresh().getShipping()).toBe(0);
    expect(fresh().getTotal()).toBe(0);
  });

  it('[BR-C6] persists the cart and restores it in a new instance', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);
    service.addToCart(product('vanilla'), 1);

    const restored = create();

    expect(restored.cart.map((l) => [l.product.slug, l.quantity])).toEqual([
      ['lavender', 2],
      ['vanilla', 1],
    ]);
    expect(count(restored)).toBe(3);
  });

  it('[BR-C6] starts empty with nothing stored', () => {
    expect(create().cart).toEqual([]);
  });

  it('[KD-04] never reads the cart on the server', () => {
    localStorage.setItem(
      'cart',
      JSON.stringify([{ product: product('lavender'), quantity: 2 }]),
    );

    const service = create('server');

    expect(count(service)).toBe(0);
    expect(service.cart).toEqual([]);
  });

  it('[KD-04] never writes the cart on the server', () => {
    const service = create('server');

    service.addToCart(product('lavender'), 1);

    expect(localStorage.getItem('cart')).toBeNull();
  });

  it('ignores malformed stored carts', () => {
    localStorage.setItem('cart', 'not json');
    expect(create().cart).toEqual([]);

    localStorage.setItem('cart', '[{"quantity":999}]');
    expect(create().cart).toEqual([]);

    localStorage.setItem('cart', '{"quantity":1}');
    expect(create().cart).toEqual([]);

    localStorage.setItem('cart', 'null');
    expect(create().cart).toEqual([]);

    localStorage.setItem(
      'cart',
      JSON.stringify([
        { product: product('lavender'), quantity: 2 },
        { product: product('vanilla'), quantity: 999 },
      ]),
    );
    const service = create();
    expect(service.cart.length).toBe(1);
    expect(service.cart[0].product.slug).toBe('lavender');
  });

  it('drops stored lines with invalid products or quantities', () => {
    const good = product('lavender');
    const lines: any[] = [
      null,
      42,
      'x',
      { product: null, quantity: 1 },
      { product: 'lavender', quantity: 1 },
      { quantity: 1 },
      { product: good },
      { product: good, quantity: 0 },
      { product: good, quantity: -1 },
      { product: good, quantity: 11 },
      { product: good, quantity: 1.5 },
      { product: good, quantity: '2' },
      { product: { ...good, id: '1' }, quantity: 1 },
      { product: { ...good, id: NaN }, quantity: 1 },
      { product: { ...good, priceCents: '1800' }, quantity: 1 },
      { product: { ...good, priceCents: -1800 }, quantity: 1 },
      { product: { ...good, priceCents: Infinity }, quantity: 1 },
      { product: { ...good, stock: '5' }, quantity: 1 },
      { product: { ...good, stock: -1 }, quantity: 1 },
      { product: { ...good, slug: 5 }, quantity: 1 },
      { product: { ...good, name: undefined }, quantity: 1 },
      { product: good, quantity: 10 },
    ];
    localStorage.setItem('cart', JSON.stringify(lines));

    const service = create();

    expect(service.cart.length).toBe(1);
    expect(service.cart[0].quantity).toBe(10);
  });

  it('drops stored lines that exceed the product stock or repeat a product', () => {
    localStorage.setItem(
      'cart',
      JSON.stringify([
        { product: product('ember-clove'), quantity: 5 },
        { product: product('lavender'), quantity: 2 },
        { product: product('lavender'), quantity: 3 },
      ]),
    );

    const service = create();

    expect(service.cart.map((l) => [l.product.slug, l.quantity])).toEqual([
      ['lavender', 2],
    ]);
  });

  it('keeps a stored line for a product that costs nothing', () => {
    localStorage.setItem(
      'cart',
      JSON.stringify([
        { product: product('lavender', { priceCents: 0 }), quantity: 1 },
      ]),
    );

    const service = create();

    expect(service.cart.map((l) => [l.product.slug, l.quantity])).toEqual([
      ['lavender', 1],
    ]);
  });

  it('keeps a stored line whose quantity equals the product stock', () => {
    localStorage.setItem(
      'cart',
      JSON.stringify([{ product: product('ember-clove'), quantity: 3 }]),
    );

    const service = create();

    expect(service.cart.map((l) => [l.product.slug, l.quantity])).toEqual([
      ['ember-clove', 3],
    ]);
  });

  it('survives a storage that throws', () => {
    const service = create();
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');

    expect(() => service.addToCart(product('lavender'), 1)).not.toThrow();
    expect(service.cart.length).toBe(1);
  });

  it('survives a storage that cannot be read', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('denied');

    expect(create().cart).toEqual([]);
  });

  it('requests families', () => {
    const service = create();
    let body: any;

    service.getFamilies().subscribe((f) => (body = f));
    const req = httpMock.expectOne('/api/families');
    req.flush([{ slug: 'floral', name: 'Floral' }]);

    expect(req.request.method).toBe('GET');
    expect(body).toEqual([{ slug: 'floral', name: 'Floral' }]);
  });

  it('requests products with repeated family params', () => {
    const service = create();

    service
      .getProducts({ family: ['floral', 'woody'], sort: 'price-asc', page: 2 })
      .subscribe();

    const req = httpMock.expectOne(
      '/api/products?family=floral&family=woody&sort=price-asc&page=2',
    );
    expect(req.request.params.getAll('family')).toEqual(['floral', 'woody']);
    req.flush({});
  });

  it('omits undefined product params', () => {
    const service = create();

    service.getProducts({}).subscribe();
    httpMock.expectOne('/api/products').flush({});

    service.getProducts({ sort: 'name-asc' }).subscribe();
    httpMock.expectOne('/api/products?sort=name-asc').flush({});

    service.getProducts({ page: 3 }).subscribe();
    httpMock.expectOne('/api/products?page=3').flush({});

    service.getProducts({ family: [] }).subscribe();
    httpMock.expectOne('/api/products').flush({});
  });

  it('requests one product by encoded slug', () => {
    const service = create();

    service.getProduct('a b').subscribe();

    httpMock.expectOne('/api/products/a%20b').flush({});
  });

  it('places an order with a POST body', () => {
    const service = create();
    const body = { lines: [] };

    service.placeOrder(body).subscribe();

    const req = httpMock.expectOne('/api/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({});
  });

  it('requests an order by encoded number', () => {
    const service = create();

    service.getOrder('WC-ABC123').subscribe();

    httpMock.expectOne('/api/orders/WC-ABC123').flush({});
  });

  it('[BR-K4] applies stock limits and price changes', () => {
    const service = create();
    service.addToCart(product('lavender'), 4);
    service.addToCart(product('vanilla'), 2);
    service.addToCart(product('cedar'), 2);

    service.applyStockLimits([
      { productId: 1, available: 1 },
      { productId: 4, available: 0 },
      { productId: 999, available: 0 },
    ]);
    service.applyPriceChanges([
      { productId: 5, unitPriceCents: 2600 },
      { productId: 999, unitPriceCents: 1 },
    ]);

    expect(service.cart.map((l) => [l.product.id, l.quantity])).toEqual([
      [1, 1],
      [5, 2],
    ]);
    expect(service.cart[1].product.priceCents).toBe(2600);
    expect(service.cart[0].product.stock).toBe(1);
    expect(count(service)).toBe(3);
    expect(
      JSON.parse(localStorage.getItem('cart')!)[1].product.priceCents,
    ).toBe(2600);
  });

  it('[BR-K4] ignores available stock for products that are not in the cart', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);

    service.applyStockLimits([{ productId: 999, available: 3 }]);

    expect(
      service.cart.map((l) => [l.product.id, l.quantity, l.product.stock]),
    ).toEqual([[1, 2, 25]]);
  });

  it('[BR-K4] keeps quantities already within available stock', () => {
    const service = create();
    service.addToCart(product('lavender'), 2);

    service.applyStockLimits([{ productId: 1, available: 5 }]);

    expect(service.cart[0].quantity).toBe(2);
  });

  it('[BR-K4] a stock of 10 or more caps nothing below the line limit', () => {
    const service = create();
    service.addToCart(product('lavender'), 10);

    service.applyStockLimits([{ productId: 1, available: 10 }]);

    expect(service.cart[0].quantity).toBe(10);
  });
});
