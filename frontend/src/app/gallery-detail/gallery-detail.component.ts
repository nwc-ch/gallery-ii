import { NgClass } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize, switchMap, tap } from 'rxjs';
import { AuthService } from '../auth.service';
import { Gallery, GalleryImage, GalleryService } from '../gallery.service';

type UploadQueueItem = {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  fading: boolean;
};

type ThumbnailSize = 's' | 'm' | 'l';

@Component({
  selector: 'app-gallery-detail',
  imports: [
    FormsModule,
    NgClass,
    RouterLink,
    LucideAngularModule,
  ],
  templateUrl: './gallery-detail.component.html',
  styleUrl: './gallery-detail.component.scss',
})
export class GalleryDetailComponent implements OnInit, OnDestroy {
  newGalleryName = '';
  editGalleryName = '';
  editGalleryTitleDialogOpen = false;
  createGalleryDialogOpen = false;
  deleteImagesDialogOpen = false;
  uploadActive = false;
  loading = false;
  deletingImages = false;
  error = signal<string | null>(null);
  uploadItems = signal<UploadQueueItem[]>([]);
  galleries = signal<Gallery[]>([]);
  images = signal<GalleryImage[]>([]);
  imageRows = signal<GalleryImage[][]>([]);
  thumbnailSize = signal<ThumbnailSize>('s');
  thumbnailSizes: ThumbnailSize[] = ['s', 'm', 'l'];
  selectedGallery = signal<Gallery | null>(null);
  imageDeleteMode = signal(false);
  selectedImageIds = signal<Set<string>>(new Set());
  galleryCount = computed(() => this.galleries().length);
  imageCount = computed(() => this.images().length);
  selectedImageCount = computed(() => this.selectedImageIds().size);
  containedGalleryCount = computed(() =>
    this.galleries().reduce((sum, gallery) => sum + gallery.childGalleryCount, 0),
  );
  private imageGridResizeObserver?: ResizeObserver;
  private imageGridWidth = 0;
  private uploadFadeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private uploadRemoveTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(switchMap((params) => this.loadGalleryDetail(params.get('id') ?? '')))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.imageGridResizeObserver?.disconnect();
    this.uploadFadeTimers.forEach((timer) => clearTimeout(timer));
    this.uploadRemoveTimers.forEach((timer) => clearTimeout(timer));
  }

  logout(): void {
    this.auth.logout();
    sessionStorage.removeItem('gallery-ii-active-gallery-path');
    void this.router.navigateByUrl('/login');
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
    const gallery = this.selectedGallery();
    if (!gallery || !name) {
      return;
    }

    this.galleriesApi.createGallery(name, gallery.id).subscribe({
      next: () => {
        this.newGalleryName = '';
        this.createGalleryDialogOpen = false;
        this.refreshChildren();
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
    this.editGalleryTitleDialogOpen = true;
  }

  cancelTitleEdit(): void {
    this.editGalleryName = '';
    this.editGalleryTitleDialogOpen = false;
  }

  saveTitleEdit(): void {
    const gallery = this.selectedGallery();
    const name = this.editGalleryName.trim();
    if (!gallery || !name) {
      return;
    }

    this.galleriesApi.updateGallery(gallery.id, name).subscribe({
      next: (updatedGallery) => {
        this.selectedGallery.set(updatedGallery);
        this.editGalleryName = '';
        this.editGalleryTitleDialogOpen = false;
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
      next: () => this.refreshChildren(),
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
      const uploadId = crypto.randomUUID();
      this.uploadItems.update((items) => [
        ...items,
        {
          id: uploadId,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
          fading: false,
        },
      ]);

      this.galleriesApi.uploadImage(gallery.id, file).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : 0;
            this.updateUploadItem(uploadId, { progress });
          }

          if (event.type === HttpEventType.Response) {
            this.updateUploadItem(uploadId, { progress: 100, status: 'done' });
            this.scheduleUploadDismiss(uploadId);
            this.loadImages(gallery.id);
            this.refreshChildren();
          }
        },
        error: () => {
          this.updateUploadItem(uploadId, { status: 'error' });
          this.scheduleUploadDismiss(uploadId);
          this.error.set(`${file.name} konnte nicht hochgeladen werden.`);
        },
      });
    });
  }

  activateImageDeleteMode(): void {
    if (this.images().length) {
      this.imageDeleteMode.set(true);
    }
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

  getImageRowHeightStyle(): string {
    return `${this.getImageRowHeight()}px`;
  }

  trackImageRow(index: number): string {
    return this.imageRows()[index]?.map((image) => image.id).join('-') ?? `${index}`;
  }

  setThumbnailSize(size: ThumbnailSize): void {
    this.thumbnailSize.set(size);
    this.updateImageRows();
  }

  deleteSelectedImages(): void {
    if (this.selectedImageCount()) {
      this.deleteImagesDialogOpen = true;
    }
  }

  cancelDeleteSelectedImages(): void {
    this.deleteImagesDialogOpen = false;
  }

  confirmDeleteSelectedImages(): void {
    const gallery = this.selectedGallery();
    const imageIds = Array.from(this.selectedImageIds());
    if (!gallery || !imageIds.length) {
      return;
    }

    this.deletingImages = true;
    this.galleriesApi
      .deleteImages(gallery.id, imageIds)
      .pipe(finalize(() => (this.deletingImages = false)))
      .subscribe({
        next: () => {
          this.deleteImagesDialogOpen = false;
          this.clearImageDeleteState();
          this.loadImages(gallery.id);
          this.refreshChildren();
        },
        error: () => this.error.set('Bilder konnten nicht geloescht werden.'),
      });
  }

  private loadGalleryDetail(galleryId: string) {
    this.loading = true;
    this.error.set(null);
    sessionStorage.setItem('gallery-ii-active-gallery-path', `/gallery/${galleryId}`);
    return this.galleriesApi.getGallery(galleryId).pipe(
      switchMap((gallery) => {
        this.selectedGallery.set(gallery);
        this.loadImages(gallery.id);
        return this.galleriesApi.listGalleries(gallery.id);
      }),
      tap((galleries) => this.galleries.set(galleries)),
      finalize(() => (this.loading = false)),
    );
  }

  private refreshChildren(): void {
    const gallery = this.selectedGallery();
    if (!gallery) {
      return;
    }

    this.galleriesApi.listGalleries(gallery.id).subscribe({
      next: (galleries) => this.galleries.set(galleries),
      error: () => this.error.set('Galerien konnten nicht geladen werden.'),
    });
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

  private updateUploadItem(
    id: string,
    changes: Partial<Omit<UploadQueueItem, 'id' | 'fileName'>>,
  ): void {
    this.uploadItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  private scheduleUploadDismiss(id: string): void {
    this.uploadFadeTimers.set(
      id,
      setTimeout(() => {
        this.updateUploadItem(id, { fading: true });
        this.uploadRemoveTimers.set(
          id,
          setTimeout(() => {
            this.uploadItems.update((items) =>
              items.filter((item) => item.id !== id),
            );
            this.uploadFadeTimers.delete(id);
            this.uploadRemoveTimers.delete(id);
          }, 900),
        );
      }, 4000),
    );
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
    const size = this.thumbnailSize();
    if (window.innerWidth <= 640) {
      return { s: 108, m: 140, l: 180 }[size];
    }

    const factors = { s: 0.09, m: 0.125, l: 0.16 };
    const minimums = { s: 112, m: 150, l: 200 };
    const maximums = { s: 152, m: 220, l: 290 };
    return Math.min(
      maximums[size],
      Math.max(minimums[size], window.innerWidth * factors[size]),
    );
  }
}
