
import React, { useState } from 'react';
import { GalleryAmplified } from '../types';
import { GeminiService } from '../geminiService';
import { supabase } from '../supabaseClient';

interface Props {
  item: GalleryAmplified;
  onDelete: (id: string, url?: string) => void;
  onPreview: (item: GalleryAmplified) => void;
  onGenerated: () => void;
  systemPrompt: string;
}

const GalleryItem: React.FC<Props> = ({ item, onDelete, onPreview, onGenerated, systemPrompt }) => {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(item.prompt_image_used || '');
  const [loading, setLoading] = useState(false);

  const handleRegenerate = async () => {
    setLoading(true);
    const gemini = new GeminiService();
    try {
      // Get the original image data (if it's a URL, we need to fetch it as base64 or similar)
      const res = await fetch(item.original_image_url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const newImageUrl = await gemini.generateAmplifiedImage(
          base64,
          editedPrompt,
          item.format === '16:9' ? '16:9' : '9:16',
          '1K'
        );

        // Upload to bucket
        const fileName = `amplified_${Date.now()}.png`;
        const blobRes = await fetch(newImageUrl);
        const finalBlob = await blobRes.blob();
        const { data: uploadData } = await supabase.storage
          .from('amplified-media')
          .upload(fileName, finalBlob);

        const { data: publicUrl } = supabase.storage
          .from('amplified-media')
          .getPublicUrl(fileName);

        // Update DB
        await supabase.from('gallery_amplified').update({
          generated_image_url: publicUrl.publicUrl,
          prompt_image_used: editedPrompt,
          status: 'completed'
        }).eq('id', item.id);

        setIsEditingPrompt(false);
        onGenerated();
      };
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = item.status === 'processing' || item.status === 'pending';

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden group border border-gray-100 flex flex-col">
      <div className="relative aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f44563] mb-2"></div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Processando...</span>
          </div>
        ) : (
          <>
            <img 
              src={item.generated_image_url || item.original_image_url} 
              className="w-full h-full object-cover transition transform duration-500 group-hover:scale-105 cursor-pointer" 
              alt="Ampliada" 
              onClick={() => onPreview(item)}
            />
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onDelete(item.id, item.generated_image_url)}
                className="bg-white/90 p-1.5 rounded-full text-red-500 hover:text-red-700 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
              </button>
            </div>
            <div className="absolute bottom-2 left-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.type === 'humanized' ? 'bg-[#f44563] text-white' : 'bg-purple-600 text-white'}`}>
                {item.type === 'humanized' ? 'Humanizada' : 'Criativa'}
              </span>
            </div>
          </>
        )}
      </div>
      
      <div className="p-3 flex-1 flex flex-col">
        {isEditingPrompt ? (
          <div className="space-y-2">
            <textarea 
              className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-[#f44563]"
              rows={3}
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setIsEditingPrompt(false)}
                className="text-xs text-gray-500 font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleRegenerate}
                disabled={loading}
                className="text-xs bg-[#f44563] text-white px-3 py-1 rounded-md font-semibold disabled:opacity-50"
              >
                {loading ? 'Gerando...' : 'Regerar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 line-clamp-3 mb-3 italic">
              "{item.prompt_image_used || 'Prompt não informado'}"
            </p>
            <div className="mt-auto flex justify-between items-center">
              <span className="text-[10px] text-gray-400">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
              {!isProcessing && (
                <button 
                  onClick={() => setIsEditingPrompt(true)}
                  className="text-xs font-semibold text-[#f44563] hover:underline"
                >
                  Editar Prompt
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GalleryItem;
