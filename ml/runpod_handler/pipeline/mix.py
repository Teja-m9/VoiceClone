"""Stage 3 — FFmpeg remix. Pure function: (converted vocal, instrumental) -> final mp3.

Mixes the converted vocal over the instrumental, loudness-normalizes to broadcast level,
and (for the free tier) mixes in a faint periodic watermark tone."""
import os
import subprocess


class MixError(RuntimeError):
    pass


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise MixError(f"ffmpeg failed: {proc.stderr[-500:]}")


def remix(converted_vocal: str, instrumental: str, watermark: bool, workdir: str) -> str:
    out_path = os.path.join(workdir, "cover.mp3")

    if watermark:
        # Faint 1kHz beep every ~12s, mixed at low volume as an audible attribution mark.
        filter_complex = (
            "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[mix];"
            "sine=frequency=1000:duration=0.15[b];"
            "[b]aloop=loop=-1:size=2.4e6,volume=0.06[wm];"
            "[mix][wm]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[out]"
        )
        cmd = [
            "ffmpeg", "-y", "-i", converted_vocal, "-i", instrumental,
            "-filter_complex", filter_complex, "-map", "[out]",
            "-c:a", "libmp3lame", "-b:a", "192k", out_path,
        ]
    else:
        filter_complex = (
            "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[out]"
        )
        cmd = [
            "ffmpeg", "-y", "-i", converted_vocal, "-i", instrumental,
            "-filter_complex", filter_complex, "-map", "[out]",
            "-c:a", "libmp3lame", "-b:a", "192k", out_path,
        ]

    _run(cmd)
    if not os.path.exists(out_path):
        raise MixError("ffmpeg produced no output")
    return out_path


def probe_duration_ms(path: str) -> int:
    proc = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    try:
        return int(float(proc.stdout.strip()) * 1000)
    except (ValueError, TypeError):
        return 0
