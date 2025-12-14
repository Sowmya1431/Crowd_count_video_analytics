import React from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AnalyticsModal = ({ isOpen = true, onClose = () => {}, analysis = null }) => {
  if (!isOpen || !analysis) return null;

  const labels = (analysis.timestamps && analysis.timestamps.length)
    ? analysis.timestamps.map(t => t.toFixed ? t.toFixed(2) + 's' : String(t))
    : (analysis.counts_per_frame || []).map((_, i) => String(i));

  const counts = analysis.counts_per_frame || [];

  const lineData = {
    labels,
    datasets: [
      {
        label: 'People in Zone',
        data: counts,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 3,
        pointBackgroundColor: '#ef4444'
      },
    ],
  };

  const barData = {
    labels,
    datasets: [
      {
        label: 'People (per sample)',
        data: counts,
        backgroundColor: '#000000',
      }
    ]
  };

  // Dwell time histogram (per-person retention)
  const dwellTimes = Array.isArray(analysis.dwell_times) ? analysis.dwell_times : [];
  let dwellHistogramData = null;
  if (dwellTimes && dwellTimes.length > 0) {
    // Compute bins
    const n = dwellTimes.length;
    const binCount = Math.min(12, Math.max(6, Math.round(Math.sqrt(n))));
    const min = Math.min(...dwellTimes);
    const max = Math.max(...dwellTimes);
    const range = max - min || 1;
    const binSize = range / binCount;

    const bins = new Array(binCount).fill(0);
    dwellTimes.forEach(v => {
      let idx = Math.floor((v - min) / binSize);
      if (idx < 0) idx = 0;
      if (idx >= binCount) idx = binCount - 1;
      bins[idx] += 1;
    });

    const binLabels = bins.map((_, i) => {
      const a = min + i * binSize;
      const b = a + binSize;
      return `${a.toFixed(1)}–${b.toFixed(1)}s`;
    });

    dwellHistogramData = {
      labels: binLabels,
      datasets: [
        {
          label: 'Dwell Time (# people)',
          data: bins,
          backgroundColor: 'rgba(14,165,233,0.85)'
        }
      ]
    };
  }

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#000' } },
      title: { display: true, text: analysis.zone_name || 'Zone Analytics', color: '#000' },
      tooltip: { enabled: true }
    },
    scales: {
      x: { title: { display: true, text: 'Time (s)', color: '#000' }, ticks: { color: '#000' }, grid: { color: 'rgba(0,0,0,0.06)' } },
      y: { title: { display: true, text: 'People', color: '#000' }, ticks: { color: '#000' }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true }
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0 }}>{analysis.zone_name || 'Analytics'}</h3>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{analysis.frames_analyzed} samples • {analysis.duration?.toFixed ? analysis.duration.toFixed(2) + 's' : analysis.duration}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={onClose} style={closeBtnStyle}>Close</button>
          </div>
        </div>

        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr auto', gap: '12px', height: '640px' }}>
          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px' }}>
            <div style={{ height: '100%' }}>
              <Line data={lineData} options={commonOptions} />
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px' }}>
            <div style={{ height: '100%' }}>
              <Bar data={barData} options={commonOptions} />
            </div>
          </div>

          {dwellHistogramData && (
            <div style={{ gridColumn: '1 / -1', background: '#ffffff', padding: '12px', borderRadius: '8px' }}>
              <div style={{ height: '220px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#000' }}>Duration People Stayed Inside Zone (Dwell Time)</h4>
                <Bar data={dwellHistogramData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { title: { display: true, text: 'Dwell (s)', color: '#000' }, ticks: { color: '#000' }, grid: { color: 'rgba(0,0,0,0.06)' } }, y: { title: { display: true, text: 'People', color: '#000' }, ticks: { color: '#000' }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true } }
                }} />
              </div>
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', marginTop: '6px', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div><strong>Peak:</strong> {analysis.peak_count}</div>
              <div><strong>Average:</strong> {analysis.avg_count?.toFixed ? analysis.avg_count.toFixed(2) : analysis.avg_count}</div>
              <div><strong>Total Unique:</strong> {analysis.total_persons_passed}</div>
              <div><strong>Peak Time:</strong> {analysis.peak_time?.toFixed ? analysis.peak_time.toFixed(2) + 's' : analysis.peak_time}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2,6,23,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '20px'
};

const modalStyle = {
  width: 'min(1200px, 96%)',
  maxHeight: '92vh',
  background: '#071029',
  border: '1px solid rgba(255,255,255,0.03)',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 30px 60px rgba(2,6,23,0.6)'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.03)'
};

const closeBtnStyle = {
  background: 'transparent',
  border: '1px solid #fff',
  color: '#fff',
  padding: '6px 10px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  backdropFilter: 'blur(4px)'
};

export default AnalyticsModal;
