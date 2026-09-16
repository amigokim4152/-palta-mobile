import type { HomeUiItem, HomeZone } from "../../state/homeUiState";

const zoneOrder: HomeZone[] = ["now", "in_progress", "useful_today", "discover"];

export function groupHomeItems(items: HomeUiItem[]) {
  return zoneOrder
    .map((zone) => ({
      zone,
      items: items.filter((item) => item.zone === zone),
    }))
    .filter((group) => group.items.length > 0);
}
