from scipy.stats import mannwhitneyu, ttest_ind
from typing import List, Dict, Any

def run_mann_whitney_u(group_a: List[float], group_b: List[float], 
                       label_a: str = "Alg A", label_b: str = "Alg B") -> Dict[str, Any]:
    """
    Performs a Mann-Whitney U test to compare two groups of fitness results.
    This is a non-parametric test suitable for metaheuristic results.
    
    H0: The distributions of both algorithms are equal.
    H1: The distribution of Alg A is shifted to the left (smaller, i.e., superior) or right of Alg B.
    """
    if len(group_a) < 3 or len(group_b) < 3:
        return {
            "u_statistic": 0.0,
            "p_value": 1.0,
            "significant": False,
            "message": "Not enough samples (minimum 3 per group) to run Mann-Whitney U test."
        }
        
    try:
        # We run a two-sided test
        stat, pval = mannwhitneyu(group_a, group_b, alternative='two-sided')
        significant = pval < 0.05
        
        mean_a = sum(group_a) / len(group_a)
        mean_b = sum(group_b) / len(group_b)
        
        if significant:
            if mean_a < mean_b:
                direction = f"{label_a} is statistically superior to {label_b}."
            else:
                direction = f"{label_b} is statistically superior to {label_a}."
            msg = f"Statistically significant difference detected (p = {pval:.4f}). {direction}"
        else:
            msg = f"No statistically significant difference detected (p = {pval:.4f}). Both algorithms perform comparably."
            
        return {
            "u_statistic": float(stat),
            "p_value": float(pval),
            "significant": bool(significant),
            "message": msg
        }
    except Exception as e:
        return {
            "error": str(e),
            "significant": False,
            "message": f"Statistical test failed: {str(e)}"
        }


def run_parametric_t_test(group_a: List[float], group_b: List[float], 
                           label_a: str = "Alg A", label_b: str = "Alg B") -> Dict[str, Any]:
    """
    Performs a standard independent two-sample t-test.
    Assumes normal distribution.
    """
    if len(group_a) < 3 or len(group_b) < 3:
        return {
            "t_statistic": 0.0,
            "p_value": 1.0,
            "significant": False,
            "message": "Not enough samples to run t-test."
        }
        
    try:
        stat, pval = ttest_ind(group_a, group_b, equal_var=False)
        significant = pval < 0.05
        
        mean_a = sum(group_a) / len(group_a)
        mean_b = sum(group_b) / len(group_b)
        
        if significant:
            if mean_a < mean_b:
                direction = f"{label_a} is significantly better than {label_b}."
            else:
                direction = f"{label_b} is significantly better than {label_a}."
            msg = f"T-test shows significant difference (p = {pval:.4f}). {direction}"
        else:
            msg = f"T-test shows no significant difference (p = {pval:.4f})."
            
        return {
            "t_statistic": float(stat),
            "p_value": float(pval),
            "significant": bool(significant),
            "message": msg
        }
    except Exception as e:
        return {
            "error": str(e),
            "significant": False,
            "message": f"T-test failed: {str(e)}"
        }
