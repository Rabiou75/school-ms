import 'reflect-metadata';
import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first');
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  console.log('API on http://localhost:' + port + '/api/v1');
}
bootstrap();
