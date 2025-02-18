import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

const VehicleTracker = () => {
  const [vehicles, setVehicles] = useState({});
  const [availableVehicles, setAvailableVehicles] = useState([
    "testDevice",
    "BIAL_SHUTTLE01",
    "BIAL_SHUTTLE02",
    "BIAL_SHUTTLE03",
    "BIAL_SHUTTLE04",
  ]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [eventSource, setEventSource] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [center, setCenter] = useState({ lat: 13.199524, lng: 77.6828239 }); // Centered on Bangalore
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  const mapContainerStyle = {
    width: "100%",
    height: "400px",
    marginTop: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e5e7eb",
  };

  // Function to add a log message to UI
  const addLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-50)); // Keep only last 50 logs
    console.log(`[${timestamp}] ${message}`);
  }, []);

  // Scroll logs to bottom when updated
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Function to transform raw data into structured format
  const transformVehicleData = (rawData) => {
    if (!rawData || !rawData.vehicleName) return null;

    // Parse direction from RawData if available
    let direction = "N/A";
    if (rawData.RawData) {
      const directionMatch = rawData.RawData.match(
        /,(\d+\.\d+),[0-9.]+,[0-9.]+,[0-9.]+$/
      );
      if (directionMatch && directionMatch[1]) {
        const degrees = parseFloat(directionMatch[1]);
        // Convert degrees to cardinal direction
        const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const index = Math.round(degrees / 45) % 8;
        direction = directions[index];
      }
    }

    // Create timestamp from Date and Time or use existing timestamp
    let timestamp = rawData.timestamp;
    if (!timestamp && rawData.Date && rawData.Time) {
      // Date format: DDMMYY, Time format: HHMMSS.SS
      const day = rawData.Date.substring(0, 2);
      const month = rawData.Date.substring(2, 4);
      const year = `20${rawData.Date.substring(4, 6)}`;

      const hours = rawData.Time.substring(0, 2);
      const minutes = rawData.Time.substring(2, 4);
      const seconds = rawData.Time.substring(4, 6);

      timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    }

    return {
      vehicleName: rawData.vehicleName,
      speed: parseFloat(rawData.Speed) || 0,
      direction: direction,
      location: {
        lat: parseFloat(rawData.Latitude) || 0,
        lng: parseFloat(rawData.Longitude) || 0,
      },
      checkpoint: rawData.checkpoint || "N/A",
      nextCheckpoint: rawData.nextCheckpoint || "N/A",
      timestamp: timestamp || new Date().toISOString(),
      altitude: rawData.Altitude || "N/A",
      satellites: rawData.UsedSatellites?.GPSSatellitesCount || "N/A",
      temperature: rawData.EnvironmentalData?.Temperature || "N/A",
    };
  };

  const disconnect = useCallback(() => {
    if (eventSource) {
      addLog(`Disconnecting SSE connection`);
      eventSource.close();
      setEventSource(null);
      setConnectionStatus("Disconnected");
      setVehicles({});
    }
  }, [eventSource, addLog]);

  const updateSSEConnection = useCallback(
    (vehicleSelection) => {
      // If no vehicles selected, disconnect
      if (vehicleSelection.length === 0) {
        addLog("No vehicles selected, disconnecting");
        disconnect();
        return;
      }

      // Close existing connection if any
      if (eventSource) {
        addLog(`Closing existing SSE connection`);
        eventSource.close();
      }

      // Create new connection with selected vehicles
      const vehiclesList = vehicleSelection.join(",");
      addLog(`Creating new SSE connection with vehicles: ${vehiclesList}`);

      const sse = new EventSource(
        `http://localhost:3000/events?vehicleIds=${vehiclesList}`
      );
      setEventSource(sse);
      setConnectionStatus("Connecting...");

      // Setup event handlers
      sse.onopen = () => {
        addLog(`SSE connection opened`);
      };

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === "connected" || data.status === "subscribed") {
            addLog(`SSE status update: ${data.status}`);
            setConnectionStatus("Connected");
            return;
          }

          // Process vehicle data
          if (data.vehicleName || data.device_id) {
            const vehicleId = data.vehicleName || data.device_id;
            const transformedData = transformVehicleData(data);

            if (transformedData) {
              addLog(`Received update for vehicle: ${vehicleId}`);
              setVehicles((prev) => ({
                ...prev,
                [transformedData.vehicleName]: {
                  ...transformedData,
                  lastUpdate: new Date(
                    transformedData.timestamp
                  ).toLocaleTimeString(),
                },
              }));

              // Update map center to the latest vehicle position
              if (
                transformedData.location &&
                transformedData.location.lat &&
                transformedData.location.lng
              ) {
                setCenter({
                  lat: transformedData.location.lat,
                  lng: transformedData.location.lng,
                });
              }
            } else {
              addLog(`Received malformed data for vehicle: ${vehicleId}`);
            }
          }
        } catch (error) {
          addLog(`Error processing message: ${error.message}`);
        }
      };

      sse.onerror = (error) => {
        addLog(`SSE connection error: ${error.type}`);
        setConnectionStatus("Error - Reconnecting...");
      };
    },
    [disconnect, addLog]
  );

  const handleVehicleSelection = useCallback(
    (vehicleId) => {
      addLog(`Toggle selection for vehicle: ${vehicleId}`);

      setSelectedVehicles((prev) => {
        const newSelection = prev.includes(vehicleId)
          ? prev.filter((v) => v !== vehicleId)
          : [...prev, vehicleId];

        addLog(`New vehicle selection: ${newSelection.join(", ") || "none"}`);

        // Auto-update the SSE connection with the new selection
        updateSSEConnection(newSelection);

        return newSelection;
      });
    },
    [updateSSEConnection, addLog]
  );

  // Function to convert speed to km/h with formatting
  const formatSpeed = (speed) => {
    if (speed === undefined || speed === null) return "N/A";
    // Converts m/s to km/h if needed (assuming speed is in m/s)
    const speedKmh = parseFloat(speed) * 3.6;
    return `${speedKmh.toFixed(1)} km/h`;
  };

  useEffect(() => {
    addLog("Component mounted");
    return () => {
      if (eventSource) {
        addLog("Component unmounting, closing SSE connection");
        eventSource.close();
      }
    };
  }, [eventSource, addLog]);

  // Add custom CSS for marker labels
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .marker-label {
        background-color: rgba(60, 102, 181, 0.85);
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 12px !important;
        font-weight: bold;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      .vehicle-marker {
        animation: pulse 2s infinite;
      }
      
      .log-container {
        background-color: #1e1e1e;
        color: #ddd;
        font-family: monospace;
        padding: 10px;
        border-radius: 4px;
        height: 200px;
        overflow-y: auto;
        margin-bottom: 20px;
      }
      
      .log-entry {
        line-height: 1.5;
        border-bottom: 1px solid #333;
        padding-bottom: 3px;
        margin-bottom: 3px;
      }
      
      .log-entry:last-child {
        border-bottom: none;
      }
      
      .log-info {
        color: #8cdcfe;
      }
      
      .log-error {
        color: #f14c4c;
      }
      
      .log-success {
        color: #6a9955;
      }
      
      .log-warning {
        color: #dcdcaa;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1400px",
        margin: "0 auto",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          marginBottom: "24px",
          color: "#1f2937",
          borderBottom: "2px solid #3c66b5",
          paddingBottom: "10px",
        }}
      >
        Auto-Updating Vehicle Tracker
      </h1>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <p
          style={{
            fontWeight: "600",
            fontSize: "16px",
          }}
        >
          Connection Status:
        </p>
        <span
          style={{
            marginLeft: "10px",
            fontWeight: "bold",
            color:
              connectionStatus === "Connected"
                ? "#22c55e"
                : connectionStatus === "Disconnected"
                ? "#ef4444"
                : "#eab308",
            padding: "4px 10px",
            borderRadius: "4px",
            backgroundColor:
              connectionStatus === "Connected"
                ? "rgba(34, 197, 94, 0.1)"
                : connectionStatus === "Disconnected"
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(234, 179, 8, 0.1)",
          }}
        >
          {connectionStatus}
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          Select Vehicles (Auto-connects on selection):
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {availableVehicles.map((vehicle) => (
            <label
              key={vehicle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: selectedVehicles.includes(vehicle)
                  ? "#f0f7ff"
                  : "transparent",
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={selectedVehicles.includes(vehicle)}
                onChange={() => handleVehicleSelection(vehicle)}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "#3c66b5",
                }}
              />
              <span>{vehicle}</span>
            </label>
          ))}
        </div>
      </div>

      <div
        style={{
          marginBottom: "30px",
          display: "flex",
          gap: "16px",
        }}
      >
        <button
          onClick={() => updateSSEConnection(selectedVehicles)}
          disabled={
            selectedVehicles.length === 0 || connectionStatus === "Connected"
          }
          style={{
            backgroundColor:
              selectedVehicles.length === 0 || connectionStatus === "Connected"
                ? "#ccc"
                : "#3c66b5",
            color: "white",
            padding: "10px 20px",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor:
              selectedVehicles.length === 0 || connectionStatus === "Connected"
                ? "not-allowed"
                : "pointer",
            border: "none",
            transition: "background-color 0.3s",
          }}
        >
          Reconnect
        </button>
        <button
          onClick={disconnect}
          disabled={connectionStatus === "Disconnected"}
          style={{
            backgroundColor:
              connectionStatus === "Disconnected" ? "#ccc" : "#e53e3e",
            color: "white",
            padding: "10px 20px",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor:
              connectionStatus === "Disconnected" ? "not-allowed" : "pointer",
            border: "none",
            transition: "background-color 0.3s",
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Log Display */}
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Connection Logs</span>
          <button
            onClick={() => setLogs([])}
            style={{
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Clear Logs
          </button>
        </h2>
        <div className="log-container">
          {logs.length === 0 ? (
            <div className="log-entry log-info">
              No logs yet. Select a vehicle to start.
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`log-entry ${
                  log.includes("Error")
                    ? "log-error"
                    : log.includes("Connected") ||
                      log.includes("update for vehicle")
                    ? "log-success"
                    : log.includes("Connecting") || log.includes("selection")
                    ? "log-warning"
                    : "log-info"
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      <div className="mb-4">
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          Vehicle Data:
        </h2>
        <div className="overflow-x-auto">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "10px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              fontSize: "14px",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#3c66b5",
                  color: "white",
                  textAlign: "left",
                  fontWeight: "bold",
                }}
              >
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    whiteSpace: "nowrap",
                  }}
                >
                  Vehicle ID
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Speed
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Direction
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Altitude
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Temperature
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  GPS Satellites
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Location
                </th>
                <th
                  style={{
                    padding: "12px 15px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                  }}
                >
                  Last Update
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vehicles).map(([vehicleName, data], index) => (
                <tr
                  key={vehicleName}
                  style={{
                    background: index % 2 === 0 ? "#f9f9f9" : "white",
                  }}
                >
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    {vehicleName}
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {formatSpeed(data.speed)}
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {data.direction || "N/A"}
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {data.altitude || "N/A"} m
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {data.temperature || "N/A"}°C
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {data.satellites || "N/A"}
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                      wordBreak: "break-word",
                    }}
                  >
                    {data.location && data.location.lat && data.location.lng
                      ? `${data.location.lat.toFixed(
                          6
                        )}, ${data.location.lng.toFixed(6)}`
                      : "N/A"}
                  </td>
                  <td
                    style={{
                      padding: "10px 15px",
                      borderBottom: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {data.lastUpdate}
                  </td>
                </tr>
              ))}
              {Object.keys(vehicles).length === 0 && (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#666",
                      fontStyle: "italic",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LoadScript googleMapsApiKey="AIzaSyD7rqUpTzUpEbxm-Xc7ikltFJGzOhd92Qk">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
        >
          {Object.entries(vehicles).map(([vehicleName, data]) =>
            data.location && data.location.lat && data.location.lng ? (
              <Marker
                key={vehicleName}
                position={{
                  lat: data.location.lat,
                  lng: data.location.lng,
                }}
                title={`${vehicleName}
Speed: ${formatSpeed(data.speed)}
Direction: ${data.direction || "N/A"}
Altitude: ${data.altitude || "N/A"} m
Last Update: ${data.lastUpdate}`}
                label={{
                  text: vehicleName,
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "14px",
                  className: "marker-label",
                }}
                icon={{
                  path: "M17.4,6.4C17.4,3.1,14.3,0,10.7,0C7.1,0,4.3,3.1,4.3,6.4c0,1.3,0.4,2.5,1.1,3.5l5.3,8.9l5.3-8.9C16.6,8.9,17.4,7.7,17.4,6.4z",
                  fillColor: "#3c66b5",
                  fillOpacity: 0.9,
                  strokeWeight: 2,
                  strokeColor: "#FFFFFF",
                  scale: 1.5,
                  anchor: { x: 10.7, y: 18.8 },
                }}
                animation={window.google?.maps?.Animation?.DROP}
              />
            ) : null
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default VehicleTracker;
