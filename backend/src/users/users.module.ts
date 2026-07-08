import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitialAdminService } from './initial-admin.service';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, InitialAdminService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
