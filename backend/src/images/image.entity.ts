import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Gallery } from '../galleries/gallery.entity';

@Entity({ name: 'images' })
export class Image {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column()
  galleryId: string;

  @ManyToOne(() => Gallery, (gallery) => gallery.images, {
    onDelete: 'CASCADE',
  })
  gallery: Gallery;

  @ApiProperty()
  @Column()
  originalName: string;

  @ApiProperty()
  @Column()
  displayPath: string;

  @ApiProperty()
  @Column()
  previewPath: string;

  @ApiProperty()
  @Column({ type: 'int', nullable: true })
  width: number | null;

  @ApiProperty()
  @Column({ type: 'int', nullable: true })
  height: number | null;

  @ApiProperty()
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
