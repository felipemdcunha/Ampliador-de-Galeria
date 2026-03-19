
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Profile, Organization } from './types';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

// Removed redundant declare global for aistudio to resolve type conflict with existing AIStudio definition in the environment.

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkApiKey();
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else {
        setProfile(null);
        setOrganization(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkApiKey = async () => {
    // Se a chave de API já estiver no ambiente (VITE_GEMINI_API_KEY), ignoramos o seletor manual
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      setHasApiKey(true);
      return;
    }

    try {
      // @ts-ignore - aistudio is provided by the global environment
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    } catch (e) {
      console.error("Erro ao verificar chave de API", e);
    }
  };

  const handleOpenKeySelector = async () => {
    // @ts-ignore - aistudio is provided by the global environment
    await window.aistudio.openSelectKey();
    setHasApiKey(true); // Assume sucesso após abrir o seletor conforme instrução
  };

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (profileData.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          .single();
        if (!orgError) setOrganization(orgData);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do usuário", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f44563]"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <Login />;
  }

  // Se não tiver chave de API selecionada, mostra tela de configuração (obrigatório para Gemini Pro)
  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 text-[#f44563] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuração Necessária</h2>
          <p className="text-gray-600 mb-6 text-sm">
            Para utilizar o <strong>Nano Banana Pro</strong> e gerar imagens de alta qualidade, você precisa selecionar uma chave de API de um projeto com faturamento ativo.
          </p>
          <button
            onClick={handleOpenKeySelector}
            className="w-full bg-[#f44563] hover:bg-[#d63d57] text-white font-bold py-3 px-4 rounded-xl transition duration-200 mb-4"
          >
            Selecionar Chave de API
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Saiba mais sobre faturamento
          </a>
        </div>
      </div>
    );
  }

  return (
    <Dashboard 
      profile={profile} 
      organization={organization} 
    />
  );
};

export default App;
