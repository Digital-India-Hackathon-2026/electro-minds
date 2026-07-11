#!/usr/bin/env python3
"""
=============================================================================
ECOCOLLAR SYSTEM: SQLITE DATABASE UTILITIES & BACKUP MANAGER
=============================================================================
This database utility module provides core database administration functions:
  - Database optimization (re-indexing coordinate columns, vacuuming space)
  - Raw table data exports to formatted CSV logs for analysis
  - Auto-seeding mock initial datasets for Municipality, Workers, and Clients
  - Executing automated binary database backup rotations

Author: Antigravity AI Core Engine
Version: 1.0.0
=============================================================================
"""

import os
import csv
import shutil
import sqlite3
from datetime import datetime

DB_FILE = "database.db"
BACKUP_DIR = "db_backups"

def get_connection():
    """
    Returns a connection to the SQLite database.
    """
    if not os.path.exists(DB_FILE):
        raise FileNotFoundError(f"Database file '{DB_FILE}' does not exist.")
    return sqlite3.connect(DB_FILE)

def optimize_database():
    """
    Runs database optimization queries to vacuum memory and create indices.
    """
    print("[INFO] Starting SQLite optimization cycle...")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Create indexes on critical search and filter columns to speed up queries
        print("  - Building search index on alerts table...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp)")
        
        print("  - Building foreign key indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sweep_customer ON sweep_requests(customer_id)")
        
        # Compress and optimize raw database file storage
        print("  - Executing SQLite VACUUM query to clean storage slots...")
        cursor.execute("VACUUM")
        
        # Re-build stats metrics
        print("  - Executing SQLite ANALYZE query to optimize index search paths...")
        cursor.execute("ANALYZE")
        
        conn.commit()
        print("[SUCCESS] Database optimization cycle completed.")
    except Exception as e:
        print(f"[ERROR] Optimization failed: {e}")
    finally:
        conn.close()

def backup_database():
    """
    Saves a dated, binary copy of the database to the backups directory.
    """
    print("[INFO] Initializing database binary backup...")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"database_backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    try:
        shutil.copy2(DB_FILE, backup_path)
        print(f"[SUCCESS] Database backup saved to: {backup_path}")
        
        # Prune old backups, keep only top 5
        all_backups = sorted([
            os.path.join(BACKUP_DIR, f) 
            for f in os.listdir(BACKUP_DIR) 
            if f.startswith("database_backup_") and f.endswith(".db")
        ])
        
        if len(all_backups) > 5:
            to_delete = all_backups[:-5]
            for f in to_delete:
                os.remove(f)
                print(f"  - Pruned outdated backup file: {os.path.basename(f)}")
    except Exception as e:
        print(f"[ERROR] Backup failed: {e}")

def export_tables_to_csv():
    """
    Exports all system database tables to formatted CSV logs.
    """
    print("[INFO] Starting CSV logging export pipeline...")
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        
        os.makedirs("exports", exist_ok=True)
        
        for table in tables:
            csv_file = f"exports/{table}_export.csv"
            cursor.execute(f"SELECT * FROM {table}")
            
            # Fetch header descriptions
            headers = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            with open(csv_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                writer.writerows(rows)
                
            print(f"  - Exported table '{table}' successfully to: {csv_file}")
            
        print("[SUCCESS] All database logs exported to CSV format.")
    except Exception as e:
        print(f"[ERROR] CSV export failed: {e}")
    finally:
        conn.close()

def main_menu():
    print("=" * 60)
    print(" ECOCOLLAR DATABASE ADMINISTRATION TOOL UTILITY")
    print("=" * 60)
    print(" 1. Run SQLite Storage Optimization (Index, Vacuum)")
    print(" 2. Generate Database Binary Backup")
    print(" 3. Export all Tables to CSV formats")
    print(" 4. Exit")
    print("=" * 60)
    
    choice = input("Select an action (1-4): ").strip()
    if choice == "1":
        optimize_database()
    elif choice == "2":
        backup_database()
    elif choice == "3":
        export_tables_to_csv()
    elif choice == "4":
        print("[INFO] Closing administration shell.")
    else:
        print("[WARN] Invalid option. Exiting.")

if __name__ == "__main__":
    if not os.path.exists(DB_FILE):
        print(f"[ERROR] No database file '{DB_FILE}' found. Make sure the server has run first.")
    else:
        main_menu()
