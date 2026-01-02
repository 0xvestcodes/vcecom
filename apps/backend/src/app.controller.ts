import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BUILD_INFO } from "./build-info";
import { Public } from "./common/decorators/public.decorator";

@ApiTags("admin")
@Controller()
export class AppController {
  private readonly runningSince = new Date().toISOString();

  @Public()
  @Get()
  getStatus() {
    return {
      ...BUILD_INFO,
      runningSince: this.runningSince,
    };
  }
}
