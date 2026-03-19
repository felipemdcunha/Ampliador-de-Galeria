
import React, { useState, useEffect } from 'react';
import { Development, Amenity, AmenityImage, GenerationQuality } from '../types';
import { supabase } from '../supabaseClient';
import { GeminiService } from '../geminiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  developments: Development[];
  currentDev: Development | null;
  orgId: string;
  systemPrompt: string;
  onStarted: () => void;
}

const BulkGenerationModal: React.FC<Props> = ({ isOpen, onClose, developments, currentDev, orgId, systemPrompt, onStarted }) => {
  const [step, setStep] = useState(1);
  const [selectedDevId, setSelectedDevId] = useState(currentDev?.id || '');
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [includeHumanized, setIncludeHumanized] = useState(true);
  const [includeCreative, setIncludeCreative] = useState(true);
  const [qtyHuman, setQtyHuman] = useState(1);
  const [qtyCreative, setQtyCreative] = useState(3);
  const [formats, setFormats] = useState<string[]>(['16:9']);
  const [quality, setQuality] = useState<GenerationQuality>('1K');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (selectedDevId) fetchAmenities();
  }, [selectedDevId]);

  const fetchAmenities = async () => {
    const { data } = await supabase.from('development_amenities').select('*').eq('development_id', selectedDevId);
    if (data) setAmenities(data);
  };

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    const gemini = new GeminiService();

    try {
      const { data: amenityImages, error: fetchError } = await supabase
        .from('development_amenity_images')
        .select('*')
        .in('amenity_id', selectedAmenities);

      if (fetchError) throw fetchError;

      if (!amenityImages || amenityImages.length === 0) {
        console.warn("Nenhuma imagem encontrada nas áreas comuns selecionadas.");
        setIsGenerating(false);
        return;
      }

      let count = 0;
      for (const img of amenityImages) {
        const tasks: { type: 'humanized' | 'creative_scene'; count: number }[] = [];
        if (includeHumanized) tasks.push({ type: 'humanized', count: qtyHuman });
        if (includeCreative) tasks.push({ type: 'creative_scene', count: qtyCreative });

        for (const task of tasks) {
          for (let i = 0; i < task.count; i++) {
            for (const format of formats) {
              const { data: record, error: insertError } = await supabase.from('gallery_amplified').insert({
                development_id: selectedDevId,
                amenity_id: img.amenity_id,
                organization_id: orgId,
                original_image_url: img.url,
                status: 'pending',
                type: task.type,
                format: format as any
              }).select().single();

              if (insertError) {
                console.error("Erro na fila de geração (RLS ou DB):", insertError);
                continue; 
              }

              if (record) {
                count++;
                onStarted();
                processInApp(record.id, img.url, task.type, format as any, gemini);
              }
            }
          }
        }
      }

      if (count > 0) {
        onClose();
      } else {
        console.error("Falha ao iniciar geração. Verifique as permissões de banco de dados (RLS).");
      }
    } catch (e: any) {
      console.error("Erro no processo em lote:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const processInApp = async (recordId: string, originalUrl: string, type: string, format: string, gemini: GeminiService) => {
    try {
      await supabase.from('gallery_amplified').update({ status: 'processing' }).eq('id', recordId);

      const res = await fetch(originalUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const suggestedPrompts = await gemini.suggestPrompts(base64, systemPrompt, type as any);
          const prompt = suggestedPrompts[0] || `Beautiful high quality ${type} real estate visualization`;
          const generatedBase64 = await gemini.generateAmplifiedImage(base64, prompt, format as any, quality);
          
          const fileName = `bulk_${recordId}_${Date.now()}.png`;
          const gBlobRes = await fetch(generatedBase64);
          const gBlob = await gBlobRes.blob();
          await supabase.storage.from('amplified-media').upload(fileName, gBlob);
          const { data: finalUrl } = supabase.storage.from('amplified-media').getPublicUrl(fileName);

          await supabase.from('gallery_amplified').update({
            generated_image_url: finalUrl.publicUrl,
            prompt_image_used: prompt,
            status: 'completed'
          }).eq('id', recordId);
          
          onStarted();
        } catch (genErr) {
          console.error("Erro durante processamento da imagem:", genErr);
          await supabase.from('gallery_amplified').update({ status: 'failed' }).eq('id', recordId);
          onStarted();
        }
      };
    } catch (e) {
      await supabase.from('gallery_amplified').update({ status: 'failed' }).eq('id', recordId);
      console.error(e);
      onStarted();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#f44563] text-white">
          <h3 className="text-xl font-bold">Nova Ampliação em Lote</h3>
          <button onClick={onClose} className="hover:rotate-90 transition transform duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <label className="block font-bold text-gray-700">1. Selecione o Empreendimento</label>
              <select 
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-[#f44563]"
                value={selectedDevId}
                onChange={(e) => setSelectedDevId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {developments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div className="flex justify-end">
                <button 
                  disabled={!selectedDevId}
                  onClick={() => setStep(2)}
                  className="bg-[#f44563] text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block font-bold text-gray-700">2. Quais áreas comuns quer incluir?</label>
              <div className="grid grid-cols-2 gap-3">
                {amenities.map(a => (
                  <label key={a.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${selectedAmenities.includes(a.id) ? 'border-[#f44563] bg-red-50' : 'hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox"
                      checked={selectedAmenities.includes(a.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedAmenities([...selectedAmenities, a.id]);
                        else setSelectedAmenities(selectedAmenities.filter(id => id !== a.id));
                      }}
                      className="w-5 h-5 accent-[#f44563]"
                    />
                    <span className="text-sm font-medium">{a.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(1)} className="text-gray-500 font-bold">Voltar</button>
                <button 
                  disabled={selectedAmenities.length === 0}
                  onClick={() => setStep(3)}
                  className="bg-[#f44563] text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block font-bold text-gray-700">3. Configurações de Geração</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeHumanized} onChange={e => setIncludeHumanized(e.target.checked)} className="accent-[#f44563] w-5 h-5"/>
                    <span className="text-sm">Humanizar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeCreative} onChange={e => setIncludeCreative(e.target.checked)} className="accent-[#f44563] w-5 h-5"/>
                    <span className="text-sm">Cena Criativa</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {includeHumanized && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd Humanizadas / Imagem</label>
                    <input type="number" value={qtyHuman} onChange={e => setQtyHuman(parseInt(e.target.value))} className="w-full border p-2 rounded-lg" min="1" max="10"/>
                  </div>
                )}
                {includeCreative && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd Cenas Criativas / Imagem</label>
                    <input type="number" value={qtyCreative} onChange={e => setQtyCreative(parseInt(e.target.value))} className="w-full border p-2 rounded-lg" min="1" max="10"/>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-500 uppercase">Formato de Saída</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formats.includes('16:9')} onChange={e => e.target.checked ? setFormats([...formats, '16:9']) : setFormats(formats.filter(f => f !== '16:9'))} className="accent-[#f44563]"/> <span className="text-sm">16:9</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formats.includes('9:16')} onChange={e => e.target.checked ? setFormats([...formats, '9:16']) : setFormats(formats.filter(f => f !== '9:16'))} className="accent-[#f44563]"/> <span className="text-sm">9:16</span></label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resolução (1 opção)</label>
                <select value={quality} onChange={(e: any) => setQuality(e.target.value)} className="w-full border p-2 rounded-lg">
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(2)} className="text-gray-500 font-bold">Voltar</button>
                <button 
                  onClick={handleStartGeneration}
                  disabled={isGenerating || (!includeHumanized && !includeCreative) || formats.length === 0}
                  className="bg-[#f44563] text-white px-8 py-3 rounded-xl font-extrabold shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Iniciando Fila...
                    </>
                  ) : 'GERAR IMAGENS'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkGenerationModal;
