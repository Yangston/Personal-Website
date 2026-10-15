export type AboutPillarId = "hobbies" | "songs" | "books";
export type AboutPillar = Readonly<{
  id: AboutPillarId;
  name: string;
  label: string;
  color: string;
  x: number;
  y: number;
}>;

export const ABOUT_PILLARS: readonly AboutPillar[] = [
  {
    id: "hobbies",
    name: "Hobbies",
    label: "Away from the screen",
    color: "#dc9752",
    x: -0.27,
    y: 0.18,
  },
  {
    id: "songs",
    name: "Music",
    label: "Current rotation",
    color: "#a18ac8",
    x: 0.27,
    y: 0.18,
  },
  {
    id: "books",
    name: "Books",
    label: "On the nightstand",
    color: "#c4a673",
    x: 0,
    y: -0.2,
  },
];
