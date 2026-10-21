import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { COUNTRIES } from '../models';
import { ShopService } from '../shop.service';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.css'],
})
export class OrderConfirmationComponent implements OnInit {
  order: any = null;
  notFound = false;

  constructor(
    private shop: ShopService,
    private route: ActivatedRoute,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.shop.getOrder(params.get('orderNumber') as string).subscribe(
        (order) => {
          this.order = order;
          this.notFound = false;
          this.title.setTitle(
            'Order ' + order.orderNumber + ' | Wick & Co. Candles',
          );
          this.meta.updateTag({
            name: 'description',
            content:
              'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
          });
        },
        () => {
          this.order = null;
          this.notFound = true;
        },
      );
    });
  }

  countryName(code: string): string {
    const country = COUNTRIES.find((c) => c.code === code);
    return country ? country.name : code;
  }
}
