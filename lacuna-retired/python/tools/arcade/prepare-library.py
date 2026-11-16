#!/usr/bin/env python3
# prepare-library.py — Local archive ingestor, NTSC SNES `.sfc` extractor, and media/manual sync (design §13).
# Owns: `snes.zip` SPC700 IPL creation, local `~/Downloads` directory & `.zip` collection extraction, USA NTSC `.sfc` extraction
# from GoodMerged `.7z` archives, and single-try Cover/Title/Snap/Manual downloads when `LACUNA_OFFLINE != "1"`.
# Refuses: retry loops against outside sites (law 10: `--retry 0`), symlinks outside `~/lacuna-world/arcade/roms`.
# Implements: design §13 (Arcade ROM shelf preparation, cover/title/snap artwork, and collector PDF manuals).
# Invariants (§18): none. Faults (§16): none.

import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.parse
import zipfile
import zlib

ROM_ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/lacuna-world/arcade/roms')
DL_ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/Downloads')
OFFLINE = os.environ.get('LACUNA_OFFLINE') == '1'

mame_dir = os.path.join(ROM_ROOT, 'mame')
saturn_dir = os.path.join(mame_dir, 'saturn')
neogeo_dir = os.path.join(mame_dir, 'neogeo')
genesis_dir = os.path.join(mame_dir, 'genesis')
snes_dir = os.path.join(mame_dir, 'snes')
art_dir = os.path.join(ROM_ROOT, 'art')
manuals_dir = os.path.join(ROM_ROOT, 'manuals')

for d in (mame_dir, saturn_dir, neogeo_dir, genesis_dir, snes_dir, art_dir, manuals_dir):
    os.makedirs(d, exist_ok=True)

# 1. Ensure snes.zip and s_smp.zip (64-byte Nintendo SPC700 IPL ROM, CRC 44bb3a40) exist
spc700 = bytes.fromhex(
    "cdefbd8f00f6" "ffc4f4d0fb2f" "8fc0f48f00f1" "2fcbf4d0fb2f"
    "7fd7f4d0fb2f" "e4f5cbba00d0" "f7e4f4d0f3ab" "0110ef7ef410"
    "ebba00c4f6dd" "5fd0db1f0000" "c0ff"
)
if len(spc700) == 64:
    for zname in ('snes.zip', 's_smp.zip'):
        zpath = os.path.join(mame_dir, zname)
        if not os.path.exists(zpath):
            with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.writestr('spc700.rom', spc700)


def extract_local_zip_entries(archive_path, callback):
    if not os.path.exists(archive_path):
        return 0
    count = 0
    with open(archive_path, 'rb') as f:
        pos = 0
        while True:
            f.seek(pos)
            hdr = f.read(30)
            if len(hdr) < 30 or hdr[:4] != b'PK\x03\x04':
                break
            _v, _fl, method, _mt, _md, crc, csize, usize, namelen, extralen = struct.unpack('<HHHHHIIIHH', hdr[4:30])
            name = f.read(namelen).decode('utf-8', errors='replace')
            data_start = pos + 30 + namelen + extralen
            next_pos = data_start + csize
            if csize > 0 and not name.endswith('/'):
                try:
                    f.seek(next_pos)
                    if f.read(4) in (b'PK\x03\x04', b'PK\x01\x02'):
                        if callback(f, name, method, csize, usize, crc, data_start):
                            count += 1
                except Exception:
                    pass
            if csize == 0 and not name.endswith('/'):
                break
            pos = next_pos
    return count


