import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PHOTOS, type PhotoId } from "../media";
import { href, useStore } from "../store";
import { Go, Icon } from "./ui";

/** Drag to wipe between the same candle at 1 g and at 0 g (real NASA photos). */
export function CandleSlider() {
  const { lang, t } = useStore();
  const [x, setX] = useState(50);
  const nudge = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setX((v) => Math.max(0, v - 5));
    if (e.key === "ArrowRight") setX((v) => Math.min(100, v + 5));
  };
  return (
    <figure style={{ margin: 0 }}>
      <div className="compare-slider" style={{ "--x": `${x}%` } as CSSProperties}>
        <img src={PHOTOS.candle0g.src} alt={PHOTOS.candle0g.caption[lang]} />
        <img className="top" src={PHOTOS.candle1g.src} alt={PHOTOS.candle1g.caption[lang]} />
        <span className="tagline l">1 g · {t("g.earth")}</span>
        <span className="tagline r">0 g · {t("g.0")}</span>
        <span className="bar" />
        <span className="knob"><Icon name="swap" /></span>
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} onKeyDown={nudge}
          aria-label={t("why.drag")} />
      </div>
      <figcaption className="photo-credit">{t("why.drag")} · {PHOTOS.candle1g.credit}</figcaption>
    </figure>
  );
}

interface Event {
  year: string;
  kind: "fire" | "data" | "future";
  title: [string, string];
  text: [string, string];
  study?: string;
}

const EVENTS: Event[] = [
  { year: "1967", kind: "fire", title: ["Apollo 1", "Apollo 1"],
    text: ["Пожар в кабине на стартовой площадке: чистый кислород под давлением, экипаж погиб. После этого NASA сменило стартовую атмосферу и материалы кабины.",
      "A cabin fire on the launch pad in pure pressurised oxygen killed the crew. NASA then changed the launch atmosphere and cabin materials."] },
  { year: "1970", kind: "fire", title: ["Apollo 13", "Apollo 13"],
    text: ["Взрыв кислородного бака на пути к Луне. Экипаж вернулся, используя лунный модуль как спасательную шлюпку.",
      "An oxygen tank exploded on the way to the Moon. The crew made it home using the lunar module as a lifeboat."] },
  { year: "1997", kind: "fire", title: ["Станция «Мир»", "Mir station"],
    text: ["Отказ кислородного генератора вызвал пожар на борту. Международный экипаж потушил его, работая в респираторах.",
      "An oxygen generator failure started a fire on board. The multinational crew put it out wearing respirators."] },
  { year: "2007", kind: "data", study: "PSI-69", title: ["FLEX", "FLEX"],
    text: ["На МКС начинают жечь капли топлива: при каком кислороде пламя гаснет и как работают CO₂ и гелий.",
      "Fuel droplets start burning on the ISS: at what oxygen level the flame dies, and how CO₂ and helium act."] },
  { year: "2009", kind: "data", study: "PSI-26", title: ["BASS", "BASS"],
    text: ["Первые ткани и пластики, сожжённые на МКС в потоке воздуха, и тушение азотом.",
      "The first fabrics and plastics burned on the ISS in an air flow, then put out with nitrogen."] },
  { year: "2010", kind: "data", study: "PSI-101", title: ["SAME-R", "SAME-R"],
    text: ["Дым от перегретых материалов корабля: частицы крупнее, чем на Земле. Это данные для датчиков дыма.",
      "Smoke from overheated spacecraft materials: particles are larger than on Earth. Data for smoke detectors."] },
  { year: "2016", kind: "data", study: "PSI-98", title: ["Saffire-I", "Saffire-I"],
    text: ["Самый крупный управляемый пожар в космосе: ткань 0,4 × 0,94 м горит в корабле Cygnus после отстыковки от МКС.",
      "The largest controlled fire in space: a 0.4 × 0.94 m fabric sheet burns inside Cygnus after it leaves the ISS."] },
  { year: "2021", kind: "data", study: "PSI-159", title: ["ACME CFI-G", "ACME CFI-G"],
    text: ["Холодные пламёна при кислороде до 85 % — самая высокая доля O₂ во всём архиве PSI.",
      "Cool flames with up to 85 % oxygen, the highest O₂ fraction in the whole PSI archive."] },
  { year: "2026", kind: "fire", title: ["Artemis II", "Artemis II"],
    text: ["Пожарная сигнализация срабатывает на корабле в 80 000 милях от Земли. Огонь по-прежнему главный страх экипажа.",
      "A fire alarm goes off aboard the spacecraft 80,000 miles from home. Fire is still what crews fear most."] },
  { year: "LUCI · FM2", kind: "future", title: ["Лунная гравитация", "Lunar gravity"],
    text: ["Первые опыты с горением при 1/6 g. До них всё про Луну и Марс — оценка между 0 g и 1 g.",
      "The first burns at 1/6 g. Until then everything about the Moon and Mars is bounded by 0 g and 1 g."] },
];

export function Timeline() {
  const { lang, t } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const i = lang === "ru" ? 0 : 1;
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 560, behavior: "smooth" });
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 28, gap: 20 }}>
        <div className="legend" style={{ color: "#bdbdbd" }}>
          <span><i style={{ background: "var(--red)" }} />{t("tl.fire")}</span>
          <span><i style={{ background: "#fff" }} />{t("tl.data")}</span>
          <span><i className="ring" style={{ color: "#777" }} />{t("tl.future")}</span>
        </div>
        <div className="tl-nav">
          <button onClick={() => scroll(-1)} aria-label="←"><Icon name="back" /></button>
          <button onClick={() => scroll(1)} aria-label="→"><Icon name="chevron" /></button>
        </div>
      </div>
      <div className="timeline" ref={ref} tabIndex={0} aria-label={t("tl.title")}>
        {EVENTS.map((ev) => (
          <article key={ev.year + ev.title[1]} className={`tl-item ${ev.kind}`}>
            <div className="year">{ev.year}</div>
            <div className="pin" />
            <h3>{ev.title[i]}</h3>
            <p>{ev.text[i]}</p>
            {ev.study && <Go small href={href(`studies/${ev.study}`)}>{ev.study}</Go>}
          </article>
        ))}
      </div>
    </>
  );
}

const GALLERY: { photo: PhotoId; study: string; span: number; tall?: boolean }[] = [
  { photo: "flameDesign", study: "PSI-10", span: 7, tall: true },
  { photo: "flex", study: "PSI-69", span: 5, tall: true },
  { photo: "bassSphere", study: "PSI-26", span: 4 },
  { photo: "spiceIss", study: "PSI-107", span: 4 },
  { photo: "sFlame", study: "PSI-23", span: 4 },
  { photo: "slice", study: "PSI-106", span: 12 },
];

export function FlameGallery() {
  const { lang, studyById } = useStore();
  return (
    <div className="gallery">
      {GALLERY.map((item) => {
        const photo = PHOTOS[item.photo];
        const study = studyById.get(item.study);
        return (
          <a key={item.study} className="photo-card" href={href(`studies/${item.study}`)}
            style={{ gridColumn: `span ${item.span}`, minHeight: item.tall ? 460 : item.span === 12 ? 260 : 320 }}>
            <img src={photo.src} alt={photo.caption[lang]} loading="lazy" />
            <div className="body">
              <div>
                <div className="label">{item.study}</div>
                <h3>{study?.short ?? item.study}</h3>
                <p>{photo.caption[lang]}</p>
              </div>
              <span className="go"><span className="dot"><Icon name="arrow" /></span></span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
