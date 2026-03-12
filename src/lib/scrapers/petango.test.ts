import { describe, it, expect } from "vitest";
import { buildPetangoUrl, buildDetailsUrl } from "./petango.js";

describe("buildPetangoUrl", () => {
  it("includes the auth key in the URL", () => {
    const url = buildPetangoUrl({ authKey: "test123" });
    expect(url).toContain("authkey=test123");
  });

  it("includes custom CSS URL when provided", () => {
    const url = buildPetangoUrl({
      authKey: "test123",
      cssUrl: "https://example.com/styles.css",
    });
    expect(url).toContain("css=https%3A%2F%2Fexample.com%2Fstyles.css");
  });

  it("uses default CSS when no custom CSS provided", () => {
    const url = buildPetangoUrl({ authKey: "test123" });
    expect(url).toContain("css=https%3A%2F%2Fws.petango.com");
  });

  it("sets detailsInPopup based on config", () => {
    const withPopup = buildPetangoUrl({
      authKey: "test123",
      detailsInPopup: true,
    });
    expect(withPopup).toContain("detailsInPopup=Yes");
    const withoutPopup = buildPetangoUrl({
      authKey: "test123",
      detailsInPopup: false,
    });
    expect(withoutPopup).toContain("detailsInPopup=No");
  });
});

describe("buildDetailsUrl", () => {
  it("constructs detail URL with sourceId and authKey", () => {
    const url = buildDetailsUrl("A12345", "mykey");
    expect(url).toBe(
      "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails.aspx?id=A12345&authkey=mykey",
    );
  });
});
