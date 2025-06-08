export interface NuclearPlant {
  id: string;
  name: string;
  location: [number, number];
  description: string;
}

export const NUCLEAR_PLANTS: NuclearPlant[] = [
  {
    id: 'chinshan',
    name: 'Chinshan Nuclear Power Plant (No. 1)',
    location: [25.286, 121.595],
    description: 'Located in Shihmen District, New Taipei City. First nuclear power plant in Taiwan.',
  },
  {
    id: 'kuosheng',
    name: 'Kuosheng Nuclear Power Plant (No. 2)',
    location: [25.211, 121.660],
    description: 'Located in Wanli District, New Taipei City. Second nuclear power plant in Taiwan.',
  },
  {
    id: 'maanshan',
    name: 'Maanshan Nuclear Power Plant (No. 3)',
    location: [21.954, 120.744],
    description: 'Located in Hengchun Township, Pingtung County. Third nuclear power plant in Taiwan.',
  },
  {
    id: 'lungmen',
    name: 'Lungmen Nuclear Power Plant (No. 4)',
    location: [25.022, 121.920],
    description: 'Located in Gongliao District, New Taipei City. Fourth nuclear power plant in Taiwan (never operational).',
  },
]; 