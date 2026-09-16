import { useState } from 'react'

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export default function FolderSelector({ onFolderSelected }: FolderSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  
  const handleSelectClick = async () => {
    try {
      const path = await window.codeVisualizer.repository.selectFolder()
      if (path) {
        setSelectedPath(path)
        onFolderSelected(path)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  return (
    <div className="folder-selector">
      <div className="folder-selector-label">Repository folder</div>
      <div className="path-display">
        {selectedPath || '/path/to/project'}
      </div>
      <button className="select-button" onClick={handleSelectClick}>
        Select Folder
      </button>
    </div>
  )
}
