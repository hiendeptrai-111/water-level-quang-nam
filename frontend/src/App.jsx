import { useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Stats from './pages/Stats';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import { API } from './auth.jsx';

export default function App() {
  const [data, setData]           = useState(null);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash]         = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot',          (p) => setData(p));
    socket.on('water-level:update', (p) => {
      setData({ lastUpdated: p.lastUpdated, records: p.records });
      setFlash(true);
      setTimeout(() => setFlash(false), 1800);
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f1f5f9' }}>
      <Navbar connected={connected} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/"          element={<Home    data={data} flash={flash} socket={socketRef.current} />} />
          <Route path="/thong-ke"  element={<Stats />} />
          <Route path="/lich-su"   element={<History />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/admin"     element={<Admin />} />
        </Routes>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0.3; } }
        @keyframes pop {
          0%   { transform: translate(-50%, -20px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        .leaflet-tooltip {
          background: rgba(255,255,255,.95);
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 3px 7px;
          box-shadow: 0 2px 6px rgba(0,0,0,.1);
        }
      `}</style>
    </div>
  );
}
