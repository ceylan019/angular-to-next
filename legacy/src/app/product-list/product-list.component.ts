import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

import { ShopService } from '../shop.service';

const FAMILIES = [
  { slug: 'floral', name: 'Floral' },
  { slug: 'woody', name: 'Woody' },
  { slug: 'fresh', name: 'Fresh' },
  { slug: 'gourmand', name: 'Gourmand' },
  { slug: 'spicy', name: 'Spicy' },
  { slug: 'herbal', name: 'Herbal' },
];

const SORTS = [
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit {
  families = FAMILIES;
  sorts = SORTS;
  selectedFamilies: string[] = [];
  sort = 'name-asc';
  page = 1;
  result: any = null;
  pageNumbers: number[] = [];
  message = '';

  constructor(
    private shop: ShopService,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Shop all candles | Wick & Co. Candles');
    this.meta.updateTag({
      name: 'description',
      content:
        'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
    });
    this.route.queryParamMap.subscribe((params) => {
      const requested = params.getAll('family');
      this.selectedFamilies = FAMILIES.map((f) => f.slug).filter(
        (slug) => requested.indexOf(slug) !== -1,
      );
      const sort = params.get('sort');
      this.sort = SORTS.some((s) => s.value === sort)
        ? (sort as string)
        : 'name-asc';
      const page = params.get('page');
      this.page =
        page !== null && /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1;
      this.shop
        .getProducts({
          family: this.selectedFamilies,
          sort: this.sort,
          page: this.page,
        })
        .subscribe((result) => {
          this.result = result;
          this.pageNumbers = [];
          for (let i = 1; i <= result.totalPages; i++) {
            this.pageNumbers.push(i);
          }
        });
    });
  }

  get outOfRange(): boolean {
    return (
      this.result !== null &&
      this.result.totalItems > 0 &&
      this.page > this.result.totalPages
    );
  }

  get noMatches(): boolean {
    return this.result !== null && this.result.totalItems === 0;
  }

  get showGrid(): boolean {
    return (
      this.result !== null && this.result.totalItems > 0 && !this.outOfRange
    );
  }

  get showPagination(): boolean {
    return this.showGrid && this.result.totalPages >= 2;
  }

  isSelected(slug: string): boolean {
    return this.selectedFamilies.indexOf(slug) !== -1;
  }

  stockText(stock: number): string {
    if (stock === 0) {
      return 'Out of stock';
    }
    return stock <= 3 ? 'Only ' + stock + ' left' : 'In stock';
  }

  toggleFamily(slug: string, checked: boolean): void {
    const families = FAMILIES.map((f) => f.slug).filter((s) =>
      s === slug ? checked : this.isSelected(s),
    );
    this.navigate(families, this.sort);
  }

  changeSort(sort: string): void {
    this.navigate(this.selectedFamilies, sort);
  }

  linkParams(page: number): any {
    const queryParams: any = {};
    if (this.selectedFamilies.length > 0) {
      queryParams.family = this.selectedFamilies;
    }
    if (this.sort !== 'name-asc') {
      queryParams.sort = this.sort;
    }
    if (page > 1) {
      queryParams.page = page;
    }
    return queryParams;
  }

  add(product: any): void {
    const result = this.shop.addToCart(product, 1);
    this.message = result.clamped
      ? 'You can buy at most ' + result.cap + ' of ' + product.name + '.'
      : 'Added ' + product.name + ' to your cart.';
  }

  private navigate(families: string[], sort: string): void {
    const queryParams: any = {};
    if (families.length > 0) {
      queryParams.family = families;
    }
    if (sort !== 'name-asc') {
      queryParams.sort = sort;
    }
    this.router.navigate(['/'], { queryParams });
  }
}
