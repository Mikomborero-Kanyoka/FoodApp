import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CustomerSignup from './pages/CustomerSignup';
import StaffSignup from './pages/StaffSignup';
import CustomerHistory from './pages/CustomerHistory';
import AdminDashboard from './pages/AdminDashboard';
import BranchDashboard from './pages/BranchDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import CustomerOrder from './pages/CustomerOrder';
import { Sun, Moon } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen transition-colors duration-300">
      <button 
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-primary text-accent hover:opacity-80 transition-all z-50"
      >
        {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
      </button>
      
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<CustomerSignup />} />
          <Route path="/staff/signup" element={<StaffSignup />} />
          <Route path="/history" element={<CustomerHistory />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/branch/:branchId" element={<BranchDashboard />} />
          <Route path="/kitchen/:branchId" element={<KitchenDashboard />} />
          <Route path="/waiter/:branchId" element={<WaiterDashboard />} />
          <Route path="/table/:tableId" element={<CustomerOrder />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
