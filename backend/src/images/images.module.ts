import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../config/app-config.module';
import { Gallery } from '../galleries/gallery.entity';
import { Image } from './image.entity';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [TypeOrmModule.forFeature([Image, Gallery]), AppConfigModule],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
