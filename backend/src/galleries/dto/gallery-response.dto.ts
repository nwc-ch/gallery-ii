import { ApiProperty } from '@nestjs/swagger';

export class GalleryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  parentId: string | null;

  @ApiProperty()
  childGalleryCount: number;

  @ApiProperty()
  imageCount: number;

  @ApiProperty({ type: String, nullable: true })
  coverImageUrl: string | null;

  @ApiProperty()
  createdAt: Date;
}
