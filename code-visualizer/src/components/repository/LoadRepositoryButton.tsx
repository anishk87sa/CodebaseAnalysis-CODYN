import React from 'react';

interface LoadRepositoryButtonProps {
  onClick: () => void;
}

export default function LoadRepositoryButton({ onClick }: LoadRepositoryButtonProps) {
  return (
    <button className="load-repo-button" onClick={onClick}>
      Load Repository
    </button>
  );
}
