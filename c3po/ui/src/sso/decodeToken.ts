import { jwtDecode } from "jwt-decode";

export interface DecodedToken {
  sub: string;
  groups: string[];
  exp: number;
  name: string;
  email: string;
  userinfo: {
    name: string;
    email: string;
  };
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch (e) {
    console.error("Token decode failed", e);
    return null;
  }
}
