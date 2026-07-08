import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateGalleryDto {
  @ApiProperty({ example: 'Sommer Shooting 2026' })
  @IsString()
  @MinLength(2)
  name: string;
}
