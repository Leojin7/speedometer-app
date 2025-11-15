// src/components/Speedometer.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Gauge } from "./ui/gauge"


const Speedometer = () => {
  const [speed, setSpeed] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(() => {
    if (!isRunning) return;

    // Clear any existing connection
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    // Determine WebSocket URL based on environment
    let wsUrl;
    if (process.env.NODE_ENV === 'production') {
      // For production, ensure we use wss for https and ws for http
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    } else {
      // For development, use localhost:5000
      wsUrl = 'ws://localhost:5000/ws';
    }

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    setConnectionError(null);

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);

          if (data.type === 'SPEED_UPDATE' && data.data?.speed !== undefined) {
            setSpeed(Number(data.data.speed.toFixed(1)));
          } else if (typeof data.speed === 'number') {
            setSpeed(Number(data.speed.toFixed(1)));
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason || 'No reason provided'}`);
        setIsConnected(false);

        // Attempt to reconnect if we're still supposed to be running
        if (isRunning && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError('Failed to connect to the server. Please refresh the page to try again.');
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error. Please check your network connection.');
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to connect to the server.');
    }
  }, [isRunning]);

  // Handle initial connection and reconnection
  useEffect(() => {
    if (isRunning) {
      connectWebSocket();
    } else {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };
  }, [isRunning, connectWebSocket]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
      <div className="backdrop-blur-sm bg-white/5 p-8 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Real-time Speedometer
        </h1>
        <p className="text-center text-gray-400 text-sm mb-6">Monitoring your speed in real-time</p>

        <div className="space-y-4 mb-8">
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <span className={`w-2.5 h-2.5 rounded-full mr-2.5 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
            {isConnected ? 'Connected to WebSocket' : 'Disconnected'}
          </div>

          {connectionError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{connectionError}</span>
              </div>
              <button
                onClick={() => {
                  setConnectionError(null);
                  reconnectAttempts.current = 0;
                  connectWebSocket();
                }}
                className="mt-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1 rounded-md transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {!isConnected && !connectionError && reconnectAttempts.current > 0 && (
            <div className="text-yellow-400 text-sm flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Attempting to reconnect ({reconnectAttempts.current}/{maxReconnectAttempts})...
            </div>
          )}
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