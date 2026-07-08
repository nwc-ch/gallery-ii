import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImagesService } from '../images/images.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { Gallery } from './gallery.entity';

@Injectable()
export class GalleriesService {
  constructor(
    @InjectRepository(Gallery)
    private readonly galleries: Repository<Gallery>,
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
    return galleries.map((gallery) => this.toDto(gallery));
  }

  async get(id: string): Promise<GalleryResponseDto> {
    const gallery = await this.findWithCounts(id);
    return this.toDto(gallery);
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

  private toDto(gallery: Gallery): GalleryResponseDto {
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
      createdAt: gallery.createdAt,
    };
  }
}
