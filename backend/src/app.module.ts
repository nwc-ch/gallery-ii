import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app-config.module';
import { GalleriesModule } from './galleries/galleries.module';
import { ImagesModule } from './images/images.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'gallery'),
        password: config.get<string>('DB_PASSWORD', 'gallery'),
        database: config.get<string>('DB_NAME', 'gallery'),
        autoLoadEntities: true,
        synchronize: config.get<string>('TYPEORM_SYNC', 'true') === 'true',
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: process.env.PUBLIC_DIR ?? join(process.cwd(), 'public'),
      exclude: ['/api*', '/docs*', '/uploads*'],
    }),
    UsersModule,
    AuthModule,
    GalleriesModule,
    ImagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
