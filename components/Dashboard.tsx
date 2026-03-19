
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Profile, Organization, Development, GalleryAmplified } from '../types';
import GalleryItem from './GalleryItem';
import BulkGenerationModal from './BulkGenerationModal';
import IndividualGenerationSection from './IndividualGenerationSection';

interface Props {
  profile: Profile;
  organization: Organization | null;
}

const Dashboard: React.FC<Props> = ({ profile, organization }) => {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [gallery, setGallery] = useState<GalleryAmplified[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'humanized' | 'creative_scene'>('all');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{id: string, imageUrl?: string} | null>(null);
  const [previewItem, setPreviewItem] = useState<GalleryAmplified | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchDevelopments();
    fetchSystemPrompt();
  }, [profile]);

  useEffect(() => {
    if (selectedDev) {
      fetchGallery();
      const channel = supabase
        .channel('gallery_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'gallery_amplified', 
          filter: `development_id=eq.${selectedDev.id}` 
        }, () => {
          fetchGallery();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedDev, filterType]);

  const fetchSystemPrompt = async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('system_prompt')
      .eq('id', 'e3b8be9a-042e-445a-8192-d8bf43fba2ca')
      .single();
    if (!error && data) setSystemPrompt(data.system_prompt);
  };

  const fetchDevelopments = async () => {
    // REGRA DE NEGÓCIO: O profile.id do usuário logado é o organization_id na tabela developments
    console.log("Buscando empreendimentos para organization_id:", profile.id);
    const { data, error } = await supabase
      .from('developments')
      .select('*')
      .eq('organization_id', profile.id);

    if (error) {
      console.error("Erro ao buscar empreendimentos:", error);
      return;
    }

    if (data && data.length > 0) {
      setDevelopments(data);
      setSelectedDev(data[0]);
    } else {
      console.warn("Nenhum empreendimento encontrado para o ID:", profile.id);
      setDevelopments([]);
    }
  };

  const fetchGallery = async () => {
    if (!selectedDev) return;

    let query = supabase
      .from('gallery_amplified')
      .select('*')
      .eq('development_id', selectedDev.id)
      .order('created_at', { ascending: false });

    if (filterType !== 'all') {
      query = query.eq('type', filterType);
    }

    const { data, error } = await query;
    if (!error && data) setGallery(data);
  };

  const handleDelete = async (id: string, imageUrl?: string) => {
    setItemToDelete({ id, imageUrl });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      const { id, imageUrl } = itemToDelete;

      if (imageUrl) {
        // Extrair o nome do arquivo da URL. 
        // URLs do Supabase costumam ser: .../storage/v1/object/public/bucket/filename
        const fileName = imageUrl.split('/').pop()?.split('?')[0];
        if (fileName) {
          await supabase.storage.from('amplified-media').remove([fileName]);
        }
      }

      const { error } = await supabase.from('gallery_amplified').delete().eq('id', id);
      if (error) throw error;
      
      if (previewItem?.id === id) setPreviewItem(null);
      fetchGallery();
    } catch (err) {
      console.error("Erro ao excluir imagem:", err);
      // Opcional: mostrar erro para o usuário de forma amigável
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao baixar imagem:", error);
    }
  };

  // O ID da organização real para persistência costuma ser profile.organization_id
  const effectiveOrgId = profile.organization_id || profile.id;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">Ampliador de Galeria</h1>
            <div className="h-6 w-[1px] bg-gray-300 mx-2 hidden md:block"></div>
            <select 
              className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm focus:ring-[#f44563] focus:border-[#f44563]"
              value={selectedDev?.id || ''}
              onChange={(e) => setSelectedDev(developments.find(d => d.id === e.target.value) || null)}
            >
              <option value="">Selecione um Empreendimento</option>
              {developments.map(dev => (
                <option key={dev.id} value={dev.id}>{dev.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-500 mr-4">
              {gallery.length} imagens na galeria
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${filterType === 'all' ? 'bg-white shadow text-[#f44563]' : 'text-gray-600'}`}
              >
                Todas
              </button>
              <button 
                onClick={() => setFilterType('humanized')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${filterType === 'humanized' ? 'bg-white shadow text-[#f44563]' : 'text-gray-600'}`}
              >
                Humanizadas
              </button>
              <button 
                onClick={() => setFilterType('creative_scene')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${filterType === 'creative_scene' ? 'bg-white shadow text-[#f44563]' : 'text-gray-600'}`}
              >
                Cenas Criativas
              </button>
            </div>
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="bg-[#f44563] hover:bg-[#d63d57] text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Nova Ampliação
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto p-4">
          <IndividualGenerationSection 
            developmentId={selectedDev?.id || ''} 
            orgId={effectiveOrgId} 
            systemPrompt={systemPrompt}
            onGenerated={fetchGallery}
          />
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {gallery.map(item => (
            <GalleryItem 
              key={item.id} 
              item={item} 
              onDelete={handleDelete}
              onPreview={setPreviewItem}
              onGenerated={fetchGallery}
              systemPrompt={systemPrompt}
            />
          ))}
          {gallery.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Nenhuma imagem ampliada encontrada.</p>
            </div>
          )}
        </div>
      </main>

      {isBulkModalOpen && (
        <BulkGenerationModal 
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          developments={developments}
          currentDev={selectedDev}
          orgId={effectiveOrgId}
          systemPrompt={systemPrompt}
          onStarted={fetchGallery}
        />
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Excluir Imagem</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Tem certeza que deseja excluir esta imagem permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition shadow-md disabled:opacity-50 flex items-center justify-center"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-10 animate-in fade-in duration-300">
          <button 
            onClick={() => setPreviewItem(null)}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 bg-white/10 rounded-full"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative w-full max-w-5xl flex-1 flex flex-col items-center justify-center gap-6">
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
              <img 
                src={previewItem.generated_image_url || previewItem.original_image_url} 
                className="max-w-full max-h-full object-contain"
                alt="Preview Ampliada"
              />
            </div>

            <div className="w-full text-center space-y-6">
              <p className="text-white/80 text-sm md:text-base italic font-medium max-w-2xl mx-auto px-4">
                "{previewItem.prompt_image_used || 'Prompt não informado'}"
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <button 
                  onClick={() => handleDownload(previewItem.generated_image_url || previewItem.original_image_url, `ampliada_${previewItem.id}.png`)}
                  className="bg-[#f44563] hover:bg-[#d63d57] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar Imagem
                </button>
                <button 
                  onClick={() => handleDelete(previewItem.id, previewItem.generated_image_url)}
                  className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
