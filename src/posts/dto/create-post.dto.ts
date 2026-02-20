import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  @Type(() => Number)
  durationSec?: number;
}
