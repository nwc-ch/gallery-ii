import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get database() {
    return {
      host: this.config.get<string>('DB_HOST', 'localhost'),
      port: this.config.get<number>('DB_PORT', 3306),
      username: this.config.get<string>('DB_USER', 'gallery'),
      password: this.config.get<string>('DB_PASSWORD', 'gallery'),
      database: this.config.get<string>('DB_NAME', 'gallery'),
    };
  }

  get jwtSecret(): string {
    return this.config.get<string>('JWT_SECRET', 'change-me-in-production');
  }

  get uploadsDir(): string {
    return this.config.get<string>('UPLOADS_DIR', 'uploads');
  }

  get publicDir(): string {
    return this.config.get<string>('PUBLIC_DIR', 'public');
  }

  get rawConverterCommand(): string {
    return this.config.get<string>('RAW_CONVERTER_COMMAND', 'darktable-cli');
  }
}
