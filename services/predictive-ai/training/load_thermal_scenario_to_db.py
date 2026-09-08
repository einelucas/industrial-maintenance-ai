"""Wrapper do carregador TypeScript que usa o service real do Next.js.

Dry-run por padrão. As flags são repassadas sem acesso direto do Python ao DB.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from training.thermal_dataset_contract import repository_root

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--allow-existing", action="store_true")
    parser.add_argument("--include-post-action", action="store_true")
    args = parser.parse_args()
    root = repository_root()
    command = ["node", "node_modules/tsx/dist/cli.mjs", "scripts/load-reserved-thermal-scenario.ts"]
    if args.apply: command.append("--apply")
    if args.allow_existing: command.append("--allow-existing")
    if args.include_post_action: command.append("--include-post-action")
    subprocess.run(command, cwd=root / "apps/web", check=True)

if __name__ == "__main__":
    main()
