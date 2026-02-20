import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload-url')
  async getUploadUrl(
    @CurrentUser() user: { id: string },
    @Req() req: RawBodyRequest<Request>,
    @Body('corsOrigin') corsOrigin?: string,
  ) {
    return this.postsService.getUploadUrl(user.id, corsOrigin);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  async completeUpload(
    @Param('id') postId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.updateAfterUpload(postId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPost(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Post('webhooks/mux')
  async muxWebhook(@Body() payload: Record<string, unknown>) {
    await this.postsService.handleMuxWebhook(payload as any);
    return { ok: true };
  }
}
