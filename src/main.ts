import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerDarkCss, swaggerThemeToggleJs } from './swagger-theme';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('小满 · 生活助理')
    .setDescription('小满 生活助理 AI 服务端 API')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: '小满 · 生活助理 · API',
    customCss: swaggerDarkCss,
    customJsStr: swaggerThemeToggleJs,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🌿 assistant-server running on http://localhost:${port}`);
  console.log(`📜 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
