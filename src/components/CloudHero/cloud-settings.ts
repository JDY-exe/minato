import profiles from './cloud-settings.json';

export type CloudSettings = {
  shading: 'auto' | 'shadows' | 'highlights';
  exposure: number; contrast: number; gamma: number; density: number; minimum: number; pixelSize: number;
  ink: string | null;
};
export const cloudProfiles = profiles as Record<'light' | 'dark', CloudSettings>;
