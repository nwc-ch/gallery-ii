import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesModule } from '../images/images.module';
import { Image } from '../images/image.entity';
import { Gallery } from './gallery.entity';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gallery, Image]),
    forwardRef(() => ImagesModule),
  ],
  controllers: [GalleriesController],
  providers: [GalleriesService],
  exports: [TypeOrmModule],
})
export class GalleriesModule {}
