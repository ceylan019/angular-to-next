import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { ShopService } from '../shop.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css'],
})
export class ProductDetailComponent implements OnInit {
  product: any = null;
  notFound = false;
  message = '';

  constructor(
    private shop: ShopService,
    private route: ActivatedRoute,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.shop.getProduct(params.get('slug') as string).subscribe(
        (product) => {
          this.product = product;
          this.notFound = false;
          this.message = '';
          this.title.setTitle(product.name + ' | Wick & Co. Candles');
          this.meta.updateTag({
            name: 'description',
            content: product.summary,
          });
        },
        () => {
          this.product = null;
          this.notFound = true;
        },
      );
    });
  }

  get cap(): number {
    return Math.min(10, this.product.stock);
  }

  stockText(stock: number): string {
    if (stock === 0) {
      return 'Out of stock';
    }
    return stock <= 3 ? 'Only ' + stock + ' left' : 'In stock';
  }

  add(quantity: string): void {
    if (this.product.stock === 0) {
      return;
    }
    const result = this.shop.addToCart(this.product, Number(quantity));
    this.message = result.clamped
      ? 'You can buy at most ' + result.cap + ' of ' + this.product.name + '.'
      : 'Added ' + this.product.name + ' to your cart.';
  }
}
