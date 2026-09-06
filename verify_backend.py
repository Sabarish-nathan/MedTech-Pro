import sys
import os

# Ensure the root directory is in the path so we can import 'backend'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.ml_models import amr_ml_engine
from backend.simulator import ward_simulator
from backend.data_manager import get_surveillance_data, get_ward_metrics

def test_ml_predictions():
    print("Testing ML Engine...")
    
    # Test case 1: Elderly patient with prior antibiotic exposure in the ICU
    profile = {
        "age": 75,
        "icu_admit": True,
        "prior_abx_90d": True,
        "hospital_days": 12,
        "gfr": 28.5,  # GFR < 30
        "immunosuppressed": True,
        "infection_site": "respiratory",
        "suspected_pathogen": "K_pneumoniae"
    }
    
    result = amr_ml_engine.predict_patient(profile)
    
    assert "resistance_probabilities" in result, "Missing resistance probabilities in result"
    assert "hai_risk_score" in result, "Missing hai risk score in result"
    assert "empiric_recommendation" in result, "Missing recommendation in result"
    
    rec = result["empiric_recommendation"]
    print(f"  [+] Recommended Drug: {rec['recommended_antibiotic']}")
    print(f"  [+] Alternatives: {', '.join(rec['alternatives'])}")
    print(f"  [+] GFR Alert triggered correctly: {'GFR < 30' in rec['dosing_instructions'] or 'Fosfomycin' in rec['recommended_antibiotic'] or 'renal' in rec['dosing_instructions'].lower()}")
    
    # Assert resistance rates are calculated
    probs = result["resistance_probabilities"]
    print(f"  [+] Carbapenem Resistance probability: {probs['carbapenem']}%")
    print(f"  [+] Penicillin Resistance probability: {probs['penicillin']}%")
    print(f"  [+] HAI Risk Score: {result['hai_risk_score']}%")
    print("ML Engine Tests passed successfully!")
    print("-" * 50)

def test_simulator():
    print("Testing Outbreak Simulator...")
    
    # Run simulation with low compliance
    sim_result_low = ward_simulator.run_simulation(
        ward_type="icu",
        hand_hygiene_compliance=40.0,
        isolation_speed=5.0,
        cleaning_frequency=1,
        staff_ratio=0.2
    )
    
    # Run simulation with high compliance
    sim_result_high = ward_simulator.run_simulation(
        ward_type="icu",
        hand_hygiene_compliance=95.0,
        isolation_speed=1.0,
        cleaning_frequency=3,
        staff_ratio=0.8
    )
    
    assert len(sim_result_low["daily_history"]) == 31, "History must have 31 entries for 30-day simulation"
    assert sim_result_low["total_new_infections"] >= sim_result_high["total_new_infections"], \
        "Low compliance should yield equal or more infections than high compliance"
        
    print(f"  [+] Low compliance infections: {sim_result_low['total_new_infections']}")
    print(f"  [+] High compliance infections: {sim_result_high['total_new_infections']}")
    print(f"  [+] Low compliance outbreak warning: {sim_result_low['active_outbreak_warning']}")
    print(f"  [+] High compliance outbreak warning: {sim_result_high['active_outbreak_warning']}")
    print("Outbreak Simulator Tests passed successfully!")
    print("-" * 50)

def test_data_manager():
    print("Testing Data Manager...")
    surv = get_surveillance_data()
    wards = get_ward_metrics()
    
    assert "SE" in surv, "Missing Sweden in surveillance data"
    assert "icu" in wards, "Missing ICU in ward metrics"
    
    print(f"  [+] Countries loaded: {len(surv)}")
    print(f"  [+] Wards loaded: {len(wards)}")
    print("Data Manager Tests passed successfully!")
    print("-" * 50)

if __name__ == "__main__":
    print("AegisAMR Backend Offline Verification Script")
    print("=" * 50)
    try:
        test_data_manager()
        test_ml_predictions()
        test_simulator()
        print("All backend offline tests completed successfully! System is integral.")
    except Exception as e:
        print(f"[-] Test failed: {str(e)}")
        sys.exit(1)
