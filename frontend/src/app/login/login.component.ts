import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = 'admin@example.com';
  password = 'change-me';
  error = signal<string | null>(null);

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  login(): void {
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const storedGalleryPath = sessionStorage.getItem(
          'gallery-ii-active-gallery-path',
        );
        void this.router.navigateByUrl(storedGalleryPath ?? '/');
      },
      error: () => this.error.set('Login fehlgeschlagen.'),
    });
  }
}
