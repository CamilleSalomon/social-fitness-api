import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MuxService } from './mux.service';
import { CreatePostDto } from './dto/create-post.dto';

const MAX_DURATION_SEC = 60;

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private mux: MuxService,
  ) {}

  async getUploadUrl(userId: string, corsOrigin?: string) {
    console.log('[Upload] Demande d’URL d’upload', { userId });
    const { uploadId, url } = await this.mux.createDirectUpload(corsOrigin || '*');
    const post = await this.prisma.post.create({
      data: {
        userId,
        muxUploadId: uploadId,
        status: 'uploading',
      },
    });
    console.log('[Upload] URL créée, post créé', { postId: post.id, muxUploadId: uploadId });
    return {
      postId: post.id,
      uploadUrl: url,
      uploadId,
    };
  }

  async updateAfterUpload(postId: string, userId: string, dto: CreatePostDto) {
    console.log('[Upload] Complétion demandée', { postId, userId, durationSec: dto.durationSec });
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new BadRequestException('Post not found');
    if (dto.durationSec != null && dto.durationSec > MAX_DURATION_SEC) {
      throw new BadRequestException(`Video must be at most ${MAX_DURATION_SEC} seconds`);
    }
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        caption: dto.caption ?? undefined,
        durationSec: dto.durationSec ?? undefined,
      },
    });
    console.log('[Upload] Post complété côté API', { postId, status: updated.status });
    return updated;
  }

  async handleMuxWebhook(payload: {
    type?: string;
    data?: { id?: string; asset_id?: string; playback_ids?: { id: string }[] };
  }) {
    console.log('[Upload] Webhook Mux reçu', { type: payload.type });
    if (payload.type !== 'video.upload.asset_ready') return;
    const uploadId = payload.data?.id;
    const assetId = payload.data?.asset_id;
    let playbackId = payload.data?.playback_ids?.[0]?.id;
    if (!uploadId || !assetId) {
      console.log('[Upload] Webhook ignoré (uploadId ou assetId manquant)');
      return;
    }
    if (!playbackId) playbackId = await this.mux.getPlaybackIdForAsset(assetId) ?? undefined;
    if (!playbackId) {
      console.log('[Upload] Webhook ignoré (playbackId introuvable)');
      return;
    }
    const result = await this.prisma.post.updateMany({
      where: { muxUploadId: uploadId },
      data: {
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        status: 'ready',
      },
    });
    console.log('[Upload] Vidéo prête (Mux)', { muxUploadId: uploadId, assetId, playbackId, postsUpdated: result.count });
  }

  async findOne(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  /** Synchronise les posts encore "uploading" avec Mux (pour dev sans webhook). */
  async syncUploadingPosts() {
    const uploading = await this.prisma.post.findMany({
      where: { status: 'uploading', muxUploadId: { not: null } },
      select: { id: true, muxUploadId: true },
    });
    for (const post of uploading) {
      const uploadId = post.muxUploadId!;
      const { assetId, status } = await this.mux.getUploadStatus(uploadId);
      if (status === 'asset_created' && assetId) {
        const playbackId = await this.mux.getPlaybackIdForAsset(assetId);
        if (playbackId) {
          await this.prisma.post.update({
            where: { id: post.id },
            data: { muxAssetId: assetId, muxPlaybackId: playbackId, status: 'ready' },
          });
          console.log('[Upload] Post synchronisé avec Mux (sans webhook)', { postId: post.id, playbackId });
        }
      }
    }
  }

  /** Feed: posts prêts, plus récents en premier, avec auteur. */
  async findFeed(limit = 50, cursor?: string) {
    await this.syncUploadingPosts();
    const items = await this.prisma.post.findMany({
      where: { status: 'ready', muxPlaybackId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    const hasMore = items.length > limit;
    const list = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? list[list.length - 1].id : undefined;
    return { posts: list, nextCursor };
  }
}
