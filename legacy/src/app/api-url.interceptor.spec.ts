import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ApiUrlInterceptor } from './api-url.interceptor';
import { BACKEND_URL } from './backend-url.token';

describe('ApiUrlInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function setup(platformId: string, providers: any[] = []) {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ApiUrlInterceptor,
          multi: true,
        },
        ...providers,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  describe('on the server', () => {
    beforeEach(() => {
      setup('server', [
        { provide: BACKEND_URL, useValue: 'http://backend:8080' },
      ]);
    });

    it('prefixes api calls with the backend url on the server', () => {
      http.get('/api/products').subscribe();

      const req = httpMock.expectOne('http://backend:8080/api/products');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('keeps the query string, method and body when prefixing', () => {
      const params = new HttpParams()
        .append('family', 'floral')
        .append('family', 'woody')
        .set('page', '2');
      http.get('/api/products', { params }).subscribe();
      http.post('/api/orders', { lines: [] }).subscribe();

      httpMock
        .expectOne(
          'http://backend:8080/api/products?family=floral&family=woody&page=2',
        )
        .flush({});
      const post = httpMock.expectOne('http://backend:8080/api/orders');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ lines: [] });
      post.flush({});
    });

    it('leaves urls outside /api untouched on the server', () => {
      const urls = [
        '/assets/data.json',
        '/images/lavender-dusk.jpg',
        '/shop/api/products',
        'http://elsewhere.test/api/products',
      ];
      urls.forEach((url) => http.get(url).subscribe());

      urls.forEach((url) => httpMock.expectOne(url).flush({}));
    });
  });

  describe('in the browser', () => {
    it('leaves api calls relative in the browser', () => {
      setup('browser', [
        { provide: BACKEND_URL, useValue: 'http://backend:8080' },
      ]);
      http.get('/api/products').subscribe();

      httpMock.expectOne('/api/products').flush({});
    });

    it('needs no backend url in the browser', () => {
      setup('browser');
      http.get('/api/families').subscribe();

      httpMock.expectOne('/api/families').flush([]);
    });
  });
});
