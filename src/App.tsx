import './App.css'
import Backdrop from './Backdrop'
import Homepage from './Homepage'
import { LandingView } from './LandingPage'
import { useAuthState } from './auth/useAuthState'
import { selectView } from './viewRouter'

function LoadingView() {
  return (
    <div className="landing">
      <Backdrop />
      <main className="landing-main">
        <p className="loading" role="status">
          Loading…
        </p>
      </main>
    </div>
  )
}

function App() {
  const auth = useAuthState()
  const view = selectView(auth)

  if (view === 'loading') return <LoadingView />
  if (view === 'home' && auth.status === 'authenticated') {
    return <Homepage userMetadata={auth.userMetadata} />
  }
  return <LandingView auth={auth} />
}

export default App
