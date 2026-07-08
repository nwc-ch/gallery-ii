import { ApiProperty } from '@nestjs/swagger';

export class ImageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  galleryId: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  displayUrl: string;

  @ApiProperty()
  previewUrl: string;

  @ApiProperty({ nullable: true })
  width: number | null;

  @ApiProperty({ nullable: true })
  height: number | null;

  @ApiProperty()
  createdAt: Date;
}
