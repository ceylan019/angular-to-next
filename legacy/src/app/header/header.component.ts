import { Component } from '@angular/core';

import { ShopService } from '../shop.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  count = 0;

  constructor(shop: ShopService) {
    shop.cartCount$.subscribe((n) => (this.count = n));
  }
}
