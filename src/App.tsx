import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Campaigns from "./pages/Campaigns";
import NewCampaign from "./pages/NewCampaign";
import CampaignDetail from "./pages/CampaignDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Campaigns />} />
          <Route path="campaigns/new" element={<NewCampaign />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}