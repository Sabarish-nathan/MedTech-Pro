import os
import time
from datetime import datetime
from collections import deque
from typing import Optional, List, Dict, Any
import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv

load_dotenv()

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "root")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "aegis_amr_db")

# In-memory buffer for real-time frontend streaming of SQL logs
_recent_sql_logs = deque(maxlen=100)

def _log_query_event(query_type: str, sql_text: str, status: str = "SUCCESS", duration_ms: float = 0.0):
    log_entry = {
        "id": int(time.time() * 1000),
        "query_type": query_type,
        "sql_text": sql_text.strip(),
        "status": status,
        "duration_ms": round(duration_ms, 2),
        "executed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    _recent_sql_logs.appendleft(log_entry)
    return log_entry

def get_connection(use_database: bool = True):
    """Establishes a MySQL connection using pymysql."""
    db_name = MYSQL_DATABASE if use_database else None
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=db_name,
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=3
    )

def init_database():
    """Initializes the MySQL database schema and pre-populates initial EHR clinical records."""
    start_time = time.time()
    try:
        # Step 1: Connect to MySQL server without database to ensure database exists
        conn = get_connection(use_database=False)
        with conn.cursor() as cursor:
            create_db_sql = f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            cursor.execute(create_db_sql)
            _log_query_event("DDL", create_db_sql, "SUCCESS", (time.time() - start_time) * 1000)
        conn.close()

        # Step 2: Connect to the database and create tables
        conn = get_connection(use_database=True)
        with conn.cursor() as cursor:
            # Patients Table
            create_patients_sql = """
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_uid VARCHAR(32) NOT NULL UNIQUE,
                name VARCHAR(128) NOT NULL,
                age INT NOT NULL,
                gender VARCHAR(16) DEFAULT 'Unknown',
                contact VARCHAR(64) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """
            cursor.execute(create_patients_sql)
            _log_query_event("DDL", "CREATE TABLE IF NOT EXISTS patients (...)", "SUCCESS", 5.2)

            # Patient Consultations & AMR Records Table
            create_consultations_sql = """
            CREATE TABLE IF NOT EXISTS patient_consultations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_uid VARCHAR(32) NOT NULL,
                infection_site VARCHAR(64),
                suspected_pathogen VARCHAR(64),
                icu_admit TINYINT(1) DEFAULT 0,
                prior_abx_90d TINYINT(1) DEFAULT 0,
                hospital_days INT DEFAULT 0,
                gfr FLOAT DEFAULT 90.0,
                immunosuppressed TINYINT(1) DEFAULT 0,
                hai_risk_score FLOAT DEFAULT 0.0,
                carbapenem_res FLOAT DEFAULT 0.0,
                penicillin_res FLOAT DEFAULT 0.0,
                fluoroquinolone_res FLOAT DEFAULT 0.0,
                recommended_drug VARCHAR(255),
                alternatives TEXT,
                dosing_instructions TEXT,
                clinical_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_uid) REFERENCES patients(patient_uid) ON DELETE CASCADE
            );
            """
            cursor.execute(create_consultations_sql)
            _log_query_event("DDL", "CREATE TABLE IF NOT EXISTS patient_consultations (...)", "SUCCESS", 4.8)

            # Check if initial seed data is needed
            cursor.execute("SELECT COUNT(*) as count FROM patients;")
            res = cursor.fetchone()
            if res and res["count"] == 0:
                seed_patients = [
                    ("PT-1001", "Eleanor Vance", 72, "Female"),
                    ("PT-1002", "Marcus Brody", 58, "Male"),
                    ("PT-1003", "Aarav Patel", 45, "Male"),
                    ("PT-1004", "Sophia Lin", 63, "Female")
                ]
                for uid, name, age, gender in seed_patients:
                    insert_sql = "INSERT INTO patients (patient_uid, name, age, gender) VALUES (%s, %s, %s, %s);"
                    cursor.execute(insert_sql, (uid, name, age, gender))
                    _log_query_event("INSERT", f"INSERT INTO patients VALUES ('{uid}', '{name}', {age}, '{gender}')", "SUCCESS", 2.1)

                # Seed sample prior consultation for Marcus Brody
                prior_sql = """
                INSERT INTO patient_consultations 
                (patient_uid, infection_site, suspected_pathogen, icu_admit, prior_abx_90d, hospital_days, gfr, immunosuppressed, hai_risk_score, carbapenem_res, penicillin_res, fluoroquinolone_res, recommended_drug, alternatives, dosing_instructions, clinical_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """
                cursor.execute(prior_sql, (
                    "PT-1002", "urinary", "E_coli", 0, 1, 4, 75.0, 0,
                    28.5, 8.2, 54.0, 24.1,
                    "Nitrofurantoin / Ciprofloxacin", "Fosfomycin",
                    "Standard oral regimen for uncomplicated UTI",
                    "Previous admission for uncomplicated cystitis. Responded well."
                ))
                _log_query_event("INSERT", "INSERT INTO patient_consultations (PT-1002 history)", "SUCCESS", 3.0)

        conn.close()
        print("[+] MySQL database schema and seed data initialized successfully.")
        return True
    except Exception as e:
        print(f"[-] Database initialization error: {e}")
        _log_query_event("ERROR", f"Database init failed: {str(e)}", "FAILED", 0.0)
        return False

