// import React, { useEffect, useState, useMemo } from "react";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import VehicleTable from "./VehicleDataTable";
// import "./App.css";

// const SSE_SERVER_URL = "http://localhost:3000/events";
// const libraries = ["places"];

// function App() {
//   const [vehicles, setVehicles] = useState(new Map());
//   const [selectedVehicleId, setSelectedVehicleId] = useState(null);
//   const [connectionStatus, setConnectionStatus] = useState("Connecting...");
//   const [lastUpdate, setLastUpdate] = useState(null);

//   const { isLoaded } = useJsApiLoader({
//     id: "google-map-script",
//     googleMapsApiKey: "AIzaSyD7rqUpTzUpEbxm-Xc7ikltFJGzOhd92Qk",
//     libraries,
//   });

//   const mapContainerStyle = {
//     width: "100%",
//     height: "400px",
//   };

//   const center = useMemo(() => {
//     if (selectedVehicleId && vehicles.has(selectedVehicleId)) {
//       const vehicle = vehicles.get(selectedVehicleId);
//       return { lat: parseFloat(vehicle.latitude), lng: parseFloat(vehicle.longitude) };
//     }

//     const visibleVehicles = Array.from(vehicles.values());
//     if (visibleVehicles.length > 0) {
//       return { lat: parseFloat(visibleVehicles[0].latitude), lng: parseFloat(visibleVehicles[0].longitude) };
//     }

//     // Default center (NYC)
//     return { lat: 40.7128, lng: -74.006 };
//   }, [vehicles, selectedVehicleId]);

//   useEffect(() => {
//     let eventSource;

//     const connectSSE = () => {
//       console.log("Attempting to connect to SSE server...");
//       setConnectionStatus("Connecting...");

//       eventSource = new EventSource(SSE_SERVER_URL);

//       eventSource.onopen = () => {
//         console.log("SSE Connection opened");
//         setConnectionStatus("Connected");
//       };

//       eventSource.onmessage = (event) => {
//         console.log("Raw SSE message:", event.data);
//         try {
//           const data = JSON.parse(event.data);
//           console.log("Parsed SSE data:", data);

//           if (data.type === "vehicleUpdate") {
//             setVehicles((prev) => {
//               const newMap = new Map(prev);
//               newMap.set(data.vehicleId, {
//                 vehicleId: data.vehicleId,
//                 latitude: data.position.latitude,
//                 longitude: data.position.longitude,
//                 direction: data.position.direction,
//                 speed: data.position.speed,
//                 checkpoint: data.position.checkpoint,
//                 nextCheckpoint: data.position.nextCheckpoint,
//                 timestamp: data.timestamp,
//               });
//               return newMap;
//             });
//           }
//         } catch (error) {
//           console.error("Error processing SSE data:", error);
//           console.log("Raw data that caused error:", event.data);
//         }
//       };

//       eventSource.onerror = (error) => {
//         console.error("SSE connection error:", error);
//         setConnectionStatus("Connection Error - Retrying...");

//         if (eventSource) {
//           eventSource.close();
//         }

//         setTimeout(connectSSE, 5000);
//       };
//     };

//     connectSSE();

//     return () => {
//       if (eventSource) {
//         console.log("Closing SSE connection");
//         eventSource.close();
//       }
//     };
//   }, []);

//   const handleVehicleSelect = (event) => {
//     const vehicleId = event.target.value;
//     console.log("Selected vehicle:", vehicleId);
//     setSelectedVehicleId(vehicleId);
//   };

//   const visibleVehicles = useMemo(() => {
//     if (selectedVehicleId) {
//       return vehicles.has(selectedVehicleId) ? [vehicles.get(selectedVehicleId)] : [];
//     }
//     return Array.from(vehicles.values());
//   }, [vehicles, selectedVehicleId]);

//   const selectedVehicle = useMemo(() => {
//     if (selectedVehicleId && vehicles.has(selectedVehicleId)) {
//       return vehicles.get(selectedVehicleId);
//     }
//     return null;
//   }, [selectedVehicleId, vehicles]);

//   return (
//     <div className="container">
//       <div className="dashboard">
//         <div className="header">
//           <div className="status">
//             <span className="status-label">Connection Status: </span>
//             <span className={`status-value ${connectionStatus === "Connected" ? "connected" : "error"}`}>
//               {connectionStatus}
//             </span>
//           </div>
//           {lastUpdate && (
//             <div className="last-update">
//               <span className="update-label">Last Update: </span>
//               <span className="update-value">{lastUpdate}</span>
//             </div>
//           )}
//         </div>

//         <div className="content">
//           <div className="vehicle-select">
//             <label htmlFor="vehicle-select">Select Vehicle: </label>
//             <select id="vehicle-select" onChange={handleVehicleSelect} value={selectedVehicleId || ""}>
//               <option value="">All Vehicles</option>
//               {Array.from(vehicles.values()).map((vehicle) => (
//                 <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
//                   {vehicle.vehicleId}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="vehicle-data">
//             <h3>Vehicle Details:</h3>
//             {selectedVehicle ? (
//               <div className="vehicle-info">
//                 {Object.entries(selectedVehicle).map(([key, value]) => (
//                   <p key={key}>
//                     <strong>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}: </strong>
//                     {value}
//                   </p>
//                 ))}
//               </div>
//             ) : (
//               <div className="no-vehicle">
//                 {vehicles.size === 0 ? "Waiting for vehicle updates..." : "Select a vehicle to view details"}
//               </div>
//             )}
//           </div>

//           <VehicleTable vehicles={Array.from(vehicles.values())} onSelectVehicle={handleVehicleSelect} selectedVehicleId={selectedVehicleId} />

//           {/* <div className="map-container">
//             {isLoaded ? (
//               <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={14}>
//                 {visibleVehicles.map((vehicle) => (
//                   <Marker
//                     key={vehicle.vehicleId}
//                     position={{
//                       lat: parseFloat(vehicle.latitude),
//                       lng: parseFloat(vehicle.longitude),
//                     }}
//                     onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
//                     title={`${vehicle.vehicleId} - ${vehicle.checkpoint}`}
//                   />
//                 ))}
//               </GoogleMap>
//             ) : (
//               <div className="map-loading">Loading map...</div>
//             )}
//           </div> */}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;
