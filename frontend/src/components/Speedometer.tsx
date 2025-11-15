// src/components/Speedometer.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Gauge } from "./ui/gauge"

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const Speedometer = () => {
  const [speed, setSpeed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connectWebSocket = useCallback(() => {
    if (ws.current) return
    // In frontend/src/components/Speedometer.tsx, update the WebSocket URL:
    const wsUrl = 'ws://localhost:5000/ws';

    console.log('Connecting to WebSocket:', wsUrl)
    setConnectionStatus('connecting')

    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      console.log('WebSocket connection established')
      setConnectionStatus('connected')
      reconnectAttempts.current = 0
    }

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle different message types
        if (message.type === 'SPEED_UPDATE' && typeof message.data?.speed === 'number') {
          const newSpeed = message.data.speed;
          setSpeed(prevSpeed => {
            // Only update if the speed has actually changed
            return newSpeed !== prevSpeed ? newSpeed : prevSpeed;
          });
        } else if (message.type === 'PONG') {
          // Handle pong message (keep-alive)
          console.log('Received pong from server');
        }
      } catch (error) {
        console.error('Error processing message:', error, event.data);
      }
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('error')
    }

    ws.current.onclose = () => {
      console.log('WebSocket connection closed')
      ws.current = null

      if (isRunning) {
        // Try to reconnect if we're still supposed to be connected
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000) // Exponential backoff
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)
          reconnectAttempts.current++
          setTimeout(connectWebSocket, delay)
        } else {
          console.error('Max reconnection attempts reached')
          setConnectionStatus('error')
        }
      } else {
        setConnectionStatus('disconnected')
      }
    }
  }, [isRunning])

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      // Stop
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
      setSpeed(0)
      setConnectionStatus('disconnected')
      reconnectAttempts.current = 0
    } else {
      // Start
      connectWebSocket()
    }
    setIsRunning(!isRunning)
  }, [isRunning, connectWebSocket])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [])

  // Connection status indicator
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Speedometer</h1>

      <div className="mb-8 relative">
        <Gauge
          value={speed}
          min={0}
          max={120}
          size={300}
          primary={connectionStatus === 'connected' ? "#3b82f6" : "#9ca3af"}
        />

        {/* Connection status indicator */}
        <div className="absolute top-2 right-2 flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></div>
          <span className="text-sm text-gray-600">{getStatusText()}</span>
        </div>
      </div>

      <button
        onClick={toggleRunning}
        disabled={connectionStatus === 'connecting'}
        className={`px-6 py-3 rounded-lg font-medium text-white ${isRunning
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-green-500 hover:bg-green-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRunning ? 'Stop' : 'Start'}
      </button>

      <div className="mt-4 text-gray-600">
        Current Speed: <span className="font-semibold">{speed.toFixed(1)} km/h</span>
      </div>

      {connectionStatus === 'error' && (
        <div className="mt-2 text-red-500 text-sm">
          Connection failed. Please check if the server is running and try again.
        </div>
      )}
    </div>
  )
}

export default Speedometer;