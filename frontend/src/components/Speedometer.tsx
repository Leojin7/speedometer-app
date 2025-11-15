// src/components/Speedometer.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { Gauge } from "./ui/gauge"


const Speedometer = () => {
  const [speed, setSpeed] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning] = useState(true)
  const ws = useRef<WebSocket | null>(null)
  // In Speedometer.tsx, update the useEffect hook
  useEffect(() => {
    if (!isRunning) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
        setIsConnected(false);
      }
      return;
    }

    let wsUrl;

    if (process.env.NODE_ENV === 'production') {
      wsUrl = 'wss://speedometer-app-backend.vercel.app/ws';
    } else {
      wsUrl = 'ws://localhost:5000/ws';
    }

    console.log('Environment:', process.env.NODE_ENV);
    console.log('Using WebSocket URL:', wsUrl);
    console.log('Connecting to WebSocket:', wsUrl); // Debug log
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data); // Debug log

        if (data.type === 'SPEED_UPDATE' && data.data?.speed !== undefined) {
          setSpeed(Number(data.data.speed.toFixed(1)));
        } else if (typeof data.speed === 'number') {
          setSpeed(Number(data.speed.toFixed(1)));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [isRunning]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
      <div className="backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Real-time Speedometer
        </h1>
        <p className="text-center text-gray-400 text-sm mb-6">Monitoring your speed in real-time</p>

        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-8 transition-all duration-300 ${isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <span className={`w-2.5 h-2.5 rounded-full mr-2.5 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
          {isConnected ? 'Connected to WebSocket' : 'Disconnected'}
        </div>

        <div className="flex justify-center my-8">
          <Gauge
            value={speed}
            size={300}
            min={0}
            max={120}
            gradient={true}
            primary={{
              0: "red",
              25: "orange",
              50: "yellow",
              75: "blue",
              100: "green"
            }}
            tickMarks={true}
            label="Speed"
            unit="km/h"
            transition={{ length: 1000, step: 200, delay: 0 }}
            showValue={true}
            showPercentage={false}
          />
        </div>

        <div className="text-center mt-10 mb-8">
          <div className="text-6xl font-bold mb-1 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {speed.toFixed(1)}
            <span className="text-2xl text-gray-400 ml-1">km/h</span>
          </div>
          <div className="text-gray-400 text-sm tracking-wider">CURRENT SPEED</div>
        </div>

        <button
          onClick={() => {
            setIsRunning(!isRunning)
            if (!isRunning) {
              setSpeed(0)
            }
          }}
          className={`w-full py-3.5 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-95 ${isRunning
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20'
            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/20'
            }`}
        >
          <span className="drop-shadow-sm">{isRunning ? '⏹ Stop' : '▶ Start'} Monitoring</span>
        </button>
      </div>
    </div>
  )
}

export default Speedometer