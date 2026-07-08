import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'gallery-ii-token';
  readonly token = signal<string | null>(localStorage.getItem(this.storageKey));
  readonly user = signal<AuthUser | null>(null);

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(this.storageKey, response.accessToken);
        this.token.set(response.accessToken);
        this.user.set(response.user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.token.set(null);
    this.user.set(null);
  }
}
