import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { RouterLinkWithHref } from '@angular/router';
import { BehaviorSubject, NEVER, Observable, of } from 'rxjs';

import { ProductListComponent } from './product-list.component';
import { ShopService } from '../shop.service';

const DESCRIPTION =
  'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.';

function makeProducts(count: number, stocks: number[] = []): any[] {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: i + 1,
      slug: 'candle-' + (i + 1),
      name: i === 0 ? 'Lavender Dusk' : 'Candle ' + (i + 1),
      family: 'floral',
      priceCents: 1800,
      stock: stocks[i] !== undefined ? stocks[i] : 25,
      imageUrl: '/images/candle-' + (i + 1) + '.jpg',
    });
  }
  return items;
}

function page(overrides: any = {}): any {
  return {
    items: makeProducts(12),
    page: 1,
    pageSize: 12,
    totalItems: 30,
    totalPages: 3,
    ...overrides,
  };
}

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let params: BehaviorSubject<any>;
  let shop: any;
  let router: Router;
  let navigate: jasmine.Spy;
  let title: Title;
  let meta: Meta;

  function setup(
    query: any = {},
    response: any = page(),
    products: Observable<any> = of(response),
  ): void {
    params = new BehaviorSubject(convertToParamMap(query));
    shop = {
      getProducts: jasmine.createSpy('getProducts').and.returnValue(products),
      addToCart: jasmine
        .createSpy('addToCart')
        .and.returnValue({ clamped: false, cap: 10 }),
    };
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [ProductListComponent],
      providers: [
        { provide: ShopService, useValue: shop },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      ],
    });
    router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    title.setTitle('Stale title');
    meta.updateTag({ name: 'description', content: 'Stale description' });
    fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
  }

  afterEach(() => {
    meta.removeTag('name="description"');
  });

  function el(): HTMLElement {
    return fixture.nativeElement;
  }

  function cards(): HTMLElement[] {
    return Array.from(
      el().querySelectorAll('ul[aria-label="Products"] > li'),
    ) as HTMLElement[];
  }

  function hrefOf(a: Element): string {
    const link = fixture.debugElement
      .queryAll(By.directive(RouterLinkWithHref))
      .find((d) => d.nativeElement === a);
    return link!.injector.get(RouterLinkWithHref).href;
  }

  function linkByText(text: string): HTMLAnchorElement | undefined {
    return Array.from(el().querySelectorAll('a')).find(
      (a) => a.textContent!.trim() === text,
    ) as HTMLAnchorElement | undefined;
  }

  function checkbox(label: string): HTMLInputElement {
    const labelEl = Array.from(el().querySelectorAll('label')).find(
      (l) => l.textContent!.trim() === label,
    ) as HTMLLabelElement;
    return (labelEl.control ||
      labelEl.querySelector('input')) as HTMLInputElement;
  }

  it('[BR-B1] renders 12 products with name link, price and stock', () => {
    setup();
    const items = cards();

    expect(el().querySelector('h1')!.textContent!.trim()).toBe('All candles');
    expect(items.length).toBe(12);
    const first = items[0];
    const link = first.querySelector('h2 a') as HTMLAnchorElement;
    expect(link.textContent!.trim()).toBe('Lavender Dusk');
    expect(hrefOf(link)).toBe('/products/candle-1');
    expect(first.textContent).toContain('$18.00');
    expect(first.textContent).toContain('In stock');
    const img = first.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/images/candle-1.jpg');
    expect(first.querySelector('button')!.textContent!.trim()).toBe(
      'Add to cart',
    );
  });

  it('[BR-B1] requests the first page with defaults when there is no query', () => {
    setup();

    expect(shop.getProducts).toHaveBeenCalledTimes(1);
    expect(shop.getProducts).toHaveBeenCalledWith({
      family: [],
      sort: 'name-asc',
      page: 1,
    });
  });

  it('[BR-B1] shows the scent family fieldset with six checkboxes in order', () => {
    setup();
    const fieldset = el().querySelector('fieldset') as HTMLElement;
    const labels = Array.from(fieldset.querySelectorAll('label')).map((l) =>
      l.textContent!.trim(),
    );

    expect(fieldset.querySelector('legend')!.textContent!.trim()).toBe(
      'Scent family',
    );
    expect(labels).toEqual([
      'Floral',
      'Woody',
      'Fresh',
      'Gourmand',
      'Spicy',
      'Herbal',
    ]);
    expect(fieldset.querySelectorAll('input[type="checkbox"]').length).toBe(6);
  });

  it('[BR-B2] checkboxes reflect the families in the query', () => {
    setup({ family: ['woody', 'herbal'] });

    expect(checkbox('Floral').checked).toBe(false);
    expect(checkbox('Woody').checked).toBe(true);
    expect(checkbox('Herbal').checked).toBe(true);
  });

  it('[BR-B1] shows the sort select with its options', () => {
    setup();
    const select = el().querySelector('select') as HTMLSelectElement;
    const label = el().querySelector('label[for="sort"]') as HTMLElement;
    const options = Array.from(select.options);

    expect(select.id).toBe('sort');
    expect(label.textContent!.trim()).toBe('Sort by');
    expect(options.map((o) => o.textContent!.trim())).toEqual([
      'Name: A to Z',
      'Price: low to high',
      'Price: high to low',
    ]);
    expect(options.map((o) => o.value)).toEqual([
      'name-asc',
      'price-asc',
      'price-desc',
    ]);
    expect(select.value).toBe('name-asc');
  });

  it('[BR-B3] the select shows the sort from the query', () => {
    setup({ sort: 'price-desc' });

    expect((el().querySelector('select') as HTMLSelectElement).value).toBe(
      'price-desc',
    );
  });

  const stockCases: [number, string][] = [
    [0, 'Out of stock'],
    [1, 'Only 1 left'],
    [3, 'Only 3 left'],
    [4, 'In stock'],
  ];
  stockCases.forEach(([stock, text]) => {
    it('[BR-B1] stock ' + stock + ' shows ' + text, () => {
      setup({}, page({ items: makeProducts(1, [stock]) }));

      expect(cards()[0].textContent).toContain(text);
    });
  });

  it('[BR-B8] disables Add to cart when out of stock', () => {
    setup({}, page({ items: makeProducts(2, [0, 5]) }));
    const buttons = cards().map(
      (c) => c.querySelector('button') as HTMLButtonElement,
    );

    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('[BR-B2] checking a family navigates with canonical families and no page', () => {
    setup({ family: 'woody', page: '2' });

    const box = checkbox('Floral');
    box.checked = true;
    box.dispatchEvent(new Event('change'));

    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { family: ['floral', 'woody'] },
    });
  });

  it('[BR-B2] unchecking the last family omits family', () => {
    setup({ family: 'woody' });

    const box = checkbox('Woody');
    box.checked = false;
    box.dispatchEvent(new Event('change'));

    expect(navigate).toHaveBeenCalledWith(['/'], { queryParams: {} });
  });

  it('[BR-B2] a filter change keeps a non default sort', () => {
    setup({ sort: 'price-asc' });

    const box = checkbox('Fresh');
    box.checked = true;
    box.dispatchEvent(new Event('change'));

    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { family: ['fresh'], sort: 'price-asc' },
    });
  });

  it('[BR-B3] changing sort navigates and the default removes the param', () => {
    setup({ family: 'woody', page: '2' });
    const select = el().querySelector('select') as HTMLSelectElement;

    select.value = 'price-desc';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { family: ['woody'], sort: 'price-desc' },
    });

    select.value = 'name-asc';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { family: ['woody'] },
    });
  });

  it('[BR-B4] invalid query values request page 1 with defaults', () => {
    setup({ page: 'abc', sort: 'PRICE-ASC', family: 'nope' });

    expect(shop.getProducts).toHaveBeenCalledWith({
      family: [],
      sort: 'name-asc',
      page: 1,
    });
  });

  ['0', '-1', '1.5', '1e3', '10000', '', ' 2', '02'].forEach((value) => {
    it('[BR-B4] page "' + value + '" falls back to 1', () => {
      setup({ page: value });

      expect(shop.getProducts).toHaveBeenCalledWith({
        family: [],
        sort: 'name-asc',
        page: 1,
      });
    });
  });

  ['1', '2', '9999'].forEach((value) => {
    it('[BR-B4] page "' + value + '" is accepted', () => {
      setup({ page: value });

      expect(shop.getProducts.calls.mostRecent().args[0].page).toBe(
        Number(value),
      );
    });
  });

  it('[BR-B4] page and sort use the first value', () => {
    setup({ page: ['3', 'x'], sort: ['price-asc', 'price-desc'] });

    expect(shop.getProducts).toHaveBeenCalledWith({
      family: [],
      sort: 'price-asc',
      page: 3,
    });
  });

  it('[BR-B4] families are deduplicated, case sensitive and in canonical order', () => {
    setup({ family: ['spicy', 'Woody', 'floral', 'spicy', 'nope', 'woody'] });

    expect(shop.getProducts).toHaveBeenCalledWith({
      family: ['floral', 'woody', 'spicy'],
      sort: 'name-asc',
      page: 1,
    });
  });

  it('[BR-B4] each sort value is accepted', () => {
    setup({ sort: 'price-asc' });
    expect(shop.getProducts.calls.mostRecent().args[0].sort).toBe('price-asc');
    params.next(convertToParamMap({ sort: 'price-desc' }));
    expect(shop.getProducts.calls.mostRecent().args[0].sort).toBe('price-desc');
  });

  it('[BR-B4] a query change fetches again', () => {
    setup();

    params.next(convertToParamMap({ page: '2' }));

    expect(shop.getProducts).toHaveBeenCalledTimes(2);
    expect(shop.getProducts.calls.mostRecent().args[0].page).toBe(2);
  });

  it('[BR-B4] pagination shows Previous, numbers and Next correctly', () => {
    setup();
    let nav = el().querySelector('nav[aria-label="Pagination"]') as HTMLElement;
    let texts = Array.from(nav.querySelectorAll('a')).map((a) =>
      a.textContent!.trim(),
    );
    expect(texts).toEqual(['1', '2', '3', 'Next']);
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent!.trim()).toBe('1');
    expect(hrefOf(linkByText('Next')!)).toBe('/?page=2');
    expect(hrefOf(linkByText('2')!)).toBe('/?page=2');

    params.next(convertToParamMap({ page: '2' }));
    fixture.detectChanges();
    nav = el().querySelector('nav[aria-label="Pagination"]') as HTMLElement;
    texts = Array.from(nav.querySelectorAll('a')).map((a) =>
      a.textContent!.trim(),
    );
    expect(texts).toEqual(['Previous', '1', '2', '3', 'Next']);
    expect(hrefOf(linkByText('Previous')!)).toBe('/');
    expect(hrefOf(linkByText('1')!)).toBe('/');

    shop.getProducts.and.returnValue(of(page({ page: 3 })));
    params.next(convertToParamMap({ page: '3' }));
    fixture.detectChanges();
    nav = el().querySelector('nav[aria-label="Pagination"]') as HTMLElement;
    texts = Array.from(nav.querySelectorAll('a')).map((a) =>
      a.textContent!.trim(),
    );
    expect(texts).toEqual(['Previous', '1', '2', '3']);
    expect(
      nav.querySelector('[aria-current="page"]')!.textContent!.trim(),
    ).toBe('3');
    expect(hrefOf(linkByText('Previous')!)).toBe('/?page=2');
  });

  it('[BR-B4] pagination links keep families and sort', () => {
    setup({ family: ['woody', 'floral'], sort: 'price-asc' });

    expect(hrefOf(linkByText('2')!)).toBe(
      '/?family=floral&family=woody&sort=price-asc&page=2',
    );
    expect(hrefOf(linkByText('1')!)).toBe(
      '/?family=floral&family=woody&sort=price-asc',
    );
  });

  it('[BR-B4] two pages show pagination', () => {
    setup({}, page({ totalItems: 13, totalPages: 2 }));

    const nav = el().querySelector('nav[aria-label="Pagination"]');
    expect(nav).not.toBeNull();
    expect(
      Array.from(nav!.querySelectorAll('a')).map((a) => a.textContent!.trim()),
    ).toEqual(['1', '2', 'Next']);
  });

  it('[BR-B4] a single page shows no pagination', () => {
    setup({}, page({ items: makeProducts(5), totalItems: 5, totalPages: 1 }));

    expect(el().querySelector('nav[aria-label="Pagination"]')).toBeNull();
    expect(cards().length).toBe(5);
  });

  it('[BR-B4] an out of range page shows the empty page message', () => {
    setup(
      { page: '9', family: 'woody', sort: 'price-desc' },
      page({ items: [], page: 9 }),
    );

    expect(el().textContent).toContain('This page is empty.');
    const link = linkByText('Go to page 1')!;
    expect(hrefOf(link)).toBe('/?family=woody&sort=price-desc');
    expect(el().querySelector('ul[aria-label="Products"]')).toBeNull();
    expect(el().querySelector('nav[aria-label="Pagination"]')).toBeNull();
  });

  it('[BR-B5] no matches shows the message and Clear filters', () => {
    setup(
      { family: 'woody' },
      page({ items: [], totalItems: 0, totalPages: 0 }),
    );

    expect(el().textContent).toContain('No candles match these filters');
    expect(hrefOf(linkByText('Clear filters')!)).toBe('/');
    expect(el().textContent).not.toContain('This page is empty.');
    expect(el().querySelector('ul[aria-label="Products"]')).toBeNull();
    expect(el().querySelector('nav[aria-label="Pagination"]')).toBeNull();
  });

  it('[BR-B1] shows no grid, messages or pagination while products load', () => {
    setup({}, page(), NEVER);

    expect(el().querySelector('ul[aria-label="Products"]')).toBeNull();
    expect(el().querySelector('nav[aria-label="Pagination"]')).toBeNull();
    expect(el().textContent).not.toContain('This page is empty.');
    expect(el().textContent).not.toContain('No candles match these filters');
  });

  it('[BR-B5] the empty messages are hidden while products show', () => {
    setup();

    expect(el().textContent).not.toContain('This page is empty.');
    expect(el().textContent).not.toContain('No candles match these filters');
    expect(linkByText('Clear filters')).toBeUndefined();
  });

  it('[BR-B9] sets the list title and default description', () => {
    setup();

    expect(title.getTitle()).toBe('Shop all candles | Wick & Co. Candles');
    const tags = meta.getTags('name="description"');
    expect(tags.length).toBe(1);
    expect(tags[0].content).toBe(DESCRIPTION);
  });

  it('[BR-C1] adding shows the added message', () => {
    setup();
    const status = el().querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent!.trim()).toBe('');

    (cards()[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(shop.addToCart).toHaveBeenCalledWith(
      jasmine.objectContaining({ slug: 'candle-1' }),
      1,
    );
    expect(el().querySelectorAll('[role="status"]').length).toBe(1);
    expect(status.textContent!.trim()).toBe(
      'Added Lavender Dusk to your cart.',
    );
  });

  it('[BR-C2] adding past the cap shows the cap message', () => {
    setup();
    shop.addToCart.and.returnValue({ clamped: true, cap: 10 });

    (cards()[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(
      (
        el().querySelector('[role="status"]') as HTMLElement
      ).textContent!.trim(),
    ).toBe('You can buy at most 10 of Lavender Dusk.');
  });

  it('[BR-C2] the cap message uses the stock when it is lower than ten', () => {
    setup({}, page({ items: makeProducts(1, [3]) }));
    shop.addToCart.and.returnValue({ clamped: true, cap: 3 });

    (cards()[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(
      (
        el().querySelector('[role="status"]') as HTMLElement
      ).textContent!.trim(),
    ).toBe('You can buy at most 3 of Lavender Dusk.');
  });

  it('[BR-C1] the last message replaces the previous one', () => {
    setup();
    const buttons = cards().map((c) => c.querySelector('button')!);

    buttons[0].click();
    buttons[1].click();
    fixture.detectChanges();

    expect(
      (
        el().querySelector('[role="status"]') as HTMLElement
      ).textContent!.trim(),
    ).toBe('Added Candle 2 to your cart.');
  });
});
