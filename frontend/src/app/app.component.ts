import { NgClass } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
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
export class AppComponent implements OnDestroy {
  private readonly activeGalleryPathKey = 'gallery-ii-active-gallery-path';
  email = 'admin@example.com';
  password = 'change-me';
  newGalleryName = '';
  editGalleryName = '';
  editingGalleryTitle = false;
  createGalleryDialogOpen = false;
  uploadActive = false;
  loading = false;
  deletingImages = false;
  error = signal<string | null>(null);
  galleries = signal<Gallery[]>([]);
  images = signal<GalleryImage[]>([]);
  imageRows = signal<GalleryImage[][]>([]);
  path = signal<Gallery[]>([]);
  imageDeleteMode = signal(false);
  selectedImageIds = signal<Set<string>>(new Set());
  selectedGallery = computed(() => this.path().at(-1) ?? null);
  galleryCount = computed(() => this.galleries().length);
  imageCount = computed(() => this.images().length);
  selectedImageCount = computed(() => this.selectedImageIds().size);
  containedGalleryCount = computed(() =>
    this.galleries().reduce((sum, gallery) => sum + gallery.childGalleryCount, 0),
  );
  private imageGridResizeObserver?: ResizeObserver;
  private imageGridWidth = 0;

  @ViewChild('imageGrid')
  set imageGridElement(element: ElementRef<HTMLElement> | undefined) {
    this.imageGridResizeObserver?.disconnect();
    this.imageGridResizeObserver = undefined;

    if (!element) {
      this.imageGridWidth = 0;
      return;
    }

    this.imageGridWidth = element.nativeElement.clientWidth;
    this.updateImageRows();
    this.imageGridResizeObserver = new ResizeObserver(([entry]) => {
      this.imageGridWidth = entry.contentRect.width;
      this.updateImageRows();
    });
    this.imageGridResizeObserver.observe(element.nativeElement);
  }

  constructor(
    readonly auth: AuthService,
    private readonly galleriesApi: GalleryService,
  ) {
    if (this.auth.token()) {
      this.loadFromUrl();
    }
  }

  ngOnDestroy(): void {
    this.imageGridResizeObserver?.disconnect();
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
    this.clearImageDeleteState();
    sessionStorage.removeItem(this.activeGalleryPathKey);
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
            this.clearImageDeleteState();
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
            this.clearImageDeleteState();
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
          this.createGalleryDialogOpen = false;
          this.refreshCurrent();
        },
        error: () => this.error.set('Galerie konnte nicht erstellt werden.'),
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

  activateImageDeleteMode(): void {
    if (!this.images().length) {
      return;
    }

    this.imageDeleteMode.set(true);
  }

  cancelImageDeleteMode(): void {
    this.clearImageDeleteState();
  }

  resetImageSelection(): void {
    this.selectedImageIds.set(new Set());
  }

  selectAllImages(): void {
    this.selectedImageIds.set(new Set(this.images().map((image) => image.id)));
  }

  toggleImageSelection(imageId: string): void {
    if (!this.imageDeleteMode()) {
      return;
    }

    this.selectedImageIds.update((selectedIds) => {
      const nextSelectedIds = new Set(selectedIds);
      if (nextSelectedIds.has(imageId)) {
        nextSelectedIds.delete(imageId);
      } else {
        nextSelectedIds.add(imageId);
      }

      return nextSelectedIds;
    });
  }

  isImageSelected(imageId: string): boolean {
    return this.selectedImageIds().has(imageId);
  }

  getImageRatio(image: GalleryImage): number {
    if (!image.width || !image.height) {
      return 1.45;
    }

    return Math.max(0.65, Math.min(image.width / image.height, 3.2));
  }

  getImageBasis(image: GalleryImage): string {
    return `${Math.round(this.getImageRatio(image) * this.getImageRowHeight())}px`;
  }

  trackImageRow(index: number): string {
    return this.imageRows()[index]?.map((image) => image.id).join('-') ?? `${index}`;
  }

  deleteSelectedImages(): void {
    const gallery = this.selectedGallery();
    const imageIds = Array.from(this.selectedImageIds());
    if (!gallery || !imageIds.length) {
      return;
    }

    if (!confirm(`${imageIds.length} Bild(er) loeschen?`)) {
      return;
    }

    this.deletingImages = true;
    this.galleriesApi
      .deleteImages(gallery.id, imageIds)
      .pipe(finalize(() => (this.deletingImages = false)))
      .subscribe({
        next: () => {
          this.clearImageDeleteState();
          this.loadImages(gallery.id);
          this.refreshCurrent();
        },
        error: () => this.error.set('Bilder konnten nicht geloescht werden.'),
      });
  }

  private refreshCurrent(): void {
    const current = this.selectedGallery();
    this.galleriesApi.listGalleries(current?.id ?? null).subscribe((galleries) => {
      this.galleries.set(galleries);
    });
  }

  private loadFromUrl(): void {
    const storedGalleryPath = sessionStorage.getItem(this.activeGalleryPathKey);
    if (
      window.location.pathname === '/' &&
      storedGalleryPath?.startsWith('/gallery/')
    ) {
      window.history.replaceState(null, '', storedGalleryPath);
    }

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
        },
      });
  }

  private getGalleryIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/gallery\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  private updateUrl(path: string): void {
    if (path.startsWith('/gallery/')) {
      sessionStorage.setItem(this.activeGalleryPathKey, path);
    } else {
      sessionStorage.removeItem(this.activeGalleryPathKey);
    }

    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }

  private loadImages(galleryId: string): void {
    this.galleriesApi.listImages(galleryId).subscribe({
      next: (images) => {
        this.images.set(images);
        this.resetImageSelection();
        this.updateImageRows();
      },
      error: () => this.error.set('Bilder konnten nicht geladen werden.'),
    });
  }

  private clearImageDeleteState(): void {
    this.imageDeleteMode.set(false);
    this.resetImageSelection();
  }

  private updateImageRows(): void {
    const images = this.images();
    if (!images.length) {
      this.imageRows.set([]);
      return;
    }

    const width = this.imageGridWidth;
    if (!width) {
      this.imageRows.set([images]);
      return;
    }

    const gap = 16;
    const rowHeight = this.getImageRowHeight();
    const rows: GalleryImage[][] = [];
    let row: GalleryImage[] = [];
    let rowWidth = 0;

    images.forEach((image) => {
      const imageWidth = this.getImageRatio(image) * rowHeight;
      const nextWidth = rowWidth + imageWidth + (row.length ? gap : 0);
      if (row.length && nextWidth >= width) {
        rows.push(row);
        row = [image];
        rowWidth = imageWidth;
      } else {
        row.push(image);
        rowWidth = nextWidth;
      }
    });

    if (row.length) {
      rows.push(row);
    }

    this.imageRows.set(rows);
  }

  private getImageRowHeight(): number {
    if (window.innerWidth <= 640) {
      return 108;
    }

    return Math.min(152, Math.max(112, window.innerWidth * 0.09));
  }
}
