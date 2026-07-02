import { describe, it, expect } from "vitest";
import { amenityIdsByRoomType } from "@/lib/amenities";

describe("amenityIdsByRoomType", () => {
  it("groups amenity ids per room type", () => {
    const map = amenityIdsByRoomType([
      { roomTypeId: "deluxe", amenityId: "wifi" },
      { roomTypeId: "deluxe", amenityId: "ac" },
      { roomTypeId: "suite", amenityId: "wifi" },
    ]);
    expect(map.deluxe.sort()).toEqual(["ac", "wifi"]);
    expect(map.suite).toEqual(["wifi"]);
    expect(map.standard).toBeUndefined();
  });
});
