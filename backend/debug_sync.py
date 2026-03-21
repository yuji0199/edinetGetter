import asyncio
from datetime import date
from database import SessionLocal
from routers.edinet import sync_edinet_data
import models

db = SessionLocal()
# Provide a dummy user
admin_user = db.query(models.User).filter(models.User.username == "admin").first()

try:
    print("Testing sync_edinet_data directly...")
    result = sync_edinet_data(target_date=date(2026, 2, 25), limit=3, db=db, current_user=admin_user)
    print("Success:", result)
except Exception as e:
    import traceback
    traceback.print_exc()

db.close()
