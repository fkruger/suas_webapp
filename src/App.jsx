// src/App.jsx
import React from 'react';
import SUASUploader from './components/SUASUploader';

export default function App() {
  return <SUASUploader />;
}

// src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
