# Quantum-Inspired Intelligent Traffic Route Optimization Platform

A research-oriented traffic simulation and metaheuristic optimization platform. The system implements **Quantum-behaved Particle Swarm Optimization (QPSO)** alongside classical **PSO** and a proposed **Adaptive Improved QPSO (IQPSO)**. It demonstrates dynamic street network modeling, BPR congestion delays, incident injects, and comparative statistical benchmarking for Shortest Path and Vehicle Routing Problems (VRP).

---

## 🚀 Key Features

- **Spatial Topologies**: Generates Grid, Geometric Random, and Scale-Free networks on-the-fly, ensuring strong connectivity for routability.
- **Dynamic Traffic Simulation**: Uses the Bureau of Public Roads (BPR) delay formula to simulate traffic flows, including morning and evening peak hour diurnal variations.
- **Dynamic Incident Injection**: Models dynamic road disruptions (accidents, construction, weather events), modifying capacity and speed limits on segments.
- **Continuous Swarm Solvers**: Manual implementations of:
  - **Classical PSO**: Inertia weight decay and velocity clamping.
  - **Basic QPSO**: Delta potential well attraction and mean-best coordination.
  - **Improved QPSO (Proposed)**: Swarm diversity feedback control (adaptive $\alpha$) and stagnation-triggered Cauchy mutations on the global best.
- **Combinatorial Encoding Decoders**: 
  - *Shortest Path (SP)*: Priority-based neighbor traversal with backtracking repair.
  - *VRP*: Random keys permutation sorted and split under fleet capacity limits.
- **Research Analytics HUD**: Live convergence charts, swarm diversity tracking, and automated **Mann-Whitney U hypothesis tests** comparing performance over multiple runs.

---

## 🛠️ Technology Stack

- **Backend**: Python, FastAPI, NetworkX, NumPy, SciPy, pytest.
- **Frontend**: React, TypeScript, Vite, Leaflet, React-Leaflet, Tailwind CSS, Recharts.
- **Deployment**: Docker, Docker Compose.

---

## 📦 Quick Start (Docker Compose)

The easiest way to start both backend and frontend is using Docker Compose:

```bash
# Build and run containers
docker-compose up --build
```

- **Frontend Dashboard**: `http://localhost:5173`
- **Backend API Docs (Swagger)**: `http://localhost:8000/docs`

---

## 🔧 Manual Setup

### 1. Backend Server Setup
Requires Python 3.10+ (recommend Python 3.11/3.12).

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. React Frontend Setup
Requires Node.js 18+.

```bash
cd frontend

# Install package dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## 🧪 Running Unit Tests

Run the backend test suite using `pytest` to verify graph generation, BPR formulas, solver compilation, and API routes:

```bash
# From the project root
backend/venv/bin/pytest backend/tests/test_backend.py
```

---

## 📖 Project Structure

```text
quantum-traffic-optimizer/
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI server entry point
│   │   ├── config.py            # CORS and metadata config
│   │   ├── api/                 # API controllers (traffic, optimization, benchmark)
│   │   ├── graph/               # Graph model & generators (Grid, Random, BA scale-free)
│   │   ├── traffic/             # Diurnal simulator & BPR formula
│   │   ├── optimization/        # Solvers (PSO, QPSO, IQPSO) & Path/VRP decoders
│   │   ├── benchmarking/        # Multi-run coordinator & Mann-Whitney stats
│   │   └── schemas/             # Pydantic request/response models
│   ├── tests/                   # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/            # API fetch client
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx              # Main Dashboard React component
│   │   ├── index.css            # Tailwind + Leaflet CSS rules
│   │   └── main.tsx             # React mount node
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                        # Scientific & Mathematical details
│   ├── architecture.md          # Layout structure and Mermaid diagrams
│   ├── mathematics.md           # Swarm formulas & Cauchy equations
│   ├── algorithms.md            # Decoders & routing details
│   └── api.md                   # Endpoint specifications
│
├── docker-compose.yml
└── README.md
```

---

## 📊 Scientific Experimentation Guide

For details on how the platform compares algorithms and measures statistical significance, see [docs/experiments.md](docs/experiments.md).
Formulations are detailed in [docs/mathematics.md](docs/mathematics.md).
