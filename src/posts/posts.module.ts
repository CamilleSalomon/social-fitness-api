import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MuxService } from './mux.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, MuxService],
  exports: [PostsService],
})
export class PostsModule {}
