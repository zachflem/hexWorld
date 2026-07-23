/** Diegetic copy for the field-manual onboarding flow. Keep prose here, not in components. */

export const COVER_TITLE = "Field Notes";
export const COVER_HOOK =
  "Pulled from a spiral pad in the old lab — coffee rings, smudged ink, someone's handwriting still legible. They walked this ground before us.";

export const SENDOFF_LINE =
  "The treeline is quiet for now. Whatever waits out there won't stay that way once we start building.";

export const STORY_PAGES = [
  {
    id: "settling",
    title: "Settling",
    body: [
      "We came in with almost nothing and marked out camp the same hour we arrived — base tile and two rings around it, nineteen hexes total, ours before sundown.",
      "Fog sits heavy one ring past that. We know the ground under our feet. Everything beyond is guesswork until someone walks it.",
    ],
  },
  {
    id: "the-noise",
    title: "The Noise",
    body: [
      "Every hammer strike, every path worn in, every tile we work — it adds up. The dead don't wander at random. They hear us.",
      "Build quiet and we might stay beneath notice. Build loud and something out in the dens will answer. There is no true silence once the camp wakes — only how loud we choose to be.",
    ],
  },
  {
    id: "what-were-looking-for",
    title: "What We're Looking For",
    body: [
      "Old maps talk of a lab somewhere deep in the wild — a cure, or close enough that people stopped asking questions.",
      "We don't have to scour every den to win this. Clearing them buys us ground, clues, and breathing room. But if we find that lab and hold it, the run is ours.",
    ],
  },
  {
    id: "before-you-go",
    title: "Before You Go",
    body: [
      "Claim ground tile by tile — adjacency matters more than bravado. Scout before you commit a party; blind assaults cost militia we can't replace quickly.",
      "Paths turn gathering into something that runs itself. Towers and walls buy time, not certainty. Keep one eye on the noise readout and one on the treeline.",
    ],
  },
] as const;

export const STORY_PAGE_COUNT = STORY_PAGES.length;
