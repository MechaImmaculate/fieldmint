import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import RequireAuth from "./components/RequireAuth";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Home from "./pages/Home";
import OrgDashboard from "./pages/OrgDashboard";
import ContributorDashboard from "./pages/ContributorDashboard";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import CampaignsPage from "./pages/CampaignsPage";
import NewCampaign from "./pages/NewCampaign";
import CampaignDetail from "./pages/CampaignDetail";
import WalletPage from "./pages/WalletPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="app" element={<Home />} />

          <Route element={<RequireAuth role="org" />}>
            <Route path="org" element={<Shell role="org" />}>
              <Route index element={<OrgDashboard />} />
              <Route path="campaigns" element={
                <CampaignsPage view="org" base="/org" title="Your campaigns"
                  subtitle="Everything you've created, funded or closed."
                  actionTo="/org/campaigns/new" actionLabel="New campaign" />} />
              <Route path="campaigns/new" element={<NewCampaign />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="wallet" element={<WalletPage role="org" />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="reviewer" />}>
            <Route path="review" element={<Shell role="reviewer" />}>
              <Route index element={<ReviewerDashboard />} />
              <Route path="campaigns" element={
                <CampaignsPage view="review" base="/review" title="Live campaigns"
                  subtitle="Funded campaigns you can review and pay out." />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="wallet" element={<WalletPage role="reviewer" />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="contributor" />}>
            <Route path="contribute" element={<Shell role="contributor" />}>
              <Route index element={<ContributorDashboard />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="wallet" element={<WalletPage role="contributor" />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}