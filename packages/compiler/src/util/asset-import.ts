import path from 'node:path';

export enum AssetType {
  Costume = 'costume',
  Sound = 'sound'
};

const formats: Record<string, AssetType> = {
  svg: AssetType.Costume,
  png: AssetType.Costume,
  jpg: AssetType.Costume,
  jpeg: AssetType.Costume,
  wav: AssetType.Sound,
  mp3: AssetType.Sound
};

export function assetImport (source: string) {
  const dataFormat = path.extname(source).slice(1).toLowerCase();
  if (!source.startsWith('tw:') && Object.hasOwn(formats, dataFormat)) {
    return {
      type: formats[dataFormat],
      dataFormat
    };
  }
}
