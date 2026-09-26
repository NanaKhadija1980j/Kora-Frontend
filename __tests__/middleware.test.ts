import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { middleware } from "../middleware";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_MAX_AGE } from "@/i18n/locale";

function createRequest(
  pathname: string,
  options: {
    cookie?: string;
    acceptLanguage?: string;
  } = {}
) {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url, {
    headers: {
      ...(options.acceptLanguage
        ? { "accept-language": options.acceptLanguage }
        : {}),
    },
    ...(options.cookie
      ? {
          headers: {
            cookie: `${LOCALE_COOKIE_NAME}=${options.cookie}`,
            ...(options.acceptLanguage
              ? { "accept-language": options.acceptLanguage }
              : {}),
          },
        }
      : {}),
  });
}

describe("middleware locale handling", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-request-id",
    });
  });

  it("passes x-kora-locale from an existing cookie to the request", () => {
    const nextSpy = vi.spyOn(NextResponse, "next");
    const req = createRequest("/", { cookie: "es" });
    middleware(req);

    const init = nextSpy.mock.calls[0]?.[0] as { request?: { headers?: Headers } };
    expect(init?.request?.headers?.get("x-kora-locale")).toBe("es");
    nextSpy.mockRestore();
  });

  it("does not rewrite cookie when it already matches the resolved locale", () => {
    const req = createRequest("/", { cookie: "es" });
    const res = middleware(req);

    expect(res.cookies.get(LOCALE_COOKIE_NAME)).toBeUndefined();
  });

  it("detects locale from Accept-Language when cookie is absent", () => {
    const req = createRequest("/", { acceptLanguage: "es-ES,es;q=0.9" });
    const res = middleware(req);

    const cookie = res.cookies.get(LOCALE_COOKIE_NAME);
    expect(cookie?.value).toBe("es");
    expect(cookie?.maxAge).toBe(LOCALE_COOKIE_MAX_AGE);
  });

  it("falls back to English for unsupported Accept-Language values", () => {
    const req = createRequest("/", { acceptLanguage: "fr-FR,de-DE" });
    const res = middleware(req);

    expect(res.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe("en");
  });
});

describe("middleware /test-components gate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-request-id",
    });
    process.env = { ...originalEnv };
  });

  it("redirects /test-components to / in production when dev flag is not enabled", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_ENABLE_TEST_COMPONENTS;

    const req = createRequest("/test-components");
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("allows /test-components in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_ENABLE_TEST_COMPONENTS;

    const req = createRequest("/test-components");
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it("allows /test-components in production when NEXT_PUBLIC_ENABLE_TEST_COMPONENTS is true", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_ENABLE_TEST_COMPONENTS = "true";

    const req = createRequest("/test-components");
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});
