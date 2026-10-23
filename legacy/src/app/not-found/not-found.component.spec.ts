import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { RouterLinkWithHref } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;
  let title: Title;
  let meta: Meta;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [NotFoundComponent],
    }).compileComponents();

    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    title.setTitle('Stale title');
    meta.updateTag({ name: 'description', content: 'Stale description' });

    fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    meta.removeTag('name="description"');
  });

  it('[BR-B7] shows the not found heading, message and link back to the shop', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headings = el.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent.trim()).toBe('Page not found');
    expect(el.querySelector('p').textContent.trim()).toBe(
      "We couldn't find that page.",
    );

    const link = fixture.debugElement.query(By.directive(RouterLinkWithHref));
    expect(link.nativeElement.textContent.trim()).toBe('Back to shop');
    expect(link.injector.get(RouterLinkWithHref).href).toBe('/');
  });

  it('[BR-B9] not found sets its title and the default description', () => {
    expect(title.getTitle()).toBe('Page not found | Wick & Co. Candles');

    const descriptions = meta.getTags('name="description"');
    expect(descriptions.length).toBe(1);
    expect(descriptions[0].content).toBe(
      'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
    );
  });
});
