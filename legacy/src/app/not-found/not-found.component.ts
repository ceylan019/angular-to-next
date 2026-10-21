import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.css'],
})
export class NotFoundComponent implements OnInit {
  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Page not found | Wick & Co. Candles');
    this.meta.updateTag({
      name: 'description',
      content:
        'Hand poured candles in floral, woody, fresh, gourmand and spicy scents.',
    });
  }
}
