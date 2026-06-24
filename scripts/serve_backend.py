from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=False, host="127.0.0.1", port=5000)
