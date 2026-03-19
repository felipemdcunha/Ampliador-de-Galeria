
import React, { useState, useRef } from 'react';
import { GeminiService } from '../geminiService';
import { supabase } from '../supabaseClient';
import { GenerationQuality } from '../types';

interface Props {
  developmentId: string;
  orgId: string;
  systemPrompt: string;
  onGenerated: () => void;
}

const IndividualGenerationSection: React.FC<Props> = ({ developmentId, orgId, systemPrompt, onGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [quality, setQuality] = useState<GenerationQuality>('1K');
  const [genType, setGenType] = useState<'humanized' | 'creative_scene'>('humanized');
  const [mode, setMode] = useState<'fast' | 'approval'>('fast');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processGeneration = async (finalPrompt?: string) => {
    if (!file || !developmentId) return;
    setLoading(true);

    const gemini = new GeminiService();
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        if (mode === 'approval' && !finalPrompt) {
          const suggestions = await gemini.suggestPrompts(base64, systemPrompt, genType);
          setSuggestions(suggestions);
          setLoading(false);
          return;
        }

        // 1. Create record with error handling
        const { data: record, error: dbError } = await supabase
          .from('gallery_amplified')
          .insert({
            development_id: developmentId,
            organization_id: orgId,
            original_image_url: 'temp',
            status: 'processing',
            type: genType,
            format: aspectRatio,
            prompt_image_used: finalPrompt || 'Auto-generated fast prompt'
          })
          .select()
          .single();

        if (dbError) {
          console.error("Erro ao inserir registro:", dbError);
          setLoading(false);
          return; 
        }

        if (!record) {
          console.error("Registro não retornado após insert.");
          setLoading(false);
          return;
        }

        // 2. Upload original
        const origFileName = `original_${record.id}.jpg`;
        await supabase.storage.from('amplified-media').upload(origFileName, file);
        const { data: origUrl } = supabase.storage.from('amplified-media').getPublicUrl(origFileName);

        // 3. Generate Amplified Image
        const promptToUse = finalPrompt || (genType === 'humanized' ? 'Realistic humanization of this architectural space with people naturally enjoying the environment' : 'A creative cinematic scene with artistic lighting and people in this space');
        const amplifiedBase64 = await gemini.generateAmplifiedImage(
          base64,
          promptToUse,
          aspectRatio,
          quality
        );

        // 4. Upload amplified
        const ampFileName = `amplified_${record.id}.png`;
        const ampBlobRes = await fetch(amplifiedBase64);
        const ampBlob = await ampBlobRes.blob();
        await supabase.storage.from('amplified-media').upload(ampFileName, ampBlob);
        const { data: ampUrl } = supabase.storage.from('amplified-media').getPublicUrl(ampFileName);

        // 5. Update Record
        await supabase.from('gallery_amplified').update({
          original_image_url: origUrl.publicUrl,
          generated_image_url: ampUrl.publicUrl,
          status: 'completed',
          prompt_image_used: promptToUse
        }).eq('id', record.id);

        setFile(null);
        setSuggestions([]);
        onGenerated();
      };
    } catch (e) {
      console.error("Erro na geração:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload de Imagem</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Formato</label>
          <select 
            value={aspectRatio}
            onChange={(e: any) => setAspectRatio(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 bg-white"
          >
            <option value="16:9">Widescreen (16:9)</option>
            <option value="9:16">Vertical (9:16)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qualidade</label>
          <select 
            value={quality}
            onChange={(e: any) => setQuality(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 bg-white"
          >
            <option value="1K">1K HD</option>
            <option value="2K">2K Quad HD</option>
            <option value="4K">4K Ultra HD</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estilo</label>
          <div className="flex border rounded-lg p-1 bg-gray-50">
            <button 
              onClick={() => setGenType('humanized')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${genType === 'humanized' ? 'bg-[#f44563] text-white' : 'text-gray-500'}`}
            >
              Humanizar
            </button>
            <button 
              onClick={() => setGenType('creative_scene')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${genType === 'creative_scene' ? 'bg-[#f44563] text-white' : 'text-gray-500'}`}
            >
              Cena Criativa
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modo</label>
          <div className="flex border rounded-lg p-1 bg-gray-50">
            <button 
              onClick={() => setMode('fast')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${mode === 'fast' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
            >
              Rápido
            </button>
            <button 
              onClick={() => setMode('approval')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${mode === 'approval' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
            >
              Aprovação
            </button>
          </div>
        </div>

        <button 
          onClick={() => processGeneration()}
          disabled={!file || loading}
          className="bg-[#f44563] text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-[#d63d57] transition disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Gerar Agora'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <h4 className="text-sm font-bold text-gray-700 mb-3">Escolha um dos prompts sugeridos pela IA:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map((s, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border hover:border-[#f44563] cursor-pointer transition flex flex-col justify-between" onClick={() => processGeneration(s)}>
                <p className="text-xs text-gray-600 mb-3 italic">"{s}"</p>
                <span className="text-[10px] font-bold text-[#f44563] uppercase">Aprovar e Gerar</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IndividualGenerationSection;
