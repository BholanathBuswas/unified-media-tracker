#!/usr/bin/env python3
"""
Import script to migrate data from 'Unified Media Tracker.xlsx' to SQLite database 'media_tracker.db'.
Handles sheet structure, clean IDs, timestamp formatting, season status parsing, and deduplication.
"""

import os
import sys
import zipfile
import xml.etree.ElementTree as ET
import sqlite3
import datetime
import json

def excel_date_to_iso(serial, timestamp_ms=None):
    if timestamp_ms:
        try:
            ms = int(float(timestamp_ms))
            if 946684800000 <= ms <= 4102444800000:
                dt = datetime.datetime.fromtimestamp(ms / 1000.0, tz=datetime.timezone.utc)
                return dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            pass

    try:
        f = float(serial)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=f)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

def clean_id(raw_id, idx, category):
    try:
        val = str(raw_id).strip()
        if not val or val.lower() == 'none' or val == '0':
            return f"{category.lower()}_{int(datetime.datetime.now().timestamp()*1000)}_{idx}"
        if 'e' in val.lower() or '.' in val:
            return str(int(float(val)))
        return val
    except Exception:
        return f"{category.lower()}_{int(datetime.datetime.now().timestamp()*1000)}_{idx}"

def parse_seasons(raw_val):
    try:
        val = float(raw_val)
        return max(1, int(val))
    except Exception:
        return 1

def parse_year(raw_val):
    if not raw_val or str(raw_val).strip() == '' or str(raw_val).strip().upper() == 'N/A':
        return 'N/A'
    try:
        return str(int(float(raw_val)))
    except Exception:
        return str(raw_val).strip()

def clean_type(raw_val):
    t = str(raw_val or '').strip()
    mapping = {
        'chinese drama': 'Chinese Drama',
        'korean drama': 'Korean Drama',
        'animation movie': 'Animation Movie',
        'hollywood movie': 'Hollywood Movie',
        'bollywood movie': 'Bollywood Movie',
        'south indian movie': 'South Indian Movie',
        'bengali movie': 'Bengali Movie',
        'korean movies': 'Korean Movies',
        'chinese movies': 'Chinese Movies',
        'web series': 'Web Series',
        'other drama': 'Other Drama',
        'that type of movie': 'That type of movie'
    }
    return mapping.get(t.lower(), t if t else 'Other')

def parse_watched(raw_val, seasons):
    s = str(raw_val or '').strip().lower()
    if not s or s == '0' or s == 'none':
        return [False] * seasons
    
    parts = [p.strip() for p in s.split(',') if p.strip()]
    bools = [p in ['true', '1', 'yes'] for p in parts]
    
    if len(bools) < seasons:
        bools.extend([False] * (seasons - len(bools)))
    elif len(bools) > seasons:
        bools = bools[:seasons]
    return bools

def derive_status(watched_list):
    if not watched_list:
        return 'Plan to Watch'
    if all(watched_list):
        return 'Completed'
    if any(watched_list):
        return 'Watching'
    return 'Plan to Watch'

def run_import(xlsx_path='Unified Media Tracker.xlsx', db_path='media_tracker.db'):
    if not os.path.exists(xlsx_path):
        print(f"Error: '{xlsx_path}' not found in current directory.")
        sys.exit(1)

    print(f"Opening '{xlsx_path}'...")
    with zipfile.ZipFile(xlsx_path, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in ss_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text = ''.join(t.text for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
                shared_strings.append(text)

        wb_root = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = []
        for s in wb_root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
            sheets.append((s.attrib['name'], s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']))

        rels_root = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_root.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

        sheet_categories = {
            'Anime Name': 'Anime',
            'Movie Name': 'Movie',
            'Hentai Name': 'Hentai'
        }

        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        cur.executescript('''
        CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            alt_name TEXT DEFAULT '',
            type TEXT NOT NULL,
            seasons INTEGER NOT NULL DEFAULT 1,
            year TEXT NOT NULL DEFAULT 'N/A',
            watched TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'Plan to Watch',
            rating REAL DEFAULT 0,
            favorite INTEGER DEFAULT 0,
            genres TEXT DEFAULT '[]',
            tags TEXT DEFAULT '',
            platform TEXT DEFAULT '',
            episodes INTEGER DEFAULT 0,
            current_episode INTEGER DEFAULT 0,
            poster_url TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
        CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
        CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
        CREATE INDEX IF NOT EXISTS idx_media_name ON media(name);
        CREATE INDEX IF NOT EXISTS idx_media_year ON media(year);
        CREATE INDEX IF NOT EXISTS idx_media_rating ON media(rating);
        CREATE INDEX IF NOT EXISTS idx_media_favorite ON media(favorite);
        ''')

        total_imported = 0

        for sheet_title, rId in sheets:
            category = sheet_categories.get(sheet_title)
            if not category:
                continue

            target = rel_map[rId]
            if not target.startswith('xl/'):
                target = 'xl/' + target
            sheet_root = ET.fromstring(z.read(target))
            rows = []
            for row in sheet_root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_dict = {}
                for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    ref = c.attrib.get('r', '')
                    col = ''.join(ch for ch in ref if ch.isalpha())
                    t = c.attrib.get('t')
                    v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = v.text if v is not None else ''
                    if t == 's' and val.isdigit():
                        val = shared_strings[int(val)]
                    elif t == 'b':
                        val = 'true' if val == '1' else 'false'
                    row_dict[col] = val
                if any(row_dict.values()):
                    rows.append(row_dict)

            data_rows = rows[1:]
            sheet_imported = 0
            seen_titles = set()
            for idx, r in enumerate(data_rows):
                name = str(r.get('C', '')).strip()
                if not name:
                    continue

                norm_name = re.sub(r'[^a-z0-9]', '', name.lower())
                if norm_name in seen_titles:
                    print(f"    ↳ Skipping duplicate entry in '{sheet_title}': \"{name}\"")
                    continue
                seen_titles.add(norm_name)

                item_id = clean_id(r.get('A'), idx, category)
                raw_time = r.get('B', '')
                created_at = excel_date_to_iso(raw_time, item_id)
                updated_at = created_at
                m_type = clean_type(r.get('D'))
                seasons = parse_seasons(r.get('E'))
                year = parse_year(r.get('F'))
                watched_list = parse_watched(r.get('G'), seasons)
                status = derive_status(watched_list)

                cur.execute('''
                INSERT OR REPLACE INTO media (
                    id, category, name, alt_name, type, seasons, year,
                    watched, status, rating, favorite, genres, tags,
                    platform, episodes, current_episode, poster_url, notes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item_id, category, name, '', m_type, seasons, year,
                    json.dumps(watched_list), status, 0.0, 0, '[]', '',
                    '', 0, 0, '', '',
                    created_at, updated_at
                ))
                sheet_imported += 1

            print(f"  ✓ {sheet_imported} items imported from sheet '{sheet_title}' -> category: {category}")
            total_imported += sheet_imported

        conn.commit()
        conn.close()
        print(f"\n🎉 Successfully migrated {total_imported} entries into '{db_path}'!")

if __name__ == '__main__':
    run_import()
