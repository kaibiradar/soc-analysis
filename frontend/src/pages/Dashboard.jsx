import Header from "../components/Header";
import StatCards from "../components/StatCards";
import AlertTable from "../components/AlertTable";
import MitrePanel from "../components/MitrePanel";
import SeverityChart from "../components/SeverityChart";
import TimelineChart from "../components/TimelineChart";

function Dashboard() {
  return (
    <>
      <Header />
      <div className="container">

        <div>
          <div className="section-label">system metrics</div>
          <StatCards />
        </div>

        <div className="charts-row">
          <TimelineChart />
          <SeverityChart />
        </div>

        <div>
          <div className="section-label">detections</div>
          <AlertTable />
        </div>

        <div>
          <div className="section-label">threat intelligence</div>
          <MitrePanel />
        </div>

      </div>
    </>
  );
}

export default Dashboard;
