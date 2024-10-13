import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [structure, setStructure] = useState(null);
  const [userChoices, setUserChoices] = useState({});
  const [migrationStatus, setMigrationStatus] = useState('');
  const [jsonData, setJsonData] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setStructure(response.data.structure);
        setJsonData(JSON.parse(await file.text()));
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const handleChoiceChange = (path, choice) => {
    setUserChoices(prevChoices => ({
      ...prevChoices,
      [path]: choice
    }));
  };

  const renderStructure = (data, path = '') => {
    if (typeof data !== 'object' || data === null) {
      return <div>{data}</div>;
    }

    return (
      <ul>
        {Object.entries(data).map(([key, value]) => (
          <li key={key}>
            <strong>{key}:</strong>
            <select
              value={userChoices[`${path}/${key}`] || ''}
              onChange={(e) => handleChoiceChange(`${path}/${key}`, e.target.value)}
            >
              <option value="">Select...</option>
              <option value="collection">Collection</option>
              <option value="document">Document</option>
              <option value="field">Field</option>
              <option value="skip">Skip</option>
            </select>
            {renderStructure(value, `${path}/${key}`)}
          </li>
        ))}
      </ul>
    );
  };

  const handleMigration = async () => {
    try {
      setMigrationStatus('Migration in progress...');
      const response = await axios.post('/api/migrate', { jsonData, userChoices });
      setMigrationStatus(response.data.message);
    } catch (error) {
      setMigrationStatus(`Error during migration: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <h1>Firebase Migration Tool</h1>
      <input type="file" accept=".json" onChange={handleFileUpload} />
      {structure ? (
        <>
          <div className="structure">
            <h2>Database Structure</h2>
            {renderStructure(structure)}
          </div>
          <button onClick={handleMigration}>Start Migration</button>
          <div className="status">{migrationStatus}</div>
        </>
      ) : (
        <p>Upload a JSON file to view the structure</p>
      )}
    </div>
  );
}

export default App;