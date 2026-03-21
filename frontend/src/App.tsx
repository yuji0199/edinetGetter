
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import AnalysisMethods from './pages/AnalysisMethods';
import Portfolios from './pages/Portfolios';
import PortfolioDetail from './pages/PortfolioDetail';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analysis" element={<AnalysisMethods />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="/portfolios/:id" element={<PortfolioDetail />} />
              <Route path="/stocks/:code" element={<StockDetail />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
