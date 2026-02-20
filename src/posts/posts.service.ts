import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MuxService } from './mux.service';
import { CreatePostDto } from './dto/create-post.dto';

const MAX_POSTS_PER_DAY = 1;
const MAX_DURATION_SEC = 60;

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private mux: MuxService,
  ) {}

  async getUploadUrl(userId: string, corsOrigin?: string) {
    await this.checkDailyQuota(userId);
    const { uploadId, url } = await this.mux.createDirectUpload(corsOrigin || '*');
    const post = await this.prisma.post.create({
      data: {
        userId,
        muxUploadId: uploadId,
        status: 'uploading',
      },
    });
    return {
      postId: post.id,
      uploadUrl: url,
      uploadId,
    };
  }

  private async checkDailyQuota(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await this.prisma.post.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });
    if (count >= MAX_POSTS_PER_DAY) {
      throw new ForbiddenException(`Maximum ${MAX_POSTS_PER_DAY} post(s) per day`);
    }
  }

  async updateAfterUpload(postId: string, userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new BadRequestException('Post not found');
    if (dto.durationSec != null && dto.durationSec > MAX_DURATION_SEC) {
      throw new BadRequestException(`Video must be at most ${MAX_DURATION_SEC} seconds`);
    }
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        caption: dto.caption ?? undefined,
        durationSec: dto.durationSec ?? undefined,
      },
    });
  }

  async handleMuxWebhook(payload: {
    type?: string;
    data?: { id?: string; asset_id?: string; playback_ids?: { id: string }[] };
  }) {
    if (payload.type !== 'video.upload.asset_ready') return;
    const uploadId = payload.data?.id;
    const assetId = payload.data?.asset_id;
    let playbackId = payload.data?.playback_ids?.[0]?.id;
    if (!uploadId || !assetId) return;
    if (!playbackId) playbackId = await this.mux.getPlaybackIdForAsset(assetId) ?? undefined;
    if (!playbackId) return;

    await this.prisma.post.updateMany({
      where: { muxUploadId: uploadId },
      data: {
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        status: 'ready',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }
}
