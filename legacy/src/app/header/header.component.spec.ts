import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';

import { HeaderComponent } from './header.component';
import { ShopService } from '../shop.service';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let shop: ShopService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      declarations: [HeaderComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
    shop = TestBed.inject(ShopService);
    fixture = TestBed.createComponent(HeaderComponent);
  });

  afterEach(() => localStorage.clear());

  function product(): any {
    return {
      id: 1,
      slug: 'lavender',
      name: 'Lavender',
      priceCents: 1800,
      stock: 25,
    };
  }

  it('[BR-C4] header shows brand, Shop and the cart count', () => {
    shop.addToCart(product(), 3);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const brand = el.querySelector('a.navbar-brand') as HTMLAnchorElement;
    const nav = el.querySelector('nav[aria-label="Main"]') as HTMLElement;
    const links = Array.from(nav.querySelectorAll('a'));

    expect(el.querySelector('header')).not.toBeNull();
    expect(brand.textContent!.trim()).toBe('Wick & Co. Candles');
    expect(brand.getAttribute('href')).toBe('/');
    expect(links.map((a) => a.textContent!.trim())).toEqual([
      'Shop',
      'Cart (3)',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/cart']);
  });

  it('[BR-C4] header shows Cart (0) for an empty cart', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cart (0)');
  });

  it('[BR-C4] header updates when the cart changes', () => {
    fixture.detectChanges();

    shop.addToCart(product(), 2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cart (2)');
  });

  it('uses a dark navbar with a collapse toggler for mobile', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const navbar = el.querySelector('.navbar') as HTMLElement;
    const toggler = el.querySelector('button.navbar-toggler') as HTMLElement;

    expect(navbar.classList).toContain('navbar-dark');
    expect(navbar.classList).toContain('bg-dark');
    expect(toggler.getAttribute('data-toggle')).toBe('collapse');
    const target = toggler.getAttribute('data-target')!;
    expect(el.querySelector(target)).not.toBeNull();
  });
});
