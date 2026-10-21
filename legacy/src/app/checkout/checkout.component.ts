import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgForm, NgModel } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { CartItem } from '../models';
import { ShopService } from '../shop.service';
import { COUNTRIES } from './checkout-validators';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent implements OnInit {
  items: CartItem[] = [];
  countries = COUNTRIES;
  submitted = false;
  alert = '';
  model = {
    email: '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    country: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  };

  constructor(
    public shop: ShopService,
    private router: Router,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Checkout | Wick & Co. Candles');
    this.meta.updateTag({
      name: 'description',
      content:
        'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
    });
    this.shop.cart$.subscribe((items) => {
      this.items = items;
    });
  }

  calcShipping(subtotal: number): number {
    return subtotal > 50 ? 0 : 5.95;
  }

  showError(control: NgModel): boolean {
    return this.submitted && !!control.invalid;
  }

  placeOrder(form: NgForm): void {
    this.submitted = true;
    if (form.invalid) {
      const firstInvalid = document.querySelector(
        '.ng-invalid:not(form)',
      ) as HTMLElement;
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }
    this.alert = '';
    this.shop.placeOrder(this.buildOrder()).subscribe(
      (order) => {
        this.shop.clearCart();
        this.router.navigate(['/order', order.orderNumber]);
      },
      (error: HttpErrorResponse) => this.showFailure(error),
    );
  }

  private buildOrder(): any {
    const m = this.model;
    const line2 = m.line2.trim();
    return {
      contact: { email: m.email.trim() },
      shipping: {
        fullName: m.fullName.trim(),
        line1: m.line1.trim(),
        ...(line2 ? { line2 } : {}),
        city: m.city.trim(),
        postalCode: m.postalCode.trim(),
        country: m.country.trim(),
      },
      payment: {
        cardNumber: m.cardNumber.trim(),
        expiry: m.expiry.trim(),
        cvc: m.cvc.trim(),
      },
      lines: this.shop.cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPriceCents: item.product.priceCents,
      })),
    };
  }

  private showFailure(error: HttpErrorResponse): void {
    const body = error.error || {};
    if (error.status === 402) {
      this.alert = 'Your card was declined.';
    } else if (body.error === 'OUT_OF_STOCK') {
      this.adjustStock(body.items);
    } else if (body.error === 'PRICE_CHANGED') {
      this.shop.applyPriceChanges(body.items);
      this.alert =
        'Prices changed for some items. Please review your order and place it again.';
    } else {
      this.alert = 'Please check your details and try again.';
    }
  }

  private adjustStock(items: any[]): void {
    const sentences = items
      .map((item) =>
        this.shop.cart.find((line) => line.product.id === item.productId),
      )
      .filter((line) => !!line)
      .map(
        (line) =>
          line!.product.name +
          ' is no longer available in the quantity you chose. We updated your cart.',
      );
    this.shop.applyStockLimits(items);
    if (this.shop.cart.length === 0) {
      this.router.navigate(['/cart']);
    } else {
      this.alert = sentences.join(' ');
    }
  }
}
