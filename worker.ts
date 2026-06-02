// Cloudflare Worker that fronts the ClinicScreen container (Cloudflare Containers).
// The Next.js app runs inside the container on port 8080; this Worker routes all
// requests to it and passes through env vars/secrets.
//
// Requires: `npm i @cloudflare/containers` and `wrangler`.
// NOTE: Cloudflare Containers + wrangler evolve fast — verify class/config names
// against the current docs (https://developers.cloudflare.com/containers/) when deploying.
import { Container, getContainer } from "@cloudflare/containers";

export interface Env {
  CONTAINER: DurableObjectNamespace;
  DATABASE_URL: string;
  APP_URL: string;
  SESSION_SECRET: string;
  QUICKAUTH_URL: string;
  QUICKAUTH_CLIENT_ID: string;
  QUICKAUTH_CLIENT_SECRET: string;
  QUICKAUTH_REDIRECT_URI: string;
  QUICKAUTH_PROVISION_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_PUBLIC_URL: string;
}

const PASS_THROUGH = [
  "DATABASE_URL",
  "APP_URL",
  "SESSION_SECRET",
  "QUICKAUTH_URL",
  "QUICKAUTH_CLIENT_ID",
  "QUICKAUTH_CLIENT_SECRET",
  "QUICKAUTH_REDIRECT_URI",
  "QUICKAUTH_PROVISION_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

export class ClinicScreenContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "1h"; // stay warm across a session; scale to zero after idle
  envVars: Record<string, string> = {};

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    for (const k of PASS_THROUGH) {
      const v = env[k];
      if (v) this.envVars[k] = v as string;
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.CONTAINER).fetch(request);
  },
};
