import re
from typing import Dict, Any, List, Optional
from datetime import datetime

from backend.database import (
    search_patient_by_name,
    verify_patient_by_uid,
    create_patient,
    save_patient_consultation,
    get_patient_consultations,
    get_recent_sql_logs
)
from backend.ml_models import amr_ml_engine

class ClinicalChatbotEngine:
    def __init__(self):
        # In-memory session store: session_id -> session_dict
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "session_id": session_id,
                "state": "IDLE", # IDLE, AWAITING_PATIENT_ID, AWAITING_NEW_PATIENT_DETAILS, ACTIVE_PATIENT
                "active_patient": None,
                "pending_patient_name": None,
                "pending_patient_matches": [],
                "pending_age": None,
                "pending_gender": "Unknown",
                "created_at": datetime.now().isoformat()
            }
        return self.sessions[session_id]

    def reset_session(self, session_id: str) -> Dict[str, Any]:
        self.sessions[session_id] = {
            "session_id": session_id,
            "state": "IDLE",
            "active_patient": None,
            "pending_patient_name": None,
            "pending_patient_matches": [],
            "pending_age": None,
            "pending_gender": "Unknown",
            "created_at": datetime.now().isoformat()
        }
        return self.sessions[session_id]

    def _extract_name_candidate(self, text: str) -> Optional[str]:
        """Extracts potential patient names from user queries."""
        clean_text = text.strip().rstrip('.,!?')
        patterns = [
            r"(?:new\s+patient|register\s+patient|patient\s*(?:name)?(?:\s*is)?(?:\s*:)?)\s*([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)*)",
            r"(?:check|find|lookup|examine)\s+(?:patient\s+)?([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)*)",
            r"^(?:patient\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)+)$"
        ]
        for pat in patterns:
            match = re.search(pat, clean_text, re.IGNORECASE)
            if match:
                cand = match.group(1).strip()
                stop_words = [
                    "clinical advisor", "decision support", "amr resistance", "outbreak simulator", 
                    "renal safety", "icu", "ward", "patient", "new patient", "eleanor vance (pt-1001)", 
                    "marcus brody (pt-1002)", "yes", "no", "help", "reset"
                ]
                if cand.lower().startswith("new "):
                    cand = cand[4:].strip()
                if cand.upper().startswith("PT-"):
                    continue
                if cand.lower() not in stop_words and len(cand) >= 2:
                    return cand
        return None

    def _extract_patient_uid(self, text: str) -> Optional[str]:
        """Extracts Patient UID pattern like PT-1001."""
        match = re.search(r"\b(PT-\d{3,6})\b", text.strip(), re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return None

    def _extract_age_and_gender(self, text: str):
        """Extracts age and gender from text."""
        age = None
        gender = "Unknown"

        age_match = re.search(r"(?:age\s*[:=]?\s*)?(\b\d{1,3}\b)\s*(?:years? old|yo|y/o|years|age)?", text, re.IGNORECASE)
        if age_match:
            try:
                val = int(age_match.group(1))
                if 0 <= val <= 120:
                    age = val
            except ValueError:
                pass

        if re.search(r"\b(male|man|boy|m)\b", text, re.IGNORECASE) and not re.search(r"\b(female|woman)\b", text, re.IGNORECASE):
            gender = "Male"
        elif re.search(r"\b(female|woman|girl|f)\b", text, re.IGNORECASE):
            gender = "Female"

        return age, gender

    def _extract_clinical_and_bacteria_params(self, text: str, default_age: int = 65) -> Dict[str, Any]:
        """Extracts bacteria, pathogen, infection focus, and lab variables."""
        text_lower = text.lower()

        # Age
        age, _ = self._extract_age_and_gender(text)
        if age is None:
            age = default_age

        # Suspected Bacteria / Pathogen
        suspected_pathogen = "E_coli"
        pathogen_detected = False
        if re.search(r"\b(k_pneumoniae|klebsiella|pneumoniae)\b", text_lower):
            suspected_pathogen = "K_pneumoniae"
            pathogen_detected = True
        elif re.search(r"\b(s_aureus|staph|staphylococcus|mrsa)\b", text_lower):
            suspected_pathogen = "S_aureus"
            pathogen_detected = True
        elif re.search(r"\b(p_aeruginosa|pseudomonas|aeruginosa)\b", text_lower):
            suspected_pathogen = "P_aeruginosa"
            pathogen_detected = True
        elif re.search(r"\b(e_coli|escherichia|e\. coli|ecoli)\b", text_lower):
            suspected_pathogen = "E_coli"
            pathogen_detected = True

        # Infection site
        infection_site = "urinary"
        site_detected = False
        if re.search(r"\b(respiratory|pneumonia|lung|sputum|bronchitis)\b", text_lower):
            infection_site = "respiratory"
            site_detected = True
        elif re.search(r"\b(blood|bloodstream|bacteremia|sepsis|line infection)\b", text_lower):
            infection_site = "bloodstream"
            site_detected = True
        elif re.search(r"\b(skin|wound|cellulitis|abscess|soft tissue|surgical)\b", text_lower):
            infection_site = "skin_wound"
            site_detected = True
        elif re.search(r"\b(urinary|uti|urine|cystitis|pyelonephritis|catheter)\b", text_lower):
            infection_site = "urinary"
            site_detected = True

        # ICU
        icu_admit = bool(re.search(r"\b(icu|intensive care|critical care)\b", text_lower))

        # Prior antibiotics in 90 days
        prior_abx = bool(re.search(r"\b(prior abx|prior antibiotic|antibiotic exposure|recent abx|recent antibiotic|past 90 days|last 90 days)\b", text_lower))

        # Hospital days
        hosp_match = re.search(r"(\d{1,3})\s*(?:hospital days?|days in hospital|days admitted|admission days?|days)", text_lower)
        hospital_days = int(hosp_match.group(1)) if hosp_match else (8 if icu_admit else 3)

        # GFR
        gfr_match = re.search(r"gfr\s*(?:is|:|=)?\s*(\d{1,3}(?:\.\d+)?)", text_lower)
        gfr = float(gfr_match.group(1)) if gfr_match else 75.0

        # Immunosuppressed
        immunosuppressed = bool(re.search(r"\b(immunosuppressed|immunocompromised|chemo|chemotherapy|transplant|steroids|hiv)\b", text_lower))

        return {
            "age": age,
            "icu_admit": icu_admit,
            "prior_abx_90d": prior_abx,
            "hospital_days": hospital_days,
            "gfr": gfr,
            "immunosuppressed": immunosuppressed,
            "infection_site": infection_site,
            "suspected_pathogen": suspected_pathogen,
            "pathogen_detected": pathogen_detected,
            "site_detected": site_detected
        }

    def _format_old_patient_details(self, patient: Dict[str, Any], consultations: List[Dict[str, Any]]) -> str:
        """Formats the old details stored in MySQL for a returning patient."""
        header = (
            f"✅ **Patient Identity Verified Successfully!**\n\n"
            f"📋 **Registered EHR Record from Database:**\n"
            f"- **Patient ID**: `{patient['patient_uid']}`\n"
            f"- **Name**: **{patient['name']}**\n"
            f"- **Age / Gender**: {patient['age']} years • {patient['gender']}\n"
            f"- **Registration Date**: {patient.get('created_at', 'Recorded')}\n"
        )

        if not consultations:
            body = (
                f"\n🦠 **Prior Bacterial & Resistance History:**\n"
                f"*No prior bacterial infection or antibiotic resistance records found for this patient yet.*\n"
            )
        else:
            latest = consultations[0]
            raw_pathogen = latest.get('suspected_pathogen', 'Unknown')
            raw_site = latest.get('infection_site', 'Unknown')

            pathogen_map = {
                "K_pneumoniae": "Klebsiella pneumoniae (K_pneumoniae)",
                "E_coli": "Escherichia coli (E_coli)",
                "S_aureus": "Staphylococcus aureus (MRSA)",
                "P_aeruginosa": "Pseudomonas aeruginosa (P_aeruginosa)"
            }
            site_map = {
                "urinary": "Urinary Tract Infection (UTI)",
                "respiratory": "Respiratory Tract Infection (Pneumonia)",
                "bloodstream": "Bloodstream Infection (Bacteremia / Sepsis)",
                "skin_wound": "Skin & Soft Tissue Wound Infection"
            }
            pathogen_display = pathogen_map.get(raw_pathogen, raw_pathogen.replace('_', ' '))
            site_display = site_map.get(raw_site, raw_site.replace('_', ' ').title())
            icu_display = 'ICU Admitted' if latest.get('icu_admit') else 'General Ward'
            prior_abx_display = 'Yes' if latest.get('prior_abx_90d') else 'No'

            body = (
                f"\n🦠 **Previous Bacterial Infection Details (From Database):**\n"
                f"- **Suspected Bacteria / Organism**: `{pathogen_display}`\n"
                f"- **Infection Focus**: `{site_display}`\n"
                f"- **Ward Status & Stay**: {icu_display} ({latest.get('hospital_days', 0)} hospital days)\n"
                f"- **Renal Function (GFR)**: `{latest.get('gfr', 90)} mL/min`\n"
                f"- **Prior Antibiotics (90d)**: {prior_abx_display}\n\n"
                f"📊 **Recorded AMR Resistance Profile:**\n"
                f"- **HAI Infection Risk Score**: **{latest.get('hai_risk_score', 0)}%**\n"
                f"- **Carbapenem Resistance**: **{latest.get('carbapenem_res', 0)}%**\n"
                f"- **Penicillin Resistance**: **{latest.get('penicillin_res', 0)}%**\n"
                f"- **Fluoroquinolone Resistance**: **{latest.get('fluoroquinolone_res', 0)}%**\n\n"
                f"💊 **Prescribed Regimen in Database:**\n"
                f"- **Recommended Drug**: **{latest.get('recommended_drug', 'N/A')}**\n"
                f"- **Alternatives**: {latest.get('alternatives', 'N/A')}\n"
                f"- **Dosing**: {latest.get('dosing_instructions', 'Standard dosage.')}\n"
            )

        footer = (
            f"\n---\n"
            f"Would you like to evaluate a **new bacterial infection**, test **kidney GFR safety**, or run an **updated AMR screen** today?"
        )

        return header + body + footer

    def process_message(self, message: str, session_id: str) -> Dict[str, Any]:
        """Core multi-turn conversational AI controller."""
        session = self.get_or_create_session(session_id)
        msg_clean = message.strip()
        msg_lower = msg_clean.lower()
        current_state = session["state"]
        active_patient = session["active_patient"]

        # 0. Global Reset or Switch Patient command
        if msg_lower in ["reset", "new chat", "clear", "restart"]:
            self.reset_session(session_id)
            return {
                "reply": "🔄 **Conversation Reset.** Hello Clinician! I am Dr. Aegis, your AI Clinical Decision & Antimicrobial Stewardship Assistant connected to the real-time hospital MySQL database.\n\nPlease enter a patient name to start (e.g. *'Patient Eleanor Vance'* or *'New patient Bruce Wayne'*).",
                "session": self.sessions[session_id],
                "active_patient": None,
                "quick_replies": ["Check Eleanor Vance (PT-1001)", "Check Marcus Brody (PT-1002)", "New patient Bruce Wayne"],
                "prediction_result": None
            }

        if msg_lower in ["switch patient", "change patient", "different patient"]:
            session["state"] = "IDLE"
            session["active_patient"] = None
            session["pending_patient_name"] = None
            return {
                "reply": "Switched out of current patient record. Please specify the name of the next patient to evaluate.",
                "session": session,
                "active_patient": None,
                "quick_replies": ["Eleanor Vance", "Marcus Brody", "Sophia Lin", "New Patient"],
                "prediction_result": None
            }

        # -------------------------------------------------------------
        # STATE 1: AWAITING_PATIENT_ID (User provided old name, now verifies with ID)
        # -------------------------------------------------------------
        if current_state == "AWAITING_PATIENT_ID":
            uid = self._extract_patient_uid(msg_clean)
            pending_name = session.get("pending_patient_name")

            if not uid:
                return {
                    "reply": f"⚠️ Please enter the **Patient ID** (such as `PT-1001` or `PT-1002`) to verify **{pending_name}** and retrieve their database records.",
                    "session": session,
                    "active_patient": None,
                    "quick_replies": ["PT-1001", "PT-1002", "PT-1003", "PT-1004"],
                    "prediction_result": None
                }

            verification = verify_patient_by_uid(uid, expected_name=pending_name)
            if not verification:
                return {
                    "reply": f"❌ **ID Not Found**: No record with ID `{uid}` exists in the MySQL database. Please verify the ID or enter a new name.",
                    "session": session,
                    "active_patient": None,
                    "quick_replies": ["Try another ID", f"Register {pending_name} as New"],
                    "prediction_result": None
                }

            if not verification.get("matched", True):
                reason = verification.get("reason", "Name mismatch")
                return {
                    "reply": f"⚠️ **Verification Warning**: {reason}.\n\nWould you like to view records for `{verification['patient']['name']}` or re-enter the ID?",
                    "session": session,
                    "active_patient": None,
                    "quick_replies": [f"Proceed with {verification['patient']['name']}", "Re-enter ID"],
                    "prediction_result": None
                }

            # Successfully verified! Provide all old details from database!
            patient = verification["patient"]
            session["active_patient"] = patient
            session["state"] = "ACTIVE_PATIENT"

            consultations = get_patient_consultations(patient["patient_uid"])
            reply_md = self._format_old_patient_details(patient, consultations)

            return {
                "reply": reply_md,
                "session": session,
                "active_patient": patient,
                "quick_replies": ["Evaluate New Bacterial Infection", "Check GFR Renal Safety", "ICU Klebsiella Case", "Switch Patient"],
                "prediction_result": None
            }

        # -------------------------------------------------------------
        # STATE 2: AWAITING_NEW_PATIENT_DETAILS
        # Need age, gender, and bacteria/infection details to register & run AMR
        # -------------------------------------------------------------
        if current_state == "AWAITING_NEW_PATIENT_DETAILS":
            pending_name = session.get("pending_patient_name", "New Patient")
            age, gender = self._extract_age_and_gender(msg_clean)

            # Check if previous turn already had age/gender saved in session
            if age is None and session.get("pending_age") is not None:
                age = session.get("pending_age")
                gender = session.get("pending_gender", "Unknown")

            # If still no age provided
            if age is None:
                return {
                    "reply": (
                        f"Please provide the **gender and age** for **{pending_name}** (e.g. *'45, Male'*) along with any **bacteria / infection details**:\n"
                        f"- **Suspected Bacteria**: *E. coli*, *K. pneumoniae*, *S. aureus (MRSA)*, or *P. aeruginosa*\n"
                        f"- **Infection Site**: *Urinary*, *Respiratory*, *Bloodstream*, or *Skin/Wound*\n"
                        f"- **Clinical Context**: Ward/ICU status, hospital days, prior antibiotic exposure (last 90 days), GFR."
                    ),
                    "session": session,
                    "active_patient": None,
                    "quick_replies": ["Age 65, Male, UTI (E. coli)", "Age 50, Female, Respiratory (K. pneumoniae)", "Age 72, Male, ICU Sepsis (MRSA)"],
                    "prediction_result": None
                }

            # Extract bacteria & clinical parameters
            params = self._extract_clinical_and_bacteria_params(msg_clean, default_age=age)

            # Check if user provided bacteria details or just age/gender
            if not params["pathogen_detected"] and not params["site_detected"] and not bool(re.search(r"\b(icu|gfr|uti|wound|blood|infection)\b", msg_lower)):
                # User provided just age/gender; register patient in MySQL and prompt for bacteria details
                session["pending_age"] = age
                session["pending_gender"] = gender
                new_patient = create_patient(name=pending_name, age=age, gender=gender)
                session["active_patient"] = new_patient

                return {
                    "reply": (
                        f"🎉 **New Patient Registered in MySQL Database!**\n\n"
                        f"- **Assigned Patient ID**: `{new_patient['patient_uid']}`\n"
                        f"- **Name**: **{new_patient['name']}**\n"
                        f"- **Age / Gender**: {new_patient['age']} years • {new_patient['gender']}\n\n"
                        f"Now, please provide the **bacterial infection details** for this project:\n"
                        f"1. **Suspected Bacteria / Pathogen**: *E. coli*, *K. pneumoniae*, *S. aureus (MRSA)*, or *P. aeruginosa*\n"
                        f"2. **Infection Focus**: *Urinary*, *Respiratory*, *Bloodstream*, or *Skin/Wound*\n"
                        f"3. **Clinical Context**: ICU admission? Hospital days? Prior antibiotics in 90 days? GFR level?"
                    ),
                    "session": session,
                    "active_patient": new_patient,
                    "quick_replies": [
                        "Urinary infection with E. coli",
                        "Respiratory infection with K. pneumoniae, ICU, GFR 25",
                        "Bloodstream infection with P. aeruginosa",
                        "Skin / wound infection with S. aureus (MRSA)"
                    ],
                    "prediction_result": None
                }

            # User provided age, gender, AND bacteria details!
            # Register patient in MySQL
            new_patient = create_patient(name=pending_name, age=age, gender=gender)
            session["active_patient"] = new_patient
            session["state"] = "ACTIVE_PATIENT"

            # Execute AMR ML Model
            ml_res = amr_ml_engine.predict_patient(params)
            res_probs = ml_res["resistance_probabilities"]
            hai_risk = ml_res["hai_risk_score"]
            rec = ml_res["empiric_recommendation"]

            # Save consultation & bacteria details to MySQL
            consultation_record = {
                "patient_uid": new_patient["patient_uid"],
                "infection_site": params["infection_site"],
                "suspected_pathogen": params["suspected_pathogen"],
                "icu_admit": params["icu_admit"],
                "prior_abx_90d": params["prior_abx_90d"],
                "hospital_days": params["hospital_days"],
                "gfr": params["gfr"],
                "immunosuppressed": params["immunosuppressed"],
                "hai_risk_score": hai_risk,
                "carbapenem_res": res_probs.get("carbapenem", 0.0),
                "penicillin_res": res_probs.get("penicillin", 0.0),
                "fluoroquinolone_res": res_probs.get("fluoroquinolone", 0.0),
                "recommended_drug": rec.get("recommended_antibiotic", ""),
                "alternatives": ", ".join(rec.get("alternatives", [])),
                "dosing_instructions": rec.get("dosing_instructions", ""),
                "clinical_notes": f"Initial bacterial intake: {params['suspected_pathogen']} in {params['infection_site']}"
            }
            save_patient_consultation(consultation_record)

            # Renal alert
            renal_alert_md = ""
            if params["gfr"] < 30:
                renal_alert_md = f"\n\n> ⚠️ **CRITICAL RENAL ALERT**: GFR is **{params['gfr']} mL/min** (< 30). Renal dosage adjustment required. Avoid aminoglycosides and nephrotoxic combos."
            elif params["gfr"] < 60:
                renal_alert_md = f"\n\n> ℹ️ **MODERATE RENAL ALERT**: GFR is **{params['gfr']} mL/min**. Monitor serum creatinine closely."

            reply_md = (
                f"🎉 **New Patient Registered & Bacterial Evaluation Complete!**\n\n"
                f"📋 **Patient Record Added to Database:**\n"
                f"- **Assigned Patient ID**: `{new_patient['patient_uid']}`\n"
                f"- **Name**: **{new_patient['name']}**\n"
                f"- **Age / Gender**: {new_patient['age']} years • {new_patient['gender']}\n\n"
                f"🦠 **Bacterial & Clinical Context:**\n"
                f"- **Suspected Bacteria / Organism**: `{params['suspected_pathogen'].replace('_', ' ')}`\n"
                f"- **Infection Site**: `{params['infection_site'].title()}`\n"
                f"- **Ward Status**: `{'ICU' if params['icu_admit'] else 'General Ward'}` | Hospital Days: `{params['hospital_days']}` | GFR: `{params['gfr']} mL/min`\n"
                f"- **Prior Antibiotics (90d)**: `{'Yes' if params['prior_abx_90d'] else 'No'}`\n\n"
                f"📊 **Machine Learning AMR Resistance Predictions:**\n"
                f"- **HAI Infection Risk Score**: **{hai_risk}%**\n"
                f"- **Carbapenem Resistance**: **{res_probs.get('carbapenem', 0)}%**\n"
                f"- **Penicillin Resistance**: **{res_probs.get('penicillin', 0)}%**\n"
                f"- **Fluoroquinolone Resistance**: **{res_probs.get('fluoroquinolone', 0)}%**\n"
                f"- **Cephalosporin Resistance**: **{res_probs.get('cephalosporin', 0)}%**{renal_alert_md}\n\n"
                f"💊 **CDC-Guided Empiric Antibiotic Regimen:**\n"
                f"- **Recommended First-Line Choice**: **{rec.get('recommended_antibiotic', '')}**\n"
                f"- **Clinical Rationale**: {rec.get('clinical_rationale', '')}\n"
                f"- **Dosing**: {rec.get('dosing_instructions', '')}\n"
                f"- **Alternatives**: {', '.join(rec.get('alternatives', []))}\n\n"
                f"💾 *All patient & bacterial records committed to MySQL database.*"
            )

            return {
                "reply": reply_md,
                "session": session,
                "active_patient": new_patient,
                "quick_replies": ["Evaluate Another Bacteria", "Test Lower GFR (20 mL/min)", "Switch to ICU Status", "Switch Patient"],
                "prediction_result": {
                    "params": params,
                    "ml": ml_res,
                    "patient": new_patient
                }
            }

        # -------------------------------------------------------------
        # CHECK FOR NEW / OLD PATIENT NAME OR DIRECT ID
        # -------------------------------------------------------------
        # Direct UID check (e.g. PT-1001)
        direct_uid = self._extract_patient_uid(msg_clean)
        if direct_uid and not active_patient:
            verification = verify_patient_by_uid(direct_uid)
            if verification and verification.get("matched"):
                patient = verification["patient"]
                session["active_patient"] = patient
                session["state"] = "ACTIVE_PATIENT"
                consultations = get_patient_consultations(patient["patient_uid"])
                reply_md = self._format_old_patient_details(patient, consultations)
                return {
                    "reply": reply_md,
                    "session": session,
                    "active_patient": patient,
                    "quick_replies": ["Evaluate New Bacterial Infection", "Check GFR Renal Safety", "Switch Patient"],
                    "prediction_result": None
                }

        # Name candidate check
        name_cand = self._extract_name_candidate(msg_clean)
        if name_cand and (not active_patient or name_cand.lower() != active_patient["name"].lower()):
            matches = search_patient_by_name(name_cand)
            session["pending_patient_name"] = name_cand
            session["pending_patient_matches"] = matches

            if matches:
                # OLD PATIENT NAME: PRESENT IN DATABASE!
                # Ask directly for ID verification and then provide old details
                session["state"] = "AWAITING_PATIENT_ID"
                sample_id = matches[0]["patient_uid"]
                return {
                    "reply": (
                        f"🔍 **Existing Patient Record Detected!**\n\n"
                        f"I found an existing record for **{name_cand}** in the MySQL database.\n\n"
                        f"👉 **Please enter their Patient ID (e.g. `{sample_id}`) to verify and retrieve their past clinical & bacterial details.**"
                    ),
                    "session": session,
                    "active_patient": None,
                    "quick_replies": [f"Verify {sample_id}", "Cancel"],
                    "prediction_result": None
                }
            else:
                # NEW PATIENT NAME: NOT PRESENT IN DATABASE!
                # Ask for gender, age, and bacteria details related to the project
                session["state"] = "AWAITING_NEW_PATIENT_DETAILS"
                return {
                    "reply": (
                        f"🔍 **New Patient Detected!**\n\n"
                        f"I checked the MySQL database and found **no existing record** for **{name_cand}**.\n\n"
                        f"To register this new patient, please provide:\n"
                        f"1. **Gender and Age** (e.g. *'45, Male'*)\n"
                        f"2. **Bacterial infection details related to the project**:\n"
                        f"   - **Suspected Bacteria / Organism**: *E. coli*, *K. pneumoniae*, *S. aureus (MRSA)*, or *P. aeruginosa*\n"
                        f"   - **Infection Focus**: *Urinary (UTI)*, *Respiratory (Pneumonia)*, *Bloodstream (Sepsis)*, or *Skin/Wound*\n"
                        f"   - **Clinical Context**: ICU admission? Hospital days? Prior antibiotic exposure in last 90 days? GFR (kidney function)?"
                    ),
                    "session": session,
                    "active_patient": None,
                    "quick_replies": [
                        "Age 65, Male, UTI with E. coli",
                        "Age 52, Female, Respiratory with K. pneumoniae, ICU, GFR 25",
                        "Age 70, Male, Bloodstream Sepsis with MRSA",
                        "Age 40, Female, Skin wound infection"
                    ],
                    "prediction_result": None
                }

        # -------------------------------------------------------------
        # STATE 3: ACTIVE_PATIENT (Clinical AMR Prediction & CDSS)
        # -------------------------------------------------------------
        if active_patient:
            # Clinical or bacteria inquiry
            params = self._extract_clinical_and_bacteria_params(msg_clean, default_age=active_patient.get("age", 65))
            
            # Execute ML Engine prediction
            ml_res = amr_ml_engine.predict_patient(params)
            res_probs = ml_res["resistance_probabilities"]
            hai_risk = ml_res["hai_risk_score"]
            rec = ml_res["empiric_recommendation"]

            # Save consultation to MySQL
            consultation_record = {
                "patient_uid": active_patient["patient_uid"],
                "infection_site": params["infection_site"],
                "suspected_pathogen": params["suspected_pathogen"],
                "icu_admit": params["icu_admit"],
                "prior_abx_90d": params["prior_abx_90d"],
                "hospital_days": params["hospital_days"],
                "gfr": params["gfr"],
                "immunosuppressed": params["immunosuppressed"],
                "hai_risk_score": hai_risk,
                "carbapenem_res": res_probs.get("carbapenem", 0.0),
                "penicillin_res": res_probs.get("penicillin", 0.0),
                "fluoroquinolone_res": res_probs.get("fluoroquinolone", 0.0),
                "recommended_drug": rec.get("recommended_antibiotic", ""),
                "alternatives": ", ".join(rec.get("alternatives", [])),
                "dosing_instructions": rec.get("dosing_instructions", ""),
                "clinical_notes": f"Prompt: {msg_clean[:120]}"
            }
            save_patient_consultation(consultation_record)

            renal_alert_md = ""
            if params["gfr"] < 30:
                renal_alert_md = f"\n\n> ⚠️ **CRITICAL RENAL ALERT**: GFR is **{params['gfr']} mL/min** (< 30). Renal dosage adjustment required. Avoid aminoglycosides and nephrotoxic combos."
            elif params["gfr"] < 60:
                renal_alert_md = f"\n\n> ℹ️ **MODERATE RENAL ALERT**: GFR is **{params['gfr']} mL/min**. Monitor serum creatinine closely."

            reply_md = (
                f"🧬 **Aegis AMR Clinical Evaluation for {active_patient['name']}** (`{active_patient['patient_uid']}`)\n\n"
                f"**Bacterial Infection & Clinical Profile:**\n"
                f"- **Suspected Bacteria / Organism**: `{params['suspected_pathogen'].replace('_', ' ')}`\n"
                f"- **Infection Site**: `{params['infection_site'].title()}`\n"
                f"- **Ward**: `{'ICU' if params['icu_admit'] else 'General Ward'}` | Hospital Days: `{params['hospital_days']}` | GFR: `{params['gfr']} mL/min`\n"
                f"- **Prior Antibiotics (90d)**: `{'Yes' if params['prior_abx_90d'] else 'No'}`\n\n"
                f"**Predicted Antimicrobial Resistance Profiles:**\n"
                f"- **HAI Infection Risk Score**: **{hai_risk}%**\n"
                f"- **Penicillin Resistance**: **{res_probs.get('penicillin', 0)}%**\n"
                f"- **Cephalosporin Resistance**: **{res_probs.get('cephalosporin', 0)}%**\n"
                f"- **Fluoroquinolone Resistance**: **{res_probs.get('fluoroquinolone', 0)}%**\n"
                f"- **Carbapenem Resistance**: **{res_probs.get('carbapenem', 0)}%**{renal_alert_md}\n\n"
                f"**Empiric Antibiotic Guidance:**\n"
                f"- 💊 **First-Line Choice**: **{rec.get('recommended_antibiotic', '')}**\n"
                f"- 📋 **Rationale**: {rec.get('clinical_rationale', '')}\n"
                f"- 💉 **Dosing Instructions**: {rec.get('dosing_instructions', '')}\n"
                f"- 🔄 **Alternatives**: {', '.join(rec.get('alternatives', []))}\n\n"
                f"💾 *Consultation & bacterial resistance records committed to MySQL database.*"
            )

            return {
                "reply": reply_md,
                "session": session,
                "active_patient": active_patient,
                "quick_replies": ["Evaluate Different Bacteria", "Test Lower GFR (20 mL/min)", "Switch to ICU Status", "Switch Patient"],
                "prediction_result": {
                    "params": params,
                    "ml": ml_res,
                    "patient": active_patient
                }
            }

        # -------------------------------------------------------------
        # DEFAULT / GREETING / HELP STATE
        # -------------------------------------------------------------
        return {
            "reply": (
                "👋 **Welcome to the Aegis AI Clinical Decision Chatbot!**\n\n"
                "Connected to your real-time **MySQL Hospital EHR Database** (`aegis_amr_db`):\n\n"
                "• **Old Patient Present in Database?** Enter their name (e.g. *'Patient Eleanor Vance'* or *'Marcus Brody'*). I will ask for their **Patient ID** to verify and **provide all their old details** and past bacterial infection history!\n\n"
                "• **New Patient?** Enter their name (e.g. *'New patient John Doe'*). I will ask for their **gender, age, and bacteria details related to the project** (suspected pathogen, infection site, ICU status, GFR), store them in MySQL, and run the AMR prediction!\n\n"
                "To get started, enter a patient name below."
            ),
            "session": session,
            "active_patient": None,
            "quick_replies": ["Check Eleanor Vance (PT-1001)", "Check Marcus Brody (PT-1002)", "New patient Bruce Wayne"],
            "prediction_result": None
        }

# Global singleton engine
chatbot_engine = ClinicalChatbotEngine()
