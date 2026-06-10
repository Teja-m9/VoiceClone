"""Stage 3 — FFmpeg remix. Pure function: (converted vocal, instrumental) -> final mp3.

Mixes the converted vocal over the instrumental, loudness-normalizes to broadcast level,
and (for the free tier) mixes in a faint periodic watermark tone."""
import os
import subprocess


class MixError(RuntimeError):
    pass

# Loudness targets (LUFS). Vocal and instrumental sit at the SAME level so the cloned
# voice merges into the background track rather than sitting loudly on top of it. Lower
# VOCAL_LUFS (e.g. -17) to push the voice further back into the mix; raise it for a more
# upfront lead vocal.
VOCAL_LUFS = "-16"
INSTRUMENTAL_LUFS = "-16"


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

    # Studio-style vocal chain so the cloned voice sounds *produced* and sits inside the song
    # instead of pasted on top:
    #   afftdn         — remove hiss/artifacts (kills the stray "beep" buzz)
    #   highpass       — clear low-end rumble out of the vocal
    #   equalizer/treble — tame mud (~250Hz), add presence (~3kHz) + air (~9kHz) like a mixed vocal
    #   loudnorm       — sit a touch above the instrumental (balanced, blended)
    #   acompressor + dynaudnorm — even, never-dropping level
    #   aecho          — a subtle room so the vocal shares the song's space (not bone-dry)
    balance = (
        # Clean first: rumble cut → strong FFT denoise → noise gate (silences the hiss in the
        # gaps between phrases so leveling can't pump it back up).
        "[0:a]highpass=f=80,afftdn=nr=20:nf=-25,"
        "agate=threshold=0.015:ratio=2:attack=10:release=200,"
        # Tone: de-mud, presence, air.
        "equalizer=f=250:width_type=o:w=1:g=-2,"
        "equalizer=f=3000:width_type=o:w=1:g=2,"
        "treble=g=2:f=9000,"
        # Level GENTLY so the noise floor isn't amplified (lower makeup + gentler dynaudnorm).
        f"loudnorm=I={VOCAL_LUFS}:TP=-1.5,"
        "acompressor=threshold=-20dB:ratio=3:attack=20:release=250:makeup=1,"
        "dynaudnorm=f=400:g=2,"
        "aecho=0.8:0.85:45:0.18[v];"
        f"[1:a]loudnorm=I={INSTRUMENTAL_LUFS}:TP=-2[m];"
    )

    # Final master: glue the mix and limit peaks so the whole track sounds finished/loud.
    master = "loudnorm=I=-14:TP=-1.5,alimiter=limit=0.95"

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
