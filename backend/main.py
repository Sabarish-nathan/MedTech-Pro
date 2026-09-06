from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from backend.data_manager import get_surveillance_data, get_ward_metrics
from backend.ml_models import amr_ml_engine
from backend.simulator import ward_simulator
from backend.database import (
    init_database,
    get_database_status,
    get_all_patients,
    get_patient_consultations,
    verify_patient_by_uid,
    create_patient,
    get_recent_sql_logs
)
from backend.chatbot_engine import chatbot_engine

app = FastAPI(
    title="AegisAMR API Server",
    description="Backend API for Antimicrobial Resistance surveillance, outbreak simulations, real-time MySQL database, and conversational AI clinical support.",
    version="2.0.0"
)

# Startup event to ensure MySQL database & tables are initialized
@app.on_event("startup")
def on_startup():
    init_database()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas for request validation
class PatientProfileRequest(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Age of the patient in years")
    icu_admit: bool = Field(..., description="Whether patient is admitted to the ICU")
    prior_abx_90d: bool = Field(..., description="Any antibiotic usage in the last 90 days")
    hospital_days: int = Field(..., ge=0, le=365, description="Number of hospital days prior to suspected infection")
    gfr: float = Field(..., ge=0, le=200, description="Glomerular Filtration Rate (gfr) in mL/min")
    immunosuppressed: bool = Field(..., description="Immunosuppressive condition or chemotherapy")
    infection_site: str = Field(..., description="Infection focus: 'urinary', 'respiratory', 'bloodstream', 'skin_wound'")
    suspected_pathogen: str = Field(..., description="Suspected organism: 'E_coli', 'S_aureus', 'K_pneumoniae', 'P_aeruginosa'")

class WardSimulationRequest(BaseModel):
    ward_type: str = Field("icu", description="Ward type: 'icu', 'surgery', 'general_medicine'")
    hand_hygiene_compliance: float = Field(80.0, ge=0.0, le=100.0, description="Hand hygiene compliance %")
    isolation_speed: float = Field(2.0, ge=0.5, le=7.0, description="Mean days taken to isolate colonized/infected patients")
    cleaning_frequency: int = Field(2, ge=1, le=4, description="Disinfections per day (1-4)")
    staff_ratio: float = Field(0.5, ge=0.1, le=1.0, description="Staff-to-patient ratio (e.g. 0.5 means 1 staff for 2 patients)")
    simulation_days: int = Field(30, ge=10, le=90, description="Length of simulation in days")

class ChatMessageRequest(BaseModel):
    message: str = Field(..., description="User message to the AI clinical chatbot")
    session_id: str = Field("default_session", description="Unique conversation session id")

class ChatResetRequest(BaseModel):
    session_id: str = Field("default_session", description="Conversation session id to reset")

class PatientVerifyRequest(BaseModel):
    patient_uid: str = Field(..., description="Unique Patient ID e.g. PT-1001")
    expected_name: Optional[str] = Field(None, description="Optional name to match against")

class PatientRegisterRequest(BaseModel):
    name: str = Field(..., description="Full patient name")
    age: int = Field(..., ge=0, le=120)
    gender: str = Field("Unknown")
    contact: Optional[str] = None

# ----------------- Core Health & Surveillance APIs -----------------
@app.get("/api/health")
def health_check():
    db_status = get_database_status()
    return {
        "status": "healthy",
        "service": "AegisAMR Backend",
        "database": db_status
    }

@app.get("/api/surveillance/data")
def surveillance_data():
    try:
        data = get_surveillance_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ward/metrics")
def ward_metrics():
    try:
        data = get_ward_metrics()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict/patient")
def predict_patient_profile(profile: PatientProfileRequest):
    try:
        input_data = profile.model_dump()
        result = amr_ml_engine.predict_patient(input_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Prediction failed: {str(e)}")

@app.post("/api/simulate/ward")
def simulate_ward_spread(sim_req: WardSimulationRequest):
    try:
        result = ward_simulator.run_simulation(
            ward_type=sim_req.ward_type,
            hand_hygiene_compliance=sim_req.hand_hygiene_compliance,
            isolation_speed=sim_req.isolation_speed,
            cleaning_frequency=sim_req.cleaning_frequency,
            staff_ratio=sim_req.staff_ratio,
            simulation_days=sim_req.simulation_days
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation run failed: {str(e)}")

# ----------------- AI Clinical Chatbot APIs -----------------
@app.post("/api/chat/message")
def chat_message(req: ChatMessageRequest):
    """Processes message through the Clinical Chatbot state machine."""
    try:
        response = chatbot_engine.process_message(req.message, req.session_id)
        # Attach latest SQL query logs to response for real-time UI feed
        response["recent_sql_logs"] = get_recent_sql_logs(15)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot processing error: {str(e)}")

@app.post("/api/chat/reset")
def chat_reset(req: ChatResetRequest):
    """Resets the conversation session."""
    try:
        res = chatbot_engine.reset_session(req.session_id)
        return {
            "status": "reset",
            "reply": "🔄 Conversation reset. Please enter a patient name to begin.",
            "session": res,
            "recent_sql_logs": get_recent_sql_logs(10)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Real-Time MySQL Database APIs -----------------
@app.get("/api/database/status")
def database_status():
    """Returns connection details, table row counts, and MySQL version."""
    return get_database_status()

@app.get("/api/database/patients")
def list_patients(limit: int = 50):
    """Lists registered EHR patients in the MySQL database."""
    try:
        patients = get_all_patients(limit)
        return {"patients": patients, "count": len(patients)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch patients: {str(e)}")

@app.get("/api/database/patient/{patient_uid}")
def get_patient_profile(patient_uid: str):
    """Gets patient record and all past AMR consultations."""
    try:
        verification = verify_patient_by_uid(patient_uid)
        if not verification:
            raise HTTPException(status_code=404, detail=f"Patient ID {patient_uid} not found in database.")
        consultations = get_patient_consultations(patient_uid)
        return {
            "patient": verification["patient"],
            "consultations": consultations
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/database/patient/verify")
def verify_patient_id(req: PatientVerifyRequest):
    """Verifies patient ID directly against MySQL database."""
    try:
        result = verify_patient_by_uid(req.patient_uid, req.expected_name)
        if not result:
            return {"matched": False, "reason": f"Patient ID {req.patient_uid} does not exist in the database."}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/database/patient/register")
def register_patient(req: PatientRegisterRequest):
    """Directly registers a new patient in MySQL."""
    try:
        patient = create_patient(req.name, req.age, req.gender, req.contact)
        return {"status": "created", "patient": patient}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/database/query-logs")
def get_query_logs(limit: int = 25):
    """Returns the real-time stream of executed MySQL queries."""
    logs = get_recent_sql_logs(limit)
    return {"logs": logs, "count": len(logs)}
