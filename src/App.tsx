import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AgentDesignerScreen } from './components/screens/AgentDesignerScreen'
import { SkillDesignerScreen } from './components/screens/SkillDesignerScreen'
import { WorkloadDesigner } from './components/screens/WorkloadDesigner'
import { CapabilityDesigner } from './components/screens/CapabilityDesigner'
import { Playground } from './components/screens/Playground'
import { EvaluationStudio } from './components/screens/EvaluationStudio'
import { GatewayDesigner } from './components/screens/GatewayDesigner'
import { SecurityDesigner } from './components/screens/SecurityDesigner'

// React Router drives navigation; the draft and platform state live in Zustand stores,
// so screens no longer prop-drill. The Agent Designer is the default landing screen.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agent" replace />} />
        <Route path="/agent" element={<AgentDesignerScreen />} />
        <Route path="/skill" element={<SkillDesignerScreen />} />
        <Route path="/workload" element={<WorkloadDesigner />} />
        <Route path="/capability" element={<CapabilityDesigner />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/evaluation" element={<EvaluationStudio />} />
        <Route path="/gateway" element={<GatewayDesigner />} />
        <Route path="/security" element={<SecurityDesigner />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>
    </Routes>
  )
}
