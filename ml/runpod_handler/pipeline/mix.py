"""Stage 3 — FFmpeg remix. Pure function: (converted vocal, instrumental) -> final mp3.

Mixes the converted vocal over the instrumental, loudness-normalizes to broadcast level,
and (for the free tier) mixes in a faint periodic watermark tone."""
import os
import subprocess


class MixError(RuntimeError):
    pass

INSTRUMENTAL_LUFS = "-16"

# Vocal-vs-music balance the user can choose. Louder = vocal sits more on top; softer =
# it blends back into the music. (Instrumental stays at -16.)
VOCAL_LEVELS = {"soft": "-19", "balanced": "-16", "loud": "-12"}

# Style presets — each sets the vocal's TONE EQ and its reverb/space.
STYLES = {
    # clean, present, modern — a subtle single-tap room (no muddy double-echo)
    "studio": {
        "tone": "equalizer=f=250:width_type=o:w=1:g=-2,equalizer=f=3000:width_type=o:w=1:g=2,treble=g=2:f=9000",
        "space": "aecho=0.85:0.88:40:0.1",
    },
    # bigger hall / concert ambience
    "live": {
        "tone": "equalizer=f=250:width_type=o:w=1:g=-1,equalizer=f=3000:width_type=o:w=1:g=2,treble=g=1:f=9000",
        "space": "aecho=0.8:0.9:60|180|320:0.3|0.22|0.14",
    },
    # warm, dull, vintage — rolled-off highs
    "lofi": {
        "tone": "equalizer=f=300:width_type=o:w=1:g=-1,lowpass=f=3600,treble=g=-3:f=8000",
        "space": "aecho=0.7:0.8:50:0.15",
    },
    # lush, heavy reverb
    "reverb": {
        "tone": "equalizer=f=250:width_type=o:w=1:g=-2,equalizer=f=3000:width_type=o:w=1:g=2,treble=g=2:f=9000",
        "space": "aecho=0.8:0.95:80|200|400:0.45|0.32|0.2",
    },
}


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
    vocal_level: str = "balanced",
    style: str = "studio",
) -> str:
    out_path = os.path.join(workdir, "cover.mp3")
    # Free tier → trim the output to a 30s preview; premium → full track.
    trim = ["-t", "30"] if preview else []

    vlufs = VOCAL_LEVELS.get(vocal_level, VOCAL_LEVELS["balanced"])
    preset = STYLES.get(style, STYLES["studio"])

    # Vocal chain: gentle denoise → rumble cut → style TONE EQ → level (user's balance) →
    # soft compress → smooth → style SPACE (reverb).
    balance = (
        # nr=16 cleans the separated-vocal artifacts (esp. the original parts kept in
        # selective mode); highpass clears rumble.
        "[0:a]afftdn=nr=16:nf=-28,highpass=f=70,"
        f"{preset['tone']},"
        f"loudnorm=I={vlufs}:TP=-1.5,"
        "acompressor=threshold=-20dB:ratio=3:attack=20:release=250:makeup=2,"
        "dynaudnorm=f=250:g=4,"
        f"{preset['space']}[v];"
        f"[1:a]loudnorm=I={INSTRUMENTAL_LUFS}:TP=-2[m];"
    )

    # Final master: glue + limit, then a short fade-in to kill any start click/noise.
    master = "loudnorm=I=-14:TP=-1.5,alimiter=limit=0.95,afade=t=in:st=0:d=0.12"

    if watermark:
        # Vocal-over-music balance, then a faint 1kHz attribution tone, then final master.
        filter_complex = (
            balance
            + "[v][m]amix=inputs=2:duration=longest:normalize=0[mix];"
            "sine=frequency=1000:duration=0.12[b];"
            "[b]aloop=loop=-1:size=2.4e6,volume=0.018[wm];"
            f"[mix][wm]amix=inputs=2:duration=first:normalize=0,{master}[out]"
        )
    else:
        filter_complex = (
            balance
            + f"[v][m]amix=inputs=2:duration=longest:normalize=0,{master}[out]"
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
