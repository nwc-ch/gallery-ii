import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';

@Injectable()
export class InitialAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      return;
    }

    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      return;
    }

    await this.users.save(
      this.users.create({
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'admin',
      }),
    );

    this.logger.log(`Created initial admin user ${email}`);
  }
}
