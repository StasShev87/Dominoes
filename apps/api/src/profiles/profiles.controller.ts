import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import type { CreateProfileRequest } from "@dominoes/contracts";
import { CurrentPrincipal } from "../auth/principal.js";
import type { Principal } from "../matches/match.service.js";
import { ProfileService } from "./profile.service.js";

@Controller("profiles")
export class ProfilesController {
  constructor(@Inject(ProfileService) private readonly profiles: ProfileService) {}

  @Post()
  create(@CurrentPrincipal() principal: Principal, @Body() body: CreateProfileRequest) {
    return this.profiles.create(principal, body);
  }

  @Get("me")
  getMe(@CurrentPrincipal() principal: Principal) {
    return this.profiles.getMe(principal);
  }
}
