
export interface Profile {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  brand_color?: string;
}

export interface Development {
  id: string;
  organization_id: string;
  name: string;
  city: string;
  cover_url?: string;
}

export interface Amenity {
  id: string;
  development_id: string;
  title: string;
}

export interface AmenityImage {
  id: string;
  amenity_id: string;
  url: string;
}

export interface GalleryAmplified {
  id: string;
  development_id: string;
  amenity_id?: string;
  organization_id: string;
  original_image_url: string;
  generated_image_url?: string;
  prompt_image_used?: string;
  type: 'humanized' | 'creative_scene';
  format: '16:9' | '9:16';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface Agent {
  id: string;
  system_prompt: string;
}

export type GenerationQuality = '1K' | '2K' | '4K';
