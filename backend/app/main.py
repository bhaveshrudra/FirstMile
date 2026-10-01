from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import traffic, optimization, benchmark, experiments, digital_twin, disruptions, recovery, dashboard

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Quantum-Inspired Traffic Route Optimization Platform using PSO, QPSO, and Improved QPSO.",
    version="1.0.0"
)

# Set up CORS middleware to allow configurable frontend interaction
origins = [o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(traffic.router, prefix=settings.API_V1_STR)
app.include_router(optimization.router, prefix=settings.API_V1_STR)
app.include_router(benchmark.router, prefix=settings.API_V1_STR)
app.include_router(experiments.router, prefix=settings.API_V1_STR)
app.include_router(digital_twin.router, prefix=settings.API_V1_STR)
app.include_router(disruptions.router, prefix=settings.API_V1_STR)
app.include_router(recovery.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": f"Welcome to the {settings.PROJECT_NAME} API. Visit /docs for interactive Swagger UI."
    }

@app.get("/health", response_model=dashboard.DashboardHealthResponse)
def read_root_health():
    return dashboard.get_health()

