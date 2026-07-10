import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../auth.service';
import { Gallery, GalleryService } from '../gallery.service';

@Component({
  selector: 'app-main-area',
  imports: [FormsModule, RouterLink],
  templateUrl: './main-area.component.html',
})
export class MainAreaComponent implements OnInit {
  newGalleryName = '';
  createGalleryDialogOpen = false;
  loading = false;
  error = signal<string | null>(null);
  galleries = signal<Gallery[]>([]);

  constructor(
    readonly auth: AuthService,
    private readonly galleriesApi: GalleryService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    sessionStorage.removeItem('gallery-ii-active-gallery-path');
    this.loadGalleries();
  }

  get galleryCount(): number {
    return this.galleries().length;
  }

  get containedGalleryCount(): number {
    return this.galleries().reduce(
      (sum, gallery) => sum + gallery.childGalleryCount,
      0,
    );
  }

  logout(): void {
    this.auth.logout();
    sessionStorage.removeItem('gallery-ii-active-gallery-path');
    void this.router.navigateByUrl('/login');
  }

  loadGalleries(): void {
    this.loading = true;
    this.error.set(null);
    this.galleriesApi
      .listGalleries(null)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (galleries) => this.galleries.set(galleries),
        error: () => this.error.set('Galerien konnten nicht geladen werden.'),
      });
  }

  openCreateGalleryDialog(): void {
    this.newGalleryName = '';
    this.createGalleryDialogOpen = true;
  }

  closeCreateGalleryDialog(): void {
    this.newGalleryName = '';
    this.createGalleryDialogOpen = false;
  }

  createGallery(): void {
    const name = this.newGalleryName.trim();
    if (!name) {
      return;
    }

    this.galleriesApi.createGallery(name, null).subscribe({
      next: () => {
        this.newGalleryName = '';
        this.createGalleryDialogOpen = false;
        this.loadGalleries();
      },
      error: () => this.error.set('Galerie konnte nicht erstellt werden.'),
    });
  }

  deleteGallery(gallery: Gallery, event: MouseEvent): void {
    event.stopPropagation();
    if (
      !confirm(
        `Galerie "${gallery.name}" inklusive Untergalerien und Bildern loeschen?`,
      )
    ) {
      return;
    }

    this.galleriesApi.deleteGallery(gallery.id).subscribe({
      next: () => this.loadGalleries(),
      error: () => this.error.set('Galerie konnte nicht geloescht werden.'),
    });
  }
}
