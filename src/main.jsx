import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Subscriber from "./Subscriber.jsx";
import VehicleTracker from "./VehicleTrack.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <>
      {/* <Subscriber /> */}
      <VehicleTracker/>
    </>
  </StrictMode>
);
