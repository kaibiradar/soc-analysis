import { useEffect, useState } from "react";
import { getStats } from "../api/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6"  y1="20" x2="6"  y2="14" /><line x1="2"  y1="20" x2="22" y2="20" />
  </svg>
);

const SEV_COLORS = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };

const options = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f2038",
      borderColor: "rgba(0,210,255,0.2)",
      borderWidth: 1,
      titleColor: "#00d2ff",
      bodyColor: "#e2eaf6",
      titleFont: { family: "'JetBrains Mono'", size: 11 },
      bodyFont:  { family: "'JetBrains Mono'", size: 12 },
      padding: 10,
    },
  },
  scales: {
    x: {
      ticks: { color: "#3d5a7a", font: { family: "'JetBrains Mono'", size: 11 } },
      grid:  { color: "rgba(0,210,255,0.04)" },
      border: { color: "rgba(0,210,255,0.1)" },
    },
    y: {
      ticks: { color: "#3d5a7a", font: { family: "'JetBrains Mono'", size: 11 } },
      grid:  { color: "rgba(0,210,255,0.06)" },
      border: { color: "transparent" },
    },
  },
};

function SeverityChart({ liveStats }) {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [error, setError]         = useState(null);

  const buildChart = (sev) => {
    const labels = Object.keys(sev);
    setChartData({
      labels,
      datasets: [{
        label: "Alerts",
        data: Object.values(sev),
        backgroundColor: labels.map((l) => SEV_COLORS[l] ?? "#00d2ff"),
        borderRadius: 5,
        borderSkipped: false,
        barThickness: 36,
      }],
    });
  };

  const fetchData = async () => {
    try {
      const data = await getStats();
      buildChart(data.severity_distribution || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Accept live push
  useEffect(() => {
    if (liveStats?.severity_distribution) {
      buildChart(liveStats.severity_distribution);
    }
  }, [liveStats]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><BarIcon />Severity Distribution</div>
      </div>
      {error
        ? <div className="panel-error">⚠ {error}</div>
        : <div className="chart-wrap"><Bar data={chartData} options={options} /></div>
      }
    </div>
  );
}

export default SeverityChart;
