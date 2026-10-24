"""Edit the captured local UI into a captioned walkthrough and a short GIF.

Optional dependency: python -m pip install imageio-ffmpeg
Run after scripts/media/capture.mjs. No AI services, music, or external assets.
"""
import hashlib
import json
import subprocess
from pathlib import Path
import imageio_ffmpeg

WORK = Path(".local/media-20261024")
OUT = Path("docs/media")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
capture = json.loads((WORK / "capture.json").read_text(encoding="utf-8"))


def run(args):
    completed = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *map(str, args)],
        capture_output=True, text=True, encoding="utf-8",
    )
    if completed.returncode:
        raise RuntimeError(completed.stderr[-6000:])


def probe(filename):
    frames = imageio_ffmpeg.read_frames(str(filename))
    try:
        return next(frames)
    finally:
        frames.close()


parts = []
chapters = []
cursor = 0.0
for scene in capture["scenes"]:
    raw = Path(scene["raw"])
    info = probe(raw)
    start = max(0, min(scene["start"], info["duration"] - scene["duration"] - 0.04))
    duration = round(min(scene["duration"], info["duration"] - start) * 25) / 25
    scene["editStart"] = start
    scene["editDuration"] = duration
    part = WORK / (scene["id"] + "-edited.mp4")
    fade_in = "" if scene["id"] == "01-home" else "fade=t=in:st=0:d=0.18:color=0xfff8e8,"
    filters = (
        "[1:v]scale=1088:680:flags=lanczos,fps=25,setpts=PTS-STARTPTS[screen];"
        "[0:v][screen]overlay=455:124:shortest=1:format=auto,"
        f"{fade_in}"
        f"fade=t=out:st={max(0, duration - 0.18):.3f}:d=0.18:color=0xfff8e8,"
        "format=yuv420p[out]"
    )
    run([
        "-loop", "1", "-framerate", "25", "-i", WORK / ("frame-" + scene["id"] + ".png"),
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", raw,
        "-filter_complex_threads", "2", "-filter_complex", filters, "-map", "[out]",
        "-t", f"{duration:.3f}", "-an", "-c:v", "libx264", "-preset", "medium",
        "-crf", "25", "-threads", "4", "-r", "25", "-movflags", "+faststart", part,
    ])
    actual = probe(part)["duration"]
    chapters.append({"id": scene["id"], "start": round(cursor, 3), "end": round(cursor + actual, 3)})
    cursor += actual
    parts.append(part)
    print(json.dumps({"rendered": part.name, "seconds": actual}), flush=True)

outro = WORK / "05-outro-edited.mp4"
run([
    "-loop", "1", "-framerate", "25", "-i", WORK / "outro.png", "-t", "7",
    "-vf", "fade=t=in:st=0:d=0.2:color=0xfff8e8,format=yuv420p", "-an",
    "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-threads", "4",
    "-r", "25", "-movflags", "+faststart", outro,
])
parts.append(outro)
chapters.append({"id": "05-contribute", "start": round(cursor, 3), "end": round(cursor + 7, 3)})
concat = WORK / "concat.txt"
concat.write_text("\n".join("file '" + p.resolve().as_posix() + "'" for p in parts) + "\n", encoding="utf-8")
movie = WORK / "chiboshi-walkthrough.mp4"
run(["-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-movflags", "+faststart", movie])
if movie.stat().st_size >= 9_500_000:
    small = WORK / "chiboshi-walkthrough-small.mp4"
    run(["-i", movie, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "29",
         "-threads", "4", "-pix_fmt", "yuv420p", "-movflags", "+faststart", small])
    small.replace(movie)

comparison = next(s for s in capture["scenes"] if s["id"] == "03-compare")
gif_duration = min(12.0, comparison["editDuration"] - 2.5)
gif = OUT / "preview.gif"
gif_filters = (
    "[1:v]fps=8,scale=900:562:flags=lanczos,setpts=PTS-STARTPTS[screen];"
    "[0:v][screen]overlay=30:114:shortest=1,split[a][b];"
    "[a]palettegen=max_colors=96:stats_mode=diff[p];"
    "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[out]"
)
run([
    "-loop", "1", "-framerate", "8", "-i", WORK / "gif-frame.png",
    "-ss", f'{comparison["editStart"] + 2.5:.3f}', "-t", f"{gif_duration:.3f}",
    "-i", comparison["raw"], "-filter_complex_threads", "1",
    "-filter_complex", gif_filters, "-map", "[out]", "-t", f"{gif_duration:.3f}",
    "-loop", "0", gif,
])

text = {
    "01-home": "Chiboshi connects numbers and units with familiar objects.",
    "02-reference": "Start with a familiar reference. This dictionary example puts an ant at about 5 mm.",
    "03-compare": "Compare a deliberately implausible 5 m estimate, then change it to 5 mm. The length becomes 1,000 times smaller.",
    "04-capacity": "Explore capacity with familiar containers. Compare 550 mL, 1 L, and 1.5 L.",
    "05-contribute": "Run locally. Explore the source. Improve explanations, translations, and accessibility.",
}


def stamp(seconds, separator="."):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{separator}{ms:03d}"


vtt = ["WEBVTT", ""]
srt = []
for i, chapter in enumerate(chapters, 1):
    caption = text[chapter["id"]]
    vtt.extend([f'{stamp(chapter["start"])} --> {stamp(chapter["end"])}', caption, ""])
    srt.extend([str(i), f'{stamp(chapter["start"], ",")} --> {stamp(chapter["end"], ",")}', caption, ""])
(OUT / "walkthrough.en.vtt").write_text("\n".join(vtt), encoding="utf-8")
(OUT / "walkthrough.en.srt").write_text("\n".join(srt), encoding="utf-8")
teaser = WORK / "chiboshi-unit-change.mp4"
run(["-i", WORK / "03-compare-edited.mp4", "-c", "copy", "-movflags", "+faststart", teaser])
teaser_info = probe(teaser)
info = probe(movie)
assert info["size"] == (1600, 900), info
assert 44 < info["duration"] < 65, info
assert movie.stat().st_size < 10_000_000
assert gif.stat().st_size < 5_000_000

metadata = {
    "capturedAt": capture["capturedAt"], "sourceCommit": capture["sourceCommit"],
    "interfaceLanguage": "zh-CN", "annotationsLanguage": "en",
    "providerConfigured": False, "responseInterception": False,
    "comparisonSource": "fallback", "pageErrors": capture["pageErrors"],
    "video": {"width": 1600, "height": 900, "fps": info["fps"], "seconds": info["duration"],
              "codec": info["codec"], "bytes": movie.stat().st_size,
              "sha256": hashlib.sha256(movie.read_bytes()).hexdigest(), "audio": False},
    "preview": {"seconds": gif_duration, "width": 960, "height": 720, "bytes": gif.stat().st_size},
    "teaser": {"seconds": teaser_info["duration"], "bytes": teaser.stat().st_size,
               "sha256": hashlib.sha256(teaser.read_bytes()).hexdigest()},
    "chapters": chapters, "comparisons": capture["comparisons"],
}
(OUT / "capture-metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=True), flush=True)