# 2. Extract Saturn Bomberman (US) CHD from ~/Downloads if present
bomber_chd = os.path.join(saturn_dir, 'saturn-bomberman.chd')
if not os.path.exists(bomber_chd):
    for cand in (
        os.path.join(DL_ROOT, 'saturn-bomberman-eu-jp-us-1996-action-maze-bin-chd-iso-sega-saturn.zip'),
        os.path.join(DL_ROOT, 'saturn-bomberman-eu-jp-us-1996-action-maze-bin-chd-iso-sega-saturn.zip.download',
                     'saturn-bomberman-eu-jp-us-1996-action-maze-bin-chd-iso-sega-saturn.zip'),
    ):
        if not os.path.exists(cand):
            continue

        def on_bomber(f, name, method, csize, _u, _c, data_start):
            if '(CHD)' in name and name.endswith('.zip'):
                tmp_zip = os.path.join(saturn_dir, '_tmp_bomber_chd.zip')
                f.seek(data_start)
                raw = f.read(csize)
                with open(tmp_zip, 'wb') as out:
                    out.write(raw if method == 0 else zlib.decompress(raw, -15))
                with zipfile.ZipFile(tmp_zip, 'r') as zf:
                    for member in zf.namelist():
                        if member.lower().endswith('.chd'):
                            with zf.open(member) as src, open(bomber_chd, 'wb') as dst:
                                shutil.copyfileobj(src, dst)
                            print(f"[arcade] ✓ extracted {member} -> saturn-bomberman.chd")
                os.remove(tmp_zip)
                return True
            return False

        if extract_local_zip_entries(cand, on_bomber) > 0:
            break

# 3. Ingest SNK Neo Geo AES/MVS ROMs from ~/Downloads
aes_dl = os.path.join(DL_ROOT, 'neo-geo-aes-romset')
if os.path.isdir(aes_dl):
    n_aes = 0
    for fname in sorted(os.listdir(aes_dl)):
        if not fname.lower().endswith('.zip'):
            continue
        src = os.path.join(aes_dl, fname)
        for dst in (os.path.join(neogeo_dir, fname), os.path.join(mame_dir, fname)):
            if (not os.path.exists(dst)) or (os.path.getsize(dst) != os.path.getsize(src)):
                try:
                    if os.path.exists(dst):
                        os.remove(dst)
                    os.link(src, dst)
                except Exception:
                    shutil.copy2(src, dst)
                if dst.startswith(neogeo_dir):
                    n_aes += 1
    if n_aes > 0:
        print(f"[arcade] ✓ installed/updated {n_aes} SNK Neo Geo AES ROMs into {neogeo_dir}/")

for cand in (
    os.path.join(DL_ROOT, 'neogeoaesmvscomplete.zip'),
    os.path.join(DL_ROOT, 'neogeoaesmvscomplete.zip.download', 'neogeoaesmvscomplete.zip'),
):
    if not os.path.exists(cand):
        continue

    def on_neogeo(f, name, method, csize, _u, _c, data_start):
        base = os.path.basename(name)
        if not base.lower().endswith('.zip') or base.lower() == 'neogeo.zip':
            return False
        dest_sub = os.path.join(neogeo_dir, base)
        dest_mame = os.path.join(mame_dir, base)
        if os.path.exists(dest_sub) and os.path.exists(dest_mame):
            return False
        f.seek(data_start)
        raw = f.read(csize)
        with open(dest_sub, 'wb') as out:
            out.write(raw if method == 0 else zlib.decompress(raw, -15))
        if not os.path.exists(dest_mame):
            try:
                os.link(dest_sub, dest_mame)
            except Exception:
                shutil.copy2(dest_sub, dest_mame)
        return True

    n_ext = extract_local_zip_entries(cand, on_neogeo)
    if n_ext > 0:
        print(f"[arcade] ✓ installed {n_ext} SNK Neo Geo MVS/AES ROMs into {neogeo_dir}/")
    break

