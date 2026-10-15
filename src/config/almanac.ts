import { site } from "./site";

export type AlmanacCredit = {
  id: string;
  title: string;
  credit: string;
  artwork: {
    source: string;
    width: number;
    height: number;
    alt: string;
    sourceCredit: string;
    sourceUrl: string;
  };
};

export type AlmanacHobby = {
  id: string;
  title: string;
  icon: "camera" | "dice" | "cards" | "city";
};

export type PersonalAlmanac = {
  origin: string | null;
  currentLocation: string;
  introduction: string;
  hobbies: readonly AlmanacHobby[];
  songs: readonly AlmanacCredit[];
  books: readonly AlmanacCredit[];
};

export const almanac: PersonalAlmanac = {
  origin: null,
  currentLocation: site.location,
  introduction: site.bio,
  hobbies: [
    { id: "photography", title: "Photography", icon: "camera" },
    { id: "board-games", title: "Board games", icon: "dice" },
    { id: "poker", title: "Poker", icon: "cards" },
    { id: "city-walks", title: "Walks in the city", icon: "city" },
  ],
  songs: [
    {
      id: "always",
      title: "Always",
      credit: "Daniel Caesar",
      artwork: {
        source: "/media/site/almanac/always.webp",
        width: 400,
        height: 400,
        alt: "Never Enough album cover",
        sourceCredit: "Daniel Caesar / Republic Records via Apple Music",
        sourceUrl:
          "https://music.apple.com/us/album/always/1681322859?i=1681323048",
      },
    },
    {
      id: "camouflage",
      title: "Camouflage",
      credit: "Weston Estate",
      artwork: {
        source: "/media/site/almanac/camouflage.webp",
        width: 400,
        height: 400,
        alt: "Camouflage single cover",
        sourceCredit: "Weston Estate / Arista Records via Apple Music",
        sourceUrl:
          "https://music.apple.com/us/album/camouflage-single/1771103395",
      },
    },
    {
      id: "of-everyone",
      title: "Of Everyone in the World",
      credit: "Forrest Nolan",
      artwork: {
        source: "/media/site/almanac/of-everyone.webp",
        width: 400,
        height: 400,
        alt: "Of Everyone in the World single cover",
        sourceCredit: "Forrest Nolan via Apple Music",
        sourceUrl:
          "https://music.apple.com/us/album/of-everyone-in-the-world-feat-love-interest-single/1891033466",
      },
    },
  ],
  books: [
    {
      id: "open-water",
      title: "Open Water",
      credit: "Caleb Azumah Nelson",
      artwork: {
        source: "/media/site/almanac/open-water.webp",
        width: 340,
        height: 509,
        alt: "Open Water book cover",
        sourceCredit: "Grove Atlantic / Black Cat",
        sourceUrl: "https://groveatlantic.com/book/open-water/",
      },
    },
    {
      id: "cure",
      title: "Cure",
      credit: "Jo Marchant",
      artwork: {
        source: "/media/site/almanac/cure.webp",
        width: 292,
        height: 450,
        alt: "Cure book cover",
        sourceCredit: "Penguin Random House / Crown",
        sourceUrl:
          "https://www.penguinrandomhouse.com/books/224590/cure-by-jo-marchant/",
      },
    },
  ],
};
