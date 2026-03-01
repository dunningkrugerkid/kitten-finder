import { describe, it, expect } from "vitest";
import { buildKittenEmbed } from "../src/lib/discord";
import type { CatListing } from "../src/lib/types";

function makeListing(overrides: Partial<CatListing> = {}): CatListing {
  return {
    id: "abc-123",
    source: "spca",
    sourceId: "cat-001",
    name: "Whiskers",
    photoUrl: "https://example.com/whiskers.jpg",
    age: "2 months",
    sex: "Male",
    breed: "Tabby",
    description: "A friendly kitten",
    listingUrl: "https://example.com/cats/001",
    firstSeen: "2026-03-01T00:00:00.000Z",
    lastSeen: "2026-03-01T00:00:00.000Z",
    isActive: 1,
    ...overrides,
  };
}

describe("buildKittenEmbed", () => {
  it("sets title to listing name", () => {
    const embed = buildKittenEmbed(makeListing({ name: "Mittens" }));
    expect(embed.title).toBe("Mittens");
  });

  it("sets url to listing listingUrl", () => {
    const listing = makeListing({
      listingUrl: "https://shelter.example.com/cats/42",
    });
    const embed = buildKittenEmbed(listing);
    expect(embed.url).toBe("https://shelter.example.com/cats/42");
  });

  it("has inline fields for Age, Sex, and Breed", () => {
    const embed = buildKittenEmbed(
      makeListing({ age: "3 months", sex: "Female", breed: "Siamese" }),
    );

    const ageField = embed.fields?.find((f) => f.name === "Age");
    const sexField = embed.fields?.find((f) => f.name === "Sex");
    const breedField = embed.fields?.find((f) => f.name === "Breed");

    expect(ageField).toBeDefined();
    expect(ageField!.value).toBe("3 months");
    expect(ageField!.inline).toBe(true);

    expect(sexField).toBeDefined();
    expect(sexField!.value).toBe("Female");
    expect(sexField!.inline).toBe(true);

    expect(breedField).toBeDefined();
    expect(breedField!.value).toBe("Siamese");
    expect(breedField!.inline).toBe(true);
  });

  it("sets thumbnail url to listing photoUrl", () => {
    const embed = buildKittenEmbed(
      makeListing({ photoUrl: "https://example.com/photo.jpg" }),
    );
    expect(embed.thumbnail).toBeDefined();
    expect(embed.thumbnail!.url).toBe("https://example.com/photo.jpg");
  });

  it("sets footer with source label", () => {
    const embed = buildKittenEmbed(makeListing({ source: "spca" }));
    expect(embed.footer).toBeDefined();
    expect(embed.footer!.text).toBe("SPCA St. John's");
  });

  it("maps heavenly source to correct label", () => {
    const embed = buildKittenEmbed(makeListing({ source: "heavenly" }));
    expect(embed.footer!.text).toBe("Heavenly Creatures");
  });

  it("maps stjohns source to correct label", () => {
    const embed = buildKittenEmbed(makeListing({ source: "stjohns" }));
    expect(embed.footer!.text).toBe("City of St. John's");
  });

  it("falls back to raw source name for unknown sources", () => {
    const embed = buildKittenEmbed(makeListing({ source: "unknown-shelter" }));
    expect(embed.footer!.text).toBe("unknown-shelter");
  });

  it("has a color", () => {
    const embed = buildKittenEmbed(makeListing({ source: "spca" }));
    expect(embed.color).toBeDefined();
    expect(typeof embed.color).toBe("number");
  });

  it("uses different colors for different sources", () => {
    const spcaEmbed = buildKittenEmbed(makeListing({ source: "spca" }));
    const heavenlyEmbed = buildKittenEmbed(makeListing({ source: "heavenly" }));
    const stjohnsEmbed = buildKittenEmbed(makeListing({ source: "stjohns" }));

    expect(spcaEmbed.color).not.toBe(heavenlyEmbed.color);
    expect(heavenlyEmbed.color).not.toBe(stjohnsEmbed.color);
    expect(spcaEmbed.color).not.toBe(stjohnsEmbed.color);
  });

  it("includes description when present", () => {
    const embed = buildKittenEmbed(
      makeListing({ description: "Very playful kitten" }),
    );
    expect(embed.description).toBe("Very playful kitten");
  });
});
