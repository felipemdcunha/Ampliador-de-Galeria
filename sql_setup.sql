
-- ESSAS TABELAS FORAM CRIADAS PELO USUÁRIO, MAS SEGUE A REFERÊNCIA DE ESTRUTURA IDEAL:

/*
CREATE TABLE public.gallery_amplified (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL,
  amenity_id uuid,
  organization_id uuid NOT NULL,
  original_image_url text NOT NULL,
  generated_image_url text,
  prompt_image_used text,
  type text CHECK (type = ANY (ARRAY['humanized'::text, 'creative_scene'::text])),
  format text CHECK (format = ANY (ARRAY['16:9'::text, '9:16'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gallery_amplified_pkey PRIMARY KEY (id),
  CONSTRAINT gallery_amplified_development_id_fkey FOREIGN KEY (development_id) REFERENCES public.developments(id),
  CONSTRAINT gallery_amplified_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.development_amenities(id),
  CONSTRAINT gallery_amplified_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.gallery_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gallery_amplified_id uuid,
  status text DEFAULT 'pending'::text,
  attempts integer DEFAULT 0,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gallery_queue_pkey PRIMARY KEY (id),
  CONSTRAINT gallery_queue_gallery_amplified_id_fkey FOREIGN KEY (gallery_amplified_id) REFERENCES public.gallery_amplified(id)
);
*/

-- BUCKET SETUP:
-- O Bucket 'amplified-media' deve ser criado como público no painel do Supabase Storage.
