"""R2/S3 IO over presigned URLs (no credentials). Streamed to keep memory low."""
import requests


def download(url: str, dest_path: str) -> str:
    """Download a presigned/public URL to a local path."""
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                f.write(chunk)
    return dest_path


def upload_put(path: str, presigned_url: str, content_type: str) -> None:
    """Upload a local file to a presigned PUT URL."""
    with open(path, "rb") as f:
        res = requests.put(
            presigned_url, data=f, headers={"Content-Type": content_type}, timeout=180
        )
    res.raise_for_status()
