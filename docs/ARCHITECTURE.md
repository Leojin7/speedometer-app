# Speedometer Application Architecture

## System Overview

This document outlines the architecture and design decisions for the real-time Speedometer application.

## High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Speed Sensor   │────▶│    Backend      │◀───▶│   PostgreSQL    │
│  (Data Source)  │     │  (Node.js/Express)    │     Database    │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ WebSocket
                                 │
                         ┌───────▼────────┐
                         │                │
                         │    Frontend    │
                         │    (React)     │
                         │                │
                         └────────────────┘
```

## Components

### 1. Speed Sensor Simulator
- Generates random speed data every second (0-120 km/h)
- Sends data to backend via HTTP POST
- Part of the backend for simplicity

### 2. Backend (Node.js/Express)
- **API Endpoints**:
  - `POST /api/speed` - Record new speed data
  - `GET /api/speed/history` - Get historical speed data
- **WebSocket Server**:
  - Broadcasts real-time speed updates to connected clients
- **Database**:
  - PostgreSQL for persistent storage
  - Table: `speed_measurements` (timestamp, speed)

### 3. Database Schema
```sql
CREATE TABLE speed_measurements (
    id SERIAL PRIMARY KEY,
    speed FLOAT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_speed_measurements_recorded_at ON speed_measurements(recorded_at);
```

### 4. Frontend (React)
- Real-time speedometer display
- WebSocket client for updates
- Responsive design
- Speed range visualization

## Data Flow
1. Sensor generates speed data every second
2. Data is sent to backend API
3. Backend saves data to PostgreSQL
4. Backend broadcasts update via WebSocket
5. Frontend receives update and updates speedometer

## Technologies
- **Backend**: Node.js, Express, WebSocket
- **Database**: PostgreSQL
- **Frontend**: React, Recharts, react-gauge-chart
- **Containerization**: Docker, docker-compose
- **API Documentation**: OpenAPI/Swagger

## Security Considerations
- Input validation on API endpoints
- CORS configuration
- WebSocket authentication (if needed)
- Rate limiting for API endpoints

## Performance Considerations
- Database indexing on timestamp
- WebSocket for real-time updates
- Efficient state management in React
- Proper connection pooling for database

## Future Enhancements
1. User authentication
2. Multiple sensors support
3. Historical data visualization
4. Alerts for speed thresholds
5. Export functionality for data analysis
