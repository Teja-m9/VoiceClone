"""Stage 3 — FFmpeg remix. Pure function: (converted vocal, instrumental) -> final mp3.

Mixes the converted vocal over the instrumental, loudness-normalizes to broadcast level,
and (for the free tier) mixes in a faint periodic watermark tone."""
import os
import subprocess


class MixError(RuntimeError):
    pass

# Loudness targets (LUFS). The cloned vocal sits a touch above the instrumental so the
# voice is clear but still blends with the music (a "medium" balance — not blasting, not
# buried). Widen the gap (lower INSTRUMENTAL_LUFS) for a louder vocal, narrow it to blend more.
VOCAL_LUFS = "-15"
INSTRUMENTAL_LUFS = "-18"


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise MixError(f"ffmpeg failed: {proc.stderr[-500:]}")


def remix(
    converted_vocal: str,
    instrumental: str,
    watermark: bool,
    workdir: str,
    preview: bool = False,
) -> str:
    out_path = os.path.join(workdir, "cover.mp3")
    # Free tier → trim the output to a 30s preview; premium → full track.
    trim = ["-t", "30"] if preview else []

    # Clean + level the cloned vocal: FFT denoise removes hiss/artifacts (the stray "beep"
    # buzz), a gentle compressor lifts quiet moments so it never drops out, and loudnorm sets
    # it a touch above the instrumental for a balanced, blended mix.
    balance = (
        f"[0:a]afftdn=nr=12:nf=-30,highpass=f=70,"
        f"loudnorm=I={VOCAL_LUFS}:TP=-1.5,"
        "acompressor=threshold=-20dB:ratio=3:attack=20:release=250:makeup=2,"
        "dynaudnorm=f=250:g=4[v];"
        f"[1:a]loudnorm=I={INSTRUMENTAL_LUFS}:TP=-2[m];"
    )

    if watermark:
        # Vocal-over-music balance, then a faint 1kHz attribution tone, then final loudnorm.
        filter_complex = (
            balance
            + "[v][m]amix=inputs=2:duration=longest:normalize=0[mix];"
            "sine=frequency=1000:duration=0.12[b];"
            "[b]aloop=loop=-1:size=2.4e6,volume=0.018[wm];"
            "[mix][wm]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[out]"
        )
    else:
        filter_complex = (
            balance
            + "[v][m]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[out]"
        )

    cmd = [
        "ffmpeg", "-y", "-i", converted_vocal, "-i", instrumental,
        "-filter_complex", filter_complex, "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "192k", *trim, out_path,
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
