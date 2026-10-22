import { describe, expect, it } from "vitest";
import { pastaSinkEmail } from "@/lib/email/send";

describe("pastaSinkEmail", () => {
  it("desligado sem EMAIL_SINK_DIR", () => {
    expect(pastaSinkEmail({ NODE_ENV: "development" })).toBeNull();
  });
  it("vale fora de produção", () => {
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "development" })).toBe("/tmp/x");
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "test" })).toBe("/tmp/x");
  });
  it("em build de produção só com E2E=1", () => {
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "production" })).toBeNull();
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "production", E2E: "1" })).toBe("/tmp/x");
  });
  it("nunca num deploy de produção da Vercel", () => {
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "production", E2E: "1", VERCEL_ENV: "production" })).toBeNull();
    expect(pastaSinkEmail({ EMAIL_SINK_DIR: "/tmp/x", NODE_ENV: "development", VERCEL_ENV: "production" })).toBeNull();
  });
});
