import type { L10n, Lang } from "./api";

// Every entry is [Russian, English]. Placeholders look like {name}.
const dict = {
  "nav.overview": ["Обзор", "Overview"],
  "nav.studies": ["Исследования", "Investigations"],
  "nav.atmosphere": ["Атмосфера", "Atmosphere"],
  "nav.flight": ["Телеметрия", "Telemetry"],
  "nav.compare": ["Сравнение", "Compare"],
  "nav.tables": ["Таблицы", "Tables"],
  "nav.earth": ["На Земле", "On Earth"],
  "nav.about": ["О проекте", "About"],
  "nav.ask": ["Ассистент", "Assistant"],
  "nav.jump": ["Перейти", "Go to"],
  "nav.menu": ["Меню", "Menu"],
  "nav.search": ["Поиск", "Search"],
  "nav.skip": ["Перейти к содержанию", "Skip to content"],
  "nav.top": ["Наверх", "Back to top"],
  "drawer.studies": ["24 эксперимента, рейтинг под вашу среду", "24 experiments ranked for your habitat"],
  "drawer.atmosphere": ["Калькулятор кислорода и давления", "Oxygen and pressure calculator"],
  "drawer.flight": ["Записи датчиков с МКС и Cygnus", "Sensor recordings from the ISS and Cygnus"],
  "drawer.compare": ["До четырёх исследований рядом", "Up to four investigations side by side"],
  "drawer.tables": ["22 таблицы испытаний PSI", "22 PSI test tables"],
  "drawer.earth": ["Космические технологии в пожарной охране", "Space tech in firefighting"],
  "drawer.about": ["Как устроен IGNIS и его ограничения", "How IGNIS works and its limits"],
  "drawer.ask": ["Ответы по архиву со ссылками", "Answers from the archive, with citations"],

  "common.loading": ["Загрузка…", "Loading…"],
  "common.error": ["Не удалось загрузить данные", "Could not load data"],
  "common.retry": ["Повторить", "Retry"],
  "common.close": ["Закрыть", "Close"],
  "common.open": ["Открыть", "Open"],
  "common.all": ["Все", "All"],
  "common.kpa": ["кПа", "kPa"],
  "common.fig": ["Рис.", "Fig."],
  "common.source": ["Источник", "Source"],
  "common.flight": ["Полёт", "Flight"],
  "common.ground": ["Земля", "Ground"],
  "common.csv": ["Скачать CSV", "Download CSV"],
  "common.notStated": ["нет в таблице", "not in the table"],
  "common.assumed": ["принято", "assumed"],
  "common.tests": ["испытаний", "tests"],
  "common.more": ["Подробнее", "Details"],
  "common.estimate": ["оценка", "estimate"],

  "env.label": ["Среда обитания экипажа", "Crew environment"],
  "env.assumed": ["допущение проекта", "project assumption"],

  "home.overline": ["NASA Space Apps Challenge 2026 · Flame in Freefall", "NASA Space Apps Challenge 2026 · Flame in Freefall"],
  "home.title": ["Насколько безопасен огонь в космосе?", "How safe is fire in space?"],
  "home.lead": [
    "{studies} исследований NASA о горении в невесомости, {tests} испытаний и {files} файлов сведены в одну базу. Выберите среду обитания: покажем, какие опыты к ней ближе всего и где данных пока нет.",
    "{studies} NASA microgravity combustion investigations, {tests} tests and {files} files in one database. Pick a crew environment to see which experiments come closest to it and where data is still missing.",
  ],
  "home.askPlaceholder": ["Например: как горит ПММА при 34 % кислорода?", "For example: how does PMMA burn at 34 % oxygen?"],
  "home.ask": ["Спросить", "Ask"],
  "home.askHint": [
    "Ассистент отвечает только по данным PSI. У каждого утверждения есть ссылка на файл, строку или страницу.",
    "The assistant answers from PSI data only. Every claim links to a file, row or page.",
  ],
  "home.stat.studies": ["исследований PSI", "PSI investigations"],
  "home.stat.tests": ["испытаний в таблицах", "tests in tables"],
  "home.stat.files": ["файлов, {size}", "files, {size}"],
  "home.stat.passages": ["фрагментов в поиске", "searchable passages"],
  "home.stat.traces": ["полётных записей датчиков", "flight sensor recordings"],
  "home.mapTitle": ["Где проверено, а где нет", "What has been tested — and what hasn't"],
  "home.mapLead": [
    "Каждая точка — строка из таблицы испытаний PSI: кислород и давление, при которых шёл опыт. Крестики — атмосферы, в которых будут жить экипажи. Лунная база и ровер попадают туда, где точек почти нет.",
    "Each dot is a row from a PSI test table: the oxygen and pressure of that run. Crosses mark the atmospheres crews will live in. The Moon base and rovers land where there are almost no dots.",
  ],
  "home.nearby": ["испытаний в пределах ±3 % O₂ и ±15 кПа", "tests within ±3 % O₂ and ±15 kPa"],
  "home.openAtmosphere": ["Рассчитать свою атмосферу", "Model your own atmosphere"],
  "home.topTitle": ["Что изучать для среды «{env}»", "What to read for the {env}"],
  "home.topLead": [
    "Пять исследований с самыми близкими условиями и прямой связью с пожарной безопасностью.",
    "The five investigations with the closest conditions and a direct link to fire safety.",
  ],
  "home.allStudies": ["Все исследования", "All investigations"],
  "home.flightTitle": ["Настоящий пожар на орбите", "A real fire in orbit"],
  "home.flightLead": [
    "В экспериментах Saffire NASA поджигало крупные образцы прямо в грузовом корабле Cygnus, уже отстыкованном от МКС. Ниже — запись датчиков Saffire-III: температура над образцом, кислород в отсеке, тепловой поток.",
    "In the Saffire experiments NASA set large samples on fire inside a Cygnus cargo ship after it had left the ISS. Below is the Saffire-III sensor record: temperature above the sample, cabin oxygen, heat flux.",
  ],
  "home.flightOpen": ["Все полётные записи", "All flight recordings"],
  "home.faqTitle": ["Быстрые ответы", "Quick answers"],
  "home.ctaStudies": ["Найти нужные исследования", "Find the right investigations"],
  "home.ctaFire": ["Смотреть пожар на орбите", "Watch a fire in orbit"],
  "home.envEyebrow": ["Шаг 1 · ваша среда", "Step 1 · your habitat"],
  "home.envTitle": ["Огонь в среде «{env}»", "Fire in the {env}"],
  "home.mapEyebrow": ["Шаг 2 · покрытие данными", "Step 2 · data coverage"],
  "home.topEyebrow": ["Шаг 3 · что читать", "Step 3 · what to read"],
  "home.faqEyebrow": ["Быстрые ответы", "Quick answers"],
  "home.askMore": ["Задать свой вопрос", "Ask your own question"],
  "why.eyebrow": ["Почему это важно", "Why it matters"],
  "why.title": ["Без гравитации огонь меняет форму и правила", "Without gravity, fire changes shape and rules"],
  "why.lead": [
    "На Земле горячий газ поднимается и тянет к пламени свежий воздух. На орбите конвекции нет: пламя становится голубой сферой и живёт за счёт медленной диффузии кислорода. Земные правила пожарной безопасности здесь работают плохо.",
    "On Earth hot gas rises and pulls fresh air into the flame. In orbit there is no buoyancy: the flame turns into a blue sphere fed by slow oxygen diffusion. Earth's fire-safety rules transfer poorly.",
  ],
  "why.drag": ["Потяните, чтобы сравнить одну и ту же свечу", "Drag to compare the same candle"],
  "why.v1": ["0 см/с", "0 cm/s"],
  "why.f1": ["Естественной тяги нет. Горение держится на вентиляции и диффузии, поэтому выключенный вентилятор может погасить пламя, а может и нет.", "No natural draft. Burning depends on ventilation and diffusion, so switching the fan off may or may not kill the flame."],
  "why.v2": ["≈10 см/с", "≈10 cm/s"],
  "why.f2": ["Оценка конвекции у пламени на Луне против ≈25 см/с на Земле. Измерений при 1/6 g в PSI нет.", "Estimated buoyant flow near a flame on the Moon, against ≈25 cm/s on Earth. PSI holds no 1/6 g measurements."],
  "why.v3": ["+18 %", "+18 %"],
  "why.f3": ["Настолько крупнее частицы дыма в невесомости. Датчики, настроенные на земной дым, могут его не узнать.", "How much larger smoke particles are in microgravity. Detectors tuned to Earth smoke may miss them."],
  "why.v4": ["≥ 30 %", "≥ 30 %"],
  "why.f4": ["Кислорода в атмосфере лунной базы и роверов — на 40 % больше земного. Твёрдые материалы при таком O₂ в PSI не испытаны.", "Oxygen planned for Moon bases and rovers, 40 % above Earth. PSI has no solid-material tests at that level."],
  "tl.eyebrow": ["60 лет уроков", "Sixty years of lessons"],
  "tl.title": ["От Apollo 1 до Artemis II", "From Apollo 1 to Artemis II"],
  "tl.lead": ["Каждый пожар на борту менял правила. Каждый эксперимент PSI отвечал на вопрос, который они оставили.", "Every fire aboard changed the rules. Every PSI experiment answered a question those fires left behind."],
  "tl.fire": ["пожар или авария", "fire or accident"],
  "tl.data": ["эксперимент в PSI", "experiment in PSI"],
  "tl.future": ["запланировано", "planned"],
  "gallery.eyebrow": ["Из архива PSI", "From the PSI archive"],
  "gallery.title": ["Настоящие пламёна в невесомости", "Real flames in microgravity"],
  "gallery.lead": ["Снимки с МКС и из башен сброса NASA. Каждый ведёт к исследованию, в котором его получили.", "Images from the ISS and NASA drop towers. Each one opens the investigation it came from."],
  "home.faqLead": ["Посчитаны заранее по таблицам испытаний, с источниками.", "Computed ahead of time from the test tables, with sources."],

  "hud.title": ["Пламя свечи", "Candle flame"],
  "hud.caption": [
    "Форму задаёт гравитация, яркость — кислород. Иллюстрация, а не расчёт.",
    "Gravity sets the shape, oxygen sets the brightness. An illustration, not a computation.",
  ],
  "hud.g": ["гравитация", "gravity"],
  "hud.o2": ["кислород", "oxygen"],
  "hud.p": ["давление", "pressure"],
  "hud.ppo2": ["pO₂", "pO₂"],
  "hud.buoyancy": ["конвекция ≈", "buoyant flow ≈"],
  "hud.pause": ["Остановить анимацию", "Pause animation"],
  "hud.play": ["Запустить анимацию", "Play animation"],
  "g.0": ["Орбита", "Orbit"],
  "g.moon": ["Луна", "Moon"],
  "g.mars": ["Марс", "Mars"],
  "g.earth": ["Земля", "Earth"],

  "map.x": ["Давление, кПа", "Pressure, kPa"],
  "map.y": ["Кислород, %", "Oxygen, %"],
  "map.ambient": ["кислород в камере", "chamber oxygen"],
  "map.oxidizer": ["кислород в горелке (CFI-G, Flame Design)", "oxygen in the burner (CFI-G, Flame Design)"],
  "map.assumed": ["давление не указано — 101 кПа", "pressure not stated — 101 kPa"],
  "map.env": ["среда экипажа", "crew environment"],
  "map.iso": ["pO₂ как у Земли, 21 кПа", "Earth-level pO₂, 21 kPa"],
  "map.caption": ["Условия испытаний PSI: давление против доли кислорода", "PSI test conditions: pressure against oxygen fraction"],
  "map.pointRow": ["строка {r}", "row {r}"],

  "flag.elevated_o2": [
    "Кислорода 30 % и больше. Материалы горят легче, чем на Земле, даже если парциальное давление O₂ такое же.",
    "Oxygen at 30 % or more. Materials burn more readily than on Earth even at the same O₂ partial pressure.",
  ],
  "flag.hyperoxic_pp": [
    "Парциальное давление O₂ выше 28 кПа — заметно выше земных 21 кПа.",
    "O₂ partial pressure above 28 kPa — well above Earth's 21 kPa.",
  ],
  "flag.hypoxic_pp": [
    "Парциальное давление O₂ ниже 16 кПа: экипажу понадобится дополнительный кислород.",
    "O₂ partial pressure below 16 kPa: the crew would need supplemental oxygen.",
  ],
  "flag.partial_g_gap": [
    "В PSI нет ни одного опыта при лунной или марсианской гравитации. Ответ ограничен сверху и снизу данными 0 g и 1 g; пробел должны закрыть LUCI и FM2.",
    "PSI has no tests at lunar or Martian gravity. Only 0 g and 1 g data bound the answer; LUCI and FM2 are expected to close the gap.",
  ],
  "flag.no_solid_tests": [
    "Твёрдые материалы (ткани, пластики) в PSI испытаны не выше 22 % O₂. Для этой атмосферы прямых данных по ним нет.",
    "Solid materials (fabrics, plastics) were tested in PSI at no more than 22 % O₂. There is no direct data for them in this atmosphere.",
  ],
  "flag.quiescent_sustained": [
    "Воздух почти неподвижен при повышенном O₂: в невесомости горение тогда зависит от диффузии кислорода, а не от вентиляции.",
    "Nearly still air at elevated O₂: in microgravity, burning then depends on oxygen diffusion rather than ventilation.",
  ],
  "flag.none": ["Атмосфера близка к условиям МКС, по ней больше всего данных.", "This atmosphere is close to the ISS, where most data exists."],

  "cov.data": ["данные есть", "data available"],
  "cov.partial": ["данных мало", "sparse data"],
  "cov.none": ["данных нет", "no data"],
  "cov.rows": ["испытаний рядом", "nearby tests"],
  "cov.gravity": ["гравитация не испытана", "gravity not tested"],

  "atm.title": ["Атмосфера и риск возгорания", "Atmosphere and fire risk"],
  "atm.lead": [
    "Задайте кислород, давление, гравитацию и поток воздуха. Калькулятор посчитает парциальное давление O₂, найдёт ближайшие испытания в архиве и покажет, каких данных не хватает.",
    "Set oxygen, pressure, gravity and airflow. The calculator works out the O₂ partial pressure, finds the closest tests in the archive and shows which data is missing.",
  ],
  "atm.presets": ["Готовые среды", "Presets"],
  "atm.o2": ["Кислород", "Oxygen"],
  "atm.p": ["Давление", "Pressure"],
  "atm.g": ["Гравитация", "Gravity"],
  "atm.flow": ["Поток воздуха", "Airflow"],
  "atm.ppo2": ["Парциальное давление O₂", "O₂ partial pressure"],
  "atm.ppo2Note": ["{x} от земного уровня", "{x} of Earth level"],
  "atm.equiv": ["Земной эквивалент", "Sea-level equivalent"],
  "atm.equivNote": ["столько O₂ дало бы то же pO₂ при 101 кПа", "O₂ share giving the same pO₂ at 101 kPa"],
  "atm.buoyant": ["Конвекция", "Buoyant flow"],
  "atm.buoyantNote": ["оценка 25 см/с · √g", "estimate 25 cm/s · √g"],
  "atm.matching": ["Испытаний рядом", "Nearby tests"],
  "atm.matchingNote": ["±3 % O₂ и ±15 кПа", "±3 % O₂ and ±15 kPa"],
  "atm.flags": ["Что важно для этой атмосферы", "What matters for this atmosphere"],
  "atm.nearest": ["Ближайшие испытанные условия", "Closest tested conditions"],
  "atm.nearestLead": ["Строки таблиц PSI, ближе всего к заданной точке. Нажмите, чтобы открыть строку.", "PSI table rows nearest to the chosen point. Click to open the row."],
  "atm.ranking": ["Исследования по близости условий", "Investigations by closeness of conditions"],
  "atm.coverage": ["Покрытие сред данными", "Data coverage by environment"],
  "atm.dist": ["расстояние", "distance"],

  "studies.title": ["Исследования NASA PSI", "NASA PSI investigations"],
  "studies.lead": [
    "Отсортированы под выбранную среду. Балл складывается из четырёх частей: кислород, давление, связь с пожарной безопасностью и гравитация. Каждая часть видна, чёрного ящика нет.",
    "Sorted for the chosen environment. The score has four parts: oxygen, pressure, fire-safety link and gravity. Every part is visible; there is no black box.",
  ],
  "studies.query": ["Тема: материал, датчик, явление…", "Topic: material, sensor, phenomenon…"],
  "studies.state": ["Топливо", "Fuel"],
  "studies.pillar": ["Направление", "Focus"],
  "studies.platform": ["Где проводили", "Platform"],
  "studies.group": ["Оборудование", "Hardware"],
  "studies.count": ["{n} из {total}", "{n} of {total}"],
  "studies.reset": ["Сбросить фильтры", "Reset filters"],
  "studies.compare": ["Сравнить", "Compare"],
  "studies.inCompare": ["В сравнении", "Comparing"],
  "studies.topicMatch": ["совпадение с темой", "topic match"],
  "studies.empty": ["Под такие фильтры ничего не подходит.", "Nothing matches these filters."],
  "studies.score": ["балл", "score"],

  "part.o2": ["Кислород", "Oxygen"],
  "part.p": ["Давление", "Pressure"],
  "part.safety": ["Безопасность", "Safety"],
  "part.g": ["Гравитация", "Gravity"],
  "why.match": ["невесомость совпадает", "microgravity matches"],
  "why.ground": ["наземная работа", "ground work"],
  "why.na": ["гравитация не важна", "gravity not relevant"],
  "why.efield": ["E-FIELD имитирует частичную g", "E-FIELD mimics partial g"],
  "why.partial": ["частичная g не испытана", "partial g not tested"],

  "study.record": ["Цель, методика и значение — из записи PSI (на английском)", "Objective, approach and impact from the PSI record"],
  "study.objective": ["Цель", "Objective"],
  "study.approach": ["Как проводили", "Approach"],
  "study.hypothesis": ["Гипотеза", "Hypothesis"],
  "study.impacts": ["Значение", "Impact"],
  "study.fuel": ["Топливо и образцы", "Fuel and samples"],
  "study.sensors": ["Измерения", "Measurements"],
  "study.varied": ["Что меняли", "What varied"],
  "study.safety": ["Связь с безопасностью", "Fire-safety link"],
  "study.hardware": ["Оборудование", "Hardware"],
  "study.program": ["Программа", "Programme"],
  "study.center": ["Центр NASA", "NASA centre"],
  "study.period": ["Период", "Period"],
  "study.license": ["Лицензия", "Licence"],
  "study.people": ["Исследователи", "Investigators"],
  "study.publications": ["Публикации", "Publications"],
  "study.tables": ["Таблицы испытаний", "Test tables"],
  "study.noTables": ["У этого исследования нет таблицы испытаний в PSI — только документы и сырые данные.", "This investigation has no test table in PSI — only documents and raw data."],
  "study.files": ["Файлы в архиве PSI", "Files in the PSI archive"],
  "study.timeline": ["Дни испытаний", "Test days"],
  "study.scoreFor": ["Близость к среде «{env}»", "Closeness to {env}"],
  "study.openPsi": ["Открыть в PSI", "Open in PSI"],
  "study.ask": ["Спросить про исследование", "Ask about this investigation"],
  "study.conditions": ["Условия испытаний", "Test conditions"],
  "study.o2": ["Кислород", "Oxygen"],
  "study.o2ox": ["O₂ в горелке", "O₂ in burner"],
  "study.p": ["Давление", "Pressure"],
  "study.flow": ["Поток", "Flow"],
  "study.fuels": ["Топлива", "Fuels"],
  "study.tests": ["Испытаний", "Tests"],
  "study.missing": ["{n} файлов не скачаны из PSI", "{n} files not downloaded from PSI"],
  "study.points": ["Условия этого исследования на общей карте", "This investigation on the shared map"],

  "compare.title": ["Сравнение исследований", "Compare investigations"],
  "compare.lead": [
    "До четырёх исследований рядом. Строки, где они расходятся, отмечены.",
    "Up to four investigations side by side. Rows where they differ are marked.",
  ],
  "compare.add": ["Добавить…", "Add…"],
  "compare.empty": ["Пока пусто. Отметьте исследования в списке или добавьте здесь.", "Nothing yet. Tick investigations in the list or add them here."],
  "compare.remove": ["Убрать", "Remove"],
  "compare.diffOnly": ["Только различия", "Differences only"],
  "compare.suggest": ["Например, три эксперимента Saffire", "For example, the three Saffire experiments"],

  "flight.title": ["Полётная телеметрия", "Flight telemetry"],
  "flight.lead": [
    "Калиброванные записи датчиков с МКС и корабля Cygnus, извлечённые из исходных файлов PSI. Запустите воспроизведение или ведите курсором — значения показаны из файла, без сглаживания.",
    "Calibrated sensor recordings from the ISS and the Cygnus spacecraft, extracted from the original PSI files. Press play or move the cursor — values are shown as recorded, unsmoothed.",
  ],
  "flight.play": ["Воспроизвести", "Play"],
  "flight.pause": ["Пауза", "Pause"],
  "flight.samples": ["{n} точек из {raw} отсчётов", "{n} points of {raw} samples"],
  "flight.events": ["События", "Events"],
  "flight.smokeTitle": ["В невесомости дым крупнее", "Smoke grows coarser in microgravity"],
  "flight.smokeLead": [
    "Модель распределения частиц дыма по размерам (PSI-115) для 0 g и 1 g. Без конвекции дым дольше остаётся у источника и успевает слипнуться: средний размер частиц в 0 g примерно на 18 % больше. Полосы — диапазоны, которые видят ионизационные и оптические датчики.",
    "A smoke particle-size model (PSI-115) for 0 g and 1 g. Without buoyancy smoke lingers near the source and has time to agglomerate: the mean particle size at 0 g is about 18 % larger. The bands show what ionisation and optical detectors can see.",
  ],
  "flight.smokeX": ["Диаметр частиц, нм", "Particle diameter, nm"],
  "flight.smokeY": ["Доля от максимума, %", "Share of peak, %"],
  "flight.modelTitle": ["Наборы данных для моделей", "Datasets for modelling"],
  "flight.modelLead": [
    "Таблицы с единицами СИ и номером исходной строки PSI у каждой записи. Можно сразу загружать в регрессию или проверять свою модель горения.",
    "Tables in SI units with the original PSI row number on every record. Ready for a regression or for checking your own combustion model.",
  ],
  "model.flex": ["FLEX: горение и погасание капель", "FLEX: droplet burning and extinction"],
  "model.flexNote": ["начальный и конечный диаметр, константа горения K, исход", "initial and extinction diameter, burning constant K, outcome"],
  "model.saffire": ["Saffire: невесомость против 1 g", "Saffire: microgravity versus 1 g"],
  "model.saffireNote": ["тот же материал в полёте и в наземном тесте NASA", "the same material in flight and in NASA's ground test"],
  "model.bass2": ["BASS-II: газы при горении в отсеке", "BASS-II: gases from burning in a closed box"],
  "model.bass2Note": ["O₂ до и после, прирост CO", "O₂ before and after, CO rise"],
  "model.cfig": ["CFI-G: режимы при высоком кислороде", "CFI-G: high-oxygen regimes"],
  "model.cfigNote": ["до 85 % O₂, пиковая температура, тип погасания", "up to 85 % O₂, peak temperature, how it went out"],
  "model.rows": ["{n} строк", "{n} rows"],

  "ask.title": ["Ассистент по архиву", "Archive assistant"],
  "ask.lead": [
    "Отвечает только по найденным фрагментам PSI. Ссылки [n] ведут к файлу, странице или строке таблицы, а каждое число в ответе сверяется с источниками.",
    "Answers only from retrieved PSI passages. Links [n] point to a file, page or table row, and every number in the answer is checked against the sources.",
  ],
  "ask.placeholder": ["Спросите об экспериментах…", "Ask about the experiments…"],
  "ask.send": ["Отправить", "Send"],
  "ask.simple": ["Простыми словами", "Plain words"],
  "ask.tech": ["Для инженера", "For engineers"],
  "ask.useEnv": ["с учётом среды «{env}»", "for the {env}"],
  "ask.thinking": ["Ищу в архиве и сверяю числа…", "Searching the archive and checking numbers…"],
  "ask.sources": ["Источники", "Sources"],
  "ask.noSources": ["Здесь появятся файлы, строки и страницы, на которые опирается ответ.", "Files, rows and pages behind the answer will appear here."],
  "ask.verified": ["числа сверены с источниками", "numbers match the sources"],
  "ask.unsupported": ["нет в источниках: {list}", "not in sources: {list}"],
  "ask.cited": ["ссылок: {n}", "{n} citations"],
  "ask.extractive": ["пересказ недоступен — показаны найденные фрагменты", "no summary — showing the retrieved passages"],
  "ask.none": ["в архиве ничего не найдено", "nothing found in the archive"],
  "ask.offline": [
    "Ключ языковой модели не задан. Ассистент покажет найденные фрагменты без пересказа.",
    "No language-model key is set. The assistant will show the retrieved passages without a summary.",
  ],
  "ask.error": ["Не удалось получить ответ: {e}", "Could not get an answer: {e}"],
  "ask.new": ["Новый диалог", "New conversation"],
  "ask.start": ["С чего начать", "Where to start"],
  "ask.openRow": ["открыть строку", "open row"],
  "ask.inPsi": ["в PSI", "in PSI"],
  "ask.scope": ["Вопрос о: {x}", "Asking about: {x}"],
  "ask.q1": ["Почему пламя в невесомости круглое?", "Why is a flame round in microgravity?"],
  "ask.q2": ["Какие материалы испытывали в Saffire?", "Which materials were tested in Saffire?"],
  "ask.q3": ["Как CO₂ и гелий тушат капли в FLEX?", "How do CO₂ and helium put out droplets in FLEX?"],
  "ask.q4": ["Есть ли данные для 34 % кислорода и 57 кПа?", "Is there data for 34 % oxygen at 57 kPa?"],

  "tables.title": ["Таблицы испытаний", "Test tables"],
  "tables.lead": [
    "Все 22 таблицы из PSI в исходном виде. Можно открыть, отфильтровать, выгрузить в CSV или задать вопрос по конкретной таблице.",
    "All 22 PSI test tables as published. Open, filter, export to CSV or ask a question about a specific table.",
  ],
  "tables.rows": ["строк", "rows"],
  "tables.cols": ["столбцов", "columns"],
  "tables.filter": ["Найти в таблице…", "Filter rows…"],
  "tables.ask": ["Спросить про таблицу", "Ask about this table"],
  "tables.shown": ["показано {n} из {total}", "{n} of {total} shown"],
  "tables.profile": ["Столбцы", "Columns"],
  "tables.filled": ["заполнено", "filled"],

  "earth.title": ["Что это даёт на Земле", "What it means on Earth"],
  "earth.lead": [
    "Опыты для космоса уже меняли земную пожарную технику: от водяного тумана до детекторов дыма. Здесь — какие данные PSI стоят за каждым направлением.",
    "Space fire research has already changed fire safety on Earth, from water mist to smoke detectors. Here is the PSI data behind each line of work.",
  ],
  "earth.where": ["Где пригодится", "Where it helps"],
  "earth.studies": ["Исследования PSI", "PSI investigations"],

  "about.title": ["О проекте", "About"],
  "about.lead": [
    "IGNIS — рабочее место для тех, кто проектирует пожарную безопасность обитаемых модулей. Сделано за два дня хакатона NASA Space Apps на открытых данных NASA PSI.",
    "IGNIS is a workbench for people who design fire safety for crewed habitats. Built in two days at the NASA Space Apps hackathon on open NASA PSI data.",
  ],
  "about.how": ["Как это устроено", "How it works"],
  "about.step1": ["Сбор", "Ingest"],
  "about.step1t": [
    "24 исследования из PSI: карточки, 22 таблицы испытаний, 135 документов, сырые записи датчиков. Всего 12,8 ГБ.",
    "24 PSI investigations: records, 22 test tables, 135 documents, raw sensor logs. 12.8 GB in total.",
  ],
  "about.step2": ["Нормализация", "Normalise"],
  "about.step2t": [
    "Для каждой таблицы своё правило: кислород в %, давление в кПа, поток в см/с, даты в ISO. Исходные ячейки сохраняются рядом.",
    "One rule per table: oxygen in %, pressure in kPa, flow in cm/s, dates in ISO. The original cells are kept alongside.",
  ],
  "about.step3": ["Индекс", "Index"],
  "about.step3t": [
    "SQLite с полнотекстовым поиском по строкам таблиц, страницам PDF и описаниям, плюс русско-английский словарь терминов.",
    "SQLite full-text search over table rows, PDF pages and descriptions, plus a Russian–English glossary of terms.",
  ],
  "about.step4": ["Ответ", "Answer"],
  "about.step4t": [
    "Модель видит только найденные фрагменты и обязана ссылаться на них. Затем код проверяет ссылки и ищет каждое число в источниках.",
    "The model sees only retrieved passages and must cite them. Code then checks the citations and looks up every number in the sources.",
  ],
  "about.limits": ["Ограничения", "Limitations"],
  "about.limit1": [
    "В PSI нет данных при частичной гравитации. Всё про Луну и Марс — это границы между 0 g и 1 g, а не измерения.",
    "PSI has no partial-gravity data. Everything about the Moon and Mars is bounded by 0 g and 1 g, not measured.",
  ],
  "about.limit2": [
    "Атмосфера марсианской базы — допущение проекта: в условии задачи она не задана.",
    "The Mars-base atmosphere is our assumption: the challenge does not specify one.",
  ],
  "about.limit3": [
    "Часть файлов PSI не скачана ({n}); они перечислены в карточках исследований.",
    "Some PSI files were not downloaded ({n}); they are listed on the investigation pages.",
  ],
  "about.limit4": [
    "Балл близости — прозрачная эвристика для сортировки, а не оценка риска.",
    "The closeness score is a transparent heuristic for sorting, not a risk assessment.",
  ],
  "about.data": ["Данные", "Data"],
  "about.built": ["База собрана {date}", "Database built {date}"],
  "about.model": ["Языковые модели", "Language models"],
  "about.noModel": ["не подключены", "not connected"],
  "about.team": ["Команда", "Team"],
  "about.api": ["Открытый API", "Open API"],
  "about.apiText": [
    "Все данные сайта доступны через REST: /api/studies, /api/tables, /api/points, /api/workbench, /api/simulate. Описание — на /docs.",
    "Everything on the site is available over REST: /api/studies, /api/tables, /api/points, /api/workbench, /api/simulate. See /docs.",
  ],

  "palette.placeholder": ["Исследование, таблица или раздел…", "Investigation, table or section…"],
  "palette.hint": ["↑↓ выбрать · Enter открыть · Esc закрыть", "↑↓ select · Enter open · Esc close"],
  "palette.section": ["раздел", "section"],
  "palette.study": ["исследование", "study"],
  "palette.table": ["таблица", "table"],

  "footer.about": [
    "Рабочее место по пожарной безопасности для обитаемых модулей на данных NASA PSI.",
    "A fire-safety workbench for crewed habitats, built on NASA PSI data.",
  ],
  "footer.sections": ["Разделы", "Sections"],
  "footer.data": ["Данные", "Data"],
  "footer.project": ["Проект", "Project"],
  "footer.fine": [
    "Сделано для NASA Space Apps Challenge 2026. Не является официальным ресурсом NASA. Данные: NASA Physical Sciences Informatics, CC0.",
    "Built for the NASA Space Apps Challenge 2026. Not an official NASA resource. Data: NASA Physical Sciences Informatics, CC0.",
  ],
  "footer.askCta": ["Спросить архив", "Ask the archive"],
  "footer.built": ["база от", "database"],
  "footer.psi": ["Репозиторий PSI", "PSI repository"],
  "footer.api": ["Документация API", "API docs"],
  "footer.challenge": ["Условие задачи", "Challenge statement"],
} satisfies Record<string, [string, string]>;

