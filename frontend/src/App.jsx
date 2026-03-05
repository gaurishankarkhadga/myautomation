import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import InstagramTest from './InstagramTest';
import YouTubeTest from './YouTubeTest';
import ChatHub from './components/ChatHub';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import DataDeletion from './pages/DataDeletion';
import './App.css';

// ==================== AUTH-AWARE ROOT COMPONENT ====================
// Shows connect page if not authenticated, redirects to chat if authenticated
function ConnectOrChat() {
  const token = localStorage.getItem('insta_token');
  const userId = localStorage.getItem('insta_user_id');

  // Also check URL params (OAuth callback redirects here with token)
  const params = new URLSearchParams(window.location.search);
  const tokenParam = params.get('token');
  const userIdParam = params.get('userId');

  if (tokenParam && userIdParam) {
    // Just arrived from OAuth — save and redirect to chat
    localStorage.setItem('insta_token', tokenParam);
    localStorage.setItem('insta_user_id', userIdParam);
    window.history.replaceState({}, document.title, window.location.pathname);
    return <Navigate to="/chat" replace />;
  }

  if (token && userId) {
    return <Navigate to="/chat" replace />;
  }

  // Not authenticated — show connect page
  return <InstagramTest />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ConnectOrChat />} />
        <Route path="/chat" element={<ChatHub />} />
        <Route path="/settings" element={<InstagramTest />} />
        <Route path="/youtube" element={<YouTubeTest />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
      </Routes>
    </Router>
  );
}

export default App;
