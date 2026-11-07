import { useState } from 'react'
import { RouterProvider } from 'react-router'
import './App.css'
import { AuthProvider } from './auth/AuthProvider'
import { createAppRouter } from './routing/routes'

type AppProps = {
  client?: React.ComponentProps<typeof AuthProvider>['client']
  router?: ReturnType<typeof createAppRouter>
}

function App({ client, router }: AppProps = {}) {
  // Created once per App instance so navigation state survives re-renders.
  const [appRouter] = useState(() => router ?? createAppRouter())

  return (
    <AuthProvider client={client}>
      <RouterProvider router={appRouter} />
    </AuthProvider>
  )
}

export default App
