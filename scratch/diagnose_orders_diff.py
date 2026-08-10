import os
import sys
import datetime
from dotenv import load_dotenv

backend_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(backend_env_path, override=True)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from sqlalchemy import create_engine, text
from app.core.config import settings

NEW_RENDER_DB_URL = "postgresql://lumoradb_user:fY8L9it8jnhUXADJVfT5snkdPg2vu105@dpg-d9svagv40ujc73dvo4ag-a.oregon-postgres.render.com/lumoradb_o3xd?sslmode=require"

orig_engine = create_engine(settings.DATABASE_URL)
target_engine = create_engine(NEW_RENDER_DB_URL)

with orig_engine.connect() as o_conn, target_engine.connect() as t_conn:
    o_rows = [dict(r._mapping) for r in o_conn.execute(text('SELECT * FROM orders ORDER BY id')).fetchall()]
    t_rows = [dict(r._mapping) for r in t_conn.execute(text('SELECT * FROM orders ORDER BY id')).fetchall()]
    
    diff_count = 0
    for r1, r2 in zip(o_rows, t_rows):
        if r1['id'] != r2['id']:
            print(f"ID Mismatch: {r1['id']} vs {r2['id']}")
            continue
        for k in r1:
            v1, v2 = r1[k], r2[k]
            if v1 != v2:
                # Check if it's just datetime representation
                v1_str = str(v1)
                v2_str = str(v2)
                print(f"Row id={r1['id']} col={k}: Orig={v1} ({type(v1)}) vs Target={v2} ({type(v2)})")
                diff_count += 1
                if diff_count > 10:
                    break
