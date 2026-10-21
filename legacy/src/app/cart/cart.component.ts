import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { CartItem } from '../models';
import { ShopService } from '../shop.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  message = '';

  constructor(
    public shop: ShopService,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Your cart | Wick & Co. Candles');
    this.meta.updateTag({
      name: 'description',
      content:
        'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
    });
    this.shop.cart$.subscribe((items) => {
      this.items = items;
    });
  }

  cap(item: CartItem): number {
    return Math.min(10, item.product.stock);
  }

  changeQuantity(item: CartItem, input: HTMLInputElement): void {
    const result = this.shop.updateQuantity(item.product.id, input.value);
    const line = this.shop.cart.find((l) => l.product.id === item.product.id);
    input.value = String(line ? line.quantity : 1);
    this.message = result.clamped
      ? 'You can buy at most ' + result.cap + ' of ' + item.product.name + '.'
      : '';
  }

  remove(item: CartItem): void {
    this.message = '';
    this.shop.removeFromCart(item.product.id);
  }
}
