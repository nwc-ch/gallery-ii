import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Image } from '../images/image.entity';

@Entity({ name: 'galleries' })
export class Gallery {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 36, nullable: true })
  parentId: string | null;

  @ManyToOne(() => Gallery, (gallery) => gallery.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  parent: Gallery | null;

  @OneToMany(() => Gallery, (gallery) => gallery.parent)
  children: Gallery[];

  @OneToMany(() => Image, (image) => image.gallery)
  images: Image[];

  @ApiProperty()
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
