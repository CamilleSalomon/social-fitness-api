import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const MUX_BASE = 'https://api.mux.com';

export interface MuxDirectUploadResponse {
  data: {
    id: string;
    url: string;
    status: string;
    new_asset_settings: { playback_policy: string[] };
  };
}

@Injectable()
export class MuxService {
  private tokenId: string;
  private tokenSecret: string;

  constructor(private config: ConfigService) {
    this.tokenId = this.config.get<string>('MUX_TOKEN_ID', '');
    this.tokenSecret = this.config.get<string>('MUX_TOKEN_SECRET', '');
  }

  async createDirectUpload(corsOrigin: string): Promise<{ uploadId: string; url: string }> {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString('base64');
    const { data } = await axios.post<MuxDirectUploadResponse>(
      `${MUX_BASE}/video/v1/uploads`,
      {
        cors_origin: corsOrigin || '*',
        new_asset_settings: {
          playback_policy: ['public'],
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      },
    );
    return {
      uploadId: data.data.id,
      url: data.data.url,
    };
  }

  /** Récupère le statut d’un upload (pour sync sans webhook, ex. en local). */
  async getUploadStatus(uploadId: string): Promise<{ assetId: string | null; status: string }> {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString('base64');
    try {
      const { data } = await axios.get<{ data: { asset_id?: string; status: string } }>(
        `${MUX_BASE}/video/v1/uploads/${uploadId}`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      return {
        assetId: data.data?.asset_id ?? null,
        status: data.data?.status ?? 'unknown',
      };
    } catch {
      return { assetId: null, status: 'error' };
    }
  }

  /** Get playback_id from asset (e.g. when webhook does not include it). */
  async getPlaybackIdForAsset(assetId: string): Promise<string | null> {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString('base64');
    try {
      const { data } = await axios.get<{ data: { playback_ids?: { id: string }[] } }>(
        `${MUX_BASE}/video/v1/assets/${assetId}`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      return data.data?.playback_ids?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }
}
