import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { ShopService } from '../shop.service';

@Injectable({ providedIn: 'root' })
export class CartNotEmptyGuard implements CanActivate {
  constructor(
    private shop: ShopService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {}

  canActivate(): boolean | UrlTree {
    if (isPlatformBrowser(this.platformId) && this.shop.cart.length === 0) {
      return this.router.parseUrl('/cart');
    }
    return true;
  }
}
