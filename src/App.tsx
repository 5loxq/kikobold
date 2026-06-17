import './index.css';
import './config/i18n';
import { MainLayout } from './components/Layout/MainLayout';
import PerformanceMonitor from './components/Performance/PerformanceMonitor';

function App() {
  return (
    <>
      <MainLayout />
      <PerformanceMonitor />
    </>
  );
}

export default App;
