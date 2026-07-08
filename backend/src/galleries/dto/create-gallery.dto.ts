import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateGalleryDto {
  @ApiProperty({ example: 'Hochzeit Anna und Ben' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
