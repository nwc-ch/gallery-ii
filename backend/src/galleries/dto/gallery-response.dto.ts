import { ApiProperty } from '@nestjs/swagger';

export class GalleryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  parentId: string | null;

  @ApiProperty()
  childGalleryCount: number;

  @ApiProperty()
  imageCount: number;

  @ApiProperty()
  createdAt: Date;
}
