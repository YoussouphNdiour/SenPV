export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: "particular" | "installer" | "admin";
  locale: string;
}

declare module "next-auth" {
  interface Session {
    user: UserInfo;
    accessToken: string;
  }

  interface User extends UserInfo {
    accessToken: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
  }
}
