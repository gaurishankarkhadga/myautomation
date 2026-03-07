import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Connect from './pages/Connect';
import AdvancedSettings from './pages/AdvancedSettings';
import ChatHub from './components/ChatHub';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import DataDeletion from './pages/DataDeletion';
import './App.css';
// Shows connect page if not authenticated, redirects to chat if authenticated
function ConnectOrChat() {
  const instaToken = localStorage.getItem('insta_token');
  const ytChannelId = localStorage.getItem('yt_channel_id');

  // Check URL params (OAuth callback redirects here)
  const params = new URLSearchParams(window.location.search);
  const instaTokenParam = params.get('token');
  const instaUserIdParam = params.get('userId');
  const ytChannelIdParam = params.get('channelId');
  const ytChannelTitleParam = params.get('channelTitle');

  let shouldRedirect = false;

  if (instaTokenParam && instaUserIdParam) {
    localStorage.setItem('insta_token', instaTokenParam);
    localStorage.setItem('insta_user_id', instaUserIdParam);
    shouldRedirect = true;
  }

  if (ytChannelIdParam) {
    localStorage.setItem('yt_channel_id', ytChannelIdParam);
    if (ytChannelTitleParam) localStorage.setItem('yt_channel_title', ytChannelTitleParam);
    shouldRedirect = true;
  }

  if (shouldRedirect) {
    window.history.replaceState({}, document.title, window.location.pathname);
    return <Navigate to="/chat" replace />;
  }

  // If ANY platform is connected, default to chat
  if (instaToken || ytChannelId) {
    return <Navigate to="/chat" replace />;
  }

  // Not authenticated at all — show connect page
  return <Connect />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ConnectOrChat />} />
        <Route path="/chat" element={<ChatHub />} />
        <Route path="/settings" element={<AdvancedSettings />} />

        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
      </Routes>
    </Router>
  );
}

export default App;