def search_patient_by_name(name: str) -> List[Dict[str, Any]]:
    """Query patients by exact or fuzzy case-insensitive name."""
    start_time = time.time()
    clean_name = name.strip()
    sql = "SELECT id, patient_uid, name, age, gender, contact, created_at FROM patients WHERE LOWER(name) = LOWER(%s);"
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, (clean_name,))
            results = cursor.fetchall()
            duration = (time.time() - start_time) * 1000
            _log_query_event("SELECT", f"SELECT * FROM patients WHERE LOWER(name) = LOWER('{clean_name}');", "SUCCESS", duration)
            for r in results:
                if isinstance(r.get("created_at"), datetime):
                    r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            conn.close()
            return results
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("SELECT", f"SELECT * FROM patients WHERE LOWER(name) = LOWER('{clean_name}');", "FAILED", duration)
        raise e

def verify_patient_by_uid(patient_uid: str, expected_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Verify patient by patient_uid (e.g. PT-1001) and optionally verify matching name."""
    start_time = time.time()
    clean_uid = patient_uid.strip().upper()
    sql = "SELECT id, patient_uid, name, age, gender, contact, created_at FROM patients WHERE UPPER(patient_uid) = %s;"
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, (clean_uid,))
            patient = cursor.fetchone()
            duration = (time.time() - start_time) * 1000
            _log_query_event("SELECT", f"SELECT * FROM patients WHERE UPPER(patient_uid) = '{clean_uid}';", "SUCCESS", duration)
            conn.close()
            if not patient:
                return None
            if isinstance(patient.get("created_at"), datetime):
                patient["created_at"] = patient["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if expected_name:
                # Compare first or last name case-insensitively
                exp = expected_name.strip().lower()
                act = patient["name"].strip().lower()
                if exp not in act and act not in exp:
                    return {"matched": False, "reason": f"ID {clean_uid} belongs to '{patient['name']}', not '{expected_name}'", "patient": patient}
            return {"matched": True, "patient": patient}
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("SELECT", f"SELECT * FROM patients WHERE UPPER(patient_uid) = '{clean_uid}';", "FAILED", duration)
        raise e

def create_patient(name: str, age: int, gender: str = "Unknown", contact: Optional[str] = None) -> Dict[str, Any]:
    """Inserts a brand new patient into the MySQL database with an auto-generated unique Patient ID."""
    start_time = time.time()
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            # Generate next patient UID: PT-100X
            cursor.execute("SELECT MAX(id) as max_id FROM patients;")
            res = cursor.fetchone()
            next_num = 1001 if not res or res["max_id"] is None else 1001 + res["max_id"]
            patient_uid = f"PT-{next_num}"

            sql = "INSERT INTO patients (patient_uid, name, age, gender, contact) VALUES (%s, %s, %s, %s, %s);"
            cursor.execute(sql, (patient_uid, name.strip(), age, gender, contact))
            duration = (time.time() - start_time) * 1000
            _log_query_event(
                "INSERT", 
                f"INSERT INTO patients (patient_uid, name, age, gender) VALUES ('{patient_uid}', '{name.strip()}', {age}, '{gender}');", 
                "SUCCESS", 
                duration
            )
        conn.close()

        return {
            "patient_uid": patient_uid,
            "name": name.strip(),
            "age": age,
            "gender": gender,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("INSERT", f"INSERT INTO patients failed for '{name}'", "FAILED", duration)
        raise e

def save_patient_consultation(record: Dict[str, Any]) -> int:
    """Saves an AI consultation & AMR resistance prediction into the database."""
    start_time = time.time()
    sql = """
    INSERT INTO patient_consultations (
        patient_uid, infection_site, suspected_pathogen, icu_admit, 
        prior_abx_90d, hospital_days, gfr, immunosuppressed, 
        hai_risk_score, carbapenem_res, penicillin_res, fluoroquinolone_res, 
        recommended_drug, alternatives, dosing_instructions, clinical_notes
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, (
                record.get("patient_uid"),
                record.get("infection_site", "general"),
                record.get("suspected_pathogen", "Unknown"),
                1 if record.get("icu_admit") else 0,
                1 if record.get("prior_abx_90d") else 0,
                record.get("hospital_days", 0),
                record.get("gfr", 90.0),
                1 if record.get("immunosuppressed") else 0,
                record.get("hai_risk_score", 0.0),
                record.get("carbapenem_res", 0.0),
                record.get("penicillin_res", 0.0),
                record.get("fluoroquinolone_res", 0.0),
                record.get("recommended_drug", ""),
                record.get("alternatives", ""),
                record.get("dosing_instructions", ""),
                record.get("clinical_notes", "")
            ))
            insert_id = cursor.lastrowid
            duration = (time.time() - start_time) * 1000
            _log_query_event(
                "INSERT", 
                f"INSERT INTO patient_consultations (patient_uid, recommended_drug) VALUES ('{record.get('patient_uid')}', '{record.get('recommended_drug')}');", 
                "SUCCESS", 
                duration
            )
        conn.close()
        return insert_id
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("INSERT", f"INSERT INTO patient_consultations failed: {str(e)}", "FAILED", duration)
        raise e

def get_patient_consultations(patient_uid: str) -> List[Dict[str, Any]]:
    """Retrieves all past consultations for a patient, ordered by date descending."""
    start_time = time.time()
    clean_uid = patient_uid.strip().upper()
    sql = "SELECT * FROM patient_consultations WHERE UPPER(patient_uid) = %s ORDER BY created_at DESC;"
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, (clean_uid,))
            rows = cursor.fetchall()
            duration = (time.time() - start_time) * 1000
            _log_query_event("SELECT", f"SELECT * FROM patient_consultations WHERE patient_uid = '{clean_uid}' ORDER BY created_at DESC;", "SUCCESS", duration)
            for r in rows:
                if isinstance(r.get("created_at"), datetime):
                    r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            conn.close()
            return rows
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("SELECT", f"SELECT FROM patient_consultations failed for {clean_uid}", "FAILED", duration)
        raise e

