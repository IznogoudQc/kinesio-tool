"""
Workaround pour electron-builder sur Windows sans Developer Mode.

Le problème : electron-builder télécharge winCodeSign-2.6.0.7z qui contient des
liens symboliques macOS (libcrypto.dylib, libssl.dylib). Créer des symlinks sur
Windows nécessite SeCreateSymbolicLinkPrivilege (Developer Mode ou Admin).

Ce script crée le répertoire de cache final attendu par electron-builder à partir
d'une extraction partielle existante (les symlinks manquants ne sont pas nécessaires
pour les builds Windows).

Usage : python3 scripts/fix-wincodesign-cache.py
"""

import os
import shutil
import glob

CACHE_DIR = os.path.expanduser(
    r"~\AppData\Local\electron-builder\Cache\winCodeSign"
)
FINAL_DIR = os.path.join(CACHE_DIR, "winCodeSign-2.6.0")


def find_partial_extraction():
    """Trouve un répertoire de tentative partielle (numéro sans extension .7z)."""
    entries = [
        e for e in os.listdir(CACHE_DIR)
        if e.isdigit() and os.path.isdir(os.path.join(CACHE_DIR, e))
    ]
    if not entries:
        return None
    # Prend le plus récent
    entries.sort(key=lambda e: os.path.getmtime(os.path.join(CACHE_DIR, e)), reverse=True)
    return os.path.join(CACHE_DIR, entries[0])


def main():
    if not os.path.isdir(CACHE_DIR):
        print(f"Cache dir not found: {CACHE_DIR}")
        print("Run 'npm run dist' once first to trigger the download, then re-run this script.")
        return

    if os.path.isdir(FINAL_DIR):
        print(f"Cache already exists: {FINAL_DIR}")
        print("npm run dist should work. If not, delete the dir and re-run this script.")
        return

    src = find_partial_extraction()
    if src is None:
        print("No partial extraction found. Run 'npm run dist' once first (it will fail), then re-run this script.")
        return

    print(f"Copying {src} → {FINAL_DIR}")
    shutil.copytree(src, FINAL_DIR)

    items = os.listdir(FINAL_DIR)
    print(f"Done. Cache contains: {', '.join(items)}")
    print("You can now run: npm run dist")


if __name__ == "__main__":
    main()
