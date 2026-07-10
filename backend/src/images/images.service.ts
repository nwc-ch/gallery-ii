import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { Gallery } from '../galleries/gallery.entity';
import { ImageResponseDto } from './dto/image-response.dto';
import { Image } from './image.entity';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly images: Repository<Image>,
    @InjectRepository(Gallery)
    private readonly galleries: Repository<Gallery>,
    private readonly config: AppConfigService,
  ) {}

  async list(galleryId: string): Promise<ImageResponseDto[]> {
    const images = await this.images.find({
      where: { galleryId },
      order: { createdAt: 'DESC' },
    });
    return images.map((image) => this.toDto(image));
  }

  async createFromUpload(
    galleryId: string,
    file: Express.Multer.File,
  ): Promise<ImageResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const gallery = await this.galleries.findOne({ where: { id: galleryId } });
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.nef'].includes(extension)) {
      throw new BadRequestException(
        'Only JPG/JPEG and Nikon NEF files are supported',
      );
    }

    const id = randomUUID();
    const galleryDir = join(this.config.uploadsDir, galleryId, id);
    await mkdir(galleryDir, { recursive: true });

    try {
      const sourcePath =
        extension === '.nef'
          ? await this.convertNef(file, galleryDir)
          : await this.persistTemporaryJpeg(file, galleryDir);

      const displayPath = join(galleryDir, 'display.jpg');
      const previewPath = join(galleryDir, 'preview.jpg');

      const imagePipeline = sharp(sourcePath).rotate();
      const metadata = await imagePipeline.metadata();

      await sharp(sourcePath)
        .rotate()
        .resize({
          width: 2200,
          height: 2200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 86 })
        .toFile(displayPath);

      await sharp(sourcePath)
        .rotate()
        .resize({
          width: 520,
          height: 520,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 78 })
        .toFile(previewPath);

      await rm(sourcePath, { force: true });

      const image = await this.images.save(
        this.images.create({
          id,
          galleryId,
          originalName: file.originalname,
          displayPath,
          previewPath,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
        }),
      );

      return this.toDto(image);
    } catch (error) {
      await rm(galleryDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async delete(imageId: string): Promise<void> {
    const image = await this.images.findOne({ where: { id: imageId } });
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.images.delete(imageId);
    await rm(dirname(image.displayPath), { recursive: true, force: true });
  }

  async deleteForGalleryIds(galleryIds: string[]): Promise<void> {
    if (galleryIds.length === 0) {
      return;
    }
    const images = await this.images
      .createQueryBuilder('image')
      .where('image.galleryId IN (:...galleryIds)', { galleryIds })
      .getMany();

    await Promise.all(
      images.map((image) =>
        rm(dirname(image.displayPath), { recursive: true, force: true }),
      ),
    );
  }

  private async persistTemporaryJpeg(
    file: Express.Multer.File,
    galleryDir: string,
  ): Promise<string> {
    const sourcePath = join(galleryDir, 'source.jpg');
    await writeFile(sourcePath, file.buffer);
    return sourcePath;
  }

  private async convertNef(
    file: Express.Multer.File,
    galleryDir: string,
  ): Promise<string> {
    const sourcePath = join(galleryDir, 'source.nef');
    const outputPath = join(galleryDir, 'source.jpg');
    await writeFile(sourcePath, file.buffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        this.config.rawConverterCommand,
        [sourcePath, outputPath],
        (error) => (error ? reject(new Error(error.message)) : resolve()),
      );
    }).catch((error: Error) => {
      throw new BadRequestException(
        `NEF conversion failed. Check RAW_CONVERTER_COMMAND. ${error.message}`,
      );
    });

    await rm(sourcePath, { force: true });
    return outputPath;
  }

  private toDto(image: Image): ImageResponseDto {
    return {
      id: image.id,
      galleryId: image.galleryId,
      originalName: image.originalName,
      displayUrl: `/uploads/${image.galleryId}/${image.id}/display.jpg`,
      previewUrl: `/uploads/${image.galleryId}/${image.id}/preview.jpg`,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
    };
  }
}
