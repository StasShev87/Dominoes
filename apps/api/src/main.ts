import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("v1");
app.use(helmet());
app.enableCors({
  origin: (process.env.WEB_ORIGINS ?? "http://localhost:3000").split(","),
  credentials: true
});
await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");