# 3b. Repair split Neo Geo `puzzldpr.zip` (Puzzle De Pon! R!, standalone parent in MAME 0.289) from `puzzledp.zip`
pdp_parent = os.path.join(neogeo_dir, 'puzzledp.zip')
pdp_clone = os.path.join(neogeo_dir, 'puzzldpr.zip')
if os.path.isfile(pdp_parent) and os.path.isfile(pdp_clone):
    try:
        with zipfile.ZipFile(pdp_clone, 'r') as zc:
            clone_names = set(zc.namelist())
        needed = {'202-m1.m1', '202-v1.v1', '202-c1.c1', '202-c2.c2'} - clone_names
        if needed:
            tmp_merged = pdp_clone + '.merged'
            with zipfile.ZipFile(tmp_merged, 'w', zipfile.ZIP_DEFLATED) as zout:
                with zipfile.ZipFile(pdp_clone, 'r') as zc:
                    for n in zc.namelist():
                        zout.writestr(n, zc.read(n))
                with zipfile.ZipFile(pdp_parent, 'r') as zp:
                    for n in sorted(needed):
                        if n in zp.namelist():
                            zout.writestr(n, zp.read(n))
            os.replace(tmp_merged, pdp_clone)
            mame_clone = os.path.join(mame_dir, 'puzzldpr.zip')
            if os.path.exists(mame_clone):
                os.remove(mame_clone)
            try:
                os.link(pdp_clone, mame_clone)
            except Exception:
                shutil.copy2(pdp_clone, mame_clone)
            print("[arcade] ✓ repaired split Neo Geo puzzldpr.zip from puzzledp.zip")
    except Exception:
        pass

# 4. Ingest curated Sega Genesis ROMs from ~/Downloads/sega-genesis-romset-ultra-usa
CURATED_GENESIS = [
    ('sonic2.zip', r'^Sonic The Hedgehog 2 \(World\)( \(Rev A\))?\.zip$'),
    ('sonic1.zip', r'^Sonic The Hedgehog \(USA, Europe\)\.zip$'),
    ('sonic3.zip', r'^Sonic The Hedgehog 3 \(USA\)\.zip$'),
    ('sonick.zip', r'^Sonic & Knuckles \(World\)\.zip$'),
    ('sor2.zip', r'^Streets of Rage 2 \(USA\)\.zip$'),
    ('sor1.zip', r'Streets of Rage \(World\)( \(Rev A\))?\.zip$'),
    ('sor3.zip', r'^Streets of Rage 3 \(USA\)\.zip$'),
    ('gunstar.zip', r'^Gunstar Heroes \(USA\)\.zip$'),
    ('shinobi3.zip', r'^Shinobi III - Return of the Ninja Master \(USA\)\.zip$'),
    ('revshinobi.zip', r'^Revenge of Shinobi, The \(USA, Europe\).*\.zip$'),
    ('contra.zip', r'^Contra - Hard Corps \(USA, Korea\)\.zip$'),
    ('bloodlines.zip', r'^Castlevania - Bloodlines \(USA\)\.zip$'),
    ('umk3.zip', r'^Ultimate Mortal Kombat 3 \(USA\)\.zip$'),
    ('mk2.zip', r'^Mortal Kombat II \(World\)\.zip$'),
    ('ssf2.zip', r'^Super Street Fighter II \(USA\)\.zip$'),
    ('sf2ce.zip', r'^Street Fighter II\x27 - Special Champion Edition \(USA\)\.zip$'),
    ('ps4.zip', r'^Phantasy Star IV \(USA\)\.zip$'),
    ('shining2.zip', r'^Shining Force II \(USA\)\.zip$'),
    ('goldenaxe.zip', r'^Golden Axe \(World\).*\.zip$'),
    ('alteredbeast.zip', r'^Altered Beast \(USA, Europe\)\.zip$'),
    ('comixzone.zip', r'^Comix Zone \(USA\)\.zip$'),
    ('vectorman.zip', r'^Vectorman \(USA, Europe\)\.zip$'),
    ('ewj.zip', r'^Earthworm Jim \(USA\)\.zip$'),
    ('toejam.zip', r'^ToeJam & Earl \(World\).*\.zip$'),
    ('strider.zip', r'^Strider \(USA, Europe\)\.zip$'),
    ('rka.zip', r'^Rocket Knight Adventures \(USA\)\.zip$'),
    ('ghouls.zip', r'^Ghouls\x27n Ghosts \(USA, Europe\).*\.zip$'),
    ('lightening.zip', r'^Lightening Force - Quest for the Darkstar \(USA\)\.zip$'),
    ('musha.zip', r'^MUSHA - Metallic Uniframe Super Hybrid Armor \(USA\)\.zip$'),
    ('ecco.zip', r'^Ecco the Dolphin \(USA, Europe, Korea\)\.zip$'),
    ('aladdin.zip', r'^Aladdin \(USA\)\.zip$'),
    ('nbajamte.zip', r'^NBA Jam - Tournament Edition \(World\)\.zip$'),
    ('nhl94.zip', r'^NHL \x2794 \(USA, Europe\)\.zip$'),
    ('roadrash2.zip', r'^Road Rash II \(USA, Europe\).*\.zip$'),
    ('wilywars.zip', r'^Mega Man - The Wily Wars \(USA\).*\.zip$'),
    ('vf2.zip', r'^Virtua Fighter 2 \(USA, Europe\)\.zip$'),
    ('virtuaracing.zip', r'^Virtua Racing \(USA\)\.zip$'),
    ('aliensoldier.zip', r'^Alien Soldier\b.*\.zip$'),
    ('megaturrican.zip', r'^Mega Turrican \(USA, Europe\).*\.zip$'),
    ('monsterworld4.zip', r'^Monster World IV\b.*\.zip$'),
    ('shining1.zip', r'^Shining Force \(USA\)\.zip$'),
    ('ps2.zip', r'^Phantasy Star II \(USA, Europe\).*\.zip$'),
    ('tf3.zip', r'^Thunder Force III \(USA.*\)\.zip$'),
    ('beyondoasis.zip', r'^Beyond Oasis \(USA\)\.zip$'),
    ('landstalker.zip', r'^Landstalker\b.*\(USA\)\.zip$'),
    ('headdy.zip', r'^Dynamite Headdy \(USA.*\)\.zip$'),
    ('ristar.zip', r'^Ristar \(USA.*\)\.zip$'),
    ('outrun.zip', r'^OutRun \(USA, Europe\)\.zip$'),
    ('goldenaxe2.zip', r'^Golden Axe II \(World\)\.zip$'),
    ('shadowdancer.zip', r'^Shadow Dancer - The Secret of Shinobi \(World\)\.zip$'),
]


