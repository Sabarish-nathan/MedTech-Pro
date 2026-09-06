import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder
import pickle

# Simple trained ML pipeline simulated in memory for prompt and reliable execution
class AMRModelSuite:
    def __init__(self):
        self.encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        self.resistance_models = {}
        self.hai_model = None
        self.features = ['age', 'icu_admit', 'prior_abx_90d', 'hospital_days', 'gfr', 'immunosuppressed']
        self.cat_features = ['infection_site', 'suspected_pathogen']
        self._train_models()

    def _generate_synthetic_training_data(self, size=1500):
        np.random.seed(42)
        
        # Continuous and binary variables
        age = np.random.randint(18, 90, size=size)
        icu_admit = np.random.choice([0, 1], p=[0.75, 0.25], size=size)
        prior_abx_90d = np.random.choice([0, 1], p=[0.6, 0.4], size=size)
        hospital_days = np.random.randint(1, 30, size=size)
        gfr = np.random.normal(75, 20, size=size).clip(15, 120)
        immunosuppressed = np.random.choice([0, 1], p=[0.85, 0.15], size=size)
        
        # Categorical features
        infection_sites = np.random.choice(['urinary', 'respiratory', 'bloodstream', 'skin_wound'], size=size)
        suspected_pathogens = np.random.choice(['E_coli', 'S_aureus', 'K_pneumoniae', 'P_aeruginosa'], size=size)
        
        df = pd.DataFrame({
            'age': age,
            'icu_admit': icu_admit,
            'prior_abx_90d': prior_abx_90d,
            'hospital_days': hospital_days,
            'gfr': gfr,
            'immunosuppressed': immunosuppressed,
            'infection_site': infection_sites,
            'suspected_pathogen': suspected_pathogens
        })
        
        # Synthesize target label probabilities based on clinically accurate multipliers
        # Penicillin resistance (e.g. MRSA, or beta-lactamase E. coli)
        p_pen = 0.2 + 0.2 * df['prior_abx_90d'] + 0.1 * df['icu_admit'] + 0.05 * (df['hospital_days'] > 10)
        p_pen += (df['suspected_pathogen'] == 'S_aureus') * 0.3  # MRSA representation
        p_pen += (df['suspected_pathogen'] == 'K_pneumoniae') * 0.4
        p_pen = p_pen.clip(0.05, 0.95)
        df['res_penicillin'] = np.random.binomial(1, p_pen)
        
        # Cephalosporin resistance
        p_ceph = 0.1 + 0.15 * df['prior_abx_90d'] + 0.15 * df['icu_admit'] + 0.1 * (df['hospital_days'] > 7)
        p_ceph += (df['suspected_pathogen'] == 'E_coli') * 0.15  # ESBL E.coli
        p_ceph += (df['suspected_pathogen'] == 'K_pneumoniae') * 0.3
        p_ceph = p_ceph.clip(0.02, 0.92)
        df['res_cephalosporin'] = np.random.binomial(1, p_ceph)

        # Fluoroquinolone resistance
        p_fq = 0.15 + 0.1 * df['prior_abx_90d'] + 0.05 * df['icu_admit'] + 0.08 * (df['age'] > 65)
        p_fq += (df['suspected_pathogen'] == 'E_coli') * 0.25
        p_fq += (df['suspected_pathogen'] == 'P_aeruginosa') * 0.2
        p_fq = p_fq.clip(0.05, 0.90)
        df['res_fluoroquinolone'] = np.random.binomial(1, p_fq)
        
        # Carbapenem resistance
        p_carb = 0.01 + 0.08 * df['prior_abx_90d'] + 0.12 * df['icu_admit'] + 0.15 * (df['hospital_days'] > 14)
        p_carb += (df['suspected_pathogen'] == 'K_pneumoniae') * 0.25
        p_carb += (df['suspected_pathogen'] == 'P_aeruginosa') * 0.3
        p_carb = p_carb.clip(0.005, 0.85)
        df['res_carbapenem'] = np.random.binomial(1, p_carb)
        
        # HAI development risk
        p_hai = 0.05 + 0.15 * df['icu_admit'] + 0.08 * (df['hospital_days'] > 5) + 0.12 * df['immunosuppressed'] + 0.05 * df['prior_abx_90d']
        p_hai = p_hai.clip(0.02, 0.88)
        df['hai_developed'] = np.random.binomial(1, p_hai)
        
        return df

    def _train_models(self):
        df = self._generate_synthetic_training_data()
        
        # Fit encoder on categorical columns
        self.encoder.fit(df[self.cat_features])
        encoded_cats = self.encoder.transform(df[self.cat_features])
        cat_cols = [f"cat_{i}" for i in range(encoded_cats.shape[1])]
        encoded_df = pd.DataFrame(encoded_cats, columns=cat_cols)
        
        X = pd.concat([df[self.features], encoded_df], axis=1)
        
        # Train classifiers for AMR classes
        for abx in ['penicillin', 'cephalosporin', 'fluoroquinolone', 'carbapenem']:
            model = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
            model.fit(X.values, df[f'res_{abx}'])
            self.resistance_models[abx] = model
            
        # Train classifier for general HAI risk
        self.hai_model = LogisticRegression(max_iter=1000, random_state=42)
        self.hai_model.fit(X.values, df['hai_developed'])

    def predict_patient(self, input_dict):
        """
        Input dictionary contains:
        {
            "age": int,
            "icu_admit": bool (True/False),
            "prior_abx_90d": bool,
            "hospital_days": int,
            "gfr": float,
            "immunosuppressed": bool,
            "infection_site": str ('urinary', 'respiratory', 'bloodstream', 'skin_wound'),
            "suspected_pathogen": str ('E_coli', 'S_aureus', 'K_pneumoniae', 'P_aeruginosa')
        }
        """
        # Convert bool to int
        df_row = pd.DataFrame([{
            'age': float(input_dict['age']),
            'icu_admit': int(input_dict['icu_admit']),
            'prior_abx_90d': int(input_dict['prior_abx_90d']),
            'hospital_days': float(input_dict['hospital_days']),
            'gfr': float(input_dict['gfr']),
            'immunosuppressed': int(input_dict['immunosuppressed']),
            'infection_site': input_dict['infection_site'],
            'suspected_pathogen': input_dict['suspected_pathogen']
        }])
        
        # Transform categorical
        encoded_cats = self.encoder.transform(df_row[self.cat_features])
        encoded_df = pd.DataFrame(encoded_cats)
        
        X_pred = np.hstack([df_row[self.features].values, encoded_df.values])
        
        # Calculate resistance probabilities
        res_probs = {}
        for abx, model in self.resistance_models.items():
            prob = model.predict_proba(X_pred)[0][1] # Probability of class 1
            res_probs[abx] = float(round(prob * 100, 1))
            
        # Calculate HAI risk
        hai_prob = self.hai_model.predict_proba(X_pred)[0][1]
        hai_score = float(round(hai_prob * 100, 1))
        
        # Recommend Empiric Therapy
        recommendation = self._compute_recommendation(input_dict, res_probs)
        
        return {
            "resistance_probabilities": res_probs,
            "hai_risk_score": hai_score,
            "empiric_recommendation": recommendation
        }
        
    def _compute_recommendation(self, input_dict, res_probs):
        pathogen = input_dict['suspected_pathogen']
        site = input_dict['infection_site']
        gfr = input_dict['gfr']
        
        # Baseline choices
        best_choice = "Amoxicillin/Clavulanate (Augmentin)"
        alternatives = ["Ciprofloxacin", "Ceftriaxone"]
        reason = "Standard empiric choice for minor localized infections."
        dose_note = "Standard adult dose: 875/125 mg orally twice daily."
        
        # Logic based on resistance and clinical criteria
        if site == 'respiratory':
            if res_probs['penicillin'] > 50:
                best_choice = "Levofloxacin (Levaquin)"
                alternatives = ["Ceftriaxone + Azithromycin", "Linezolid (if suspecting MRSA)"]
                reason = "High risk of penicillin/beta-lactam resistance. Using respiratory fluoroquinolone coverage."
                dose_note = "Standard dose: 750 mg IV/PO daily."
            else:
                best_choice = "Ceftriaxone (Rocephin) + Azithromycin"
                alternatives = ["Levofloxacin", "Piperacillin/Tazobactam"]
                reason = "Broad-spectrum coverage for community/atypical pneumonia."
                dose_note = "Ceftriaxone 1-2g IV daily. Adjust azithromycin standard course."
                
        elif site == 'urinary':
            if res_probs['fluoroquinolone'] > 40:
                best_choice = "Nitrofurantoin (Macrobid)"
                alternatives = ["Fosfomycin", "Ertapenem (if ESBL confirmed)"]
                reason = "Local/patient fluoroquinolone resistance is high. Opting for Nitrofurantoin for cystitis."
                dose_note = "100 mg orally twice daily for 5 days. Avoid if GFR < 30."
            else:
                best_choice = "Ciprofloxacin (Cipro)"
                alternatives = ["Trimethoprim/Sulfamethoxazole", "Nitrofurantoin"]
                reason = "Standard empiric agent for uncomplicated pyelonephritis/UTI."
                dose_note = "500 mg orally twice daily."
                
        elif site == 'bloodstream' or input_dict['icu_admit']:
            if res_probs['cephalosporin'] > 40 or res_probs['carbapenem'] < 10:
                best_choice = "Meropenem (Merrem)"
                alternatives = ["Piperacillin/Tazobactam", "Vancomycin + Meropenem"]
                reason = "Suspected severe sepsis. High cephalosporin resistance. Carbapenem chosen for stable coverage."
                dose_note = "1g IV every 8 hours."
            else:
                best_choice = "Piperacillin/Tazobactam (Zosyn)"
                alternatives = ["Cefepime", "Meropenem"]
                reason = "Broad antipseudomonal cover suitable for ICU sepsis management."
                dose_note = "4.5g IV every 6 hours."
                
        elif site == 'skin_wound' and pathogen == 'S_aureus':
            best_choice = "Vancomycin (Vancocin)"
            alternatives = ["Linezolid", "Daptomycin", "Clindamycin"]
            reason = "High probability of Methicillin-Resistant S. aureus (MRSA)."
            dose_note = "15-20 mg/kg IV every 8-12 hours. Requires trough level monitoring."
            
        # Renal dose adjustment logic
        if gfr < 30:
            dose_note += " WARNING: Severe renal impairment (GFR < 30 mL/min). Renal dosing adjustments required."
            if "Meropenem" in best_choice:
                dose_note += " Meropenem dose should be reduced to 500mg IV every 12 hours."
            elif "Piperacillin" in best_choice:
                dose_note += " Pip/Tazo dose should be reduced to 2.25g IV every 6 hours or 3.375g every 8 hours."
            elif "Ciprofloxacin" in best_choice:
                dose_note += " Ciprofloxacin dose should be reduced to 250-500mg orally daily."
            elif "Nitrofurantoin" in best_choice:
                best_choice = "Fosfomycin (3g single dose)"
                reason += " Nitrofurantoin contraindicated in GFR < 30. Switched to Fosfomycin."
                dose_note = "Fosfomycin 3g PO single packet dose."

        return {
            "recommended_antibiotic": best_choice,
            "alternatives": alternatives,
            "clinical_rationale": reason,
            "dosing_instructions": dose_note
        }

# Instantiate global model runner
amr_ml_engine = AMRModelSuite()
