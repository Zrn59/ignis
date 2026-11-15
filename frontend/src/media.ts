import type { Lang } from "./api";

// Real photographs taken from the PSI archive and NASA's 2015 "Researcher's Guide
// to ISS Combustion Science" (NP-2015-10-034-JSC). Captions follow the guide's own.

export interface Photo {
  src: string;
  caption: { ru: string; en: string };
  credit: string;
}

const GUIDE = "NASA · Researcher’s Guide to ISS Combustion Science, 2015";

export const PHOTOS = {
  iss: {
    src: "/img/iss.jpg",
    caption: { ru: "Международная космическая станция", en: "The International Space Station" },
    credit: GUIDE,
  },
  candle1g: {
    src: "/img/candle-1g.jpg",
    caption: { ru: "Свеча на Земле, 1 g", en: "Candle on Earth, 1 g" },
    credit: GUIDE,
  },
  candle0g: {
    src: "/img/candle-0g.jpg",
    caption: { ru: "Свеча в невесомости, 0 g", en: "Candle in microgravity, 0 g" },
    credit: GUIDE,
  },
  flameDesign: {
    src: "/img/flame-design.jpg",
    caption: { ru: "Сферическое диффузионное пламя на пористой горелке", en: "Spherical diffusion flame on a porous burner" },
    credit: `${GUIDE}, fig. 6`,
  },
  sFlame: {
    src: "/img/s-flame.jpg",
    caption: { ru: "Сферическое пламя в 2,2-секундной башне сброса NASA", en: "Spherical flame in NASA’s 2.2-second drop tower" },
    credit: `${GUIDE}, fig. 7`,
  },
  slice: {
    src: "/img/slice.jpg",
    caption: { ru: "Приподнятое пламя при росте скорости спутного потока", en: "Lifted flame as the co-flow speed increases" },
    credit: `${GUIDE}, fig. 5`,
  },
  spice: {
    src: "/img/spice.jpg",
    caption: { ru: "С ростом расхода топлива кончик пламени начинает коптить", en: "As fuel flow rises, the flame tip opens and starts to smoke" },
    credit: `${GUIDE}, fig. 4`,
  },
  spiceIss: {
    src: "/img/spice-iss.jpg",
    caption: { ru: "Кадр бортового видео SPICE: этиленовое пламя в перчаточном боксе МКС", en: "SPICE onboard video: ethylene flame in the ISS glovebox" },
    credit: "NASA PSI-107, raw data",
  },
  bassSphere: {
    src: "/img/bass-sphere.jpg",
    caption: { ru: "Акриловый шар 2 см горит при 17 % O₂ и потоке 12 см/с, кадры через 1,5 с", en: "A 2 cm acrylic sphere burning at 17 % O₂ and 12 cm/s, frames 1.5 s apart" },
    credit: `${GUIDE}, fig. 11`,
  },
  bassSpread: {
    src: "/img/bass-spread.jpg",
    caption: { ru: "В медленном потоке пламя ползёт навстречу воздуху", en: "In slow flow the flame spreads upstream, into the air" },
    credit: `${GUIDE}, fig. 9`,
  },
  dropTower: {
    src: "/img/drop-tower.jpg",
    caption: { ru: "Шар ПММА: 1 g, через 1 с после сброса, тушение азотом через 4 с", en: "PMMA sphere: 1 g, 1 s after the drop, nitrogen extinguishing at 4 s" },
    credit: `${GUIDE}, fig. 13`,
  },
  flex: {
    src: "/img/flex.jpg",
    caption: { ru: "Капля н-гептана горит в атмосфере, разбавленной CO₂", en: "An n-heptane droplet burning in CO₂-diluted air" },
    credit: `${GUIDE}, fig. 2`,
  },
  flex2: {
    src: "/img/flex2.jpg",
    caption: { ru: "Сажеобразование у разных топлив", en: "Sooting propensity of different fuels" },
    credit: `${GUIDE}, fig. 3`,
  },
  compare: {
    src: "/img/compare.jpg",
    caption: { ru: "Пламена в 1 g и 0 g: струи, свечи, капли, разлив", en: "Flames at 1 g and 0 g: jets, candles, droplets, a pool" },
    credit: `${GUIDE}, fig. 1`,
  },
} satisfies Record<string, Photo>;

export type PhotoId = keyof typeof PHOTOS;

const STUDY_PHOTO: Record<string, PhotoId> = {
  "PSI-10": "flameDesign",
  "PSI-23": "sFlame",
  "PSI-106": "slice",
  "PSI-107": "spiceIss",
  "PSI-60": "spice",
  "PSI-26": "bassSphere",
  "PSI-25": "bassSpread",
  "PSI-62": "dropTower",
  "PSI-69": "flex",
  "PSI-68": "flex2",
};

export function studyPhoto(id: string): Photo | null {
  const key = STUDY_PHOTO[id];
  return key ? PHOTOS[key] : null;
}

export const caption = (photo: Photo, lang: Lang) => photo.caption[lang];
