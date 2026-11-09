from fastapi import FastAPI
from app.api.demand_forecast_routes import router as demand_router
from app.api.combo_routes import router as combo_router

app = FastAPI(title="StockSense AI Service")

# Include routers
app.include_router(demand_router)
app.include_router(combo_router)

@app.get('/')
def read_root():
    return {"message": "StockSense AI Service is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
