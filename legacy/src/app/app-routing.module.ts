import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProductListComponent } from './product-list/product-list.component';
import { NotFoundComponent } from './not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: ProductListComponent },
  { path: '**', component: NotFoundComponent },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      initialNavigation: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
