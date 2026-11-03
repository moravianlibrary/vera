// What the mock photo reader sees and recognises.
import type { PhotoFake } from "@vera/contract/queries/ways-in";

export const photoFake: PhotoFake = {
  seen: "a catalog card",
  read: [
    { label: "Author", value: "Kratochvíl, Josef", confidence: 0.94 },
    { label: "Title", value: "Moravské kostely", confidence: 0.97 },
    { label: "Published", value: "Brno : Moravský kraj, 1932", confidence: 0.71 },
    { label: "Shelf mark", value: "MB2-0433", confidence: 0.62 },
  ],
  best: "Moravské kostely",
  near: "Kniha o Brně",
};
