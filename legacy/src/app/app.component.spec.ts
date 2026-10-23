import { Location } from '@angular/common';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AppComponent } from './app.component';
import { routes } from './app-routing.module';
import { NotFoundComponent } from './not-found/not-found.component';
import { HeaderComponent } from './header/header.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes(routes),
        HttpClientTestingModule,
      ],
      declarations: [AppComponent, NotFoundComponent, HeaderComponent],
    }).compileComponents();
  });

  function visit(url: string): HTMLElement {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.ngZone.run(() => TestBed.inject(Router).navigateByUrl(url));
    tick();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('renders the header above the main container', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const children = Array.from(
      fixture.nativeElement.children as HTMLElement[],
    );
    expect(children.map((c) => c.tagName.toLowerCase())).toEqual([
      'app-header',
      'main',
    ]);
  });

  it('renders routed pages inside the main container', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const main = fixture.nativeElement.querySelector('main.container.py-4');
    expect(main.querySelector('router-outlet')).not.toBeNull();
  });

  it('[KD-02] routes unknown paths to the not found page', fakeAsync(() => {
    const el = visit('/does-not-exist');

    expect(el.querySelector('main app-not-found h1').textContent.trim()).toBe(
      'Page not found',
    );
    expect(TestBed.inject(Location).path()).toBe('/does-not-exist');
  }));

  it('[KD-02] routes deep unknown paths with a query string to the not found page', fakeAsync(() => {
    const el = visit('/products/lavender-dusk/reviews?page=2');

    expect(el.querySelector('main app-not-found h1').textContent.trim()).toBe(
      'Page not found',
    );
    expect(TestBed.inject(Location).path()).toBe(
      '/products/lavender-dusk/reviews?page=2',
    );
  }));
});
