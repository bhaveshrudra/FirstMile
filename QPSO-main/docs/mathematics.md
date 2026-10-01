# Quantum-Inspired Traffic Optimization: Mathematical Formulations

This document provides the mathematical basis for the metaheuristic optimization solvers implemented in this platform.

---

## 1. Classical Particle Swarm Optimization (PSO)

In Classical PSO, the swarm consists of $M$ particles moving through a $D$-dimensional continuous search space. Each particle $i$ has a position vector $x_i \in \mathbb{R}^D$ and a velocity vector $v_i \in \mathbb{R}^D$.

### Velocity Update Equation
At iteration $t+1$, the velocity of particle $i$ along dimension $j$ is updated as:

$$v_{ij}(t+1) = w \cdot v_{ij}(t) + c_1 \cdot r_{1j} \cdot \left(\text{pbest}_{ij}(t) - x_{ij}(t)\right) + c_2 \cdot r_{2j} \cdot \left(\text{gbest}_j(t) - x_{ij}(t)\right)$$

Where:
- $w$ is the inertia weight, representing the particle's tendency to maintain its current motion.
- $c_1$ (cognitive coefficient) controls the attraction towards the particle's personal historic best position $\text{pbest}_i$.
- $c_2$ (social coefficient) controls the attraction towards the swarm's global best position $\text{gbest}$.
- $r_{1j}, r_{2j} \sim U(0, 1)$ are independent random variables sampled at each step to introduce stochastic exploration.

### Position Update Equation
The position is updated by adding the new velocity:

$$x_{ij}(t+1) = x_{ij}(t) + v_{ij}(t+1)$$

To prevent swarm divergence, velocities are clamped to range $[-V_{\text{max}}, V_{\text{max}}]$ and positions are clamped to bounds $[X_{\text{min}}, X_{\text{max}}]$.

---

## 2. Quantum-behaved Particle Swarm Optimization (QPSO)

Quantum-behaved PSO (QPSO) is inspired by quantum mechanics. In the quantum model, a particle does not have a defined velocity or trajectory. Instead, its state is described by a wave function $\psi(x, t)$, and its position is determined by probability density.

The particle is assumed to move in a multidimensional space with a $\delta$-potential well centered at the local attractor point.

### Mean Best Position (mbest)
QPSO introduces the Mean Best position $\text{mbest} \in \mathbb{R}^D$, which is the average of the personal best positions of all particles:

$$\text{mbest}(t) = \frac{1}{M} \sum_{i=1}^M \text{pbest}_i(t) = \left( \frac{1}{M} \sum_{i=1}^M \text{pbest}_{i1}(t), \dots, \frac{1}{M} \sum_{i=1}^M \text{pbest}_{iD}(t) \right)$$

### Local Attractor Point
Each particle converges toward a unique local attractor $p_i \in \mathbb{R}^D$ which lies on the line segment connecting its personal best and the global best:

$$p_{ij}(t) = \phi_i \cdot \text{pbest}_{ij}(t) + (1 - \phi_i) \cdot \text{gbest}_j(t)$$

Where $\phi_i \sim U(0, 1)$ is dynamically generated.

### Position Update Equation
Solving the Schrödinger equation for a particle in a $\delta$-potential well yields a probability density from which the position update is sampled:

$$x_{ij}(t+1) = p_{ij}(t) \pm \alpha \cdot \left| \text{mbest}_j(t) - x_{ij}(t) \right| \cdot \ln\left(\frac{1}{u_{ij}}\right)$$

Where:
- $u_{ij} \sim U(0, 1)$ is a uniform random number.
- The sign $\pm$ is selected with equal probability (50%).
- $\alpha$ is the contraction-expansion coefficient, which controls the convergence speed and exploration radius. In basic QPSO, it decays linearly over iterations:
  $$\alpha(t) = \alpha_{\text{start}} - \left(\alpha_{\text{start}} - \alpha_{\text{end}}\right) \cdot \frac{t}{T}$$

---

## 3. Proposed Improved Quantum-behaved PSO (IQPSO)

To address premature convergence (getting stuck in local minima), we propose two additions:

### A. Swarm Diversity Feedback Control (Adaptive $\alpha$)
Instead of forcing a linear decay of the contraction-expansion coefficient $\alpha$, we adjust it dynamically using the swarm's spatial diversity $D(t)$.

Swarm diversity is calculated as:

$$D(t) = \frac{1}{M \cdot L} \sum_{i=1}^M \sqrt{\sum_{j=1}^D \left(x_{ij}(t) - \bar{x}_j(t)\right)^2}$$

Where:
- $\bar{x}_j(t)$ is the average coordinate of the swarm in dimension $j$ at iteration $t$.
- $L$ is the diagonal length of the search space: $L = \sqrt{D} \cdot (X_{\text{max}} - X_{\text{min}})$.

We model a target diversity decay curve:
$$D_{\text{target}}(t) = D(0) \cdot e^{-\lambda t}$$

At each iteration, we compare $D(t)$ with $D_{\text{target}}(t)$:
- If $D(t) < D_{\text{target}}(t)$, the swarm is collapsing too quickly (increasing the risk of local minima stagnation). We increase $\alpha$ to expand search:
  $$\alpha(t+1) = \min\left(\alpha_{\text{max}}, \alpha(t) \cdot 1.05\right)$$
- If $D(t) \ge D_{\text{target}}(t)$, the swarm has sufficient diversity. We decrease $\alpha$ to focus on local exploitation:
  $$\alpha(t+1) = \max\left(\alpha_{\text{min}}, \alpha(t) \cdot 0.95\right)$$

### B. Stagnation-Triggered Cauchy Mutation
If the global best fitness $\text{gbest\_fit}$ does not improve for $K$ consecutive iterations, we assume the swarm is stuck. We apply a Cauchy mutation on the global best position to escape the local minimum.

The Cauchy distribution has heavy tails, allowing the particle to occasionally perform large jumps while still searching locally:

$$\text{gbest}_{\text{mutated}} = \text{gbest} + \eta(t) \cdot \text{Cauchy}(0, 1) \cdot \left(X_{\text{max}} - X_{\text{min}}\right)$$

Where:
- $\text{Cauchy}(0, 1)$ is a standard Cauchy-distributed random variable.
- $\eta(t)$ is a decaying step size allowing fine-tuning towards the end of the search:
  $$\eta(t) = \eta_0 \cdot \left(1 - \frac{t}{T}\right)$$

We evaluate the mutated best:
$$\text{gbest}(t+1) = \begin{cases} 
\text{gbest}_{\text{mutated}} & \text{if } f(\text{gbest}_{\text{mutated}}) < f(\text{gbest}(t)) \\
\text{gbest}(t) & \text{otherwise}
\end{cases}$$
