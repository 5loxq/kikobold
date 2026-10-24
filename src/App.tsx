import './index.css';
import './config/i18n';
import { MainLayout } from './components/Layout/MainLayout';
import { UpdateToast } from './components/common/UpdateToast';

function App(): JSX.Element {
  return (
    <>
      <MainLayout />
      <UpdateToast />
    </>
  );
}

export default App;
