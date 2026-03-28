import os
import random
from datetime import datetime, timedelta
from db import SessionLocal
import models

db = SessionLocal()
user = db.query(models.User).filter(models.User.phone == "8104451989").first()

if not user:
    print("User with phone 8104451989 not found.")
else:
    stall = db.query(models.Stall).filter(models.Stall.user_id == user.id).first()
    if not stall:
        print("User has no stalls. Please complete onboarding first.")
    else:
        print(f"Adding 30 days of data for stall '{stall.name}'...")
        for i in range(1, 31):
            day_date = (datetime.utcnow() - timedelta(days=i)).date().isoformat()
            
            # check if data already exists for this day to avoid infinite stacking if run multiple times
            existing = db.query(models.AudioSession).filter(models.AudioSession.stall_id == stall.id, models.AudioSession.day_date == day_date).first()
            if existing:
                print(f"Data already exists for {day_date}, skipping.")
                continue

            rev = random.randint(800, 3000)
            exp = random.randint(200, 800)
            
            session = models.AudioSession(
                stall_id=stall.id,
                day_date=day_date,
                raw_text=f"Seeded sales for {day_date}",
                total_revenue=rev,
                total_expense=exp,
                insight=f"Generated insight for {day_date}. Good volume of sales.",
                audio_url=None
            )
            
            # get real items if possible
            items = stall.menu_items
            item1 = items[0].item_name if len(items) > 0 else "Samosa"
            item2 = items[1].item_name if len(items) > 1 else "Vadapav"
            
            session.entries.append(models.SessionEntry(
                entry_type="REVENUE", item_name=item1, value=rev//2, amount_type="exact"
            ))
            session.entries.append(models.SessionEntry(
                entry_type="REVENUE", item_name=item2, value=rev//2, amount_type="exact",
                stockout_flag=True if random.random() > 0.7 else False,
                lost_sales_flag=True if random.random() > 0.8 else False
            ))
            session.entries.append(models.SessionEntry(
                entry_type="EXPENSE", item_name="Raw Materials", value=exp, amount_type="exact"
            ))
            
            db.add(session)
        
        db.commit()
        print("Data seeding complete! You can view the Trends & Analytics dashboard now.")
