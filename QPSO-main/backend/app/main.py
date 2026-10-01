from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import traffic, optimization, benchmark, experiments

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Quantum-Inspired Traffic Route Optimization Platform using PSO, QPSO, and Improved QPSO.",
    version="1.0.0"
)

# Set up CORS middleware to allow frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(traffic.router, prefix=settings.API_V1_STR)
app.include_router(optimization.router, prefix=settings.API_V1_STR)
app.include_router(benchmark.router, prefix=settings.API_V1_STR)
app.include_router(experiments.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": f"Welcome to the {settings.PROJECT_NAME} API. Visit /docs for interactive Swagger UI."
    }
