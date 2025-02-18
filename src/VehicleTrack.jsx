import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const VehicleTracker = () => {
  const [vehicles, setVehicles] = useState({});
  const [availableVehicles, setAvailableVehicles] = useState([  "V1234995",
    "V1234996",
     "V1234997",
    "V1234998",
    "V1234999",
    "V12349911"
  ]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [eventSource, setEventSource] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [center, setCenter] = useState({ lat: 40.696508, lng: -74.026415 });

  const mapContainerStyle = {
    width: '100%',
    height: '400px',
    marginTop: '20px'
  };

  const connectToSSE = useCallback(() => {
    if (selectedVehicles.length === 0) {
      alert('Please select at least one vehicle');
      return;
    }

    if (eventSource) {
      eventSource.close();
    }

    const sse = new EventSource(`http://localhost:3000/events?vehicleIds=${selectedVehicles.join(',')}`);
    setEventSource(sse);
    setConnectionStatus('Connecting...');

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'connected') {
        setConnectionStatus('Connected');
      } else if (data.vehicleName) {
        setVehicles(prev => ({
          ...prev,
          [data.vehicleName]: {
            ...data,
            lastUpdate: new Date(data.timestamp).toLocaleTimeString()
          }
        }));

        // Update map center to the latest vehicle position
        if (data.location) {
          setCenter({
            lat: data.location.lat,
            lng: data.location.lng
          });
        }
      }
    };

    sse.onerror = () => {
      setConnectionStatus('Error - Reconnecting...');
    };
  }, [selectedVehicles, eventSource]);

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setConnectionStatus('Disconnected');
      setVehicles({});
    }
  };

  const handleVehicleSelection = (vehicleId) => {
    setSelectedVehicles(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(v => v !== vehicleId);
      }
      return [...prev, vehicleId];
    });
  };

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Vehicle Tracking Dashboard</h1>
      
      <div className="mb-4">
        <p className="font-semibold">Connection Status: 
          <span className={`ml-2 ${
            connectionStatus === 'Connected' ? 'text-green-600' : 
            connectionStatus === 'Disconnected' ? 'text-red-600' : 
            'text-yellow-600'
          }`}>
            {connectionStatus}
          </span>
        </p>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Select Vehicles:</h2>
        <div className="flex flex-wrap gap-2">
          {availableVehicles.map(vehicle => (
            <label key={vehicle} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedVehicles.includes(vehicle)}
                onChange={() => handleVehicleSelection(vehicle)}
                className="form-checkbox"
              />
              <span>{vehicle}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4 space-x-4">
        <button
          onClick={connectToSSE}
          disabled={selectedVehicles.length === 0 || connectionStatus === 'Connected'}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Connect
        </button>
        <button
          onClick={disconnect}
          disabled={connectionStatus === 'Disconnected'}
          className="bg-red-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Disconnect
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Vehicle Data:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Vehicle ID</th>
                <th className="border p-2">Speed</th>
                <th className="border p-2">Direction</th>
                <th className="border p-2">Current Checkpoint</th>
                <th className="border p-2">Next Checkpoint</th>
                <th className="border p-2">Location</th>
                <th className="border p-2">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vehicles).map(([vehicleName, data]) => (
                <tr key={vehicleName}>
                  <td className="border p-2">{vehicleName}</td>
                  <td className="border p-2">{data.speed} km/h</td>
                  <td className="border p-2">{data.direction}</td>
                  <td className="border p-2">{data.checkpoint}</td>
                  <td className="border p-2">{data.nextCheckpoint}</td>
                  <td className="border p-2">
                    {data.location ? 
                      `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}` : 
                      'N/A'
                    }
                  </td>
                  <td className="border p-2">{data.lastUpdate}</td>
                </tr>
              ))}
              {Object.keys(vehicles).length === 0 && (
                <tr>
                  <td colSpan="7" className="border p-2 text-center">No data available</td>
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
          {Object.entries(vehicles).map(([vehicleName, data]) => (
            data.location && (
              <Marker
                key={vehicleName}
                position={{
                  lat: data.location.lat,
                  lng: data.location.lng
                }}
                title={`${vehicleName} - ${data.checkpoint}`}
              />
            )
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default VehicleTracker;