import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { BACKEND_URL } from './backend-url.token';

@NgModule({
  imports: [AppModule, ServerModule],
  providers: [
    {
      provide: BACKEND_URL,
      useValue: process.env.BACKEND_URL || 'http://localhost:8080',
    },
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
