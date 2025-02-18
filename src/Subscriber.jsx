import React, { useEffect, useState, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import VehicleTable from "./VehicleDataTable";
// import "./Subscriber.css";

const BASE_SSE_SERVER_URL = "http://localhost:3000/events";
const AVAILABLE_VEHICLES = ["V1234995", "V1234996", "V1234997", "V1234998", "V1234999", "V12349911"];
const libraries = ["places"];

function Subscriber() {
  const [vehicles, setVehicles] = useState(new Map());
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [subscribedVehicles, setSubscribedVehicles] = useState(new Set(AVAILABLE_VEHICLES));
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [eventSources, setEventSources] = useState({});

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyD7rqUpTzUpEbxm-Xc7ikltFJGzOhd92Qk",
    libraries,
  });

  const mapContainerStyle = {
    width: "100%",
    height: "800px",
  };

  // Calculate center based on all available vehicles or selected vehicle
  const center = useMemo(() => {
    if (selectedVehicleId && vehicles.has(selectedVehicleId)) {
      const vehicle = vehicles.get(selectedVehicleId);
      return { lat: parseFloat(vehicle.latitude), lng: parseFloat(vehicle.longitude) };
    }
    
    // If we have any vehicle, center on the first one
    if (vehicles.size > 0) {
      const firstVehicle = vehicles.values().next().value;
      return { lat: parseFloat(firstVehicle.latitude), lng: parseFloat(firstVehicle.longitude) };
    }

    return { lat: 40.7128, lng: -74.006 }; // Default to NYC
  }, [vehicles, selectedVehicleId]);

  // Auto-zoom to fit all vehicles
  const mapOptions = useMemo(() => {
    return {
      disableDefaultUI: false,
      clickableIcons: true,
      scrollwheel: true,
    };
  }, []);

  // Connect to SSE for all subscribed vehicles
  useEffect(() => {
    const newEventSources = {};
    setConnectionStatus("Connecting...");
    
    // Close any existing connections for vehicles no longer subscribed
    Object.keys(eventSources).forEach(vehicleId => {
      if (!subscribedVehicles.has(vehicleId)) {
        console.log(`Closing connection for ${vehicleId}`);
        eventSources[vehicleId].close();
      }
    });

    // Create connections for all subscribed vehicles
    subscribedVehicles.forEach(vehicleId => {
      // Skip if already connected
      if (eventSources[vehicleId] && eventSources[vehicleId].readyState === 1) {
        newEventSources[vehicleId] = eventSources[vehicleId];
        return;
      }
      
      const url = `${BASE_SSE_SERVER_URL}?vehicleId=${vehicleId}`;
      console.log(`Connecting to ${url}`);
      
      const source = new EventSource(url);
      newEventSources[vehicleId] = source;
      
      source.onopen = () => {
        console.log(`SSE Connection opened for ${vehicleId}`);
        setConnectionStatus("Connected");
        setLastUpdate(new Date().toLocaleTimeString());
      };
      
      source.onmessage = (event) => {
        console.log(`Raw SSE message from ${vehicleId}:`, event.data);
        try {
          const data = JSON.parse(event.data);
          console.log(`Parsed SSE data from ${vehicleId}:`, data);
          
          if (data.status === "connected") {
            console.log(`Successfully connected to ${vehicleId}`);
            return;
          }
          
          if (data.type === "error") {
            console.error(`Server error: ${data.message}`);
            setConnectionStatus(`Error: ${data.message}`);
            return;
          }
          
          // Process vehicle data
          setVehicles((prev) => {
            const newMap = new Map(prev);
            const updatedVehicleId = data.vehicleId || data.vehicleName;
            
            newMap.set(updatedVehicleId, {
              vehicleId: updatedVehicleId,
              latitude: data.position?.latitude || data.latitude || 40.7128,
              longitude: data.position?.longitude || data.longitude || -74.006,
              direction: data.position?.direction || data.direction || "N/A",
              speed: data.position?.speed || data.speed || 0,
              checkpoint: data.position?.checkpoint || data.checkpoint || "N/A",
              nextCheckpoint: data.position?.nextCheckpoint || data.nextCheckpoint || "N/A",
              timestamp: data.timestamp || new Date().toISOString(),
            });
            
            setLastUpdate(new Date().toLocaleTimeString());
            return newMap;
          });
        } catch (error) {
          console.error(`Error processing SSE data from ${vehicleId}:`, error);
        }
      };
      
      source.onerror = () => {
        console.error(`SSE connection error for ${vehicleId} - Retrying...`);
        setConnectionStatus(`Connection Error for ${vehicleId} - Retrying...`);
        
        // Close and try to reconnect after a delay
        source.close();
        
        setTimeout(() => {
          if (subscribedVehicles.has(vehicleId)) {
            const newSource = new EventSource(url);
            setEventSources(prev => ({...prev, [vehicleId]: newSource}));
            newSource.onopen = source.onopen;
            newSource.onmessage = source.onmessage;
            newSource.onerror = source.onerror;
          }
        }, 5000);
      };
    });
    
    setEventSources(newEventSources);
    
    // Cleanup function
    return () => {
      Object.values(newEventSources).forEach(source => {
        source.close();
      });
    };
  }, [subscribedVehicles]);

  const handleVehicleSelect = (event) => {
    const vehicleId = event.target.value;
    console.log("Selected vehicle for display:", vehicleId);
    setSelectedVehicleId(vehicleId);
  };
  
  const toggleVehicleSubscription = (vehicleId) => {
    setSubscribedVehicles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
  };

  // Function to select vehicle from either map markers or table
  const handleSelectVehicle = (vehicleId) => {
    setSelectedVehicleId(vehicleId);
  };

  const selectedVehicle = useMemo(() => {
    if (selectedVehicleId && vehicles.has(selectedVehicleId)) {
      return vehicles.get(selectedVehicleId);
    }
    return null;
  }, [selectedVehicleId, vehicles]);

  // Convert vehicles Map to Array for table display
  const vehiclesArray = useMemo(() => {
    return Array.from(vehicles.values());
  }, [vehicles]);

  return (
    <div className="container">
      <div className="dashboard">
        <div className="header">
          <h2>Vehicle Tracking Dashboard</h2>
          <div className="status">
            <span className="status-label">Connection Status: </span>
            <span className={`status-value ${connectionStatus === "Connected" ? "connected" : "error"}`}>
              {connectionStatus}
            </span>
          </div>
          {lastUpdate && (
            <div className="last-update">
              <span className="update-label">Last Update: </span>
              <span className="update-value">{lastUpdate}</span>
            </div>
          )}
        </div>

        <div className="content">
          {/* Subscription controls */}
          <div className="subscription-controls">
            <h3>Vehicle Subscriptions:</h3>
            <button 
              onClick={() => setSubscribedVehicles(new Set(AVAILABLE_VEHICLES))}
              disabled={subscribedVehicles.size === AVAILABLE_VEHICLES.length}
            >
              Subscribe to All
            </button>
            <button 
              onClick={() => setSubscribedVehicles(new Set())}
              disabled={subscribedVehicles.size === 0}
            >
              Unsubscribe from All
            </button>
            <div className="vehicle-checkboxes">
              {AVAILABLE_VEHICLES.map(vehicleId => (
                <div key={vehicleId} className="vehicle-checkbox">
                  <input
                    type="checkbox"
                    id={`subscribe-${vehicleId}`}
                    checked={subscribedVehicles.has(vehicleId)}
                    onChange={() => toggleVehicleSubscription(vehicleId)}
                  />
                  <label htmlFor={`subscribe-${vehicleId}`}>{vehicleId}</label>
                  <span className="connection-indicator">
                    {eventSources[vehicleId]?.readyState === 1 ? 
                      "✓" : eventSources[vehicleId] ? "⟳" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Map display - Show all vehicles */}
          {/* <div className="map-container">
            <h3>Vehicle Map View</h3>
            {isLoaded ? (
              <GoogleMap 
                mapContainerStyle={mapContainerStyle} 
                center={center} 
                zoom={12}
                options={mapOptions}
              >
                {vehiclesArray.map(vehicle => (
                  <Marker
                    key={vehicle.vehicleId}
                    position={{
                      lat: parseFloat(vehicle.latitude),
                      lng: parseFloat(vehicle.longitude),
                    }}
                    onClick={() => handleSelectVehicle(vehicle.vehicleId)}
                    title={`${vehicle.vehicleId} - ${vehicle.checkpoint}`}
                    // Add visual indication of selected vehicle
                    icon={selectedVehicleId === vehicle.vehicleId ? 
                      {
                        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        scaledSize: new window.google.maps.Size(50, 50)
                      } : 
                      undefined}
                  />
                ))}
              </GoogleMap> 
            ) : (
              <div className="map-loading">Loading map...</div>
            )}
          </div> */}

          {/* Vehicle selection dropdown */}
          <div className="vehicle-select">
            <label htmlFor="vehicle-select">Show details for: </label>
            <select 
              id="vehicle-select" 
              onChange={handleVehicleSelect} 
              value={selectedVehicleId || ""}
            >
              <option value="">All Vehicles</option>
              {vehiclesArray.map((vehicle) => (
                <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                  {vehicle.vehicleId}
                </option>
              ))}
            </select>
          </div>

          {/* Selected vehicle details */}
          {selectedVehicle && (
            <div className="vehicle-data">
              <h3>Selected Vehicle Details:</h3>
              <div className="vehicle-info">
                {Object.entries(selectedVehicle).map(([key, value]) => (
                  <p key={key}>
                    <strong>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}: </strong>
                    {value}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Vehicle table - Show all vehicles */}
          {/* <div className="vehicle-table-container">
            <h3>All Vehicles Data</h3>
            <VehicleTable 
              vehicles={vehiclesArray} 
              onSelectVehicle={handleSelectVehicle}
              selectedVehicleId={selectedVehicleId} 
            />
          </div> */}

          {/* Connection debug info */}
          <div className="debug-info">
            <h4>Connection Debug:</h4>
            <ul>
              {Array.from(subscribedVehicles).map(vehicleId => (
                <li key={vehicleId}>
                  {vehicleId}: {eventSources[vehicleId] ? 
                    (eventSources[vehicleId].readyState === 0 ? "Connecting" : 
                     eventSources[vehicleId].readyState === 1 ? "Open" : "Closed") : 
                    "No connection"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Subscriber;