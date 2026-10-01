import numpy as np

def sphere(x: np.ndarray) -> float:
    """Sphere function: global minimum at f(0,0,...,0) = 0."""
    return float(np.sum(x ** 2))

def rosenbrock(x: np.ndarray) -> float:
    """Rosenbrock function: global minimum at f(1,1,...,1) = 0."""
    if len(x) < 2:
        return 0.0
    return float(np.sum(100.0 * (x[1:] - x[:-1]**2)**2 + (1.0 - x[:-1])**2))

def rastrigin(x: np.ndarray) -> float:
    """Rastrigin function: global minimum at f(0,0,...,0) = 0."""
    D = len(x)
    return float(10.0 * D + np.sum(x**2 - 10.0 * np.cos(2.0 * np.pi * x)))

def ackley(x: np.ndarray) -> float:
    """Ackley function: global minimum at f(0,0,...,0) = 0."""
    D = len(x)
    sum_sq = np.sum(x**2)
    sum_cos = np.sum(np.cos(2.0 * np.pi * x))
    term1 = -20.0 * np.exp(-0.2 * np.sqrt(sum_sq / D))
    term2 = -np.exp(sum_cos / D)
    return float(term1 + term2 + 20.0 + np.e)
