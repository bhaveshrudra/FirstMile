import os

class Settings:
    PROJECT_NAME: str = "Quantum-Inspired Traffic Optimization Platform"
    API_V1_STR: str = "/api"
    FRONTEND_ORIGINS: str = os.getenv("FRONTEND_ORIGINS", "*")
    
    # Placeholders for future external API integrations (Step 66)
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    TOMTOM_TRAFFIC_API_KEY: str = os.getenv("TOMTOM_TRAFFIC_API_KEY", "")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    OSM_OVERPASS_URL: str = os.getenv("OSM_OVERPASS_URL", "https://overpass-api.de/api/interpreter")

settings = Settings()
