import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ImageResponseDto } from './dto/image-response.dto';
import { ImagesService } from './images.service';

@ApiTags('images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('galleries/:galleryId/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get()
  @ApiOkResponse({ type: ImageResponseDto, isArray: true })
  list(@Param('galleryId') galleryId: string): Promise<ImageResponseDto[]> {
    return this.imagesService.list(galleryId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  upload(
    @Param('galleryId') galleryId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImageResponseDto> {
    return this.imagesService.createFromUpload(galleryId, file);
  }

  @Delete(':imageId')
  @ApiOkResponse()
  async delete(@Param('imageId') imageId: string): Promise<void> {
    await this.imagesService.delete(imageId);
  }
}
