"""Cloud entry point. Keep launch.py as the local Windows launcher."""
import os

from backend.server import Handler, LocalHTTPServer


def main():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "7860"))
    with LocalHTTPServer((host, port), Handler) as server:
        print(f"Heartward listening on {host}:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
