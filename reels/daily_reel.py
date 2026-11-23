#!/usr/bin/env python3
"""Daily anime Reel: intro + next episode + outro, published to Instagram.

Each run:
  1. Picks the next episode that has not been posted yet (natural order:
     1, 2, ... 10, 11).
  2. Joins intro + episode + outro into one vertical 1080x1920 video.
  3. Uploads it to Instagram as a Reel (Instagram Graph API, resumable upload)
     and records it in state.json so it is not posted again.

Episodes, intro and outro are read from the "episodes" GitHub Release
(assets named intro.mp4, outro.mp4, 001.mp4, 002.mp4, ...) and/or from the
local folder reels/episodes/. Only the Python standard library and ffmpeg
are needed.

Environment:
  IG_USER_ID       Instagram professional account ID
  IG_ACCESS_TOKEN  access token with instagram_content_publish permission
  GH_TOKEN         (in GitHub Actions) used by the gh CLI to read the release

Usage:
  python3 reels/daily_reel.py            # build and publish
  python3 reels/daily_reel.py --dry-run  # build only, do not publish
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
STATE_PATH = ROOT / "state.json"
CAPTIONS_PATH = ROOT / "captions.json"
WORK_DIR = ROOT / "work"
OUT_DIR = ROOT / "out"

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
W, H, FPS = 1080, 1920, 30


def log(msg):
    print(msg, flush=True)


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def is_episode(name):
    p = Path(name)
    return p.suffix.lower() in VIDEO_EXTS and p.stem.lower() not in ("intro", "outro")


# ---------------------------------------------------------------- sources

def release_assets(tag):
    """Names of assets in the GitHub release `tag`, or [] if unavailable."""
    if not tag or not shutil.which("gh"):
        return []
    r = subprocess.run(
        ["gh", "api", f"repos/{{owner}}/{{repo}}/releases/tags/{tag}",
         "--paginate", "--jq", ".assets[].name"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        log(f"Note: could not read release '{tag}': {r.stderr.strip()}")
        return []
    return [n for n in r.stdout.splitlines() if n.strip()]


def release_download(tag, name, dest_dir):
    dest_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["gh", "release", "download", tag, "-p", name, "-D", str(dest_dir), "--clobber"],
        check=True,
    )
    return dest_dir / name


class Sources:
    def __init__(self, cfg):
        self.tag = cfg.get("release_tag", "episodes")
        self.local_dir = ROOT / cfg.get("episodes_dir", "episodes")
        self.assets = release_assets(self.tag)

    def local_files(self):
        if not self.local_dir.is_dir():
            return []
        return [p.name for p in self.local_dir.iterdir() if p.is_file()]

    def episodes(self):
        names = set(n for n in self.local_files() if is_episode(n))
        names |= set(n for n in self.assets if is_episode(n))
        return sorted(names, key=natural_key)

    def find(self, stem):
        """Find intro/outro by stem in any video extension."""
        for n in self.local_files() + self.assets:
            if Path(n).stem.lower() == stem and Path(n).suffix.lower() in VIDEO_EXTS:
                return n
        return None

    def fetch(self, name):
        local = self.local_dir / name
        if local.is_file():
            return local
        if name in self.assets:
            log(f"Downloading {name} from release '{self.tag}'...")
            return release_download(self.tag, name, WORK_DIR)
        fail(f"File not found: {name}")


# ---------------------------------------------------------------- video

def has_audio(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
         "stream=index", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return bool(r.stdout.strip())


def duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


def video_chain(i, fit):
    """Filter that turns input i into a 1080x1920 30fps frame labelled [v{i}]."""
    if fit == "blur":
        # Blurred, zoomed copy of the video fills the background; the full
        # frame sits in the middle (nicer than black bars for 16:9 anime).
        return (
            f"[{i}:v]split=2[bg{i}][fg{i}];"
            f"[bg{i}]scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},boxblur=20:2,eq=brightness=-0.08[bgb{i}];"
            f"[fg{i}]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs{i}];"
            f"[bgb{i}][fgs{i}]overlay=(W-w)/2:(H-h)/2,"
            f"setsar=1,fps={FPS},format=yuv420p[v{i}]"
        )
    if fit == "crop":
        return (
            f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},setsar=1,fps={FPS},format=yuv420p[v{i}]"
        )
    # "pad": black bars
    return (
        f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={FPS},format=yuv420p[v{i}]"
    )


def build_reel(parts, out_path, fit):
    """Concatenate `parts` (paths) into one Reel-ready MP4."""
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats"]
    for p in parts:
        cmd += ["-i", str(p)]

    filters, concat_in = [], []
    extra = len(parts)
    silent_inputs = []
    for i, p in enumerate(parts):
        filters.append(video_chain(i, fit))
        if has_audio(p):
            filters.append(
                f"[{i}:a]aresample=48000,aformat=sample_fmts=fltp:"
                f"channel_layouts=stereo[a{i}]"
            )
        else:
            # Silent track of the same length so concat stays in sync.
            silent_inputs += ["-f", "lavfi", "-t", f"{duration(p):.3f}",
                              "-i", "anullsrc=r=48000:cl=stereo"]
            filters.append(f"[{extra}:a]aformat=sample_fmts=fltp:"
                           f"channel_layouts=stereo[a{i}]")
            extra += 1
        concat_in.append(f"[v{i}][a{i}]")
    cmd += silent_inputs
    filters.append("".join(concat_in) + f"concat=n={len(parts)}:v=1:a=1[v][a]")

    cmd += [
        "-filter_complex", ";".join(filters),
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-g", str(FPS * 2),
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        str(out_path),
    ]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(cmd, check=True)
    return out_path


# ---------------------------------------------------------------- Instagram

class InstagramError(Exception):
    pass


class Instagram:
    def __init__(self, user_id, token, version):
        self.user_id = user_id
        self.token = token
        self.version = version
        self.base = f"https://graph.facebook.com/{version}"

    def _request(self, method, url, params=None, data=None, headers=None):
        headers = dict(headers or {})
        if params is not None:
            params = dict(params, access_token=self.token)
            if method == "GET":
                url += "?" + urllib.parse.urlencode(params)
            else:
                data = urllib.parse.urlencode(params).encode()
                headers["Content-Type"] = "application/x-www-form-urlencoded"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            try:
                err = json.loads(body).get("error", {})
                msg = f"{err.get('message')} (code {err.get('code')}, subcode {err.get('error_subcode')})"
            except ValueError:
                msg = body[:500]
            raise InstagramError(f"HTTP {e.code}: {msg}") from None

    def create_container(self, caption, share_to_feed):
        return self._request("POST", f"{self.base}/{self.user_id}/media", params={
            "media_type": "REELS",
            "upload_type": "resumable",
            "caption": caption,
            "share_to_feed": "true" if share_to_feed else "false",
        })

    def upload(self, container_id, upload_uri, path):
        size = path.stat().st_size
        uri = upload_uri or (
            f"https://rupload.facebook.com/ig-api-upload/{self.version}/{container_id}"
        )
        with open(path, "rb") as f:
            res = self._request("POST", uri, data=f, headers={
                "Authorization": f"OAuth {self.token}",
                "offset": "0",
                "file_size": str(size),
                "Content-Length": str(size),
                "Content-Type": "application/octet-stream",
            })
        if not res.get("success", True):
            raise InstagramError(f"Upload failed: {res}")

    def wait_ready(self, container_id, timeout_s=45 * 60):
        start = time.time()
        while time.time() - start < timeout_s:
            res = self._request("GET", f"{self.base}/{container_id}",
                                params={"fields": "status_code,status"})
            code = res.get("status_code")
            log(f"  processing status: {code}")
            if code == "FINISHED":
                return
            if code in ("ERROR", "EXPIRED"):
                raise InstagramError(f"Instagram could not process the video: {res.get('status')}")
            time.sleep(20)
        raise InstagramError("Timed out waiting for Instagram to process the video")

    def publish(self, container_id):
        res = self._request("POST", f"{self.base}/{self.user_id}/media_publish",
                            params={"creation_id": container_id})
        media_id = res["id"]
        try:
            info = self._request("GET", f"{self.base}/{media_id}",
                                 params={"fields": "permalink"})
            return media_id, info.get("permalink")
        except InstagramError:
            return media_id, None


# ---------------------------------------------------------------- main

def make_caption(cfg, captions, episode, number):
    stem = Path(episode).stem
    entry = captions.get(stem) or captions.get(episode) or {}
    if isinstance(entry, str):
        entry = {"title": entry}
    if entry.get("caption"):
        return entry["caption"]
    text = cfg["caption_template"].format(
        n=number, title=entry.get("title", ""),
        series=cfg.get("series_name", ""), file=stem,
    )
    lines = [ln.strip() for ln in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="build the video but do not publish")
    ap.add_argument("--episode", help="post this file instead of the next one")
    args = ap.parse_args()

    cfg = load_json(CONFIG_PATH, None)
    if cfg is None:
        fail(f"Missing {CONFIG_PATH}")
    state = load_json(STATE_PATH, {"posted": []})
    captions = load_json(CAPTIONS_PATH, {})
    posted = {p["file"] for p in state["posted"]}

    src = Sources(cfg)
    episodes = src.episodes()
    if not episodes:
        fail("No episodes found. Upload them to the 'episodes' release "
             "(001.mp4, 002.mp4, ...) or put them in reels/episodes/.")

    if args.episode:
        if args.episode not in episodes:
            fail(f"Episode '{args.episode}' not found. Available: {', '.join(episodes)}")
        episode = args.episode
    else:
        remaining = [e for e in episodes if e not in posted]
        if not remaining:
            log("All episodes have been posted. Nothing to do today.")
            return
        episode = remaining[0]
    number = episodes.index(episode) + 1
    log(f"Episode {number}/{len(episodes)}: {episode}")

    intro_name = src.find("intro")
    outro_name = src.find("outro")
    if not intro_name and not outro_name:
        log("Warning: no intro/outro found, posting the episode alone.")
    parts = []
    if intro_name:
        parts.append(src.fetch(intro_name))
    parts.append(src.fetch(episode))
    if outro_name:
        parts.append(src.fetch(outro_name))

    out = OUT_DIR / f"reel-{Path(episode).stem}.mp4"
    log("Joining intro + episode + outro...")
    build_reel(parts, out, cfg.get("fit", "blur"))
    total = duration(out)
    size_mb = out.stat().st_size / 1e6
    log(f"Built {out.name}: {total:.1f}s, {size_mb:.1f} MB")

    max_s = cfg.get("max_seconds", 900)
    if total > max_s:
        fail(f"Video is {total:.0f}s, longer than the Reels limit ({max_s}s). "
             "Shorten the episode, or split it into parts (e.g. 005a.mp4, 005b.mp4).")

    caption = make_caption(cfg, captions, episode, number)
    log("Caption:\n" + caption)

    if args.dry_run:
        log("Dry run: not publishing.")
        return

    user_id = os.environ.get("IG_USER_ID", "").strip()
    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not user_id or not token:
        fail("IG_USER_ID and IG_ACCESS_TOKEN must be set (GitHub repository secrets).")

    ig = Instagram(user_id, token, cfg.get("graph_api_version", "v21.0"))
    try:
        log("Creating Reel container...")
        c = ig.create_container(caption, cfg.get("share_to_feed", True))
        log("Uploading video...")
        ig.upload(c["id"], c.get("uri"), out)
        log("Waiting for Instagram to process the video...")
        ig.wait_ready(c["id"])
        log("Publishing...")
        media_id, link = ig.publish(c["id"])
    except InstagramError as e:
        fail(str(e))

    log(f"Published! {link or media_id}")
    state["posted"].append({
        "file": episode,
        "number": number,
        "media_id": media_id,
        "permalink": link,
        "posted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    save_json(STATE_PATH, state)


if __name__ == "__main__":
    main()