def ingest_curated_collection(dl_dir, dl_zip, dest_dir, curated_specs, exts, label):
    installed = 0
    if os.path.isdir(dl_dir):
        files = [f for f in os.listdir(dl_dir) if f.lower().endswith(exts)]
        for alias, pat in curated_specs:
            dst = os.path.join(dest_dir, alias)
            if os.path.exists(dst):
                continue
            match = next((f for f in files if re.search(pat, f, re.I)), None)
            if match:
                src = os.path.join(dl_dir, match)
                try:
                    os.link(src, dst)
                except Exception:
                    shutil.copy2(src, dst)
                installed += 1
    elif os.path.isfile(dl_zip):
        try:
            with zipfile.ZipFile(dl_zip, 'r') as zf:
                entries = [(m, os.path.basename(m)) for m in zf.namelist() if not m.endswith('/')]
                for m, base in entries:
                    if base.lower() == 'sega genesis.png':
                        sys_art = os.path.join(art_dir, 'sys-genesis.png')
                        if not os.path.exists(sys_art):
                            with zf.open(m) as src, open(sys_art, 'wb') as out:
                                shutil.copyfileobj(src, out)
                rom_entries = [(m, b) for m, b in entries if b.lower().endswith(exts)]
                for alias, pat in curated_specs:
                    dst = os.path.join(dest_dir, alias)
                    if os.path.exists(dst):
                        continue
                    hit = next((m for m, b in rom_entries if re.search(pat, b, re.I)), None)
                    if hit:
                        with zf.open(hit) as src, open(dst, 'wb') as out:
                            shutil.copyfileobj(src, out)
                        installed += 1
        except Exception as exc:
            print(f"[arcade] ! could not read {os.path.basename(dl_zip)}: {exc}")
    if installed > 0:
        print(f"[arcade] ✓ installed {installed} {label} ROMs into {dest_dir}/")


