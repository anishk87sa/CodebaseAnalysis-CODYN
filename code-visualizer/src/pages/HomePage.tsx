import React from 'react';

interface HomePageProps {
  onStart: () => void;
}

export default function HomePage({ onStart }: HomePageProps) {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1 className="app-title">CODYN</h1>
        <p className="app-subtitle">Visualize and understand your code</p>
        <button className="start-button" onClick={onStart}>
          START
        </button>
      </div>
    </div>
  );
}
