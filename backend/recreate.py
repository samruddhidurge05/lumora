import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine
from app.models.affiliate import Base

# We dropped referral_clicks, this will recreate it
Base.metadata.create_all(engine)
print("Recreated tables")
