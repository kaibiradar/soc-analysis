import { useEffect, useState } from "react";
import { getTimeline } from "../api/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const TrendIcon = () => (
  <svg
    className="panel-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const buildDataset = (labels, values) => ({
  labels,
  datasets: [
    {
      label: "Events",
      data: values,
      borderColor: "#00d2ff",
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(
          0,
          0,
          0,
          ctx.chart.height
        );
        g.addColorStop(0, "rgba(0,210,255,0.22)");
        g.addColorStop(1, "rgba(0,210,255,0.01)");
        return g;
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

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  animation: {
    duration: 400,
  },
  plugins: {
    legend: {
      display: false,
    },
  },
};

function TimelineChart({ liveTimeline }) {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });

  const [error, setError] = useState(null);

  // Initial REST load
  useEffect(() => {
    async function loadTimeline() {
      try {
        const data = await getTimeline();

        setChartData(
          buildDataset(
            data.labels || [],
            data.values || []
          )
        );

        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadTimeline();
    }, 0);

    const timer = setInterval(loadTimeline, 60000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(timer);
    };
  }, []);

  // Live WebSocket updates
  useEffect(() => {
    if (!liveTimeline) return;

    if (
      Array.isArray(liveTimeline.labels) &&
      Array.isArray(liveTimeline.values)
    ) {
      console.log("Timeline Update:", liveTimeline);

      const timeoutId = window.setTimeout(() => {
        setChartData(
          buildDataset(
            [...liveTimeline.labels],
            [...liveTimeline.values]
          )
        );
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [liveTimeline]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <TrendIcon />
          Event Timeline
        </div>

        <span className="panel-badge">
          30-min buckets
        </span>
      </div>

      {error ? (
        <div className="panel-error">
          ⚠ {error}
        </div>
      ) : (
        <div className="chart-wrap">
          <Line
            data={chartData}
            options={OPTIONS}
          />
        </div>
      )}
    </div>
  );
}

export default TimelineChart;