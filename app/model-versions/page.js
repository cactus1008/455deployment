'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ModelVersionsPage() {
  const [versions, setVersions] = useState([]);
  const [retrainingLogs, setRetrainingLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [versionsRes, logsRes] = await Promise.all([
          fetch('/api/model-versions'),
          fetch('/api/retraining-logs'),
        ]);

        const versionsData = await versionsRes.json();
        const logsData = await logsRes.json();

        setVersions(versionsData.versions || []);
        setRetrainingLogs(logsData.logs || []);
        setError('');
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load model data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function startRetraining() {
    setRetraining(true);
    try {
      const response = await fetch('/api/ml/retrain', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        alert('Retraining started! Check back shortly.');
        setTimeout(() => location.reload(), 2000);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to start retraining: ' + err.message);
    } finally {
      setRetraining(false);
    }
  }

  async function deployVersion(versionId) {
    if (!confirm('Deploy this model version to production?')) return;

    try {
      const response = await fetch(`/api/model-versions/${versionId}/deploy`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        alert('Model deployed to production!');
        location.reload();
      } else {
        alert('Deployment failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🤖 Model Versions & Retraining Pipeline</h1>
      <p>Manage fraud detection model versions and automated retraining</p>

      <Link href="/">← Back to Dashboard</Link>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Retraining Controls */}
      <section style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <h2>🔄 Manual Retraining</h2>
        <p>Start training a new model from labeled fraud data</p>
        <button
          onClick={startRetraining}
          disabled={retraining}
          style={{
            padding: '10px 20px',
            backgroundColor: retraining ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: retraining ? 'not-allowed' : 'pointer',
            fontSize: '16px',
          }}
        >
          {retraining ? '⏳ Retraining in progress...' : '▶️ Start Retraining Now'}
        </button>
      </section>

      {/* Model Versions Table */}
      <section style={{ marginTop: '30px' }}>
        <h2>📦 Model Versions</h2>
        {loading ? (
          <p>Loading model versions...</p>
        ) : versions.length === 0 ? (
          <p style={{ color: '#666' }}>No model versions yet. Start retraining to create one.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Version</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Accuracy</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Precision</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Recall</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>F1 Score</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Samples</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Created</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.model_version_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
                        {version.version_name}
                      </code>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '3px',
                          backgroundColor:
                            version.status === 'production'
                              ? '#d4edda'
                              : version.status === 'staged'
                              ? '#fff3cd'
                              : '#e2e3e5',
                          color: '#000',
                          fontWeight: 'bold',
                        }}
                      >
                        {version.status === 'production' && '✓ Production'}
                        {version.status === 'staged' && '⏳ Staged'}
                        {version.status === 'archived' && '📦 Archived'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {version.accuracy ? (version.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {version.precision ? (version.precision * 100).toFixed(2) + '%' : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {version.recall ? (version.recall * 100).toFixed(2) + '%' : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {version.f1_score ? version.f1_score.toFixed(4) : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {version.training_samples || 0}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {new Date(version.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {version.status === 'staged' && (
                        <button
                          onClick={() => deployVersion(version.model_version_id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Deploy
                        </button>
                      )}
                      {version.status === 'production' && (
                        <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Active</span>
                      )}
                      {version.status === 'archived' && (
                        <span style={{ color: '#999' }}>Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Retraining History */}
      <section style={{ marginTop: '30px' }}>
        <h2>📋 Retraining History</h2>
        {retrainingLogs.length === 0 ? (
          <p style={{ color: '#666' }}>No retraining runs yet</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Started</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Completed</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Samples</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Accuracy</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {retrainingLogs.map((log) => (
                  <tr key={log.retraining_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      {new Date(log.started_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {log.completed_at
                        ? new Date(log.completed_at).toLocaleString()
                        : 'In progress...'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '3px',
                          backgroundColor:
                            log.status === 'success'
                              ? '#d4edda'
                              : log.status === 'in_progress'
                              ? '#cfe2ff'
                              : '#f8d7da',
                          color: '#000',
                          fontWeight: 'bold',
                        }}
                      >
                        {log.status === 'success' && '✓ Success'}
                        {log.status === 'in_progress' && '⏳ In Progress'}
                        {log.status === 'failed' && '✗ Failed'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {log.training_samples || 'N/A'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {log.accuracy ? (log.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {log.error_message && (
                        <button
                          onClick={() => setSelectedLog(selectedLog === log ? null : log)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          View Error
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedLog && selectedLog.error_message && (
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
            }}
          >
            <h4>Error Details</h4>
            <pre style={{ overflow: 'auto', maxHeight: '300px' }}>
              {selectedLog.error_message}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
