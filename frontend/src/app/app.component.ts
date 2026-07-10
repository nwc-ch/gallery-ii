import { NgClass } from '@angular/common';
import { Component, HostListener, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from './auth.service';
import { Gallery, GalleryImage, GalleryService } from './gallery.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, NgClass],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  email = 'admin@example.com';
  password = 'change-me';
  newGalleryName = '';
  editGalleryName = '';
  editingGalleryTitle = false;
  uploadActive = false;
  loading = false;
  error = signal<string | null>(null);
  galleries = signal<Gallery[]>([]);
  images = signal<GalleryImage[]>([]);
  path = signal<Gallery[]>([]);
  selectedGallery = computed(() => this.path().at(-1) ?? null);
  galleryCount = computed(() => this.galleries().length);
  imageCount = computed(() => this.images().length);
  containedGalleryCount = computed(() =>
    this.galleries().reduce((sum, gallery) => sum + gallery.childGalleryCount, 0),
  );

  constructor(
    readonly auth: AuthService,
    private readonly galleriesApi: GalleryService,
  ) {
    if (this.auth.token()) {
      this.loadFromUrl();
    }
  }

  @HostListener('window:popstate')
  onPopState(): void {
    if (this.auth.token()) {
      this.loadFromUrl();
    }
  }

  login(): void {
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.loadFromUrl(),
      error: () => this.error.set('Login fehlgeschlagen.'),
    });
  }

  logout(): void {
    this.auth.logout();
    this.galleries.set([]);
    this.images.set([]);
    this.path.set([]);
    this.updateUrl('/');
  }

  loadGalleries(parent?: Gallery | null, updateUrl = true): void {
    this.loading = true;
    this.error.set(null);
    this.galleriesApi
      .listGalleries(parent?.id ?? null)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (galleries) => {
          this.galleries.set(galleries);
          if (parent) {
            this.path.update((path) => [...path, parent]);
            this.loadImages(parent.id);
            if (updateUrl) {
              this.updateUrl(`/gallery/${parent.id}`);
            }
          } else {
            this.path.set([]);
            this.images.set([]);
            if (updateUrl) {
              this.updateUrl('/');
            }
          }
        },
        error: () => this.error.set('Galerien konnten nicht geladen werden.'),
      });
  }

  openGalleryLink(event: MouseEvent, gallery: Gallery): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.loadGalleries(gallery);
  }

  openBreadcrumb(index: number): void {
    const nextPath = this.path().slice(0, index + 1);
    this.path.set(nextPath);
    const current = nextPath.at(-1);
    this.loading = true;
    this.galleriesApi
      .listGalleries(current?.id ?? null)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (galleries) => {
          this.galleries.set(galleries);
          if (current) {
            this.loadImages(current.id);
            this.updateUrl(`/gallery/${current.id}`);
          } else {
            this.images.set([]);
            this.updateUrl('/');
          }
        },
        error: () => this.error.set('Galerie konnte nicht geoeffnet werden.'),
      });
  }

  createGallery(): void {
    const name = this.newGalleryName.trim();
    if (!name) {
      return;
    }

    this.galleriesApi
      .createGallery(name, this.selectedGallery()?.id ?? null)
      .subscribe({
        next: () => {
          this.newGalleryName = '';
          this.refreshCurrent();
        },
        error: () => this.error.set('Galerie konnte nicht erstellt werden.'),
      });
  }

  startTitleEdit(): void {
    const gallery = this.selectedGallery();
    if (!gallery) {
      return;
    }

    this.editGalleryName = gallery.name;
    this.editingGalleryTitle = true;
  }

  cancelTitleEdit(): void {
    this.editGalleryName = '';
    this.editingGalleryTitle = false;
  }

  saveTitleEdit(): void {
    const gallery = this.selectedGallery();
    const name = this.editGalleryName.trim();
    if (!gallery || !name) {
      return;
    }

    this.galleriesApi.updateGallery(gallery.id, name).subscribe({
      next: (updatedGallery) => {
        this.path.update((path) =>
          path.map((item) =>
            item.id === updatedGallery.id ? updatedGallery : item,
          ),
        );
        this.editGalleryName = '';
        this.editingGalleryTitle = false;
      },
      error: () => this.error.set('Galerietitel konnte nicht gespeichert werden.'),
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
      next: () => this.refreshCurrent(),
      error: () => this.error.set('Galerie konnte nicht geloescht werden.'),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFiles(input.files);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.uploadActive = false;
    this.uploadFiles(event.dataTransfer?.files ?? null);
  }

  uploadFiles(files: FileList | null): void {
    const gallery = this.selectedGallery();
    if (!gallery || !files?.length) {
      return;
    }

    Array.from(files).forEach((file) => {
      this.galleriesApi.uploadImage(gallery.id, file).subscribe({
        next: () => {
          this.loadImages(gallery.id);
          this.refreshCurrent();
        },
        error: () => this.error.set(`${file.name} konnte nicht hochgeladen werden.`),
      });
    });
  }

  deleteImage(image: GalleryImage): void {
    const gallery = this.selectedGallery();
    if (!gallery) {
      return;
    }

    this.galleriesApi.deleteImage(gallery.id, image.id).subscribe({
      next: () => {
        this.loadImages(gallery.id);
        this.refreshCurrent();
      },
      error: () => this.error.set('Bild konnte nicht geloescht werden.'),
    });
  }

  private refreshCurrent(): void {
    const current = this.selectedGallery();
    this.galleriesApi.listGalleries(current?.id ?? null).subscribe((galleries) => {
      this.galleries.set(galleries);
    });
  }

  private loadFromUrl(): void {
    const galleryId = this.getGalleryIdFromUrl();
    if (galleryId) {
      this.loadGalleryDetail(galleryId);
    } else {
      this.loadGalleries(null, false);
    }
  }

  private loadGalleryDetail(galleryId: string): void {
    this.loading = true;
    this.error.set(null);
    this.galleriesApi
      .getGallery(galleryId)
      .subscribe({
        next: (gallery) => {
          this.path.set([gallery]);
          this.loadImages(gallery.id);
          this.galleriesApi
            .listGalleries(gallery.id)
            .pipe(finalize(() => (this.loading = false)))
            .subscribe({
              next: (galleries) => this.galleries.set(galleries),
              error: () =>
                this.error.set('Galerie konnte nicht geoeffnet werden.'),
            });
        },
        error: () => {
          this.loading = false;
          this.error.set('Galerie konnte nicht geoeffnet werden.');
          this.updateUrl('/');
          this.loadGalleries(null, false);
        },
      });
  }

  private getGalleryIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/gallery\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  private updateUrl(path: string): void {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }

  private loadImages(galleryId: string): void {
    this.galleriesApi.listImages(galleryId).subscribe({
      next: (images) => this.images.set(images),
      error: () => this.error.set('Bilder konnten nicht geladen werden.'),
    });
  }
}
