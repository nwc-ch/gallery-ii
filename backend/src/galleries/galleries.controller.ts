import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { GalleriesService } from './galleries.service';

@ApiTags('galleries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get()
  @ApiQuery({ name: 'parentId', required: false })
  @ApiOkResponse({ type: GalleryResponseDto, isArray: true })
  list(@Query('parentId') parentId?: string): Promise<GalleryResponseDto[]> {
    return this.galleriesService.list(parentId);
  }

  @Get(':id')
  @ApiOkResponse({ type: GalleryResponseDto })
  get(@Param('id') id: string): Promise<GalleryResponseDto> {
    return this.galleriesService.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: GalleryResponseDto })
  create(@Body() dto: CreateGalleryDto): Promise<GalleryResponseDto> {
    return this.galleriesService.create(dto);
  }

  @Delete(':id')
  @ApiOkResponse()
  async delete(@Param('id') id: string): Promise<void> {
    await this.galleriesService.delete(id);
  }
}
