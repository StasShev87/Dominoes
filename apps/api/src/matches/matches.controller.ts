import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import type { CommandRequest } from "@dominoes/contracts";
import { CurrentPrincipal } from "../auth/principal.js";
import { MatchService, type Principal } from "./match.service.js";
import { MatchesGateway } from "./matches.gateway.js";

@Controller()
export class MatchesController {
  constructor(
    @Inject(MatchService) private readonly matches: MatchService,
    @Inject(MatchesGateway) private readonly gateway: MatchesGateway
  ) {}

  @Post("matches/ai")
  createAi(
    @CurrentPrincipal() principal: Principal,
    @Body() body: { seed?: number }
  ) {
    return this.matches.createAiMatch(principal, body.seed ?? Date.now());
  }

  @Post("matches/private")
  createPrivate(
    @CurrentPrincipal() principal: Principal,
    @Body() body: { seed?: number }
  ) {
    return this.matches.createPrivateMatch(principal, body.seed ?? Date.now());
  }

  @Post("invites/:token/join")
  join(
    @Param("token") token: string,
    @CurrentPrincipal() principal: Principal
  ) {
    return this.matches.joinPrivateMatch(token, principal);
  }

  @Get("matches/:matchId")
  getMatch(
    @Param("matchId") matchId: string,
    @CurrentPrincipal() principal: Principal
  ) {
    return this.matches.getView(matchId, principal);
  }

  @Post("matches/:matchId/commands")
  async command(
    @Param("matchId") matchId: string,
    @CurrentPrincipal() principal: Principal,
    @Body() body: CommandRequest
  ) {
    const result = await this.matches.executeCommand(matchId, principal, body);
    await this.gateway.publishMatch(matchId);
    return result;
  }
}
