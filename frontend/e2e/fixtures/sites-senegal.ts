/**
 * Données réelles de sites de forages solaires au Sénégal.
 * Source : tableau de synthèse des données de forages.
 */
export interface SiteSenegal {
  item: number;
  zone: string;
  centre: string;
  site: string;
  lng: number;
  lat: number;
  puissanceKw: number;
}

export const SITES_SENEGAL: SiteSenegal[] = [
  { item: 1, zone: "DKR", centre: "Ptb", site: "Point M 1", lng: -17.46334093, lat: 14.74513189, puissanceKw: 30 },
  { item: 2, zone: "DKR", centre: "Ptb", site: "Fort A Ter", lng: -17.47139804, lat: 14.72796764, puissanceKw: 30 },
  { item: 3, zone: "DKR", centre: "Ptb", site: "Point G 2", lng: -17.45754077, lat: 14.71642797, puissanceKw: 22 },
  { item: 4, zone: "DKR", centre: "Ptb", site: "Camp Leclerc 1", lng: -17.47143689, lat: 14.73333282, puissanceKw: 30 },
  { item: 5, zone: "DKR", centre: "Ptb", site: "Lymodak", lng: -17.45660779, lat: 14.74670457, puissanceKw: 30 },
  { item: 6, zone: "DKB", centre: "Tassette", site: "F2 Tassette", lng: -16.92707818, lat: 14.64812188, puissanceKw: 16 },
  { item: 7, zone: "SALY", centre: "Saly", site: "Saly F2", lng: -17.00389194, lat: 14.44005022, puissanceKw: 22 },
  { item: 8, zone: "NOUEKHOKH", centre: "Nguékhokh", site: "F3 Nuékhokh", lng: -17.00389194, lat: 14.44005022, puissanceKw: 0 },
  { item: 9, zone: "LINGUERE", centre: "Linguere", site: "Linguere F1Bis", lng: -15.11181444, lat: 15.40435638, puissanceKw: 30 },
  { item: 10, zone: "NDIOKH SALL", centre: "Ndiokh Sall", site: "Ndiock Sall F1", lng: -16.26215671, lat: 15.74777542, puissanceKw: 14.5 },
  { item: 11, zone: "NDIOUM", centre: "Ndioum", site: "F1 Bis Ndioum", lng: -14.65366001, lat: 15.50727659, puissanceKw: 22.5 },
  { item: 12, zone: "MATAM", centre: "Matam", site: "Matam F3", lng: -13.25744123, lat: 15.65538964, puissanceKw: 30 },
  { item: 13, zone: "DIOURBEL", centre: "Diourbel", site: "Diourbel F5", lng: -16.23880846, lat: 14.64270608, puissanceKw: 30 },
  { item: 14, zone: "BAMBEY", centre: "Bambey", site: "Bambey F2", lng: -16.45300771, lat: 14.69461036, puissanceKw: 30 },
  { item: 15, zone: "KAOLACK", centre: "Kaolack", site: "Kaolack F2 Bis", lng: -16.08394906, lat: 14.13841853, puissanceKw: 30 },
  { item: 16, zone: "NIORO", centre: "Nioro", site: "Nioro Du Rip F5", lng: -15.78933236, lat: 13.75541601, puissanceKw: 30 },
  { item: 17, zone: "SOKONE", centre: "Sokone", site: "Sokone F2", lng: -16.30659322, lat: 13.87583906, puissanceKw: 10.5 },
  { item: 18, zone: "GUIGUINEO", centre: "Guiguineo", site: "Guinguineo F2", lng: -15.95653778, lat: 14.28130642, puissanceKw: 22 },
  { item: 19, zone: "FATICK", centre: "Fatick", site: "Fatick F2", lng: -16.41108847, lat: 14.33339855, puissanceKw: 30 },
  { item: 20, zone: "KAFRINE", centre: "Kafrine", site: "Kafrine F2", lng: -15.55152492, lat: 14.10070666, puissanceKw: 25 },
  { item: 21, zone: "KOUGUEUL", centre: "Kougueul", site: "Koungheul F2", lng: -14.80023904, lat: 13.96644789, puissanceKw: 30 },
  { item: 22, zone: "BAKEL", centre: "Bakel", site: "Bakel F1", lng: -12.44411282, lat: 14.88820792, puissanceKw: 12.5 },
  { item: 23, zone: "KEDOUGOU", centre: "Kédougou", site: "Kédougou F1", lng: -12.19373721, lat: 12.54932789, puissanceKw: 0 },
  { item: 24, zone: "KEDOUGOU", centre: "Kédougou", site: "Kédougou F6", lng: -12.19373721, lat: 12.54932789, puissanceKw: 5.5 },
  { item: 25, zone: "VELINGARA", centre: "Vélingara", site: "Vélingara F3", lng: -14.11150475, lat: 13.15755058, puissanceKw: 30 },
  { item: 26, zone: "ZIGUINCHOR", centre: "Ziguinchor", site: "Ziguire F2", lng: -16.28514367, lat: 12.57506207, puissanceKw: 8.5 },
  { item: 27, zone: "ZIGUINCHOR", centre: "Ziguinchor", site: "Ziguire F5Bis", lng: -16.26721598, lat: 12.54937071, puissanceKw: 30 },
  { item: 28, zone: "ZIGUINCHOR", centre: "Ziguinchor", site: "Ziguire F6", lng: -16.28469449, lat: 12.56307963, puissanceKw: 30 },
  { item: 29, zone: "ZIGUINCHOR", centre: "Ziguinchor", site: "Ziguire F8", lng: -16.22197527, lat: 12.60246064, puissanceKw: 7 },
  { item: 30, zone: "BIGNONA", centre: "Bignona", site: "Bignona F2", lng: -16.22744118, lat: 12.80880262, puissanceKw: 16 },
  { item: 31, zone: "BIGNONA", centre: "Bignona", site: "Bignona F5", lng: -16.22974673, lat: 12.79012325, puissanceKw: 12.5 },
  { item: 32, zone: "KOLDA", centre: "Kolda", site: "Kolda F1 Ter", lng: -14.97200000, lat: 12.88340000, puissanceKw: 16 },
  { item: 33, zone: "SEDHIOU", centre: "Sédhiou", site: "Sédhiou F2", lng: -15.56667178, lat: 12.70304417, puissanceKw: 13 },
];

/** Sites avec coordonnées GPS valides (lat/lng != 0) */
export const VALID_SITES = SITES_SENEGAL.filter((s) => s.lat !== 0 && s.lng !== 0);

/** Site par défaut pour les tests (Dakar Point M1 - 30kW) */
export const DEFAULT_SITE = SITES_SENEGAL[0];

/** Site à Matam pour tester une autre région */
export const MATAM_SITE = SITES_SENEGAL[11];

/** Site petite puissance (Ziguinchor 7kW) */
export const SMALL_SITE = SITES_SENEGAL[28];
