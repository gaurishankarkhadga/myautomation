import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InstagramTest from './InstagramTest';
import YouTubeTest from './YouTubeTest';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import DataDeletion from './pages/DataDeletion';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<InstagramTest />} />
        <Route path="/youtube" element={<YouTubeTest />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
      </Routes>
    </Router>
  );
}

export default App;
