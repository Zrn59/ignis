#!/usr/bin/env python3
"""Download NASA microgravity combustion databases for the Space Apps challenge.

Source: NASA Physical Sciences Informatics (PSI), research area Combustion Science.
Official challenge resource list is not published yet (statements open Oct 28, 2026);
PSI is the public archive of the ISS/microgravity flame experiments named in the
challenge (FLEX, ACME, BASS, SAFFIRE, SAME, SPICE, SLICE, CFI, and related studies).

The full PSI combustion archive is about 13.5 TB, almost all of it camera frames
and video packed in zip files. This script keeps the databases and written
findings:

  * tables and arrays: csv, tsv, xls, xlsx, txt, json, xml, mat, hdf, nc, ...
  * analyzed numerical grids (text .dat under Analyzed Data)
  * reports, papers, and slide decks: pdf, doc, ppt, ...
  * the small metadata zip and the investigation record (objectives, results, DOI)

It does not download photos, video, camera-raw .dat files, or the multi-terabyte
raw-image archives.

Nothing in this script deletes files. If free space would fall below
--min-free-gb (default 20), it stops and leaves what is already on disk.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from requests.utils import quote

PSI = "https://psi.nasa.gov"
USER_AGENT = "pre-nasa-combustion-downloader/1.0"
SEARCH_PAGE = 50

DATA_EXT = {
    ".csv", ".tsv", ".tab", ".txt", ".dat",
    ".xls", ".xlsx", ".xlsm", ".xlsb", ".ods",
    ".json", ".xml",
    ".nc", ".cdf", ".h5", ".hdf", ".hdf5",
    ".mat", ".npy", ".npz", ".parquet",
    ".sql", ".sqlite", ".db",
}
DOC_EXT = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".rtf", ".md", ".eps"}
MEDIA_EXT = {
    ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".bmp", ".webp",
    ".heic", ".svg", ".nef", ".cr2", ".arw", ".dng", ".raw", ".psd",
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm", ".m4v", ".mpg",
    ".mpeg", ".mp3", ".wav",
}
ARCHIVE_EXT = {".zip", ".7z", ".tar", ".gz", ".tgz", ".rar", ".bz2", ".xz"}

# File-list keys on the investigation record. They repeat the file tree and can
# be very large; the science text is what we keep in investigation.json.
DROP_META_KEYS = {"added", "removed", "modified", "images"}


def log(msg: str) -> None:
    print(msg, flush=True)


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def encode_query(params: dict) -> str:
    return "&".join(
        f"{quote(str(key), safe='')}={quote(str(value), safe='')}"
        for key, value in params.items()
    )


def nasa_token() -> str:
    return os.environ.get("NASA_TOKEN") or os.environ.get("NASA_TOKE") or ""


def is_nasa_host(url: str) -> bool:
    host = url.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0].lower()
    return host == "nasa.gov" or host.endswith(".nasa.gov")


def auth_headers(url: str) -> dict[str, str]:
    token = nasa_token()
    if token and is_nasa_host(url):
        return {"Authorization": f"Bearer {token}"}
    return {}


def make_session() -> requests.Session:
    """One session per thread. requests keeps the TCP connection and TLS session."""
    session = requests.Session()
    adapter = HTTPAdapter(pool_connections=8, pool_maxsize=4, pool_block=True)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers["User-Agent"] = USER_AGENT
    return session


_thread_state = threading.local()
_main_session: requests.Session | None = None


def http() -> requests.Session:
    if threading.current_thread() is threading.main_thread():
        global _main_session
        if _main_session is None:
            _main_session = make_session()
        return _main_session
    session = getattr(_thread_state, "session", None)
    if session is None:
        session = make_session()
        _thread_state.session = session
    return session


def get_json(url: str, timeout: int = 180) -> dict:
    response = http().get(url, headers=auth_headers(url), timeout=(20, timeout))
    response.raise_for_status()
    return response.json()


def post_json(url: str, payload: dict, timeout: int = 600) -> dict:
    response = http().post(url, json=payload, headers=auth_headers(url), timeout=(20, timeout))
    response.raise_for_status()
    return response.json()


def free_bytes(path: Path) -> int:
    return shutil.disk_usage(path).free


def human(n: float) -> str:
    step = 0
    value = float(n)
    for step, unit in enumerate(["B", "KB", "MB", "GB", "TB"]):
        if abs(value) < 1024 or unit == "TB":
            break
        value /= 1024
    else:
        unit = "TB"
    if step == 0:
        return f"{int(value)} {unit}"
    return f"{value:.2f} {unit}"


def list_investigations() -> list[dict]:
    found: list[dict] = []
    start = 0
    total = None
    while True:
        query = encode_query(
            {
                "type": "investigation",
                "size": SEARCH_PAGE,
                "from": start,
                "ffield": "Research Area",
                "fvalue": "Combustion Science",
                "sort": "Accession",
                "order": "asc",
            }
        )
        payload = get_json(f"{PSI}/geode-py/ws/repo/search?{query}")
        hits = payload.get("hits", {})
        raw_total = hits.get("total", 0)
        total = raw_total.get("value", raw_total) if isinstance(raw_total, dict) else raw_total
        batch = hits.get("hits") or []
        if not batch:
            break
        for hit in batch:
            found.append(hit.get("_source") or {})
        start += len(batch)
        if start >= int(total):
            break
    unique = {}
    for row in found:
        acc = row.get("Accession")
        if acc:
            unique[acc] = row
    return [unique[k] for k in sorted(unique, key=lambda a: int(a.split("-")[-1]))]


def walk_files(nodes: list, acc: list) -> None:
    for node in nodes:
        children = node.get("files") or []
        if children:
            walk_files(children, acc)
            continue
        key = node.get("key") or ""
        if node.get("directory") or key.endswith("/"):
            continue
        acc.append(node)


def extension_of(name: str) -> str:
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def classify(node: dict) -> tuple[str, str]:
    """Return (decision, reason). decision is 'keep' or 'skip'."""
    if node.get("restricted"):
        return "skip", "restricted"
    key = (node.get("key") or "").replace("\\", "/")
    name = key.rsplit("/", 1)[-1]
    ext = extension_of(name)
    low_key = key.lower()
    size = int(float(node.get("bytes_size") or 0))

    if "/metadata/" in low_key and ext in ARCHIVE_EXT and size <= 100 * 1024 * 1024:
        return "keep", "metadata_archive"
    if ext in MEDIA_EXT:
        return "skip", "photo_or_video"
    if ext in ARCHIVE_EXT:
        return "skip", "raw_archive"
    if ext == ".dat" and "/analyzed data/" not in low_key:
        # SLICE stores Nikon D300S frames in numeric .dat files (~42 GB).
        return "skip", "camera_dat"
    if ext in DATA_EXT or ext in DOC_EXT:
        return "keep", "database" if ext in DATA_EXT else "document"
    return "skip", "not_a_database"


def relative_path(accession: str, key: str) -> Path:
    key = key.replace("\\", "/")
    marker = f"/{accession}/"
    if marker in key:
        rel = key.split(marker, 1)[1]
    else:
        rel = key.rsplit("/", 1)[-1]
    parts = [p for p in rel.split("/") if p not in ("", ".", "..")]
    if not parts:
        raise ValueError(f"empty relative path for {key}")
    return Path(*parts)


def presigned_url(accession: str, node: dict, study_version: int) -> str:
    file_id = node.get("id") or node.get("_id") or (node.get("key") or "").rsplit("/", 1)[-1]
    params = encode_query(
        {
            "file": str(file_id),
            "version": str(node.get("version") or ""),
            "studyVersion": str(study_version),
            "redirect": "false",
        }
    )
    url = f"{PSI}/geode-py/ws/studies/{quote(accession, safe='')}/download?{params}"
    response = http().get(url, headers=auth_headers(url), timeout=(20, 120))
    response.raise_for_status()
    text = response.text.strip()
    if not text.startswith("http"):
        raise RuntimeError(f"PSI did not return a download URL: {text[:240]}")
    return text


def download_url(url: str, dest: Path, timeout: int = 180) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_name(dest.name + ".part")
    written = 0
    # No NASA token here: this URL is a presigned S3 link, and an extra
    # Authorization header makes S3 reject it. The thread session still
    # reuses its TCP connection to the bucket.
    with http().get(url, stream=True, timeout=(20, timeout)) as response:
        response.raise_for_status()
        with partial.open("wb") as out:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                out.write(chunk)
                written += len(chunk)
    os.replace(partial, dest)
    return written


class DiskGuard:
    def __init__(self, root: Path, min_free: int) -> None:
        self.root = root
        self.min_free = min_free
        self._lock = threading.Lock()
        self._inflight = 0
        self.stopped = False
        self.stop_reason = ""

    def reserve(self, nbytes: int) -> bool:
        with self._lock:
            if self.stopped:
                return False
            free = free_bytes(self.root)
            if free - self._inflight - nbytes < self.min_free:
                self.stopped = True
                self.stop_reason = (
                    f"Stopping: after this file less than "
                    f"{human(self.min_free)} would be left free. Free now: {human(free)}, "
                    f"file size {human(nbytes)}. Nothing was deleted."
                )
                return False
            self._inflight += max(nbytes, 0)
            return True

    def release(self, nbytes: int) -> None:
        with self._lock:
            self._inflight = max(0, self._inflight - max(nbytes, 0))


_manifest_lock = threading.Lock()


def append_jsonl(path: Path, row: dict) -> None:
    line = json.dumps(row, ensure_ascii=False) + "\n"
    with _manifest_lock:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(line)


def already_complete(dest: Path, expected: int) -> bool:
    if not dest.is_file():
        return False
    size = dest.stat().st_size
    if size <= 0:
        return False
    # A file on disk was written only after the HTTP body finished. PSI's
    # catalog size is sometimes stale, so a different non-empty size still counts.
    return True


def fetch_one(job: dict, guard: DiskGuard, manifest: Path, retries: int) -> dict:
    dest: Path = job["dest"]
    expected = job["bytes"]
    row = {
        "accession": job["accession"],
        "path": str(dest),
        "bytes": expected,
        "reason": job["reason"],
        "key": job["key"],
    }
    if already_complete(dest, expected):
        row["status"] = "exists"
        append_jsonl(manifest, row)
        return row
    if not guard.reserve(expected):
        row["status"] = "stopped_disk"
        append_jsonl(manifest, row)
        return row
    try:
        last_error = ""
        for attempt in range(1, retries + 1):
            try:
                url = presigned_url(job["accession"], job["node"], job["study_version"])
                written = download_url(url, dest)
                row["status"] = "downloaded"
                row["bytes_written"] = written
                if expected and written != expected:
                    row["size_note"] = f"catalog {expected}, saved {written}"
                append_jsonl(manifest, row)
                return row
            except Exception as exc:  # noqa: BLE001 - retry network/API failures per file
                last_error = f"{type(exc).__name__}: {exc}"
                time.sleep(min(8, attempt * 2))
        row["status"] = "failed"
        row["error"] = last_error[:500]
        append_jsonl(manifest, row)
        return row
    finally:
        guard.release(expected)


def save_investigation(out_dir: Path, record: dict) -> None:
    slim = {k: v for k, v in record.items() if k not in DROP_META_KEYS}
    dest = out_dir / "investigation.json"
    dest.write_text(json.dumps(slim, ensure_ascii=False, indent=2), encoding="utf-8")


def process_investigation(source: dict, out_root: Path, guard: DiskGuard, manifest: Path, workers: int, retries: int, dry_run: bool) -> dict:
    accession = source["Accession"]
    log(f"\n== {accession} {source.get('Acronym') or ''} ==")
    record = get_json(f"{PSI}/geode-py/ws/repo/investigations/{quote(accession, safe='')}")
    version = int(record.get("version") or 0)
    folder = out_root / accession
    folder.mkdir(parents=True, exist_ok=True)
    save_investigation(folder, record)
    files_disabled = bool(record.get("filesDisabled"))
    for key in DROP_META_KEYS:
        record.pop(key, None)

    summary = {
        "accession": accession,
        "title": record.get("title") or source.get("Title"),
        "acronym": record.get("investigationAcronym") or source.get("Acronym"),
        "project_type": record.get("projectType") or source.get("Project Type"),
        "doi": record.get("doi"),
        "version": version,
        "psi_total_bytes": record.get("totalFileSize") or 0,
        "keep_bytes": 0,
        "keep_files": 0,
        "skip_bytes": {},
        "skip_files": {},
        "downloaded": 0,
        "exists": 0,
        "failed": 0,
        "stopped_disk": 0,
    }
    if files_disabled:
        summary["files_disabled"] = True
        log("  files of this version are disabled in PSI, only investigation.json was saved")
        return summary

    tree = post_json(
        f"{PSI}/geode-py/ws/files/v2",
        {
            "folder": f"{accession}/",
            "fileType": "study",
            "studyId": accession,
            "version": version,
            "obfuscationcode": "",
        },
    )
    nodes: list = []
    walk_files(tree.get("files") or [], nodes)
    del tree

    jobs = []
    for node in nodes:
        decision, reason = classify(node)
        size = int(float(node.get("bytes_size") or 0))
        if decision != "keep":
            summary["skip_bytes"][reason] = summary["skip_bytes"].get(reason, 0) + size
            summary["skip_files"][reason] = summary["skip_files"].get(reason, 0) + 1
            continue
        key = node.get("key") or ""
        try:
            rel = relative_path(accession, key)
        except ValueError:
            summary["skip_bytes"]["bad_path"] = summary["skip_bytes"].get("bad_path", 0) + size
            summary["skip_files"]["bad_path"] = summary["skip_files"].get("bad_path", 0) + 1
            continue
        summary["keep_bytes"] += size
        summary["keep_files"] += 1
        jobs.append(
            {
                "accession": accession,
                "node": {
                    "id": node.get("id") or node.get("_id"),
                    "version": node.get("version"),
                    "key": key,
                },
                "study_version": version,
                "dest": folder / rel,
                "bytes": size,
                "reason": reason,
                "key": key,
            }
        )
    del nodes
    log(
        f"  to download: {summary['keep_files']} files, {human(summary['keep_bytes'])}; "
        f"skipped archives/media: {human(sum(summary['skip_bytes'].values()))}"
    )
    if dry_run or guard.stopped:
        return summary

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fetch_one, job, guard, manifest, retries) for job in jobs]
        done = 0
        for future in as_completed(futures):
            result = future.result()
            status = result["status"]
            summary[status] = summary.get(status, 0) + 1
            done += 1
            if status == "failed":
                log(f"  error {result['path']}: {result.get('error', '')[:180]}")
            if done % 25 == 0 or done == len(futures):
                log(f"  progress {done}/{len(futures)}")
    if guard.stopped and guard.stop_reason:
        log(guard.stop_reason)
    return summary


def write_catalog(out_root: Path, dry_run: bool, guard: DiskGuard, summaries: list[dict]) -> None:
    catalog = {
        "source": PSI,
        "research_area": "Combustion Science",
        "challenge": "Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data",
        "dry_run": dry_run,
        "stopped_for_disk": guard.stopped,
        "stop_reason": guard.stop_reason,
        "investigations": summaries,
        "keep_bytes": sum(item.get("keep_bytes", 0) for item in summaries),
        "keep_files": sum(item.get("keep_files", 0) for item in summaries),
    }
    (out_root / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Download NASA PSI combustion databases (no photos or video).")
    parser.add_argument("--out", default="data", help="output folder (default: data, relative to this script)")
    parser.add_argument("--env", default=".env", help="file with NASA_TOKEN")
    parser.add_argument("--min-free-gb", type=float, default=20.0, help="stop if free disk space would drop below this many GB")
    parser.add_argument("--workers", type=int, default=20)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true", help="only count the size, download nothing")
    parser.add_argument("--only", default="", help="comma-separated PSI ids, e.g. PSI-69,PSI-98")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    load_dotenv(root / args.env)
    token_name = "NASA_TOKEN" if os.environ.get("NASA_TOKEN") else ("NASA_TOKE" if os.environ.get("NASA_TOKE") else "")
    if token_name:
        log(f"{token_name} loaded. PSI serves these files without auth; the key is only sent to nasa.gov hosts if asked.")
    else:
        log("No Earthdata key found. Public PSI does not need one, continuing.")

    out_root = Path(args.out)
    if not out_root.is_absolute():
        out_root = root / out_root
    out_root.mkdir(parents=True, exist_ok=True)
    min_free = int(args.min_free_gb * 1024 ** 3)
    log(f"Folder: {out_root}")
    log(f"Workers: {args.workers}. Each has its own requests session, so connections to PSI and S3 are reused between files.")
    log(f"Free now: {human(free_bytes(out_root))}. Stop threshold: {human(min_free)}.")

    investigations = list_investigations()
    if args.only:
        wanted = {item.strip() for item in args.only.split(",") if item.strip()}
        investigations = [row for row in investigations if row.get("Accession") in wanted]
    log(f"Combustion Science investigations: {len(investigations)}")
    if not investigations:
        log("PSI returned no investigations. Check the network and try again.")
        return 1

    manifest = out_root / "manifest.jsonl"
    guard = DiskGuard(out_root, min_free)
    summaries = []
    for source in investigations:
        if guard.stopped:
            break
        try:
            summaries.append(
                process_investigation(source, out_root, guard, manifest, args.workers, args.retries, args.dry_run)
            )
        except Exception as exc:  # noqa: BLE001 - one bad investigation should not drop the rest
            log(f"  could not process {source.get('Accession')}: {type(exc).__name__}: {exc}")
            summaries.append({"accession": source.get("Accession"), "error": str(exc)})
        write_catalog(out_root, args.dry_run, guard, summaries)

    catalog = json.loads((out_root / "catalog.json").read_text(encoding="utf-8"))
    log(
        f"\nDone. Data and documents: {catalog['keep_files']} files, {human(catalog['keep_bytes'])}."
    )
    if guard.stopped:
        log(guard.stop_reason)
        log("Run the same command again to resume: files already on disk with the right size are skipped.")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
