import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { LanScanPage } from "./pages/LanScanPage";
import { PortScanPage } from "./pages/PortScanPage";
import { ArpSpoofPage } from "./pages/ArpSpoofPage";
import { BinaryPage } from "./pages/BinaryPage";
import { CtfPage } from "./pages/CtfPage";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lanscan" element={<LanScanPage />} />
          <Route path="/portscan" element={<PortScanPage />} />
          <Route path="/arp-spoof" element={<ArpSpoofPage />} />
          <Route path="/binary" element={<BinaryPage />} />
          <Route path="/ctf" element={<CtfPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
