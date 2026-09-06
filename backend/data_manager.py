import pandas as pd
import numpy as np

# Statistically modeled dataset matching WHO GLASS and ECDC report patterns (2021-2023)
SURVEILLANCE_DATA = {
    "SE": { # Sweden
        "name": "Sweden",
        "mrsa": 1.5,
        "cre_coli": 4.2,
        "cr_kp": 0.5,
        "fq_coli": 10.2,
        "abx_consumption": 10.8, # DDD per 1000 inhabitants/day
        "ipc_score": 92.0,
        "trend": [
            {"year": 2019, "mrsa": 1.2, "cre_coli": 3.8, "cr_kp": 0.3},
            {"year": 2020, "mrsa": 1.4, "cre_coli": 4.0, "cr_kp": 0.4},
            {"year": 2021, "mrsa": 1.5, "cre_coli": 4.1, "cr_kp": 0.4},
            {"year": 2022, "mrsa": 1.5, "cre_coli": 4.2, "cr_kp": 0.5},
            {"year": 2023, "mrsa": 1.6, "cre_coli": 4.3, "cr_kp": 0.5}
        ]
    },
    "DE": { # Germany
        "name": "Germany",
        "mrsa": 7.8,
        "cre_coli": 8.5,
        "cr_kp": 1.8,
        "fq_coli": 15.6,
        "abx_consumption": 14.2,
        "ipc_score": 85.5,
        "trend": [
            {"year": 2019, "mrsa": 8.9, "cre_coli": 8.0, "cr_kp": 1.5},
            {"year": 2020, "mrsa": 8.2, "cre_coli": 8.3, "cr_kp": 1.6},
            {"year": 2021, "mrsa": 8.0, "cre_coli": 8.5, "cr_kp": 1.7},
            {"year": 2022, "mrsa": 7.8, "cre_coli": 8.5, "cr_kp": 1.8},
            {"year": 2023, "mrsa": 7.5, "cre_coli": 8.7, "cr_kp": 1.9}
        ]
    },
    "FR": { # France
        "name": "France",
        "mrsa": 10.2,
        "cre_coli": 11.1,
        "cr_kp": 2.5,
        "fq_coli": 18.2,
        "abx_consumption": 18.5,
        "ipc_score": 83.0,
        "trend": [
            {"year": 2019, "mrsa": 12.1, "cre_coli": 10.5, "cr_kp": 2.1},
            {"year": 2020, "mrsa": 11.5, "cre_coli": 10.9, "cr_kp": 2.3},
            {"year": 2021, "mrsa": 10.8, "cre_coli": 11.0, "cr_kp": 2.4},
            {"year": 2022, "mrsa": 10.2, "cre_coli": 11.1, "cr_kp": 2.5},
            {"year": 2023, "mrsa": 9.8, "cre_coli": 11.3, "cr_kp": 2.6}
        ]
    },
    "IT": { # Italy
        "name": "Italy",
        "mrsa": 29.8,
        "cre_coli": 15.4,
        "cr_kp": 26.7,
        "fq_coli": 28.5,
        "abx_consumption": 21.4,
        "ipc_score": 74.0,
        "trend": [
            {"year": 2019, "mrsa": 34.0, "cre_coli": 14.8, "cr_kp": 28.5},
            {"year": 2020, "mrsa": 32.5, "cre_coli": 15.1, "cr_kp": 27.8},
            {"year": 2021, "mrsa": 30.9, "cre_coli": 15.3, "cr_kp": 27.1},
            {"year": 2022, "mrsa": 29.8, "cre_coli": 15.4, "cr_kp": 26.7},
            {"year": 2023, "mrsa": 28.5, "cre_coli": 15.6, "cr_kp": 26.0}
        ]
    },
    "GR": { # Greece
        "name": "Greece",
        "mrsa": 38.2,
        "cre_coli": 20.1,
        "cr_kp": 64.7,
        "fq_coli": 32.4,
        "abx_consumption": 24.8,
        "ipc_score": 68.0,
        "trend": [
            {"year": 2019, "mrsa": 40.5, "cre_coli": 18.2, "cr_kp": 66.2},
            {"year": 2020, "mrsa": 39.8, "cre_coli": 19.0, "cr_kp": 65.8},
            {"year": 2021, "mrsa": 38.9, "cre_coli": 19.5, "cr_kp": 65.2},
            {"year": 2022, "mrsa": 38.2, "cre_coli": 20.1, "cr_kp": 64.7},
            {"year": 2023, "mrsa": 37.6, "cre_coli": 20.8, "cr_kp": 64.1}
        ]
    },
    "ES": { # Spain
        "name": "Spain",
        "mrsa": 18.4,
        "cre_coli": 12.3,
        "cr_kp": 6.8,
        "fq_coli": 22.1,
        "abx_consumption": 19.1,
        "ipc_score": 81.0,
        "trend": [
            {"year": 2019, "mrsa": 21.0, "cre_coli": 11.5, "cr_kp": 5.9},
            {"year": 2020, "mrsa": 19.8, "cre_coli": 12.0, "cr_kp": 6.2},
            {"year": 2021, "mrsa": 19.1, "cre_coli": 12.1, "cr_kp": 6.5},
            {"year": 2022, "mrsa": 18.4, "cre_coli": 12.3, "cr_kp": 6.8},
            {"year": 2023, "mrsa": 17.9, "cre_coli": 12.5, "cr_kp": 7.1}
        ]
    },
    "PL": { # Poland
        "name": "Poland",
        "mrsa": 15.6,
        "cre_coli": 10.8,
        "cr_kp": 18.9,
        "fq_coli": 24.3,
        "abx_consumption": 22.1,
        "ipc_score": 76.5,
        "trend": [
            {"year": 2019, "mrsa": 17.2, "cre_coli": 9.8, "cr_kp": 16.5},
            {"year": 2020, "mrsa": 16.5, "cre_coli": 10.2, "cr_kp": 17.3},
            {"year": 2021, "mrsa": 16.0, "cre_coli": 10.5, "cr_kp": 18.0},
            {"year": 2022, "mrsa": 15.6, "cre_coli": 10.8, "cr_kp": 18.9},
            {"year": 2023, "mrsa": 15.2, "cre_coli": 11.1, "cr_kp": 19.5}
        ]
    },
    "RO": { # Romania
        "name": "Romania",
        "mrsa": 46.5,
        "cre_coli": 18.5,
        "cr_kp": 48.2,
        "fq_coli": 31.0,
        "abx_consumption": 26.2,
        "ipc_score": 62.0,
        "trend": [
            {"year": 2019, "mrsa": 48.9, "cre_coli": 16.5, "cr_kp": 44.5},
            {"year": 2020, "mrsa": 47.8, "cre_coli": 17.2, "cr_kp": 46.0},
            {"year": 2021, "mrsa": 47.1, "cre_coli": 17.9, "cr_kp": 47.3},
            {"year": 2022, "mrsa": 46.5, "cre_coli": 18.5, "cr_kp": 48.2},
            {"year": 2023, "mrsa": 45.8, "cre_coli": 19.1, "cr_kp": 49.0}
        ]
    }
}

