import { Navigate } from "react-router-dom";
import "./App.css";

const App : React.FC = () => {
  return <Navigate to="/carousel/user/1" replace />;
};

export default App;
