import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from '../images/image.entity';
import { ImagesService } from '../images/images.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery } from './gallery.entity';

@Injectable()
export class GalleriesService {
  constructor(
    @InjectRepository(Gallery)
    private readonly galleries: Repository<Gallery>,
    @InjectRepository(Image)
    private readonly images: Repository<Image>,
    private readonly imagesService: ImagesService,
  ) {}

  async list(parentId?: string | null): Promise<GalleryResponseDto[]> {
    const query = this.galleries
      .createQueryBuilder('gallery')
      .loadRelationCountAndMap('gallery.childGalleryCount', 'gallery.children')
      .loadRelationCountAndMap('gallery.imageCount', 'gallery.images')
      .orderBy('gallery.createdAt', 'ASC');

    if (parentId) {
      query.where('gallery.parentId = :parentId', { parentId });
    } else {
      query.where('gallery.parentId IS NULL');
    }

    const galleries = await query.getMany();
    const covers = await this.findCoverImages(
      galleries.map((gallery) => gallery.id),
    );
    return galleries.map((gallery) =>
      this.toDto(gallery, covers.get(gallery.id)),
    );
  }

  async get(id: string): Promise<GalleryResponseDto> {
    const gallery = await this.findWithCounts(id);
    const cover = await this.findCoverImage(id);
    return this.toDto(gallery, cover);
  }

  async create(dto: CreateGalleryDto): Promise<GalleryResponseDto> {
    if (dto.parentId) {
      const parent = await this.galleries.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent gallery not found');
      }
    }

    const gallery = await this.galleries.save(
      this.galleries.create({
        name: dto.name,
        parentId: dto.parentId ?? null,
      }),
    );

    return this.get(gallery.id);
  }

  async update(id: string, dto: UpdateGalleryDto): Promise<GalleryResponseDto> {
    const gallery = await this.galleries.findOne({ where: { id } });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    gallery.name = dto.name;
    await this.galleries.save(gallery);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const gallery = await this.galleries.findOne({ where: { id } });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    const descendantIds = await this.collectDescendantIds(id);
    const idsToDelete = [id, ...descendantIds];
    await this.imagesService.deleteForGalleryIds(idsToDelete);
    await this.galleries.delete(idsToDelete);
  }

  private async collectDescendantIds(parentId: string): Promise<string[]> {
    const children = await this.galleries.find({
      where: { parentId },
      select: { id: true },
    });
    const descendants = await Promise.all(
      children.map((child) => this.collectDescendantIds(child.id)),
    );
    return children.flatMap((child, index) => [
      child.id,
      ...descendants[index],
    ]);
  }

  private async findWithCounts(id: string): Promise<Gallery> {
    const gallery = await this.galleries
      .createQueryBuilder('gallery')
      .where('gallery.id = :id', { id })
      .loadRelationCountAndMap('gallery.childGalleryCount', 'gallery.children')
      .loadRelationCountAndMap('gallery.imageCount', 'gallery.images')
      .getOne();

    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }
    return gallery;
  }

  private async findCoverImages(
    galleryIds: string[],
  ): Promise<Map<string, Image>> {
    if (galleryIds.length === 0) {
      return new Map();
    }

    const images = await this.images
      .createQueryBuilder('image')
      .where('image.galleryId IN (:...galleryIds)', { galleryIds })
      .orderBy('image.createdAt', 'DESC')
      .getMany();

    const covers = new Map<string, Image>();
    images.forEach((image) => {
      if (!covers.has(image.galleryId)) {
        covers.set(image.galleryId, image);
      }
    });
    return covers;
  }

  private findCoverImage(galleryId: string): Promise<Image | null> {
    return this.images.findOne({
      where: { galleryId },
      order: { createdAt: 'DESC' },
    });
  }

  private toDto(gallery: Gallery, cover?: Image | null): GalleryResponseDto {
    const countedGallery = gallery as Gallery & {
      childGalleryCount?: number;
      imageCount?: number;
    };

    return {
      id: gallery.id,
      name: gallery.name,
      parentId: gallery.parentId,
      childGalleryCount: countedGallery.childGalleryCount ?? 0,
      imageCount: countedGallery.imageCount ?? 0,
      coverImageUrl: cover
        ? `/uploads/${cover.galleryId}/${cover.id}/preview.jpg`
        : null,
      createdAt: gallery.createdAt,
    };
  }
}
