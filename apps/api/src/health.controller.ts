import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/principal.js";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health(): { status: "ok" } {
    return { status: "ok" };
  }
}