# Hospital ward configurations & initial states
WARD_METRICS = {
    "icu": {
        "active_patients": 18,
        "beds_capacity": 20,
        "hand_hygiene_compliance": 82.5,  # % compliance
        "ventilator_associated_pneumonia_rate": 4.2,  # per 1000 ventilator days
        "catheter_associated_uti_rate": 1.8,
        "clabsi_rate": 1.2,  # Central line bloodstream infections
        "cdiff_cases_last_month": 3,
        "antibiotic_usage_index": 780,  # Defined Daily Doses (DDD) per 1000 patient-days
    },
    "general_medicine": {
        "active_patients": 42,
        "beds_capacity": 45,
        "hand_hygiene_compliance": 75.0,
        "ventilator_associated_pneumonia_rate": 0.0,
        "catheter_associated_uti_rate": 2.5,
        "clabsi_rate": 0.4,
        "cdiff_cases_last_month": 5,
        "antibiotic_usage_index": 420,
    },
    "surgery": {
        "active_patients": 26,
        "beds_capacity": 30,
        "hand_hygiene_compliance": 88.0,
        "ventilator_associated_pneumonia_rate": 0.5,
        "catheter_associated_uti_rate": 1.1,
        "clabsi_rate": 0.8,
        "cdiff_cases_last_month": 2,
        "antibiotic_usage_index": 590,
    }
}

def get_surveillance_data():
    return SURVEILLANCE_DATA

def get_ward_metrics():
    return WARD_METRICS
