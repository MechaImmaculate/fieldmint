import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import OrgDashboard from "./pages/OrgDashboard";
import ContributorDashboard from "./pages/ContributorDashboard";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import NewCampaign from "./pages/NewCampaign";
import CampaignDetail from "./pages/CampaignDetail";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route index element={<Landing />} />
          <Route path="app" element={<Layout />}>
            <Route element={<RequireAuth />}>
              <Route index element={<Home />} />
              <Route path="contribute" element={<ContributorDashboard />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route element={<RequireAuth role="org" />}>
                <Route path="org" element={<OrgDashboard />} />
                <Route path="campaigns/new" element={<NewCampaign />} />
              </Route>
              <Route element={<RequireAuth role="reviewer" />}>
                <Route path="review" element={<ReviewerDashboard />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}