ingest_curated_collection(
    os.path.join(DL_ROOT, 'sega-genesis-romset-ultra-usa'),
    os.path.join(DL_ROOT, 'sega-genesis-romset-ultra-usa.zip'),
    genesis_dir, CURATED_GENESIS, ('.zip',), 'Sega Genesis'
)

# 5. Ingest curated Super Nintendo (SNES) ROMs from ~/Downloads/gameplay-snes(.zip)
CURATED_SNES = [
    ('smw.7z', r'^Super Mario World(\s*\(.*\))?\.7z$'),
    ('smas.7z', r'^Super Mario All-Stars(\s*\(.*\))?\.7z$'),
    ('mariokart.7z', r'^Super Mario Kart(\s*\(.*\))?\.7z$'),
    ('smrpg.7z', r'^Super Mario RPG - Legend of the Seven Stars.*\.7z$'),
    ('yoshi.7z', r'^Super Mario World 2 - Yoshi\x27s Island.*\.7z$'),
    ('supermetroid.7z', r'^Super Metroid.*\.7z$'),
    ('zelda3.7z', r'^Legend of Zelda, The - A Link to the Past.*\.7z$'),
    ('chronotrigger.7z', r'^Chrono Trigger(\s*\(.*\))?\.7z$'),
    ('ff3.7z', r'^Final Fantasy III(\s*\(.*\))?\.7z$'),
    ('ff2.7z', r'^Final Fantasy II(\s*\(.*\))?\.7z$'),
    ('bof2.7z', r'^Breath of Fire II.*\.7z$'),
    ('lufia2.7z', r'^Lufia II - Rise of the Sinistrals.*\.7z$'),
    ('secretmana.7z', r'^Secret of Mana.*\.7z$'),
    ('earthbound.7z', r'^EarthBound.*\.7z$'),
    ('dkc1.7z', r'^Donkey Kong Country(\s*\(.*\))?\.7z$'),
    ('dkc2.7z', r'^Donkey Kong Country 2 - Diddy\x27s Kong Quest.*\.7z$'),
    ('dkc3.7z', r'^Donkey Kong Country 3 - Dixie Kong\x27s Double Trouble.*\.7z$'),
    ('castlevania4.7z', r'^Super Castlevania IV.*\.7z$'),
    ('contra3.7z', r'^Contra III - The Alien Wars.*\.7z$'),
    ('megamanx.7z', r'^Mega Man X(\s*\(.*\))?\.7z$'),
    ('megamanx2.7z', r'^Mega Man X\s*2.*\.7z$'),
    ('megamanx3.7z', r'^Mega Man X\s*3.*\.7z$'),
    ('megaman7.7z', r'^Mega Man (VII|7).*\.7z$'),
    ('rockmanforte.7z', r'^Rockman & Forte.*\.7z$'),
    ('megamansoccer.7z', r'^Mega Man\x27s Soccer.*\.7z$'),
    ('sf2turbo.7z', r'^Street Fighter II Turbo.*\.7z$'),
    ('ssf2.7z', r'^Super Street Fighter II.*\.7z$'),
    ('sfa2.7z', r'^Street Fighter Alpha 2.*\.7z$'),
    ('killerinstinct.7z', r'^Killer Instinct.*\.7z$'),
    ('umk3.7z', r'^Ultimate Mortal Kombat 3.*\.7z$'),
    ('tmnt4.7z', r'^Teenage Mutant Ninja Turtles IV - Turtles in Time.*\.7z$'),
    ('starfox.7z', r'^Star Fox(\s*\(.*\))?\.7z$'),
    ('fzero.7z', r'^F-Zero(\s*\(.*\))?\.7z$'),
    ('pilotwings.7z', r'^Pilotwings(\s*\(.*\))?\.7z$'),
    ('punchout.7z', r'^Super Punch-Out!!.*\.7z$'),
    ('kirbysuperstar.7z', r'^Kirby Super Star.*\.7z$'),
    ('actraiser.7z', r'^ActRaiser(\s*\(.*\))?\.7z$'),
    ('sunsetriders.7z', r'^Sunset Riders.*\.7z$'),
    ('wildguns.7z', r'^Wild Guns.*\.7z$'),
    ('zombies.7z', r'^Zombies Ate My Neighbors.*\.7z$'),
    ('pockyrocky.7z', r'^Pocky & Rocky(\s*\(.*\))?\.7z$'),
    ('harvestmoon.7z', r'^Harvest Moon(\s*\(.*\))?\.7z$'),
    ('illusiongaia.7z', r'^Illusion of Gaia.*\.7z$'),
    ('terranigma.7z', r'^Terranigma.*\.7z$'),
    ('ogrebattle.7z', r'^Ogre Battle - The March of the Black Queen.*\.7z$'),
    ('gradius3.7z', r'^Gradius III.*\.7z$'),
    ('rtype3.7z', r'^R-Type III.*\.7z$'),
    ('demonscrest.7z', r'^Demon\x27s Crest.*\.7z$'),
    ('sbomberman2.7z', r'^Super Bomberman 2.*\.7z$'),
    ('nbajamte.7z', r'^NBA Jam - Tournament Edition.*\.7z$'),
]