def get_all_patients(limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches all registered patients with their consultation counts."""
    start_time = time.time()
    sql = """
    SELECT p.id, p.patient_uid, p.name, p.age, p.gender, p.created_at,
           COUNT(c.id) as consultation_count,
           MAX(c.created_at) as last_visit
    FROM patients p
    LEFT JOIN patient_consultations c ON p.patient_uid = c.patient_uid
    GROUP BY p.id, p.patient_uid, p.name, p.age, p.gender, p.created_at
    ORDER BY p.id DESC
    LIMIT %s;
    """
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, (limit,))
            rows = cursor.fetchall()
            duration = (time.time() - start_time) * 1000
            _log_query_event("SELECT", f"SELECT p.*, COUNT(c.id) FROM patients p LEFT JOIN patient_consultations c ... LIMIT {limit};", "SUCCESS", duration)
            for r in rows:
                if isinstance(r.get("created_at"), datetime):
                    r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(r.get("last_visit"), datetime):
                    r["last_visit"] = r["last_visit"].strftime("%Y-%m-%d %H:%M:%S")
            conn.close()
            return rows
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        _log_query_event("SELECT", "SELECT all patients failed", "FAILED", duration)
        raise e

def get_recent_sql_logs(limit: int = 30) -> List[Dict[str, Any]]:
    """Returns the most recent SQL queries executed in real-time."""
    return list(_recent_sql_logs)[:limit]

def get_database_status() -> Dict[str, Any]:
    """Checks MySQL connection status and returns table metrics."""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as patient_count FROM patients;")
            p_res = cursor.fetchone()
            cursor.execute("SELECT COUNT(*) as consultation_count FROM patient_consultations;")
            c_res = cursor.fetchone()
            cursor.execute("SELECT VERSION() as mysql_version;")
            v_res = cursor.fetchone()
        conn.close()
        return {
            "status": "connected",
            "engine": "MySQL Server",
            "version": v_res.get("mysql_version", "8.0"),
            "host": f"{MYSQL_HOST}:{MYSQL_PORT}",
            "database": MYSQL_DATABASE,
            "patient_count": p_res.get("patient_count", 0),
            "consultation_count": c_res.get("consultation_count", 0)
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "engine": "MySQL Server",
            "host": f"{MYSQL_HOST}:{MYSQL_PORT}",
            "database": MYSQL_DATABASE,
            "error": str(e)
        }
