import { Controller, Get, VERSION_NEUTRAL, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BUILD_INFO } from "./build-info";
import { Public } from "./common/decorators/public.decorator";

@ApiTags("admin")
@Controller()
export class AppController {
  private readonly runningSince = new Date().toISOString();

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  getStatus() {
    return {
      ...BUILD_INFO,
      runningSince: this.runningSince,
    };
  }
}
