import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendTelegramMessage } from "./telegram";

describe("sendTelegramMessage", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });

  it("POSTs to Telegram sendMessage with chat_id and text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("{}"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendTelegramMessage("12345", "hello");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      chat_id: "12345",
      text: "hello",
      disable_web_page_preview: true,
    });
  });

  it("throws when token is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(sendTelegramMessage("1", "x")).rejects.toThrow(
      "TELEGRAM_BOT_TOKEN is not configured",
    );
  });

  it("throws with Telegram response when HTTP not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad request"),
      }),
    );

    await expect(sendTelegramMessage("1", "x")).rejects.toThrow(
      "Telegram send failed (400)",
    );
  });
});
