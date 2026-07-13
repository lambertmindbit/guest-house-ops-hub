// Barrel for the settings sections. Each section now lives in its own file (was a
// single 700-line module); this re-exports them so existing page imports —
// `import { RoomsSection } from "@/components/settings/sections"` — stay unchanged.
export type { RoomType, Room, Channel, Block, Settings, Policy, Season } from "./shared";
export { PropertySection } from "./PropertySection";
export { RoomTypesSection } from "./RoomTypesSection";
export { RoomsSection } from "./RoomsSection";
export { ChannelsSection } from "./ChannelsSection";
export { PricingSection } from "./PricingSection";
export { BlocksSection } from "./BlocksSection";