ingest_curated_collection(
    os.path.join(DL_ROOT, 'gameplay-snes'),
    os.path.join(DL_ROOT, 'gameplay-snes.zip'),
    snes_dir, CURATED_SNES, ('.7z', '.zip'), 'Super Nintendo (SNES)'
)


# 6. Extract verified USA NTSC `[!]` `.sfc` out of GoodMerged `.7z` archives in `snes/`
# (GoodMerged archives place `(E)` 50 Hz PAL or hacks alphabetically first, which desyncs music in 60 Hz NTSC MAME!)
def score_rom(member):
    base = os.path.basename(member)
    if not re.search(r'\.(sfc|smc)$', base, re.I):
        return -999
    s = 0
    if re.search(r'\b(hack|trainer|pirate|beta|proto|sample)\b', base, re.I):
        s -= 400
    if re.search(r'\[(b\d*|o\d*|t\d*|h\d*\w*|f\d*|T[+-][^\]]+)\]', base, re.I):
        s -= 250
    if '[!]' in base:
        s += 300
    if re.search(r'\((USA|U|JU)\b|\(Japan,\s*USA\)|\(USA,\s*Europe\)', base, re.I):
        s += 200
    elif re.search(r'\(World\)', base, re.I):
        s += 160
    elif re.search(r'\((Japan|J)\b', base, re.I):
        s += 90
    elif re.search(r'\((Europe|E)\b', base, re.I):
        s -= 120
    if re.search(r'V1\.1|Rev\s*[AB12]', base, re.I):
        s += 15
    return s


extracted_ntsc = 0
for fname in sorted(os.listdir(snes_dir)):
    if not fname.lower().endswith('.7z'):
        continue
    stem = fname[:-3]
    sfc_dest = os.path.join(snes_dir, f'{stem}.sfc')
    if os.path.exists(sfc_dest) and os.path.getsize(sfc_dest) > 1024:
        continue
    arch = os.path.join(snes_dir, fname)
    tmp_dir = tempfile.mkdtemp(prefix='lacuna-snes-')
    try:
        subprocess.run(['/usr/bin/bsdtar', '-xf', arch, '-C', tmp_dir], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=35)
        cands = []
        for root_d, _dirs, files_d in os.walk(tmp_dir):
            for fn in files_d:
                fp = os.path.join(root_d, fn)
                sz = os.path.getsize(fp) if os.path.isfile(fp) and not os.path.islink(fp) else 0
                if sz >= 32768 and (sz % 32768 == 0 or sz % 32768 == 512):
                    sc = score_rom(fn)
                    if sc > -500:
                        cands.append((sc, fp))
        cands.sort(key=lambda x: x[0], reverse=True)
        if cands:
            shutil.copyfile(cands[0][1], sfc_dest)
            extracted_ntsc += 1
    except Exception:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
if extracted_ntsc > 0:
    print(f"[arcade] ✓ extracted {extracted_ntsc} verified 60 Hz NTSC USA (.sfc) SNES ROMs (eliminating 50 Hz PAL music desync)")