export type Key = keyof typeof dict;
export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: Key, params?: Params): string {
  let text = dict[key][lang === "ru" ? 0 : 1];
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export const pick = (lang: Lang, value: L10n | string | null | undefined) =>
  value == null ? "" : typeof value === "string" ? value : value[lang] || value.en;

const locale = (lang: Lang) => (lang === "ru" ? "ru-RU" : "en-US");

export function fmtNum(lang: Lang, value: number | null | undefined, digits?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const d = digits ?? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: d }).format(value);
}

export function fmtRange(lang: Lang, range: [number, number] | null | undefined, unit = ""): string {
  if (!range) return "—";
  const [a, b] = range;
  const tail = unit ? ` ${unit}` : "";
  return a === b ? `${fmtNum(lang, a)}${tail}` : `${fmtNum(lang, a)}–${fmtNum(lang, b)}${tail}`;
}

export function fmtBytes(lang: Lang, bytes: number): string {
  const units = lang === "ru" ? ["Б", "КБ", "МБ", "ГБ", "ТБ"] : ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${fmtNum(lang, v, v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function fmtDate(lang: Lang, iso: string | null | undefined, withDay = true): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(lang), {
    year: "numeric",
    month: "short",
    ...(withDay ? { day: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}

export function fmtYears(start: string | null, end: string | null): string {
  const a = start?.slice(0, 4);
  const b = end?.slice(0, 4);
  if (!a && !b) return "—";
  if (!b || a === b) return a ?? b ?? "—";
  return `${a ?? "?"}–${b}`;
}
