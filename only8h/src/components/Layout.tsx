import { Scale, FilePlus, History, LogOut, ChevronRight, LayoutDashboard, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Page } from '../App'

interface LayoutProps {
  user: User
  currentPage: Page
  onNavigate: (page: Page) => void
  children: React.ReactNode
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-1 ${
        active
          ? 'bg-[#2B58C4] text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {active && (
        <ChevronRight className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      )}
    </button>
  )
}

export default function Layout({ user, currentPage, onNavigate, children }: LayoutProps) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const displayName = user.email?.split('@')[0] ?? 'Usuario'

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col"
        aria-label="Navegación principal"
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 w-8 h-8 bg-[#2B58C4] rounded-lg flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <span className="text-base font-bold text-[#2B58C4] tracking-tight">ONLY8H</span>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">RUA Abogados</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Menú principal">
          <NavItem
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Inicio"
            active={currentPage === 'dashboard'}
            onClick={() => onNavigate('dashboard')}
          />

          <p className="px-3 mt-4 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Análisis
          </p>
          <NavItem
            icon={<FilePlus className="w-4 h-4" />}
            label="Nuevo análisis"
            active={currentPage === 'new-analysis'}
            onClick={() => onNavigate('new-analysis')}
          />
          <NavItem
            icon={<History className="w-4 h-4" />}
            label="Historial"
            active={currentPage === 'history'}
            onClick={() => onNavigate('history')}
          />

          <p className="px-3 mt-4 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Ajustes
          </p>
          <NavItem
            icon={<Settings className="w-4 h-4" />}
            label="Configuración"
            active={currentPage === 'settings'}
            onClick={() => onNavigate('settings')}
          />
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-7 h-7 rounded-full bg-[#2B58C4]/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <span className="text-xs font-semibold text-[#2B58C4]">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
