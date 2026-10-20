import { ptCaveats } from "./caveats";
import { ptGlossary } from "./glossary";
import { pt1 } from "./pt1";
import { pt2 } from "./pt2";

export const pt: Record<string, string> = {
  ...pt1,
  ...pt2,
  ...ptGlossary,
  ...ptCaveats,
};
