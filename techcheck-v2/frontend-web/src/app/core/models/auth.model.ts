export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface JwtPayload {
  sub: number;
  email: string;
  rol: string;
  workspace_id: number | null;
  exp: number;
}
