import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';

export type Gallery = {
  id: string;
  name: string;
  parentId: string | null;
  childGalleryCount: number;
  imageCount: number;
  coverImageUrl: string | null;
  createdAt: string;
};

export type GalleryImage = {
  id: string;
  galleryId: string;
  originalName: string;
  displayUrl: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class GalleryService {
  constructor(private readonly http: HttpClient) {}

  listGalleries(parentId?: string | null) {
    let params = new HttpParams();
    if (parentId) {
      params = params.set('parentId', parentId);
    }
    return this.http.get<Gallery[]>('/api/galleries', { params });
  }

  getGallery(id: string) {
    return this.http.get<Gallery>(`/api/galleries/${id}`);
  }

  createGallery(name: string, parentId?: string | null) {
    return this.http.post<Gallery>('/api/galleries', { name, parentId });
  }

  updateGallery(id: string, name: string) {
    return this.http.patch<Gallery>(`/api/galleries/${id}`, { name });
  }

  deleteGallery(id: string) {
    return this.http.delete<void>(`/api/galleries/${id}`);
  }

  listImages(galleryId: string) {
    return this.http.get<GalleryImage[]>(`/api/galleries/${galleryId}/images`);
  }

  uploadImage(galleryId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<GalleryImage>(
      `/api/galleries/${galleryId}/images`,
      formData,
      {
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  deleteImages(galleryId: string, imageIds: string[]) {
    return forkJoin(
      imageIds.map((imageId) =>
        this.http.delete<void>(`/api/galleries/${galleryId}/images/${imageId}`),
      ),
    );
  }
}
