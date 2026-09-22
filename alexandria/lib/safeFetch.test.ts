import { describe, expect, it } from "vitest";
import { assertSafeRemoteUrl, isPublicIpAddress } from "./safeFetch";

describe("isPublicIpAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:7f00:1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPublicIpAddress(address)).toBe(true);
    },
  );
});

describe("assertSafeRemoteUrl", () => {
  it("rejects embedded credentials before making a network request", async () => {
    await expect(
      assertSafeRemoteUrl("https://user:password@example.com/article"),
    ).rejects.toThrow("credentials");
  });
});
