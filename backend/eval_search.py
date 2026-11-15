"""A quick check of search quality: python -m backend.eval_search

Each question comes with the investigations a person would expect to see. A question passes
when one of them is among the first sources the assistant gets. Questions about a measured
value (marked "row") also need an actual table row or column statistics among the sources,
because a PDF that merely mentions the value is not enough to quote a number.
No model is called, so this runs offline in a couple of seconds.
"""

from __future__ import annotations

from .ai import Assistant
from .search import Index, parse

CASES: list[tuple[str, str, set[str]] | tuple[str, str, set[str], str]] = [
    ("ru", "Как гасили пламя в FLEX?", {"PSI-69"}),
    ("ru", "При каком кислороде горела ткань в Saffire?", {"PSI-98", "PSI-99", "PSI-100"}),
    ("ru", "Что будет с огнём на Луне при 34% кислорода и 57 кПа?", {"PSI-159", "PSI-69", "PSI-10", "PSI-20"}, "row"),
    ("ru", "Какие датчики дыма проверяли?", {"PSI-101", "PSI-102", "PSI-115"}),
    ("ru", "Почему пламя в невесомости круглое?", {"PSI-10", "PSI-23", "PSI-107", "PSI-69"}),
    ("ru", "Сколько угарного газа выделялось в BASS-II?", {"PSI-25"}, "row"),
    ("ru", "огнетушитель водяной туман", {"PSI-20", "PSI-98"}),
    ("ru", "сажа в пламени", {"PSI-10", "PSI-21", "PSI-60", "PSI-107"}),
    ("ru", "холодные пламёна при высоком кислороде", {"PSI-159", "PSI-39", "PSI-142"}),
    ("ru", "Как электрическое поле меняет пламя?", {"PSI-22"}),
    ("ru", "пыль на станции", {"PSI-47"}),
    ("en", "What is the extinction diameter of heptane droplets with CO2?", {"PSI-69", "PSI-68"}, "row"),
    ("en", "Which material burned fastest in BASS?", {"PSI-26", "PSI-25", "PSI-62"}, "row"),
    ("en", "smoke particle size", {"PSI-101", "PSI-102", "PSI-115"}),
    ("en", "lifted flames in co-flow", {"PSI-106", "PSI-21"}),
    ("en", "largest fire in a spacecraft", {"PSI-98", "PSI-99", "PSI-100"}),
    ("en", "burning rate emulator", {"PSI-20"}),
    ("en", "candle flame shape", {"PSI-10", "PSI-23"}),
    ("ru", "Сколько длился самый долгий тест FLEX?", {"PSI-69"}, "row"),
    ("en", "highest oxygen tested in CFI-G", {"PSI-159"}, "row"),
    ("ru", "какая скорость потока была в SAME-R", {"PSI-101"}, "row"),
]


def main(top: int = 4) -> None:
    index = Index()
    assistant = Assistant(index)
    passed = rows_needed = rows_found = 0
    for lang, question, expected, *flags in CASES:
        sources = assistant.gather(parse(question), lang, "iss", None, None)
        got = [s["study"] for s in sources[:top] if s["study"]]
        ok = bool(expected & set(got))
        if "row" in flags:
            rows_needed += 1
            has_row = any(s["kind"] in ("row", "table") and s["study"] in expected for s in sources[:8])
            rows_found += has_row
            ok = ok and has_row
        passed += ok
        print(f"{'ok  ' if ok else 'MISS'} {question[:58]:58} {', '.join(dict.fromkeys(got)) or '-'}")
    print(f"\n{passed}/{len(CASES)} passed; table data found for {rows_found}/{rows_needed} questions about measured values")


if __name__ == "__main__":
    main()
