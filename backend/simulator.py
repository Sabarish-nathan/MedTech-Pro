import numpy as np

class WardOutbreakSimulator:
    def __init__(self):
        pass

    def run_simulation(self, ward_type, hand_hygiene_compliance, isolation_speed, cleaning_frequency, staff_ratio, simulation_days=30):
        """
        Runs a compartmental mathematical simulation of hospital transmission (S-C-I-R style).
        
        Parameters:
        - ward_type: 'icu', 'surgery', 'general_medicine'
        - hand_hygiene_compliance: float (0 to 100)
        - isolation_speed: float (0.5 to 5.0 days, lower is faster/better)
        - cleaning_frequency: int (1 to 4 times/day)
        - staff_ratio: float (0.1 to 1.0 staff per patient)
        
        Returns list of daily states for plotting.
        """
        # Baseline capacities
        capacity = 20 if ward_type == 'icu' else (30 if ward_type == 'surgery' else 50)
        
        # Initial compartments
        # N = S + C + I
        initial_infected = 1
        initial_colonized = 2
        initial_susceptible = capacity - initial_infected - initial_colonized
        
        S = float(initial_susceptible)
        C = float(initial_colonized)
        I = float(initial_infected)
        
        history = []
        
        # Scaling rates based on inputs
        # Hygiene compliance: 100% compliance reduces contact transmission rate beta by 85%
        hygiene_factor = 1.0 - (hand_hygiene_compliance / 100.0) * 0.85
        
        # Staff workload factor: lower staff ratio (e.g. 0.2 vs 1.0) increases transmission multiplier
        workload_factor = 1.5 if staff_ratio < 0.3 else (1.2 if staff_ratio < 0.6 else 0.9)
        
        # Cleaning factor: more cleaning reduces environmental transmission risk
        cleaning_factor = 1.2 / cleaning_frequency
        
        # Base transmission coefficient (colonized/infected to susceptible)
        # In ICU, contact is higher
        base_beta = 0.08 if ward_type == 'icu' else 0.05
        beta = base_beta * hygiene_factor * workload_factor * cleaning_factor
        
        # Rate of colonization turning into active infection (per day)
        progression_rate = 0.06
        
        # Isolation rate: faster isolation (lower isolation_speed days) means faster removal from active pool
        # gamma is the isolation/recovery rate of infected patients (to isolated or cured state R)
        isolation_rate = 1.0 / max(0.5, isolation_speed)
        
        # Daily time step (Euler integration with minor noise)
        cumulative_infections = initial_infected
        
        for day in range(simulation_days + 1):
            history.append({
                "day": day,
                "susceptible": int(round(S)),
                "colonized": int(round(C)),
                "infected": int(round(I)),
                "isolated_recovered": int(round(capacity - S - C - I)),
                "cumulative_infections": int(cumulative_infections)
            })
            
            if day == simulation_days:
                break
                
            # Differential changes
            # New colonizations
            new_colonized = beta * S * (C + I)
            
            # Ensure we don't colonize more than susceptible pool
            new_colonized = min(new_colonized, S)
            
            # Colonized turning into infected
            new_infected = progression_rate * C
            new_infected = min(new_infected, C)
            
            # Infected isolated/discharged
            isolated = isolation_rate * I
            isolated = min(isolated, I)
            
            # Natural discharge/admit loop to keep occupancy stable
            # Simulated admissions (susceptible)
            admissions = isolated
            
            # State equations
            S = S - new_colonized + admissions
            C = C + new_colonized - new_infected
            I = I + new_infected - isolated
            
            # Clamp limits
            S = max(0.0, min(float(capacity), S))
            C = max(0.0, min(float(capacity), C))
            I = max(0.0, min(float(capacity), I))
            
            cumulative_infections += new_infected
            
        # Outbreak flag trigger if infected count goes above threshold
        threshold = 3 if ward_type == 'icu' else 5
        max_infected = max([h["infected"] for h in history])
        active_outbreak = bool(max_infected >= threshold)
        
        return {
            "ward_type": ward_type,
            "simulation_days": simulation_days,
            "active_outbreak_warning": active_outbreak,
            "peak_infection_count": int(round(max_infected)),
            "total_new_infections": int(round(cumulative_infections - initial_infected)),
            "daily_history": history
        }

# Global simulator instance
ward_simulator = WardOutbreakSimulator()
