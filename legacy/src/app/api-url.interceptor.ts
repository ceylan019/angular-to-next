import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { BACKEND_URL } from './backend-url.token';

@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Optional() @Inject(BACKEND_URL) private backendUrl: string,
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    if (isPlatformServer(this.platformId) && req.url.startsWith('/api')) {
      return next.handle(req.clone({ url: this.backendUrl + req.url }));
    }
    return next.handle(req);
  }
}
