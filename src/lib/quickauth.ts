/** quickAuth (https://github.com/nmallik1029/quickAuth) OAuth client config. */
export const quickauth = {
  url: process.env.QUICKAUTH_URL ?? "http://localhost:3000",
  clientId: process.env.QUICKAUTH_CLIENT_ID ?? "",
  clientSecret: process.env.QUICKAUTH_CLIENT_SECRET ?? "",
  redirectUri: process.env.QUICKAUTH_REDIRECT_URI ?? "http://localhost:3001/auth/callback",
  scope: "profile email",
  provisionSecret: process.env.QUICKAUTH_PROVISION_SECRET ?? "",
};

export const OAUTH_STATE_COOKIE = "cs_oauth_state";
