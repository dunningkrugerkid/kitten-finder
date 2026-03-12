import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookNotifier } from "./webhook.js";
import type { CatListing } from "../types.js";

const mockListing: CatListing = {
  id: "1",
  source: "spca",
  sourceId: "A123",
  name: "Whiskers",
  photoUrl: "https://example.com/photo.jpg",
  age: "Kitten",
  sex: "Female",
  breed: "Domestic Shorthair",
  description: "",
  listingUrl: "https://example.com/listing",
  firstSeen: "2026-03-12T00:00:00Z",
  lastSeen: "2026-03-12T00:00:00Z",
  isActive: 1,
};

describe("WebhookNotifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with JSON body to configured URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const notifier = new WebhookNotifier("https://example.com/hook");
    await notifier.notify([mockListing]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.com/hook");

    const options = opts as RequestInit;
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );

    const body = JSON.parse(options.body as string);
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0].name).toBe("Whiskers");
  });

  it("does nothing when listings array is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const notifier = new WebhookNotifier("https://example.com/hook");
    await notifier.notify([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
