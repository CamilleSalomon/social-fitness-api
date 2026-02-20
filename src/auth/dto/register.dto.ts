import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username: letters, numbers, underscore only' })
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
