import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.authService.sign({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
