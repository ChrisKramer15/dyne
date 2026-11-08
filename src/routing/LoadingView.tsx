import Backdrop from '../shared/Backdrop'

export function LoadingView() {
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

export default LoadingView
