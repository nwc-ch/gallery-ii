import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './auth.service';
import { GalleryDetailComponent } from './gallery-detail/gallery-detail.component';
import { LoginComponent } from './login/login.component';
import { MainAreaComponent } from './main-area/main-area.component';

const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token() && state.url.startsWith('/gallery/')) {
    sessionStorage.setItem('gallery-ii-active-gallery-path', state.url);
  }

  return auth.token() ? true : router.createUrlTree(['/login']);
};

const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.token() ? router.createUrlTree(['/']) : true;
};

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: '', component: MainAreaComponent, canActivate: [authGuard] },
  {
    path: 'gallery/:id',
    component: GalleryDetailComponent,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
