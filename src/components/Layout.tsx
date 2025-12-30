import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users, Briefcase, User as UserIcon, LayoutDashboard, Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const canViewUsers = profile?.role && ['ADMINISTRADOR', 'GERENTE', 'SUPERVISOR'].includes(profile.role);
  const canViewTeams = profile?.role && ['ADMINISTRADOR', 'GERENTE', 'SUPERVISOR', 'VENDEDOR', 'ADESIONISTA'].includes(profile.role);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/users', label: 'Usuários', icon: Users, show: canViewUsers },
    { path: '/teams', label: 'Equipes', icon: Briefcase, show: canViewTeams },
    { path: '/profile', label: 'Meu Perfil', icon: UserIcon, show: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4 md:space-x-8">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
              <div className="flex items-center">
                <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
                <span className="ml-2 text-lg sm:text-xl font-bold text-slate-800">Adesao+</span>
              </div>
              <div className="hidden md:flex space-x-1">
                {menuItems.map((item) => item.show && (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-900">{profile?.name}</div>
                <div className="text-xs text-slate-500">{profile?.role}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center px-2 sm:px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              <div className="px-3 py-2 border-b border-slate-200 mb-2">
                <div className="text-sm font-medium text-slate-900">{profile?.name}</div>
                <div className="text-xs text-slate-500">{profile?.role}</div>
              </div>
              {menuItems.map((item) => item.show && (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
