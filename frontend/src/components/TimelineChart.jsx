import { useEffect, useState } from "react";
import { getTimeline } from "../api/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const TrendIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

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

function TimelineChart() {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTimeline();
        setChartData({
          labels: data.labels || [],
          datasets: [
            {
              label: "Events",
              data: data.values || [],
              borderColor: "#00d2ff",
              backgroundColor: (ctx) => {
                const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
                gradient.addColorStop(0,   "rgba(0,210,255,0.18)");
                gradient.addColorStop(1,   "rgba(0,210,255,0.01)");
                return gradient;
              },
              fill: true,
              tension: 0.45,
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: "#00d2ff",
              pointBorderColor: "#070d1a",
              pointBorderWidth: 2,
              pointHoverRadius: 6,
            },
          ],
        });
      } catch (err) {
        console.error("TimelineChart Error:", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <TrendIcon />
          Event Timeline
        </div>
        <span className="panel-badge">last 6 intervals</span>
      </div>
      <div className="chart-wrap">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default TimelineChart;
