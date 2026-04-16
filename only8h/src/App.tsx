import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import NewAnalysisPage from './pages/NewAnalysisPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

export type Page = 'dashboard' | 'new-analysis' | 'history' | 'settings'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setUser(session?.user ?? null)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <Layout user={user} currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard'    && <DashboardPage onNavigate={setCurrentPage} />}
      {currentPage === 'new-analysis' && <NewAnalysisPage user={user} />}
      {currentPage === 'history'      && <HistoryPage user={user} />}
      {currentPage === 'settings'     && <SettingsPage user={user} />}
    </Layout>
  )
}
